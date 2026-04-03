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
    const contentType = req.headers["content-type"] || "";
    let audioBuffer: Buffer;

    if (contentType.includes("application/json")) {
      const { audio, format } = req.body;
      if (!audio) {
        res.status(400).json({ error: "audio data is required" });
        return;
      }
      audioBuffer = Buffer.from(audio, "base64");
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      audioBuffer = Buffer.concat(chunks);
    }

    if (audioBuffer.length < 100) {
      res.status(400).json({ error: "Audio too short" });
      return;
    }

    if (audioBuffer.length > 25 * 1024 * 1024) {
      res.status(400).json({ error: "Audio too large (max 25MB)" });
      return;
    }

    const { ensureCompatibleFormat, speechToText } = await getAudioModule();

    const { buffer: compatBuffer, format: detectedFormat } = await ensureCompatibleFormat(audioBuffer);
    const text = await speechToText(compatBuffer, detectedFormat);

    res.json({ text: text.trim() });
  } catch (err: any) {
    console.error("Transcribe error:", err?.message || err);
    res.status(500).json({ error: "Transcription failed" });
  }
});

export default router;
