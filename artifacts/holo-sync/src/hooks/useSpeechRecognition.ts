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

interface IWebkitSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onaudiostart: (() => void) | null;
}

function getSpeechRecognition(): (new () => IWebkitSpeechRecognition) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<IWebkitSpeechRecognition | null>(null);
  const fullTranscriptRef = useRef<string>("");
  const sessionTranscriptRef = useRef<string>("");
  const isActiveRef = useRef(false);
  const restartingRef = useRef(false);
  const onResultRef = useRef<((text: string) => void) | null>(null);

  const SpeechRecClass = getSpeechRecognition();
  const isSupported = SpeechRecClass !== null;

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
    supported: isSupported,
  });

  const startListening = useCallback(async (onResult?: (finalText: string) => void) => {
    if (!SpeechRecClass) {
      setData(prev => ({ ...prev, error: "Speech recognition not supported. Use Google Chrome.", supported: false }));
      return;
    }

    onResultRef.current = onResult || null;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("[Speech] Google Speech Recognition started");
      setData(prev => ({ ...prev, isListening: true, error: null, audioLevel: 50 }));
    };

    recognition.onaudiostart = () => {
      console.log("[Speech] Audio capture started");
      setData(prev => ({ ...prev, audioLevel: 60 }));
    };

    recognition.onspeechstart = () => {
      console.log("[Speech] Speech detected");
      setData(prev => ({ ...prev, audioLevel: 80 }));
    };

    recognition.onspeechend = () => {
      console.log("[Speech] Speech ended");
      setData(prev => ({ ...prev, audioLevel: 30 }));
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalChunk) {
        const cleaned = finalChunk.trim();
        if (cleaned) {
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
            audioLevel: 80,
            analytics: { ...stats, transcript: sessionTranscriptRef.current },
            error: null,
          }));
        }
      }

      if (interim) {
        setData(prev => ({ ...prev, interimText: interim, audioLevel: 70 }));
      }
    };

    recognition.onerror = (event: any) => {
      const errType = event.error;
      console.error("[Speech] Recognition error:", errType);

      if (errType === "aborted") return;

      if (errType === "no-speech") {
        setData(prev => ({ ...prev, audioLevel: 10 }));
        if (isActiveRef.current && !restartingRef.current) {
          restartingRef.current = true;
          setTimeout(() => {
            restartingRef.current = false;
            if (isActiveRef.current && recognitionRef.current) {
              try { recognitionRef.current.start(); } catch {}
            }
          }, 300);
        }
        return;
      }

      if (errType === "not-allowed" || errType === "permission-denied") {
        setData(prev => ({
          ...prev,
          error: "Microphone access denied — please allow mic permission in your browser",
          isListening: false,
          audioLevel: 0,
        }));
        isActiveRef.current = false;
        return;
      }

      setData(prev => ({ ...prev, error: `Speech error: ${errType}` }));
    };

    recognition.onend = () => {
      console.log("[Speech] Recognition ended, active:", isActiveRef.current);
      if (isActiveRef.current && !restartingRef.current) {
        restartingRef.current = true;
        setTimeout(() => {
          restartingRef.current = false;
          if (isActiveRef.current) {
            try {
              recognition.start();
              console.log("[Speech] Auto-restarted");
            } catch (e) {
              console.error("[Speech] Restart failed:", e);
              setData(prev => ({ ...prev, isListening: false, audioLevel: 0 }));
            }
          }
        }, 300);
      } else {
        setData(prev => ({ ...prev, isListening: false, audioLevel: 0 }));
      }
    };

    recognitionRef.current = recognition;
    isActiveRef.current = true;

    try {
      recognition.start();
    } catch (e) {
      console.error("[Speech] Failed to start:", e);
      setData(prev => ({ ...prev, error: `Failed to start: ${e}`, isListening: false }));
    }
  }, [SpeechRecClass]);

  const stopListening = useCallback(async () => {
    console.log("[Speech] Stopping...");
    isActiveRef.current = false;
    restartingRef.current = false;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
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
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
  }, []);

  return {
    data,
    startListening,
    stopListening,
    clearTranscript,
    clearCurrentAnswer,
    supported: isSupported,
  };
}
