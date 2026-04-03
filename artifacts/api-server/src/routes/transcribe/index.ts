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

    const { openai, detectAudioFormat } = await getAudioModule();
    const { toFile } = await import("openai");

    const detected = detectAudioFormat(audioBuffer);
    const ext = detected === "unknown" ? "webm" : detected;
    const file = await toFile(audioBuffer, `audio.${ext}`);

    const response = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });

    res.json({ text: (response.text || "").trim() });
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("Transcribe error:", msg);
    res.status(500).json({ error: "Transcription failed" });
  }
});

export default router;
