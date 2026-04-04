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
  audioLevel: number;
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
const RECORD_INTERVAL_MS = 6000;

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");

  const resp = await fetch(`${BASE}api/transcribe`, {
    method: "POST",
    body: formData,
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [data, setData] = useState<SpeechRecognitionData>({
    isListening: false,
    interimText: "",
    finalText: "",
    audioLevel: 0,
    analytics: {
      wpm: 0, fillerCount: 0, fillerWords: [],
      wordCount: 0, vocabularyScore: 0, confidenceScore: 0, transcript: "",
    },
    error: null,
    supported: true,
  });

  const onResultRef = useRef<((text: string) => void) | null>(null);

  const handleTranscription = useCallback(async (blob: Blob) => {
    if (processingRef.current) {
      console.log(`[Speech] Skipped — still processing previous chunk`);
      return;
    }
    if (blob.size < 500) {
      console.log(`[Speech] Skipped tiny blob: ${blob.size} bytes`);
      return;
    }
    processingRef.current = true;
    console.log(`[Speech] Sending ${blob.size} bytes (${blob.type}) for transcription`);

    try {
      const text = await transcribeAudio(blob);
      console.log(`[Speech] Got back: "${text}"`);
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
      }
    } catch (err: unknown) {
      console.error("Transcription error:", err);
      setData(prev => ({ ...prev, error: err instanceof Error ? err.message : "Transcription failed" }));
    }
    processingRef.current = false;
  }, []);

  const startNewRecording = useCallback(() => {
    if (!streamRef.current || !isActiveRef.current) return;

    const chunks: Blob[] = [];
    const mimeType = mimeTypeRef.current;

    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          console.log(`[Speech] Chunk received: ${e.data.size} bytes`);
        }
      };

      recorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          console.log(`[Speech] Recording stopped, total blob: ${blob.size} bytes from ${chunks.length} chunks`);
          handleTranscription(blob);
        } else {
          console.log(`[Speech] Recording stopped but no chunks collected`);
        }
      };

      recorder.onerror = (e) => {
        console.error("[Speech] MediaRecorder error:", e);
      };

      recorder.start(1000);
      console.log(`[Speech] Recording started (${mimeType}), state: ${recorder.state}`);

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
      console.error("[Speech] MediaRecorder create error:", err);
      setData(prev => ({ ...prev, error: `Recorder error: ${err}` }));
    }
  }, [handleTranscription]);

  const startListening = useCallback(async (onResult?: (finalText: string) => void) => {
    onResultRef.current = onResult || null;

    try {
      console.log("[Speech] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      const tracks = stream.getAudioTracks();
      console.log(`[Speech] Got ${tracks.length} audio track(s):`, tracks.map(t => ({
        label: t.label, enabled: t.enabled, muted: t.muted,
        settings: t.getSettings?.() || "N/A",
      })));

      try {
        const actx = new AudioContext();
        const source = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = actx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        levelIntervalRef.current = setInterval(() => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(dataArray);
          let maxAmplitude = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const amplitude = Math.abs(dataArray[i] - 128);
            if (amplitude > maxAmplitude) maxAmplitude = amplitude;
          }
          const level = Math.min(100, Math.round((maxAmplitude / 128) * 100));
          setData(prev => {
            if (Math.abs(prev.audioLevel - level) < 2) return prev;
            return { ...prev, audioLevel: level };
          });
        }, 150);
      } catch (e) {
        console.warn("[Speech] AudioContext setup failed (non-critical):", e);
      }

      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      let foundType = "audio/webm";
      for (const t of supportedTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          foundType = t;
          break;
        }
      }
      mimeTypeRef.current = foundType;
      console.log(`[Speech] Using MIME type: ${foundType}`);

      isActiveRef.current = true;
      setData(prev => ({ ...prev, isListening: true, error: null, audioLevel: 0 }));

      startNewRecording();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      console.error("[Speech] getUserMedia failed:", msg);
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

    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setData(prev => ({ ...prev, isListening: false, interimText: "", audioLevel: 0 }));
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
    if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
    if (recorderRef.current?.state === "recording") {
      try { recorderRef.current.stop(); } catch {}
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
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
