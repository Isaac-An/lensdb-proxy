import { onObjectFinalized } from "firebase-functions/v2/storage";
import { setGlobalOptions } from "firebase-functions/v2";
import { logger } from "firebase-functions";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import crypto from "crypto";

const EXPECTED_BUCKET = "studio-3861763439-b3374.firebasestorage.app";
setGlobalOptions({ region: "asia-east1", memory: "1GiB" });

function initAdmin() {
  if (!getApps().length) initializeApp();
}

function loadPdfParse(): any {
  const tryRequire = (mod: string) => { try { return require(mod); } catch { return null; } };
  const a = tryRequire("pdf-parse/dist/pdf-parse.cjs");
  if (typeof a === "function") return a;
  const b = tryRequire("pdf-parse/dist/pdf-parse.js");
  if (typeof b === "function") return b;
  const c = tryRequire("pdf-parse");
  if (typeof c === "function") return c;
  if (c && typeof c.default === "function") return c.default;
  throw new Error("pdf-parse not callable");
}

const pdfParse = loadPdfParse();

async function getFirebaseDownloadUrl(bucket: string, filePath: string): Promise<string> {
  const file = getStorage().bucket(bucket).file(filePath);
  const [meta] = await file.getMetadata();
  const metaAny = meta as any;
  let token = metaAny?.metadata?.firebaseStorageDownloadTokens || metaAny?.firebaseStorageDownloadTokens;
  if (!token) {
    token = crypto.randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  }
  const firstToken = String(token).split(",")[0].trim();
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media&token=${firstToken}`;
}

async function getPdfText(bucket: string, filePath: string): Promise<string> {
  const file = getStorage().bucket(bucket).file(filePath);
  const [buf] = await file.download();
  const data = await pdfParse(buf);
  return (data.text || "").replace(/-\n/g, "").replace(/[ \t]+/g, " ").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function pickRelevantText(pdfText: string, maxLen: number): string {
  const text = pdfText || "";
  if (!text) return "";
  const keys = ["EFL","FNO","F/#","FOV","Image Circle","CRA","Chief Ray","Distortion","Relative Illumination","Mount","Structure","TTL","Total Track"];
  const lower = text.toLowerCase();
  const chunks: string[] = [];
  keys.forEach((k) => {
    const idx = lower.indexOf(k.toLowerCase());
    if (idx >= 0) chunks.push(text.slice(Math.max(0, idx - 2200), Math.min(text.length, idx + 2200)));
  });
  return (chunks.length > 0 ? [...new Set(chunks)].join("\n\n") : text).slice(0, maxLen);
}

export const onLensPdfUploaded = onObjectFinalized(
  { bucket: EXPECTED_BUCKET, secrets: ["GEMINI_API_KEY"] },
  async (event) => {
    initAdmin();
    const filePath = event.data.name || "";
    const bucket = event.data.bucket;

    if (!filePath.endsWith(".pdf")) {
      logger.info("Not a PDF, skipping", { filePath });
      return;
    }

    logger.info("Processing PDF", { filePath, bucket });
    const db = getFirestore();
    const safeId = filePath.replace(/[^a-zA-Z0-9]/g, "_");
    const docRef = db.collection("products").doc(safeId);

    try {
      await docRef.set({ sourcePath: filePath, extractionStatus: "processing", updatedAt: new Date() }, { merge: true });

      const pdfUrl = await getFirebaseDownloadUrl(bucket, filePath);
      const fullText = await getPdfText(bucket, filePath);
      const relevantText = pickRelevantText(fullText, 12000);

      const apiKey = process.env.GEMINI_API_KEY;
      logger.info("Gemini API key present", { hasKey: !!apiKey, keyLength: apiKey?.length });

      const prompt = `You are a precise optical lens data extractor. Extract ALL the following fields from this lens datasheet text. Return ONLY a valid JSON object with no markdown, no code fences, no explanation. Just the raw JSON:
{
  "name": "product name/model",
  "sensorSize": "sensor size string",
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

Datasheet text:
${relevantText}`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const aiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      const aiData = await aiResponse.json() as any;
      logger.info("Gemini HTTP status", { status: aiResponse.status });
      logger.info("Gemini raw response", { raw: JSON.stringify(aiData).slice(0, 1000) });

      if (!aiResponse.ok) {
        throw new Error(`Gemini API error ${aiResponse.status}: ${JSON.stringify(aiData)}`);
      }

      const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      logger.info("Gemini text output", { rawText: rawText.slice(0, 500) });

      const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`No JSON in AI response. Raw: ${rawText.slice(0, 300)}`);

      const parsed = JSON.parse(jsonMatch[0]);
      const lensData = {
        ...parsed,
        id: safeId,
        pdfUrl,
        sourcePath: filePath,
        extractionStatus: "extracted",
        updatedAt: new Date(),
        createdAt: new Date(),
        debug_pdfText_sample: fullText.slice(0, 500),
        debug_aiRaw: rawText.slice(0, 1000),
      };

      await docRef.set(lensData, { merge: true });
      logger.info("Lens extracted successfully", { filePath, name: parsed.name });

    } catch (err: any) {
      logger.error("Extraction failed", { filePath, error: err.message });
      await docRef.set({ extractionStatus: "failed", debug_error: err.message, updatedAt: new Date() }, { merge: true });
    }
  }
);
