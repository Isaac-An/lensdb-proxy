"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLensPdfUploaded = void 0;
const storage_1 = require("firebase-functions/v2/storage");
const v2_1 = require("firebase-functions/v2");
const firebase_functions_1 = require("firebase-functions");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_2 = require("firebase-admin/storage");
const crypto_1 = __importDefault(require("crypto"));
/**
 * IMPORTANT:
 * Your Storage bucket is the .firebasestorage.app bucket.
 * Your Functions region is asia-east1.
 */
const EXPECTED_BUCKET = "studio-3861763439-b3374.firebasestorage.app";
(0, v2_1.setGlobalOptions)({ region: "asia-east1", memory: "1GiB" });
/**
 * Initialize Admin SDK once.
 */
function initAdmin() {
    if (!(0, app_1.getApps)().length) {
        (0, app_1.initializeApp)();
    }
}
/**
 * Load pdf-parse in a way that works reliably on Node 24.
 * We try a few known entry points.
 * @return {any} A callable pdfParse function.
 */
function loadPdfParse() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const a = safeRequire("pdf-parse/dist/pdf-parse.cjs");
    if (typeof a === "function")
        return a;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const b = safeRequire("pdf-parse/dist/pdf-parse.js");
    if (typeof b === "function")
        return b;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const c = safeRequire("pdf-parse");
    if (typeof c === "function")
        return c;
    if (c && typeof c.default === "function")
        return c.default;
    const keys = c && typeof c === "object" ? Object.keys(c) : [];
    throw new Error("pdf-parse loaded but not callable. keys=" + JSON.stringify(keys));
}
/**
 * Safe require wrapper.
 * @param {string} mod Module path.
 * @return {any} Required module or null.
 */
function safeRequire(mod) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(mod);
    }
    catch (e) {
        firebase_functions_1.logger.info("safeRequire failed", { mod });
        return null;
    }
}
const pdfParse = loadPdfParse();
firebase_functions_1.logger.info("pdf-parse loaded", {
    type: typeof pdfParse,
});
/**
 * Build a stable token-based Firebase Storage download URL.
 * @param {string} bucket Bucket name.
 * @param {string} filePath Object path.
 * @return {Promise<string>} Public download URL.
 */
async function getFirebaseDownloadUrl(bucket, filePath) {
    var _a;
    const file = (0, storage_2.getStorage)().bucket(bucket).file(filePath);
    const [meta] = await file.getMetadata();
    const metaAny = meta;
    let token = ((_a = metaAny === null || metaAny === void 0 ? void 0 : metaAny.metadata) === null || _a === void 0 ? void 0 : _a.firebaseStorageDownloadTokens) ||
        (metaAny === null || metaAny === void 0 ? void 0 : metaAny.firebaseStorageDownloadTokens);
    if (!token) {
        token = crypto_1.default.randomUUID();
        await file.setMetadata({
            metadata: { firebaseStorageDownloadTokens: token },
        });
    }
    const firstToken = String(token).split(",")[0].trim();
    const encodedPath = encodeURIComponent(filePath);
    return [
        "https://firebasestorage.googleapis.com/v0/b/",
        bucket,
        "/o/",
        encodedPath,
        "?alt=media&token=",
        firstToken,
    ].join("");
}
/**
 * Extract PDF text from Storage.
 * @param {string} bucket Bucket name.
 * @param {string} filePath Object path.
 * @return {Promise<string>} Extracted text.
 */
async function getPdfText(bucket, filePath) {
    const file = (0, storage_2.getStorage)().bucket(bucket).file(filePath);
    const [buf] = await file.download();
    const data = await pdfParse(buf);
    const text = (data.text || "")
        .replace(/-\n/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return text;
}
/**
 * Pick relevant snippets instead of full PDF.
 * @param {string} pdfText Full PDF text.
 * @param {number} maxLen Max length.
 * @return {string} Reduced text.
 */
function pickRelevantText(pdfText, maxLen) {
    const text = pdfText || "";
    if (!text)
        return "";
    const keys = [
        "EFL",
        "FNO",
        "F/#",
        "FOV",
        "Image Circle",
        "CRA",
        "Chief Ray",
        "Distortion",
        "Relative Illumination",
        "Mount",
        "Structure",
        "TTL",
        "Total Track",
    ];
    const lower = text.toLowerCase();
    const chunks = [];
    keys.forEach((k) => {
        const idx = lower.indexOf(k.toLowerCase());
        if (idx >= 0) {
            const start = Math.max(0, idx - 2200);
            const end = Math.min(text.length, idx + 2200);
            chunks.push(text.slice(start, end));
        }
    });
    const joined = chunks.length ? chunks.join("\n\n---\n\n") : text;
    return joined.slice(0, maxLen);
}
/**
 * Normalize text for parsing.
 * @param {string} s Input.
 * @return {string} Normalized.
 */
function normalizeText(s) {
    if (!s)
        return "";
    return s
        .replace(/\u2212/g, "-")
        .replace(/\u00D7/g, "x")
        .replace(/[°]/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\r/g, "")
        .trim();
}
/**
 * Parse a number from a string (first numeric token).
 * @param {string} value Input.
 * @return {number|undefined} Parsed number.
 */
function parseNumber(value) {
    if (!value)
        return undefined;
    const v = normalizeText(value).replace(/%/g, "");
    const m = v.match(/-?\d+(\.\d+)?/);
    if (!m)
        return undefined;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : undefined;
}
/**
 * Parse key:value lines with optional variant blocks.
 * @param {string} aiRaw Raw text output.
 * @return {VariantData[]} Parsed variants.
 */
function parseVariantsFromAi(aiRaw) {
    const raw = normalizeText(aiRaw);
    if (!raw)
        return [];
    const lines = raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const variants = [];
    let current = null;
    const globals = {};
    let insideVariant = false;
    lines.forEach((line) => {
        if (/^variant\s*:/i.test(line)) {
            if (current && Object.keys(current).length)
                variants.push(current);
            const sensorLabel = line.split(":").slice(1).join(":").trim();
            current = { sensorSize: sensorLabel };
            insideVariant = true;
            return;
        }
        if (/^end_variant/i.test(line)) {
            if (current && Object.keys(current).length)
                variants.push(current);
            current = null;
            insideVariant = false;
            return;
        }
        const sep = line.indexOf(":");
        if (sep <= 0)
            return;
        const key = line.slice(0, sep).trim();
        const val = line.slice(sep + 1).trim();
        if (insideVariant && current) {
            current[key] = val;
        }
        else {
            globals[key] = val;
        }
    });
    if (current && Object.keys(current).length)
        variants.push(current);
    if (!variants.length) {
        if (!Object.keys(globals).length)
            return [];
        return [globals];
    }
    return variants.map((v) => (Object.assign(Object.assign({}, globals), v)));
}
/**
 * Map AI keys to Firestore fields.
 * @param {VariantData} parsed Parsed data.
 * @param {string} partNumber Part number.
 * @return {Record<string, unknown>} Firestore fields.
 */
function mapToFields(parsed, partNumber) {
    const out = {};
    if (parsed.sensorSize)
        out.sensorSize = normalizeText(parsed.sensorSize);
    const map = {
        efl_mm: "efl",
        fno: "fNo",
        max_image_circle_mm: "maxImageCircle",
        fov_h_deg: "fovH",
        fov_v_deg: "fovV",
        fov_d_deg: "fovD",
        ttl_mm: "ttl",
        mount_type: "mountType",
        lens_structure: "lensStructure",
        relative_illumination_pct: "relativeIllumination",
        cra_deg: "chiefRayAngle",
    };
    Object.entries(parsed).forEach(([k, v]) => {
        const field = map[k];
        if (!field)
            return;
        const numeric = [
            "efl",
            "fNo",
            "maxImageCircle",
            "fovH",
            "fovV",
            "fovD",
            "ttl",
            "relativeIllumination",
            "chiefRayAngle",
        ].includes(field);
        out[field] = numeric ? parseNumber(v) : normalizeText(v);
    });
    if (parsed.distortion_type && parsed.distortion_value) {
        const t = normalizeText(parsed.distortion_type);
        const val = normalizeText(parsed.distortion_value);
        out.tvDistortion = `(${t}) ${val}`;
    }
    else if (parsed.distortion_value) {
        out.tvDistortion = normalizeText(parsed.distortion_value);
    }
    if (partNumber.startsWith("AE-ZLM")) {
        out["Motorized zoom lens"] = normalizeText(parsed.motorized_zoom_lens || "");
    }
    else {
        out["Motorized zoom lens"] = "No";
    }
    return out;
}
/**
 * Call Gemini via REST. Requires GOOGLE_API_KEY secret mapped to env.
 * @param {string} prompt Prompt text.
 * @return {Promise<string>} Model output text.
 */
async function callGemini(prompt) {
    var _a, _b, _c, _d, _e;
    const apiKey = process.env.GOOGLE_API_KEY || "";
    if (!apiKey) {
        throw new Error("Missing GOOGLE_API_KEY in function environment.");
    }
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
        "gemini-1.5-pro:generateContent?key=" +
        apiKey;
    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
    };
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(("Gemini HTTP " + res.status + ": " + t).slice(0, 500));
    }
    const json = (await res.json());
    const text = ((_e = (_d = (_c = (_b = (_a = json === null || json === void 0 ? void 0 : json.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || "";
    return String(text);
}
/**
 * Storage trigger: upload PDF, extract specs, write to Firestore.
 */
exports.onLensPdfUploaded = (0, storage_1.onObjectFinalized)({ bucket: EXPECTED_BUCKET, region: "asia-east1" }, async (event) => {
    initAdmin();
    const bucket = event.data.bucket;
    const filePath = event.data.name;
    if (!bucket || !filePath)
        return;
    if (bucket !== EXPECTED_BUCKET)
        return;
    if (!filePath.startsWith("lens-pdfs/"))
        return;
    if (!filePath.toLowerCase().endsWith(".pdf"))
        return;
    const fileName = filePath.split("/").pop();
    if (!fileName)
        return;
    const partNumber = fileName.replace(/\.pdf$/i, "");
    const db = (0, firestore_1.getFirestore)();
    let pdfUrl = "";
    let pdfText = "";
    let aiRaw = "";
    try {
        pdfUrl = await getFirebaseDownloadUrl(bucket, filePath);
        pdfText = await getPdfText(bucket, filePath);
        const relevant = pickRelevantText(pdfText, 14000);
        if (!relevant || relevant.length < 50) {
            throw new Error("PDF text too short after extraction.");
        }
        const prompt = [
            "Extract lens specifications from the text below.",
            "Output ONLY plain text lines: key: value",
            "Use ONLY these keys exactly:",
            "efl_mm, fno, max_image_circle_mm, fov_h_deg, fov_v_deg, fov_d_deg,",
            "ttl_mm, mount_type, lens_structure, relative_illumination_pct,",
            "cra_deg, distortion_type, distortion_value, motorized_zoom_lens.",
            "",
            "Rules:",
            "- For numeric keys output numbers only (no units).",
            "- If a value is not present, omit the line.",
            "- If multiple sensor variants exist, output blocks:",
            "variant: <sensor label>",
            "fov_h_deg: ...",
            "fov_v_deg: ...",
            "fov_d_deg: ...",
            "end_variant",
            "",
            "Part Number: " + partNumber,
            "",
            "PDF Text:",
            relevant,
        ].join("\n");
        aiRaw = await callGemini(prompt);
        const variants = parseVariantsFromAi(aiRaw);
        if (!variants.length) {
            throw new Error("AI returned no parsable key:value lines.");
        }
        const mapped = mapToFields(variants[0], partNumber);
        await db.collection("lenses").doc(partNumber).set(Object.assign(Object.assign({ name: partNumber, pdfUrl, sourcePath: filePath, extractionStatus: "extracted", updatedAt: firestore_1.FieldValue.serverTimestamp(), createdAt: firestore_1.FieldValue.serverTimestamp() }, mapped), { debug_aiRaw: aiRaw, debug_pdfText_sample: pdfText.substring(0, 2000) }), { merge: true });
        firebase_functions_1.logger.info("Lens extracted", { partNumber, filePath });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.collection("lenses").doc(partNumber).set({
            name: partNumber,
            pdfUrl,
            sourcePath: filePath,
            extractionStatus: "failed",
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            debug_aiRaw: aiRaw,
            debug_pdfText_sample: pdfText.substring(0, 2000),
            debug_error: msg,
        }, { merge: true });
        firebase_functions_1.logger.error("Lens extraction failed", { partNumber, msg });
    }
});
//# sourceMappingURL=index.js.map