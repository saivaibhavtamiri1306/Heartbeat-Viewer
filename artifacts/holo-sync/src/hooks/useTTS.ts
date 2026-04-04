import { useRef, useCallback, useEffect } from "react";

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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const amplitudeRef = useRef(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const getAmplitude = useCallback(() => amplitudeRef.current, []);

  const speak = useCallback(async (text: string, options: TTSOptions = {}): Promise<void> => {
    const { voice = "nova", onStart, onEnd, onError } = options;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    cancelAnimationFrame(animFrameRef.current);
    amplitudeRef.current = 0;

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
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;

        if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        analyserRef.current = analyser;

        const source = ctx.createMediaElementSource(audio);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const pumpAmplitude = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          const len = Math.min(64, dataArray.length);
          for (let i = 0; i < len; i++) sum += dataArray[i];
          amplitudeRef.current = Math.min(1, (sum / len / 255) * 2.5);
          animFrameRef.current = requestAnimationFrame(pumpAmplitude);
        };

        audio.onplay = () => {
          if (ctx.state === "suspended") ctx.resume();
          pumpAmplitude();
          onStart?.();
        };
        audio.onended = () => {
          cancelAnimationFrame(animFrameRef.current);
          amplitudeRef.current = 0;
          source.disconnect();
          URL.revokeObjectURL(url);
          onEnd?.();
          resolve();
        };
        audio.onerror = () => {
          cancelAnimationFrame(animFrameRef.current);
          amplitudeRef.current = 0;
          source.disconnect();
          URL.revokeObjectURL(url);
          onError?.();
          resolve();
        };

        audio.play().catch(() => {
          cancelAnimationFrame(animFrameRef.current);
          amplitudeRef.current = 0;
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
    cancelAnimationFrame(animFrameRef.current);
    amplitudeRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, stop, getAmplitude };
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
