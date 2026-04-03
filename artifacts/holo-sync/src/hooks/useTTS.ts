import { useRef, useCallback } from "react";

type Voice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

interface TTSOptions {
  voice?: Voice;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const speak = useCallback(async (text: string, options: TTSOptions = {}): Promise<void> => {
    const { voice = "nova", onStart, onEnd, onError } = options;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiUrl = "/api/tts";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`TTS failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      return new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => onStart?.();
        audio.onended = () => {
          URL.revokeObjectURL(url);
          onEnd?.();
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          onError?.();
          resolve();
        };

        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          onError?.();
          resolve();
        });
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.warn("AI TTS failed, using browser fallback:", err?.message);
      return fallbackSpeak(text, onStart, onEnd, onError);
    }
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, stop };
}

function fallbackSpeak(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: () => void
): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      onStart?.();
      setTimeout(() => { onEnd?.(); resolve(); }, 3000);
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.88;
    utter.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const pick = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google"))
      || voices.find(v => v.lang.startsWith("en"))
      || voices[0];
    if (pick) utter.voice = pick;

    utter.onstart = () => onStart?.();
    utter.onend = () => { onEnd?.(); resolve(); };
    utter.onerror = () => { onError?.(); resolve(); };
    window.speechSynthesis.speak(utter);
  });
}
