import { useRef, useState, useCallback, useEffect } from "react";

export interface SpeechAnalytics {
  wpm: number;
  fillerCount: number;
  fillerWords: string[];
  wordCount: number;
  vocabularyScore: number;  // 0-100 unique word ratio
  confidenceScore: number;  // 0-100 derived from WPM + filler rate
  transcript: string;       // full session transcript
}

export interface SpeechRecognitionData {
  isListening: boolean;
  interimText: string;       // live partial text (not final)
  finalText: string;         // last confirmed answer
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

  // Filler detection
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

  // Vocabulary richness = unique words / total words (excluding fillers & short words)
  const meaningfulWords = words.filter(w => w.length > 3 && !FILLER_WORDS.includes(w));
  const uniqueWords = new Set(meaningfulWords);
  const vocabularyScore = meaningfulWords.length > 0
    ? Math.min(100, Math.round((uniqueWords.size / meaningfulWords.length) * 100))
    : 0;

  // WPM — approximate (assume answers spoken at ~1.2x typing speed, ~3 chars/word)
  const avgWPM = wordCount > 0 ? Math.min(180, Math.max(60, Math.round(wordCount * 12))) : 0;

  // Confidence: penalize high filler rate, reward good WPM & vocab
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

// Extend window type for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
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

  const supported = !!(
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const startListening = useCallback((onResult?: (finalText: string) => void) => {
    if (!supported) return;
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
      }));
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const err = event.error;
      if (err !== "aborted" && err !== "no-speech") {
        setData(prev => ({ ...prev, error: err, isListening: false }));
      }
    };

    rec.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current === rec) {
        try { rec.start(); } catch {}
      }
    };

    rec.onstart = () => {
      setData(prev => ({ ...prev, isListening: true, error: null }));
    };

    try {
      rec.start();
    } catch (e) {
      setData(prev => ({ ...prev, error: "Could not start microphone", isListening: false }));
    }
  }, [supported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null; // prevent auto-restart
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

  // Clear per-answer (keep session stats)
  const clearCurrentAnswer = useCallback(() => {
    fullTranscriptRef.current = "";
    setData(prev => ({ ...prev, finalText: "", interimText: "" }));
  }, []);

  useEffect(() => () => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
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
