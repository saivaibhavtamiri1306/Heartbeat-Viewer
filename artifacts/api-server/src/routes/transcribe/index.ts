import { Router, type IRouter } from "express";
import { Buffer } from "node:buffer";

const router: IRouter = Router();

let audioModule: typeof import("@workspace/integrations-openai-ai-server/audio") | null = null;

async function getAudioModule() {
  if (!audioModule) {
    audioModule = await import("@workspace/integrations-openai-ai-server/audio");
  }
  return audioModule;
}

router.post("/transcribe", async (req, res) => {
  try {
    const { audio } = req.body;
    if (!audio || typeof audio !== "string") {
      res.status(400).json({ error: "audio (base64) is required" });
      return;
    }

    const audioBuffer = Buffer.from(audio, "base64");

    if (audioBuffer.length < 100) {
      res.status(400).json({ error: "Audio too short" });
      return;
    }

    if (audioBuffer.length > 25 * 1024 * 1024) {
      res.status(400).json({ error: "Audio too large (max 25MB)" });
      return;
    }

    const { detectAudioFormat, speechToText } = await getAudioModule();

    const detected = detectAudioFormat(audioBuffer);
    const format = (detected === "wav" || detected === "mp3") ? detected : "webm";

    const text = await speechToText(audioBuffer, format as "wav" | "mp3" | "webm");
    const trimmed = (text || "").trim();

    console.log(`Transcribed (${audioBuffer.length} bytes, ${format}): "${trimmed.slice(0, 100)}"`);

    res.json({ text: trimmed });
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("Transcribe error:", msg);
    res.status(500).json({ error: "Transcription failed" });
  }
});

export default router;
