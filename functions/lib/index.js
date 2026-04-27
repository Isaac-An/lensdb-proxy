"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSheetSync = exports.onLensPdfUploaded = void 0;
const storage_1 = require("firebase-functions/v2/storage");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const firebase_functions_1 = require("firebase-functions");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_2 = require("firebase-admin/storage");
const crypto_1 = __importDefault(require("crypto"));
const EXPECTED_BUCKET = "studio-3861763439-b3374.firebasestorage.app";
(0, v2_1.setGlobalOptions)({ region: "asia-east1", memory: "1GiB" });
function initAdmin() {
    if (!(0, app_1.getApps)().length)
        (0, app_1.initializeApp)();
}
function loadPdfParse() {
    const tryRequire = (mod) => { try {
        return require(mod);
    }
    catch (_a) {
        return null;
    } };
    const a = tryRequire("pdf-parse/dist/pdf-parse.cjs");
    if (typeof a === "function")
        return a;
    const b = tryRequire("pdf-parse/dist/pdf-parse.js");
    if (typeof b === "function")
        return b;
    const c = tryRequire("pdf-parse");
    if (typeof c === "function")
        return c;
    if (c && typeof c.default === "function")
        return c.default;
    throw new Error("pdf-parse not callable");
}
const pdfParse = loadPdfParse();
async function getFirebaseDownloadUrl(bucket, filePath) {
    var _a;
    const file = (0, storage_2.getStorage)().bucket(bucket).file(filePath);
    const [meta] = await file.getMetadata();
    const metaAny = meta;
    let token = ((_a = metaAny === null || metaAny === void 0 ? void 0 : metaAny.metadata) === null || _a === void 0 ? void 0 : _a.firebaseStorageDownloadTokens) || (metaAny === null || metaAny === void 0 ? void 0 : metaAny.firebaseStorageDownloadTokens);
    if (!token) {
        token = crypto_1.default.randomUUID();
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    }
    const firstToken = String(token).split(",")[0].trim();
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media&token=${firstToken}`;
}
async function getPdfText(bucket, filePath) {
    const file = (0, storage_2.getStorage)().bucket(bucket).file(filePath);
    const [buf] = await file.download();
    const data = await pdfParse(buf);
    return (data.text || "").replace(/-\n/g, "").replace(/[ \t]+/g, " ").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
function pickRelevantText(pdfText, maxLen) {
    const text = pdfText || "";
    if (!text)
        return "";
    const keys = ["EFL", "FNO", "F/#", "FOV", "Image Circle", "CRA", "Chief Ray", "Distortion", "Relative Illumination", "Mount", "Structure", "TTL", "Total Track"];
    const lower = text.toLowerCase();
    const chunks = [];
    keys.forEach((k) => {
        const idx = lower.indexOf(k.toLowerCase());
        if (idx >= 0)
            chunks.push(text.slice(Math.max(0, idx - 2200), Math.min(text.length, idx + 2200)));
    });
    return (chunks.length > 0 ? [...new Set(chunks)].join("\n\n") : text).slice(0, maxLen);
}
exports.onLensPdfUploaded = (0, storage_1.onObjectFinalized)({ bucket: EXPECTED_BUCKET, secrets: ["GEMINI_API_KEY"] }, async (event) => {
    var _a, _b, _c, _d, _e, _f;
    initAdmin();
    const filePath = event.data.name || "";
    const bucket = event.data.bucket;
    if (!filePath.endsWith(".pdf")) {
        firebase_functions_1.logger.info("Not a PDF, skipping", { filePath });
        return;
    }
    firebase_functions_1.logger.info("Processing PDF", { filePath, bucket });
    const db = (0, firestore_1.getFirestore)();
    const safeId = filePath.replace(/[^a-zA-Z0-9]/g, "_");
    const docRef = db.collection("products").doc(safeId);
    try {
        await docRef.set({ sourcePath: filePath, extractionStatus: "processing", updatedAt: new Date() }, { merge: true });
        const pdfUrl = await getFirebaseDownloadUrl(bucket, filePath);
        const fullText = await getPdfText(bucket, filePath);
        const relevantText = pickRelevantText(fullText, 12000);
        const apiKey = process.env.GEMINI_API_KEY;
        firebase_functions_1.logger.info("Gemini API key present", { hasKey: !!apiKey, keyLength: apiKey === null || apiKey === void 0 ? void 0 : apiKey.length });
        const prompt = `You are a precise optical lens data extractor. This datasheet may describe ONE lens or MULTIPLE lenses for different sensor sizes.

Extract ALL lenses from this datasheet. Return ONLY a valid JSON object with no markdown, no code fences, no explanation. Just the raw JSON:
{
  "lenses": [
    {
      "name": "product name/model",
      "sensorSize": "sensor size string e.g. 1/2.8\"",
      "efl": "focal length in mm as number string",
      "maxImageCircle": "max image circle in mm",
      "fNo": "f-number",
      "fovD": "diagonal FOV in degrees",
      "fovH": "horizontal FOV in degrees",
      "fovV": "vertical FOV in degrees",
      "ttl": "total track length in mm",
      "tvDistortion": "TV distortion percentage",
      "relativeIllumination": "relative illumination percentage",
      "chiefRayAngle": "chief ray angle in degrees",
      "mountType": "mount type",
      "lensStructure": "lens structure",
      "price": null
    }
  ]
}

If the datasheet covers multiple sensor sizes, include one entry per sensor size in the lenses array. If it covers only one lens, the array will have one element.

Datasheet text:
${relevantText}`;
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const aiResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        const aiData = await aiResponse.json();
        firebase_functions_1.logger.info("Gemini HTTP status", { status: aiResponse.status });
        firebase_functions_1.logger.info("Gemini raw response", { raw: JSON.stringify(aiData).slice(0, 1000) });
        if (!aiResponse.ok) {
            throw new Error(`Gemini API error ${aiResponse.status}: ${JSON.stringify(aiData)}`);
        }
        const rawText = ((_e = (_d = (_c = (_b = (_a = aiData === null || aiData === void 0 ? void 0 : aiData.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || "";
        firebase_functions_1.logger.info("Gemini text output", { rawText: rawText.slice(0, 500) });
        const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error(`No JSON in AI response. Raw: ${rawText.slice(0, 300)}`);
        const parsed = JSON.parse(jsonMatch[0]);
        // Multi-lens: array of lenses
        const lensArray = Array.isArray(parsed.lenses) ? parsed.lenses : [parsed];
        if (lensArray.length > 1) {
            // Write staging doc for review
            await docRef.set({
                id: safeId,
                name: ((_f = lensArray[0]) === null || _f === void 0 ? void 0 : _f.name) || safeId,
                pdfUrl,
                sourcePath: filePath,
                extractionStatus: "needs_split_review",
                stagedLenses: lensArray,
                updatedAt: new Date(),
                createdAt: new Date(),
                debug_pdfText_sample: fullText.slice(0, 500),
                debug_aiRaw: rawText.slice(0, 1000),
            }, { merge: true });
            firebase_functions_1.logger.info("Multi-sensor PDF staged for review", { filePath, count: lensArray.length });
        }
        else {
            // Single lens — existing flow
            const lensData = Object.assign(Object.assign({}, lensArray[0]), { id: safeId, pdfUrl, sourcePath: filePath, extractionStatus: "extracted", updatedAt: new Date(), createdAt: new Date(), debug_pdfText_sample: fullText.slice(0, 500), debug_aiRaw: rawText.slice(0, 1000) });
            await docRef.set(lensData, { merge: true });
            firebase_functions_1.logger.info("Lens extracted successfully", { filePath, name: lensArray[0].name });
        }
    }
    catch (err) {
        firebase_functions_1.logger.error("Extraction failed", { filePath, error: err.message });
        await docRef.set({ extractionStatus: "failed", debug_error: err.message, updatedAt: new Date() }, { merge: true });
    }
});
// ─── Sheets → Firestore Sync ───────────────────────────────────────────────
exports.onSheetSync = (0, https_1.onRequest)({ secrets: ["SHEETS_SYNC_SECRET"], timeoutSeconds: 540, memory: "2GiB" }, async (req, res) => {
    initAdmin();
    const secret = process.env.SHEETS_SYNC_SECRET;
    const authHeader = req.headers["x-sync-secret"] || "";
    if (!secret || authHeader !== secret) {
        firebase_functions_1.logger.warn("onSheetSync: unauthorized request");
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: "Missing or empty rows array" });
        return;
    }
    const db = (0, firestore_1.getFirestore)();
    const collection = db.collection("supplier_lenses");
    // 1. Fetch all existing docs (name → id)
    const existingSnap = await collection.select("name").get();
    const existingByName = new Map();
    existingSnap.docs.forEach(doc => {
        const n = (doc.data().name || "").trim();
        if (n)
            existingByName.set(n, doc.id);
    });
    // 2. Incoming names set
    const incomingNames = new Set(rows.map(r => (r.name || "").trim()).filter(Boolean));
    // 3. Delete orphans (in sheet no longer)
    const toDelete = existingSnap.docs.filter(doc => {
        const n = (doc.data().name || "").trim();
        return n && !incomingNames.has(n);
    });
    for (let i = 0; i < toDelete.length; i += 500) {
        const batch = db.batch();
        toDelete.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    // 4. Upsert all rows
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const batch = db.batch();
        for (const row of chunk) {
            const name = (row.name || "").trim();
            if (!name)
                continue;
            const existingId = existingByName.get(name);
            const docRef = existingId ? collection.doc(existingId) : collection.doc();
            batch.set(docRef, Object.assign(Object.assign(Object.assign({}, row), { syncedFromSheet: true, updatedAt: firestore_1.FieldValue.serverTimestamp() }), (existingId ? {} : { createdAt: firestore_1.FieldValue.serverTimestamp() })), { merge: true });
            upserted++;
        }
        await batch.commit();
    }
    // 5. Clear stale sync_conflicts
    const conflictsSnap = await db.collection("sync_conflicts").select().get();
    for (let i = 0; i < conflictsSnap.docs.length; i += 500) {
        const batch = db.batch();
        conflictsSnap.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    firebase_functions_1.logger.info("onSheetSync: complete", { upserted, deleted: toDelete.length });
    res.status(200).json({ ok: true, upserted, deleted: toDelete.length, errors: 0 });
});
//# sourceMappingURL=index.js.map