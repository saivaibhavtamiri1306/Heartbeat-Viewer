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

    const response = await openai.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice: selectedVoice, format: "mp3" },
      messages: [
        { role: "system", content: "You are an assistant that performs text-to-speech." },
        { role: "user", content: `Repeat the following text verbatim: ${text}` },
      ],
    });

    const audioData = response.choices[0]?.message?.audio?.data ?? "";
    const audioBuffer = Buffer.from(audioData, "base64");

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
    return Response.json({ error: "TTS generation failed" }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
};

export const config = {
  path: "/api/tts",
};
