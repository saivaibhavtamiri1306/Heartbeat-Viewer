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

  return {
    wpm: avgWPM,
    fillerCount,
    fillerWords: foundFillers,
    wordCount,
    vocabularyScore,
    confidenceScore,
  };
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

async function requestMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fullTranscriptRef = useRef<string>("");
  const sessionTranscriptRef = useRef<string>("");
  const [data, setData] = useState<SpeechRecognitionData>({
    isListening: false,
    interimText: "",
    finalText: "",
    analytics: {
      wpm: 0, fillerCount: 0, fillerWords: [],
      wordCount: 0, vocabularyScore: 0, confidenceScore: 0, transcript: "",
    },
    error: null,
    supported: typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  });

  const onResultRef = useRef<((text: string) => void) | null>(null);
  const micPermissionGrantedRef = useRef(false);
  const restartingRef = useRef(false);

  const supported = !!(
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const startListening = useCallback(async (onResult?: (finalText: string) => void) => {
    if (!supported) {
      setData(prev => ({
        ...prev,
        error: "Speech recognition not supported — use Chrome or Edge",
        supported: false,
      }));
      return;
    }

    if (!micPermissionGrantedRef.current) {
      const granted = await requestMicPermission();
      if (!granted) {
        setData(prev => ({
          ...prev,
          error: "Microphone access denied — please allow mic permission and try again",
          isListening: false,
        }));
        return;
      }
      micPermissionGrantedRef.current = true;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    onResultRef.current = onResult || null;
    const rec = new SpeechRec();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let newFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (newFinal) {
        fullTranscriptRef.current += newFinal;
        sessionTranscriptRef.current += newFinal;
        if (onResultRef.current) onResultRef.current(fullTranscriptRef.current.trim());
      }

      const combined = sessionTranscriptRef.current + interim;
      const stats = analyzeText(combined);
      setData(prev => ({
        ...prev,
        interimText: interim,
        finalText: fullTranscriptRef.current.trim(),
        analytics: { ...stats, transcript: sessionTranscriptRef.current },
        error: null,
      }));
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const err = event.error;
      if (err === "not-allowed") {
        setData(prev => ({
          ...prev,
          error: "Microphone blocked — check browser permissions",
          isListening: false,
        }));
        recognitionRef.current = null;
        return;
      }
      if (err === "network") {
        setData(prev => ({
          ...prev,
          error: "Speech recognition needs internet connection",
          isListening: false,
        }));
        return;
      }
      if (err !== "aborted" && err !== "no-speech") {
        setData(prev => ({ ...prev, error: `Mic error: ${err}` }));
      }
    };

    rec.onend = () => {
      if (recognitionRef.current === rec && !restartingRef.current) {
        restartingRef.current = true;
        try {
          setTimeout(() => {
            if (recognitionRef.current === rec) {
              try { rec.start(); } catch {}
            }
            restartingRef.current = false;
          }, 100);
        } catch {
          restartingRef.current = false;
        }
      }
    };

    rec.onstart = () => {
      setData(prev => ({ ...prev, isListening: true, error: null }));
    };

    rec.onaudiostart = () => {
      setData(prev => ({ ...prev, isListening: true, error: null }));
    };

    try {
      rec.start();
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Could not start microphone";
      setData(prev => ({ ...prev, error: errMsg, isListening: false }));
    }
  }, [supported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      restartingRef.current = false;
      try { rec.stop(); } catch {}
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
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      restartingRef.current = false;
      try { rec.stop(); } catch {}
    }
  }, []);

  return {
    data,
    startListening,
    stopListening,
    clearTranscript,
    clearCurrentAnswer,
    supported,
  };
}
