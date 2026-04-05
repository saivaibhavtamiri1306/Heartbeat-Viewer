import OpenAI from "openai";

const MAX_TEXT_LENGTH = 2000;

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== "string") {
      return Response.json({ error: "text is required" }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return Response.json({ error: `text exceeds max length of ${MAX_TEXT_LENGTH}` }, { status: 400 });
    }

    const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    const selectedVoice = validVoices.includes(voice) ? voice : "nova";

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
      voice: selectedVoice,
      input: text,
      response_format: "mp3",
    });

    const arrayBuffer = await mp3Response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("TTS error:", err?.message || err);
    return Response.json({ error: "TTS generation failed", detail: err?.message }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
};

export const config = {
  path: "/api/tts",
};
