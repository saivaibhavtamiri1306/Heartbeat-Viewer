import { Router, type IRouter } from "express";

const router: IRouter = Router();

const MAX_TEXT_LENGTH = 2000;

let ttsModule: typeof import("@workspace/integrations-openai-ai-server/audio") | null = null;

async function getTTS() {
  if (!ttsModule) {
    ttsModule = await import("@workspace/integrations-openai-ai-server/audio");
  }
  return ttsModule;
}

router.post("/tts", async (req, res) => {
  try {
    const { text, voice } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text is required" });
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      res.status(400).json({ error: `text exceeds max length of ${MAX_TEXT_LENGTH}` });
      return;
    }

    const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
    const selectedVoice = validVoices.includes(voice) ? voice : "nova";

    const { textToSpeech } = await getTTS();
    const audioBuffer = await textToSpeech(text, selectedVoice, "mp3");

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length.toString());
    res.send(audioBuffer);
  } catch (err: any) {
    console.error("TTS error:", err?.message || err);
    res.status(500).json({ error: "TTS generation failed" });
  }
});

export default router;
