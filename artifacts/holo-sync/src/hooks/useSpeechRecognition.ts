import { useRef, useState, useCallback, useEffect } from "react";

export interface SpeechAnalytics {
  wpm: number;
  fillerCount: number;
  fillerWords: string[];
  wordCount: number;
  vocabularyScore: number;
  confidenceScore: number;
  transcript: string;
}

export interface SpeechRecognitionData {
  isListening: boolean;
  interimText: string;
  finalText: string;
  analytics: SpeechAnalytics;
  error: string | null;
  supported: boolean;
}

const FILLER_WORDS = [
  "um", "uh", "er", "ah", "like", "basically", "literally",
  "actually", "you know", "i mean", "sort of", "kind of",
  "right", "okay", "so", "well", "anyway", "yeah"
];

function analyzeText(text: string): Pick<SpeechAnalytics, "wpm" | "fillerCount" | "fillerWords" | "wordCount" | "vocabularyScore" | "confidenceScore"> {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  const foundFillers: string[] = [];
  let fillerCount = 0;
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`\\b${filler}\\b`, "gi");
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      foundFillers.push(filler);
      fillerCount += matches.length;
    }
  }

  const meaningfulWords = words.filter(w => w.length > 3 && !FILLER_WORDS.includes(w));
  const uniqueWords = new Set(meaningfulWords);
  const vocabularyScore = meaningfulWords.length > 0
    ? Math.min(100, Math.round((uniqueWords.size / meaningfulWords.length) * 100))
    : 0;

  const avgWPM = wordCount > 0 ? Math.min(180, Math.max(60, Math.round(wordCount * 12))) : 0;

  const fillerRate = wordCount > 0 ? fillerCount / wordCount : 0;
  const confidenceScore = Math.min(100, Math.max(0,
    Math.round(
      (vocabularyScore * 0.4) +
      (Math.min(100, avgWPM) * 0.3) +
      ((1 - Math.min(1, fillerRate * 5)) * 100 * 0.3)
    )
  ));

  return { wpm: avgWPM, fillerCount, fillerWords: foundFillers, wordCount, vocabularyScore, confidenceScore };
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const BASE = import.meta.env.BASE_URL || "/";

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const arrayBuf = await audioBlob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuf).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  const resp = await fetch(`${BASE}api/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: base64 }),
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(errBody.error || `Transcription failed: ${resp.status}`);
  }

  const result = await resp.json();
  return result.text || "";
}

export function useSpeechRecognition() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullTranscriptRef = useRef<string>("");
  const sessionTranscriptRef = useRef<string>("");
  const isActiveRef = useRef(false);
  const processingRef = useRef(false);

  const [data, setData] = useState<SpeechRecognitionData>({
    isListening: false,
    interimText: "",
    finalText: "",
    analytics: {
      wpm: 0, fillerCount: 0, fillerWords: [],
      wordCount: 0, vocabularyScore: 0, confidenceScore: 0, transcript: "",
    },
    error: null,
    supported: true,
  });

  const onResultRef = useRef<((text: string) => void) | null>(null);

  const processChunks = useCallback(async () => {
    if (processingRef.current || chunksRef.current.length === 0) return;
    processingRef.current = true;

    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
    chunksRef.current = [];

    if (blob.size < 1000) {
      processingRef.current = false;
      return;
    }

    try {
      setData(prev => ({ ...prev, interimText: "Transcribing..." }));
      const text = await transcribeAudio(blob);

      if (text && text.trim()) {
        fullTranscriptRef.current += (fullTranscriptRef.current ? " " : "") + text.trim();
        sessionTranscriptRef.current += (sessionTranscriptRef.current ? " " : "") + text.trim();

        if (onResultRef.current) {
          onResultRef.current(fullTranscriptRef.current.trim());
        }

        const combined = sessionTranscriptRef.current;
        const stats = analyzeText(combined);
        setData(prev => ({
          ...prev,
          interimText: "",
          finalText: fullTranscriptRef.current.trim(),
          analytics: { ...stats, transcript: sessionTranscriptRef.current },
          error: null,
        }));
      } else {
        setData(prev => ({ ...prev, interimText: "" }));
      }
    } catch (err: unknown) {
      console.error("Transcription error:", err);
      setData(prev => ({
        ...prev,
        interimText: "",
        error: err instanceof Error ? err.message : "Transcription failed",
      }));
    }

    processingRef.current = false;
  }, []);

  const startListening = useCallback(async (onResult?: (finalText: string) => void) => {
    onResultRef.current = onResult || null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      isActiveRef.current = true;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(100);

      setData(prev => ({ ...prev, isListening: true, error: null }));

      intervalRef.current = setInterval(() => {
        if (!isActiveRef.current) return;
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setTimeout(() => {
            if (isActiveRef.current && streamRef.current) {
              try {
                const newRecorder = new MediaRecorder(streamRef.current, { mimeType });
                mediaRecorderRef.current = newRecorder;
                newRecorder.ondataavailable = (e) => {
                  if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                  }
                };
                newRecorder.start(100);
              } catch {}
            }
          }, 50);
        }
        processChunks();
      }, 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
        setData(prev => ({
          ...prev,
          error: "Microphone access denied — please allow mic permission in your browser settings",
          isListening: false,
        }));
      } else {
        setData(prev => ({
          ...prev,
          error: `Mic error: ${msg}`,
          isListening: false,
        }));
      }
    }
  }, [processChunks]);

  const stopListening = useCallback(async () => {
    isActiveRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (chunksRef.current.length > 0) {
      await processChunks();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setData(prev => ({ ...prev, isListening: false, interimText: "" }));
  }, [processChunks]);

  const clearTranscript = useCallback(() => {
    fullTranscriptRef.current = "";
    sessionTranscriptRef.current = "";
    setData(prev => ({
      ...prev,
      interimText: "",
      finalText: "",
      analytics: { wpm: 0, fillerCount: 0, fillerWords: [], wordCount: 0, vocabularyScore: 0, confidenceScore: 0, transcript: "" },
    }));
  }, []);

  const clearCurrentAnswer = useCallback(() => {
    fullTranscriptRef.current = "";
    setData(prev => ({ ...prev, finalText: "", interimText: "" }));
  }, []);

  useEffect(() => () => {
    isActiveRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, []);

  return {
    data,
    startListening,
    stopListening,
    clearTranscript,
    clearCurrentAnswer,
    supported: true,
  };
}
