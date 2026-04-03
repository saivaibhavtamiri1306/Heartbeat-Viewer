import { useRef, useState, useEffect, useCallback } from "react";

export interface HeartbeatData {
  bpm: number;
  signal: number[];
  isActive: boolean;
  stress: "low" | "medium" | "high";
  trend: "rising" | "falling" | "stable";
}

export function useHeartbeat(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const valuesRef = useRef<number[]>([]);
  const timestampsRef = useRef<number[]>([]);
  const baselineRef = useRef<number>(0);
  const lastBpmRef = useRef<number>(72);
  const [data, setData] = useState<HeartbeatData>({
    bpm: 72,
    signal: Array(60).fill(0),
    isActive: false,
    stress: "low",
    trend: "stable",
  });

  const WINDOW_SIZE = 180;
  const SAMPLE_RATE = 30;

  const movingAverage = (arr: number[], window: number) => {
    return arr.map((_, i) => {
      const start = Math.max(0, i - window);
      const slice = arr.slice(start, i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
  };

  const detectPeaks = (signal: number[]) => {
    const peaks: number[] = [];
    for (let i = 2; i < signal.length - 2; i++) {
      if (
        signal[i] > signal[i - 1] &&
        signal[i] > signal[i - 2] &&
        signal[i] > signal[i + 1] &&
        signal[i] > signal[i + 2] &&
        signal[i] > (Math.max(...signal) * 0.5)
      ) {
        peaks.push(i);
      }
    }
    return peaks;
  };

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const forehead = ctx.getImageData(
      Math.floor(video.videoWidth * 0.3),
      Math.floor(video.videoHeight * 0.1),
      Math.floor(video.videoWidth * 0.4),
      Math.floor(video.videoHeight * 0.15)
    );

    let greenSum = 0;
    let count = 0;
    for (let i = 0; i < forehead.data.length; i += 4) {
      greenSum += forehead.data[i + 1];
      count++;
    }
    const greenAvg = greenSum / count;

    const now = Date.now();
    valuesRef.current.push(greenAvg);
    timestampsRef.current.push(now);

    if (valuesRef.current.length > WINDOW_SIZE) {
      valuesRef.current.shift();
      timestampsRef.current.shift();
    }

    if (valuesRef.current.length > 60) {
      if (baselineRef.current === 0) {
        baselineRef.current = valuesRef.current.reduce((a, b) => a + b, 0) / valuesRef.current.length;
      }

      const normalized = valuesRef.current.map(v => v - baselineRef.current);
      const smoothed = movingAverage(normalized, 8);
      const peaks = detectPeaks(smoothed);

      let bpm = lastBpmRef.current;
      if (peaks.length >= 2) {
        const timeSpan = (timestampsRef.current[timestampsRef.current.length - 1] - timestampsRef.current[0]) / 1000;
        const calculatedBpm = Math.round((peaks.length / timeSpan) * 60);
        if (calculatedBpm >= 45 && calculatedBpm <= 180) {
          bpm = Math.round(lastBpmRef.current * 0.7 + calculatedBpm * 0.3);
        }
      }

      bpm = Math.max(55, Math.min(150, bpm));
      lastBpmRef.current = bpm;

      const stress: "low" | "medium" | "high" =
        bpm > 100 ? "high" : bpm > 80 ? "medium" : "low";

      const prevBpm = lastBpmRef.current;
      const trend: "rising" | "falling" | "stable" =
        bpm > prevBpm + 3 ? "rising" : bpm < prevBpm - 3 ? "falling" : "stable";

      const waveformLength = 60;
      const waveform = smoothed.slice(-waveformLength);
      const maxAbs = Math.max(...waveform.map(Math.abs), 1);
      const normalizedWave = waveform.map(v => v / maxAbs);

      setData(prev => ({
        bpm,
        signal: normalizedWave,
        isActive: true,
        stress,
        trend,
      }));
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [videoRef]);

  const start = useCallback(() => {
    valuesRef.current = [];
    timestampsRef.current = [];
    baselineRef.current = 0;
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const panic = useCallback(() => {
    lastBpmRef.current = 115 + Math.floor(Math.random() * 20);
  }, []);

  return { data, start, stop, panic };
}
