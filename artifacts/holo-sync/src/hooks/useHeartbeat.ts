import { useRef, useState, useEffect, useCallback } from "react";

export interface HeartbeatData {
  bpm: number;
  confidence: number;
  signal: number[];
  rawSignal: number[];
  isActive: boolean;
  stress: "low" | "medium" | "high";
  trend: "rising" | "falling" | "stable";
  algorithm: "CHROM" | "G";
  faceDetected: boolean;
  frameRate: number;
}

// ─── DSP Utilities ──────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 1;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance) || 1;
}

function detrend(signal: number[]): number[] {
  const n = signal.length;
  if (n < 2) return signal;
  const xMean = (n - 1) / 2;
  const yMean = mean(signal);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (signal[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  return signal.map((v, i) => v - (slope * i + intercept));
}

// Simple moving-average bandpass: low-pass(signal, hi_cutoff) - low-pass(signal, lo_cutoff)
function movingAvg(signal: number[], window: number): number[] {
  return signal.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = signal.slice(start, i + 1);
    return mean(slice);
  });
}

function bandpass(signal: number[], fps: number, lowHz: number, highHz: number): number[] {
  const n = signal.length;
  const loWin = Math.max(1, Math.round(fps / highHz));
  const hiWin = Math.max(1, Math.round(fps / lowHz));

  const lo = movingAvg(signal, loWin);
  const hi = movingAvg(signal, hiWin);
  const filtered = signal.map((v, i) => lo[i] - hi[i]);

  // Normalize
  const s = std(filtered);
  return s > 0 ? filtered.map(v => v / s) : filtered;
}

// Real DFT — find dominant frequency in [lowHz, highHz]
function fftBPM(
  signal: number[],
  fps: number,
  lowHz = 0.67,
  highHz = 4.0
): { bpm: number; confidence: number; spectrum: number[] } {
  const n = signal.length;
  if (n < 10) return { bpm: 75, confidence: 0, spectrum: [] };

  // Apply Hann window
  const windowed = signal.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));

  // Compute DFT power for frequencies in [lowHz, highHz]
  const freqResolution = fps / n;
  const minBin = Math.ceil(lowHz / freqResolution);
  const maxBin = Math.floor(highHz / freqResolution);

  let maxPower = 0;
  let dominantBin = minBin;
  const spectrum: number[] = [];

  for (let k = minBin; k <= maxBin && k < Math.floor(n / 2); k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += windowed[t] * Math.cos(angle);
      im -= windowed[t] * Math.sin(angle);
    }
    const power = re * re + im * im;
    spectrum.push(power);
    if (power > maxPower) {
      maxPower = power;
      dominantBin = k;
    }
  }

  const dominantHz = dominantBin * freqResolution;
  const bpm = Math.round(dominantHz * 60);

  // Confidence: ratio of peak power to total power in range
  const totalPower = spectrum.reduce((a, b) => a + b, 0) || 1;
  const confidence = Math.min(1, maxPower / (totalPower / spectrum.length) / 10);

  return { bpm: Math.max(40, Math.min(200, bpm)), confidence, spectrum };
}

// ─── CHROM Algorithm (de Haan & Jeanne, 2013) ────────────────────────────────
// Most accurate open rPPG method for varied skin tones
function chromMethod(
  rgbSeries: Array<[number, number, number]>,
  fps: number
): { signal: number[]; bpm: number; confidence: number } {
  if (rgbSeries.length < 20) return { signal: [], bpm: 75, confidence: 0 };

  const Rs = rgbSeries.map(([r]) => r);
  const Gs = rgbSeries.map(([, g]) => g);
  const Bs = rgbSeries.map(([, , b]) => b);

  const Rm = mean(Rs) || 1;
  const Gm = mean(Gs) || 1;
  const Bm = mean(Bs) || 1;

  // Normalize each channel
  const Rn = Rs.map(v => v / Rm);
  const Gn = Gs.map(v => v / Gm);
  const Bn = Bs.map(v => v / Bm);

  // CHROM chrominance signals
  const Xs = Rn.map((r, i) => 3 * r - 2 * Gn[i]);
  const Ys = Rn.map((r, i) => 1.5 * r + Gn[i] - 1.5 * Bn[i]);

  // Bandpass both chrominance signals
  const XsBP = bandpass(Xs, fps, 0.67, 4.0);
  const YsBP = bandpass(Ys, fps, 0.67, 4.0);

  // Adaptive combination: minimize motion artifacts
  const stdXs = std(XsBP) || 1;
  const stdYs = std(YsBP) || 1;
  const alpha = stdXs / stdYs;

  const S = XsBP.map((x, i) => x - alpha * YsBP[i]);

  // Detrend final signal
  const detrended = detrend(S);

  const { bpm, confidence } = fftBPM(detrended, fps, 0.67, 4.0);

  return { signal: detrended, bpm, confidence };
}

// ─── POS Algorithm (Wang et al., 2017) ───────────────────────────────────────
function posMethod(
  rgbSeries: Array<[number, number, number]>,
  fps: number
): { signal: number[]; bpm: number; confidence: number } {
  if (rgbSeries.length < 20) return { signal: [], bpm: 75, confidence: 0 };

  const Rs = rgbSeries.map(([r]) => r);
  const Gs = rgbSeries.map(([, g]) => g);
  const Bs = rgbSeries.map(([, , b]) => b);

  const Rm = mean(Rs) || 1;
  const Gm = mean(Gs) || 1;
  const Bm = mean(Bs) || 1;

  const Rn = Rs.map(v => v / Rm);
  const Gn = Gs.map(v => v / Gm);
  const Bn = Bs.map(v => v / Bm);

  const S1 = Rn.map((r, i) => r - Gn[i]);
  const S2 = Rn.map((r, i) => r + Gn[i] - 2 * Bn[i]);

  const S1BP = bandpass(S1, fps, 0.67, 4.0);
  const S2BP = bandpass(S2, fps, 0.67, 4.0);

  const stdS1 = std(S1BP) || 1;
  const stdS2 = std(S2BP) || 1;

  const H = S1BP.map((s1, i) => s1 + (stdS1 / stdS2) * S2BP[i]);
  const detrended = detrend(H);

  const { bpm, confidence } = fftBPM(detrended, fps, 0.67, 4.0);
  return { signal: detrended, bpm, confidence };
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

export function useHeartbeat(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const rgbSeriesRef = useRef<Array<[number, number, number]>>([]);
  const timestampsRef = useRef<number[]>([]);
  const smoothBpmRef = useRef<number>(72);
  const frameCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const fpsRef = useRef<number>(30);
  const faceDetectedRef = useRef<boolean>(false);

  const [data, setData] = useState<HeartbeatData>({
    bpm: 72,
    confidence: 0,
    signal: Array(80).fill(0),
    rawSignal: Array(80).fill(0),
    isActive: false,
    stress: "low",
    trend: "stable",
    algorithm: "CHROM",
    faceDetected: false,
    frameRate: 30,
  });

  const MAX_SAMPLES = 300;  // ~10s at 30fps
  const MIN_SAMPLES_FOR_BPM = 90;  // ~3s minimum

  const extractROI = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): { r: number; g: number; b: number; detected: boolean } => {
    // Primary ROI: forehead region (top 15-30% of face, center 40%)
    // Also sample cheeks for redundancy
    const foreheadX = Math.floor(width * 0.3);
    const foreheadY = Math.floor(height * 0.05);
    const foreheadW = Math.floor(width * 0.4);
    const foreheadH = Math.floor(height * 0.18);

    const leftCheekX = Math.floor(width * 0.05);
    const leftCheekY = Math.floor(height * 0.35);
    const leftCheekW = Math.floor(width * 0.2);
    const leftCheekH = Math.floor(height * 0.15);

    const rightCheekX = Math.floor(width * 0.75);
    const rightCheekY = Math.floor(height * 0.35);
    const rightCheekW = Math.floor(width * 0.2);
    const rightCheekH = Math.floor(height * 0.15);

    let rSum = 0, gSum = 0, bSum = 0, count = 0;

    const processRegion = (x: number, y: number, w: number, h: number, weight: number) => {
      if (w <= 0 || h <= 0) return;
      try {
        const data = ctx.getImageData(x, y, w, h).data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;  // skip transparent
          rSum += data[i] * weight;
          gSum += data[i + 1] * weight;
          bSum += data[i + 2] * weight;
          count += weight;
        }
      } catch { /* ignore OOB */ }
    };

    // Forehead gets 50% weight, cheeks 25% each
    processRegion(foreheadX, foreheadY, foreheadW, foreheadH, 2);
    processRegion(leftCheekX, leftCheekY, leftCheekW, leftCheekH, 1);
    processRegion(rightCheekX, rightCheekY, rightCheekW, rightCheekH, 1);

    if (count === 0) return { r: 0, g: 0, b: 0, detected: false };

    const r = rSum / count;
    const g = gSum / count;
    const b = bSum / count;

    // Simple skin tone detection: skin has R > B, R > G in many cases
    // Also check for reasonable pixel range (not black screen, not pure white)
    const detected = g > 20 && g < 240 && r > 20 && b > 10;

    return { r, g, b, detected };
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Estimate FPS
    const now = performance.now();
    if (lastFrameTimeRef.current > 0) {
      const dt = (now - lastFrameTimeRef.current) / 1000;
      fpsRef.current = 0.9 * fpsRef.current + 0.1 * (1 / dt);
    }
    lastFrameTimeRef.current = now;
    frameCountRef.current++;

    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const { r, g, b, detected } = extractROI(ctx, canvas.width, canvas.height);
    faceDetectedRef.current = detected;

    if (detected) {
      rgbSeriesRef.current.push([r, g, b]);
      timestampsRef.current.push(now);

      if (rgbSeriesRef.current.length > MAX_SAMPLES) {
        rgbSeriesRef.current.shift();
        timestampsRef.current.shift();
      }
    }

    // Only compute BPM every 10 frames to save CPU
    if (frameCountRef.current % 10 === 0 && rgbSeriesRef.current.length >= MIN_SAMPLES_FOR_BPM) {
      const fps = Math.min(Math.max(fpsRef.current, 15), 60);
      const { signal: chromSignal, bpm: chromBpm, confidence: chromConf } =
        chromMethod(rgbSeriesRef.current, fps);

      if (chromConf > 0.1 && chromBpm >= 40 && chromBpm <= 200) {
        const prevBpm = smoothBpmRef.current;
        // Smooth BPM changes to avoid jitter
        const alpha = chromConf > 0.5 ? 0.3 : 0.1;
        smoothBpmRef.current = Math.round(prevBpm * (1 - alpha) + chromBpm * alpha);
        smoothBpmRef.current = Math.max(45, Math.min(180, smoothBpmRef.current));

        const bpm = smoothBpmRef.current;
        const stress: "low" | "medium" | "high" = bpm > 100 ? "high" : bpm > 82 ? "medium" : "low";
        const trend: "rising" | "falling" | "stable" =
          bpm > prevBpm + 3 ? "rising" : bpm < prevBpm - 3 ? "falling" : "stable";

        const displaySignal = chromSignal.slice(-80);
        const maxAbs = Math.max(...displaySignal.map(Math.abs), 0.001);
        const normalized = displaySignal.map(v => v / maxAbs);

        setData({
          bpm,
          confidence: Math.round(chromConf * 100),
          signal: normalized,
          rawSignal: chromSignal.slice(-80),
          isActive: true,
          stress,
          trend,
          algorithm: "CHROM",
          faceDetected: detected,
          frameRate: Math.round(fps),
        });
      } else if (rgbSeriesRef.current.length >= MIN_SAMPLES_FOR_BPM) {
        // Fallback: POS method
        const { signal: posSignal, bpm: posBpm, confidence: posConf } =
          posMethod(rgbSeriesRef.current, fps);

        if (posConf > 0.05 && posBpm >= 40 && posBpm <= 200) {
          const prevBpm = smoothBpmRef.current;
          smoothBpmRef.current = Math.round(prevBpm * 0.85 + posBpm * 0.15);
          smoothBpmRef.current = Math.max(45, Math.min(180, smoothBpmRef.current));

          const bpm = smoothBpmRef.current;
          const stress: "low" | "medium" | "high" = bpm > 100 ? "high" : bpm > 82 ? "medium" : "low";
          const trend: "rising" | "falling" | "stable" =
            bpm > prevBpm + 3 ? "rising" : bpm < prevBpm - 3 ? "falling" : "stable";

          const displaySignal = posSignal.slice(-80);
          const maxAbs = Math.max(...displaySignal.map(Math.abs), 0.001);
          const normalized = displaySignal.map(v => v / maxAbs);

          setData(prev => ({
            ...prev,
            bpm,
            confidence: Math.round(posConf * 80),
            signal: normalized,
            isActive: true,
            stress,
            trend,
            algorithm: "CHROM",
            faceDetected: detected,
            frameRate: Math.round(fps),
          }));
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, extractROI]);

  const start = useCallback(() => {
    rgbSeriesRef.current = [];
    timestampsRef.current = [];
    frameCountRef.current = 0;
    lastFrameTimeRef.current = 0;
    smoothBpmRef.current = 72;
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const panic = useCallback(() => {
    smoothBpmRef.current = 118 + Math.floor(Math.random() * 15);
    setData(prev => ({
      ...prev,
      bpm: smoothBpmRef.current,
      stress: "high",
      trend: "rising",
      confidence: 85,
    }));
  }, []);

  const calm = useCallback(() => {
    smoothBpmRef.current = 65 + Math.floor(Math.random() * 10);
    setData(prev => ({
      ...prev,
      bpm: smoothBpmRef.current,
      stress: "low",
      trend: "falling",
      confidence: 85,
    }));
  }, []);

  return { data, start, stop, panic, calm };
}
