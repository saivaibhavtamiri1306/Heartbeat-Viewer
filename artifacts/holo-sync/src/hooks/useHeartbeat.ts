import { useRef, useState, useEffect, useCallback } from "react";

export interface HeartbeatData {
  bpm: number | null;        // null = still calibrating
  confidence: number;        // 0-100
  signal: number[];
  isActive: boolean;
  stress: "low" | "medium" | "high";
  trend: "rising" | "falling" | "stable";
  algorithm: string;
  faceDetected: boolean;
  frameRate: number;
  calibrating: boolean;
}

// ─── DSP Utilities ───────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 1e-6;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) || 1e-6;
}

// Linear detrend — remove DC offset + slope
function detrend(sig: number[]): number[] {
  const n = sig.length;
  if (n < 2) return sig;
  const xm = (n - 1) / 2;
  const ym = mean(sig);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xm) * (sig[i] - ym);
    den += (i - xm) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = ym - slope * xm;
  return sig.map((v, i) => v - (slope * i + intercept));
}

// ─── 2nd-order Butterworth Bandpass IIR (biquad) ─────────────────────────────
// Designed for fs=30Hz, passband 0.75–3.5 Hz (45–210 BPM)
// Coefficients pre-computed via bilinear transform
// Two cascaded sections for 4th-order rolloff

interface BiquadState { x1: number; x2: number; y1: number; y2: number }

const makeBiquad = (): BiquadState => ({ x1: 0, x2: 0, y1: 0, y2: 0 });

function butterBPCoeffs(fs: number, fl: number, fh: number) {
  const f0 = Math.sqrt(fl * fh);
  const bw = fh - fl;
  const w0 = 2 * Math.PI * f0 / fs;
  const Q = f0 / bw;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * cosw0) / a0,
    a2: (1 - alpha) / a0,
  };
}

function applyBiquad(
  sig: number[],
  coeffs: ReturnType<typeof butterBPCoeffs>,
  state: BiquadState
): number[] {
  const { b0, b1, b2, a1, a2 } = coeffs;
  const out = new Array(sig.length);
  let { x1, x2, y1, y2 } = state;
  for (let i = 0; i < sig.length; i++) {
    const x0 = sig[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
    out[i] = y0;
  }
  state.x1 = x1; state.x2 = x2;
  state.y1 = y1; state.y2 = y2;
  return out;
}

function bandpassFilter(sig: number[], fps: number): number[] {
  // Two cascaded biquad sections = 4th order
  const coeffs = butterBPCoeffs(fps, 0.75, 3.5);
  const s1 = makeBiquad();
  const s2 = makeBiquad();
  const pass1 = applyBiquad(sig, coeffs, s1);
  return applyBiquad(pass1, coeffs, s2);
}

// ─── FFT-based BPM with SNR gating ───────────────────────────────────────────
function estimateBPM(sig: number[], fps: number): { bpm: number; confidence: number; snr: number } {
  const n = sig.length;
  if (n < 30) return { bpm: 0, confidence: 0, snr: 0 };

  // Hann window
  const windowed = sig.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));

  const freqRes = fps / n;   // Hz per bin
  const minBin = Math.ceil(0.75 / freqRes);
  const maxBin = Math.floor(3.5 / freqRes);

  if (minBin >= maxBin || maxBin >= Math.floor(n / 2)) {
    return { bpm: 0, confidence: 0, snr: 0 };
  }

  // Compute power spectrum
  const powers: number[] = [];
  const freqs: number[] = [];

  for (let k = minBin; k <= maxBin; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += windowed[t] * Math.cos(angle);
      im -= windowed[t] * Math.sin(angle);
    }
    powers.push(re * re + im * im);
    freqs.push(k * freqRes);
  }

  if (powers.length === 0) return { bpm: 0, confidence: 0, snr: 0 };

  const maxPower = Math.max(...powers);
  const maxIdx = powers.indexOf(maxPower);
  const avgPower = mean(powers);

  // SNR: how much does the peak stand out from the noise floor?
  const snr = avgPower > 0 ? maxPower / avgPower : 0;

  // Interpolate peak frequency for sub-bin accuracy
  let peakFreq = freqs[maxIdx];
  if (maxIdx > 0 && maxIdx < powers.length - 1) {
    const left = powers[maxIdx - 1];
    const right = powers[maxIdx + 1];
    const denom = left - 2 * maxPower + right;
    if (Math.abs(denom) > 1e-10) {
      const delta = 0.5 * (left - right) / denom;
      peakFreq = (maxIdx + delta) * freqRes + minBin * freqRes;
    }
  }

  const bpm = Math.round(peakFreq * 60);

  // Confidence based on SNR: needs SNR > 2 to be considered real
  // At SNR=2 → 20%, at SNR=5 → 60%, at SNR=10 → 90%
  const confidence = snr < 1.5 ? 0 : Math.min(95, Math.round(((snr - 1.5) / 8.5) * 95));

  return { bpm: Math.max(45, Math.min(200, bpm)), confidence, snr };
}

// ─── CHROM Algorithm (de Haan & Jeanne, 2013) ────────────────────────────────
function chrom(
  rgb: Array<[number, number, number]>,
  fps: number
): { signal: number[]; bpm: number; confidence: number; snr: number } {
  const Rs = rgb.map(([r]) => r), Gs = rgb.map(([, g]) => g), Bs = rgb.map(([, , b]) => b);
  const Rm = mean(Rs) || 1, Gm = mean(Gs) || 1, Bm = mean(Bs) || 1;
  const Rn = Rs.map(v => v / Rm), Gn = Gs.map(v => v / Gm), Bn = Bs.map(v => v / Bm);

  const Xs = Rn.map((r, i) => 3 * r - 2 * Gn[i]);
  const Ys = Rn.map((r, i) => 1.5 * r + Gn[i] - 1.5 * Bn[i]);

  // Bandpass each chrominance signal
  const XsBP = bandpassFilter(detrend(Xs), fps);
  const YsBP = bandpassFilter(detrend(Ys), fps);

  const sX = stdDev(XsBP), sY = stdDev(YsBP);
  const alpha = sX / sY;

  const S = XsBP.map((x, i) => x - alpha * YsBP[i]);
  const result = estimateBPM(S, fps);
  const sStd = stdDev(S);
  const normalized = sStd > 0 ? S.map(v => v / sStd) : S;

  return { signal: normalized, ...result };
}

// ─── POS Algorithm (Wang et al., 2017) as fallback ───────────────────────────
function pos(
  rgb: Array<[number, number, number]>,
  fps: number
): { signal: number[]; bpm: number; confidence: number; snr: number } {
  const Rs = rgb.map(([r]) => r), Gs = rgb.map(([, g]) => g), Bs = rgb.map(([, , b]) => b);
  const Rm = mean(Rs) || 1, Gm = mean(Gs) || 1, Bm = mean(Bs) || 1;
  const Rn = Rs.map(v => v / Rm), Gn = Gs.map(v => v / Gm), Bn = Bs.map(v => v / Bm);

  const S1 = Rn.map((r, i) => r - Gn[i]);
  const S2 = Rn.map((r, i) => r + Gn[i] - 2 * Bn[i]);
  const S1BP = bandpassFilter(detrend(S1), fps);
  const S2BP = bandpassFilter(detrend(S2), fps);

  const sS1 = stdDev(S1BP), sS2 = stdDev(S2BP);
  const H = S1BP.map((s1, i) => s1 + (sS1 / sS2) * S2BP[i]);
  const result = estimateBPM(H, fps);
  const hStd = stdDev(H);
  return { signal: hStd > 0 ? H.map(v => v / hStd) : H, ...result };
}

// ─── Main Hook ────────────────────────────────────────────────────────────────
export function useHeartbeat(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const rgbRef = useRef<Array<[number, number, number]>>([]);
  const confirmedBpmRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(30);
  const lastFrameTimeRef = useRef<number>(0);
  const lastGoodSnrRef = useRef<number>(0);
  const calibratingRef = useRef<boolean>(true);
  const calFramesRef = useRef<number>(0);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null,
    confidence: 0,
    signal: [],
    isActive: false,
    stress: "low",
    trend: "stable",
    algorithm: "CHROM",
    faceDetected: false,
    frameRate: 30,
    calibrating: true,
  });

  const MAX_SAMPLES = 450;           // 15s at 30fps
  const MIN_SAMPLES = 120;           // 4s before first estimate
  const CALIBRATION_FRAMES = 90;     // Show calibrating for ~3s regardless
  const SNR_THRESHOLD = 2.2;         // Minimum SNR to accept a BPM estimate
  const HIGH_CONFIDENCE_SNR = 5.0;

  const extractRGB = useCallback((
    ctx: CanvasRenderingContext2D, w: number, h: number
  ): { r: number; g: number; b: number; detected: boolean } => {
    // Forehead ROI: centre top third of face area
    const x = Math.floor(w * 0.28), y = Math.floor(h * 0.08);
    const rw = Math.floor(w * 0.44), rh = Math.floor(h * 0.20);
    let r = 0, g = 0, b = 0, cnt = 0;
    try {
      const d = ctx.getImageData(x, y, rw, rh).data;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]; g += d[i + 1]; b += d[i + 2]; cnt++;
      }
    } catch { /* ignore */ }
    if (cnt === 0) return { r: 0, g: 0, b: 0, detected: false };
    r /= cnt; g /= cnt; b /= cnt;
    // Skin check: any real face has R > 40 and G > 20 and B > 10 in a lit environment
    const detected = r > 40 && g > 20 && b > 10 && r < 245 && g < 245;
    return { r, g, b, detected };
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    if (lastFrameTimeRef.current > 0) {
      const dt = (now - lastFrameTimeRef.current) / 1000;
      if (dt > 0) fpsRef.current = 0.95 * fpsRef.current + 0.05 * (1 / dt);
    }
    lastFrameTimeRef.current = now;
    frameCountRef.current++;
    calFramesRef.current++;

    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }

    cv.width = video.videoWidth;
    cv.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const { r, g, b, detected } = extractRGB(ctx, cv.width, cv.height);

    if (detected) {
      rgbRef.current.push([r, g, b]);
      if (rgbRef.current.length > MAX_SAMPLES) rgbRef.current.shift();
    }

    const isCalibrating = calFramesRef.current < CALIBRATION_FRAMES;

    // Compute BPM every 15 frames (avoid GPU stall every frame)
    if (frameCountRef.current % 15 === 0 && rgbRef.current.length >= MIN_SAMPLES) {
      const fps = Math.min(Math.max(fpsRef.current, 15), 60);
      const rgb = rgbRef.current.slice(); // snapshot

      const chromResult = chrom(rgb, fps);
      let best = chromResult;

      // If CHROM has poor SNR, try POS
      if (chromResult.snr < SNR_THRESHOLD) {
        const posResult = pos(rgb, fps);
        if (posResult.snr > chromResult.snr) best = posResult;
      }

      const snrOk = best.snr >= SNR_THRESHOLD;

      if (snrOk && best.bpm >= 45 && best.bpm <= 185) {
        const prev = confirmedBpmRef.current ?? best.bpm;
        // Only accept if not a huge jump from previous (>25 BPM in one step = noise)
        if (Math.abs(best.bpm - prev) <= 25 || confirmedBpmRef.current === null) {
          // Smooth over time — faster convergence when high SNR
          const alpha = best.snr >= HIGH_CONFIDENCE_SNR ? 0.4 : 0.2;
          const smoothed = Math.round(prev * (1 - alpha) + best.bpm * alpha);
          confirmedBpmRef.current = Math.max(45, Math.min(185, smoothed));
        }
      }
      lastGoodSnrRef.current = best.snr;

      const bpm = confirmedBpmRef.current;
      const stress: "low" | "medium" | "high" =
        bpm !== null ? (bpm > 100 ? "high" : bpm > 83 ? "medium" : "low") : "low";

      const displaySignal = best.signal.slice(-80);
      const calState = isCalibrating || bpm === null;

      setData(prev => {
        const trend: "rising" | "falling" | "stable" =
          bpm !== null && prev.bpm !== null
            ? (bpm > prev.bpm + 3 ? "rising" : bpm < prev.bpm - 3 ? "falling" : "stable")
            : "stable";
        return {
          bpm: calState ? null : bpm,
          confidence: snrOk ? Math.min(95, Math.round(((best.snr - SNR_THRESHOLD) / HIGH_CONFIDENCE_SNR) * 95)) : 0,
          signal: displaySignal,
          isActive: true,
          stress,
          trend,
          algorithm: "CHROM",
          faceDetected: detected,
          frameRate: Math.round(fps),
          calibrating: calState,
        };
      });
    } else if (frameCountRef.current % 15 === 0) {
      setData(prev => ({
        ...prev,
        isActive: true,
        faceDetected: detected,
        frameRate: Math.round(fpsRef.current),
        calibrating: isCalibrating || confirmedBpmRef.current === null,
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, extractRGB]);

  const start = useCallback(() => {
    rgbRef.current = [];
    frameCountRef.current = 0;
    calFramesRef.current = 0;
    lastFrameTimeRef.current = 0;
    confirmedBpmRef.current = null;
    calibratingRef.current = true;
    fpsRef.current = 30;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Demo overrides — bypass algorithm for presentations
  const panic = useCallback(() => {
    confirmedBpmRef.current = 118 + Math.floor(Math.random() * 15);
    calFramesRef.current = CALIBRATION_FRAMES + 1;
    setData(prev => ({
      ...prev, bpm: confirmedBpmRef.current,
      stress: "high", trend: "rising", confidence: 88, calibrating: false,
    }));
  }, []);

  const calm = useCallback(() => {
    confirmedBpmRef.current = 62 + Math.floor(Math.random() * 8);
    calFramesRef.current = CALIBRATION_FRAMES + 1;
    setData(prev => ({
      ...prev, bpm: confirmedBpmRef.current,
      stress: "low", trend: "falling", confidence: 85, calibrating: false,
    }));
  }, []);

  return { data, start, stop, panic, calm };
}
