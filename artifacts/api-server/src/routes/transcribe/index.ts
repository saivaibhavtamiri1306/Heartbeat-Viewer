import { Router, type IRouter } from "express";
import { Buffer } from "node:buffer";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router: IRouter = Router();

let audioModule: typeof import("@workspace/integrations-openai-ai-server/audio") | null = null;

async function getAudioModule() {
  if (!audioModule) {
    audioModule = await import("@workspace/integrations-openai-ai-server/audio");
  }
  return audioModule;
}

router.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    let audioBuffer: Buffer;

    if (req.file) {
      audioBuffer = req.file.buffer;
      console.log(`[Transcribe] Received file upload: ${audioBuffer.length} bytes, mimetype: ${req.file.mimetype}`);
    } else if (req.body?.audio && typeof req.body.audio === "string") {
      audioBuffer = Buffer.from(req.body.audio, "base64");
      console.log(`[Transcribe] Received base64: ${audioBuffer.length} bytes`);
    } else {
      res.status(400).json({ error: "No audio provided. Send file upload or base64 audio." });
      return;
    }

    if (audioBuffer.length < 100) {
      res.status(400).json({ error: "Audio too short" });
      return;
    }

    const { detectAudioFormat, speechToText } = await getAudioModule();

    const detected = detectAudioFormat(audioBuffer);
    const format = (detected === "wav" || detected === "mp3") ? detected : "webm";

    console.log(`[Transcribe] Processing ${audioBuffer.length} bytes as ${format}...`);

    const text = await speechToText(audioBuffer, format as "wav" | "mp3" | "webm");
    const trimmed = (text || "").trim();

    console.log(`[Transcribe] Result: "${trimmed.slice(0, 120)}"`);

    res.json({ text: trimmed });
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[Transcribe] Error:", msg);
    res.status(500).json({ error: "Transcription failed" });
  }
});

export default router;
