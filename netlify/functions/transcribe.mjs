import OpenAI, { toFile } from "openai";

function detectAudioFormat(buffer) {
  if (buffer.length < 12) return "unknown";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "wav";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm";
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) return "mp3";
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "mp4";
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return "ogg";
  return "unknown";
}

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
    const contentType = req.headers.get("content-type") || "";
    let audioBuffer;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (!body.audio || typeof body.audio !== "string") {
        return Response.json({ error: "No audio provided. Send base64 audio in JSON body." }, { status: 400 });
      }
      audioBuffer = Buffer.from(body.audio, "base64");
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const formFile = formData.get("file");
      if (!formFile) {
        return Response.json({ error: "No file provided" }, { status: 400 });
      }
      const arrayBuffer = await formFile.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    } else {
      const arrayBuffer = await req.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    }

    if (audioBuffer.length < 100) {
      return Response.json({ error: "Audio too short" }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const detected = detectAudioFormat(audioBuffer);
    const format = (detected === "wav" || detected === "mp3") ? detected : "webm";

    const audioFile = await toFile(audioBuffer, `audio.${format}`);
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    const trimmed = (response.text || "").trim();

    return Response.json({ text: trimmed }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Transcribe error:", err?.message || err);
    return Response.json({ error: "Transcription failed", detail: err?.message }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
};

export const config = {
  path: "/api/transcribe",
};
