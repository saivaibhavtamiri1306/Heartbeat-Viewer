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

const BASE = import.meta.env.BASE_URL || "/";
const RECORD_INTERVAL_MS = 5000;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const base64 = await blobToBase64(audioBlob);

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
  const streamRef = useRef<MediaStream | null>(null);
  const fullTranscriptRef = useRef<string>("");
  const sessionTranscriptRef = useRef<string>("");
  const isActiveRef = useRef(false);
  const processingRef = useRef(false);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

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

  const handleTranscription = useCallback(async (blob: Blob) => {
    if (blob.size < 1000 || processingRef.current) return;
    processingRef.current = true;
    setData(prev => ({ ...prev, interimText: "Transcribing..." }));

    try {
      const text = await transcribeAudio(blob);
      if (text && text.trim()) {
        const cleaned = text.trim();
        fullTranscriptRef.current += (fullTranscriptRef.current ? " " : "") + cleaned;
        sessionTranscriptRef.current += (sessionTranscriptRef.current ? " " : "") + cleaned;

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
      setData(prev => ({ ...prev, interimText: "" }));
    }
    processingRef.current = false;
  }, []);

  const startNewRecording = useCallback(() => {
    if (!streamRef.current || !isActiveRef.current) return;

    const chunks: Blob[] = [];
    const mimeType = mimeTypeRef.current;

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          handleTranscription(blob);
        }
      };

      recorder.start();

      cycleTimerRef.current = setTimeout(() => {
        if (!isActiveRef.current) return;
        if (recorder.state === "recording") {
          recorder.stop();
        }
        if (isActiveRef.current) {
          startNewRecording();
        }
      }, RECORD_INTERVAL_MS);

    } catch (err) {
      console.error("MediaRecorder error:", err);
    }
  }, [handleTranscription]);

  const startListening = useCallback(async (onResult?: (finalText: string) => void) => {
    onResultRef.current = onResult || null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      streamRef.current = stream;

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeTypeRef.current = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeTypeRef.current = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeTypeRef.current = "audio/mp4";
      } else {
        mimeTypeRef.current = "audio/webm";
      }

      isActiveRef.current = true;
      setData(prev => ({ ...prev, isListening: true, error: null }));

      startNewRecording();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      setData(prev => ({
        ...prev,
        error: msg.includes("ermission") || msg.includes("NotAllowed") || msg.includes("denied")
          ? "Microphone access denied — please allow mic permission in your browser"
          : `Mic error: ${msg}`,
        isListening: false,
      }));
    }
  }, [startNewRecording]);

  const stopListening = useCallback(async () => {
    isActiveRef.current = false;

    if (cycleTimerRef.current) {
      clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }

    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    await new Promise(r => setTimeout(r, 200));

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setData(prev => ({ ...prev, isListening: false, interimText: "" }));
  }, []);

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
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    if (recorderRef.current?.state === "recording") {
      try { recorderRef.current.stop(); } catch {}
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
