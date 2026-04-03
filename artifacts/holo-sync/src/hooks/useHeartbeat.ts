/**
 * useHeartbeat — Browser rPPG (remote photoplethysmography)
 *
 * Pipeline (matches best-practice reference implementations):
 *  1. Multi-region ROI auto-selection — picks best of 5 candidate face zones
 *  2. Collect R, G, B channel means into a 12-second ring buffer
 *  3. Linear detrend — removes DC offset and linear trend
 *  4. 2nd-order Butterworth bandpass (0.75–3.0 Hz = 45–180 BPM), zero-phase
 *  5. Select green channel (hemoglobin absorption peak)
 *  6. Hann window + 4× zero-padded FFT
 *  7. Parabolic peak interpolation for sub-bin accuracy
 *  8. SNR gate (peak/band-mean ≥ 2.0)
 *  9. Temporal EMA smoothing + jump rejection
 */
import { useRef, useState, useEffect, useCallback } from "react";

export interface HeartbeatData {
  bpm: number | null;
  confidence: number;
  signal: number[];
  isActive: boolean;
  stress: "low" | "medium" | "high";
  trend: "rising" | "falling" | "stable";
  algorithm: string;
  faceDetected: boolean;
  frameRate: number;
  calibrating: boolean;
  roiDebug?: string;
}

// ─── Math ─────────────────────────────────────────────────────────────────────
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)) || 1e-10;
};

// ─── Linear detrend ───────────────────────────────────────────────────────────
function linearDetrend(sig: number[]): number[] {
  const n = sig.length;
  if (n < 2) return [...sig];
  const x = Array.from({ length: n }, (_, i) => i);
  const xm = (n - 1) / 2;
  const ym = mean(sig);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - xm) * (sig[i] - ym); den += (x[i] - xm) ** 2; }
  const slope = den !== 0 ? num / den : 0;
  const intercept = ym - slope * xm;
  return sig.map((v, i) => v - (slope * i + intercept));
}

// ─── Butterworth 2nd-order IIR coefficients ───────────────────────────────────
// Using bilinear transform (pre-warped). Returns {b, a} for Direct Form II.
function butter2HP(fc: number, fs: number): { b: [number, number, number]; a: [number, number, number] } {
  const w = 2 * Math.tan(Math.PI * fc / fs);          // pre-warped analog freq
  const w2 = w * w, sq2 = Math.SQRT2;
  const norm = 4 + 2 * sq2 * w + w2;
  return {
    b: [(4) / norm, (-8) / norm, (4) / norm],
    a: [1, (2 * w2 - 8) / norm, (4 - 2 * sq2 * w + w2) / norm],
  };
}
function butter2LP(fc: number, fs: number): { b: [number, number, number]; a: [number, number, number] } {
  const w = 2 * Math.tan(Math.PI * fc / fs);
  const w2 = w * w, sq2 = Math.SQRT2;
  const norm = 4 + 2 * sq2 * w + w2;
  return {
    b: [w2 / norm, 2 * w2 / norm, w2 / norm],
    a: [1, (2 * w2 - 8) / norm, (4 - 2 * sq2 * w + w2) / norm],
  };
}

// Apply a 2nd-order IIR filter in one direction
function applyIIR(sig: number[], b: [number, number, number], a: [number, number, number]): number[] {
  const y = new Array(sig.length).fill(0);
  for (let i = 0; i < sig.length; i++) {
    let v = b[0] * sig[i];
    if (i >= 1) v += b[1] * sig[i - 1] - a[1] * y[i - 1];
    if (i >= 2) v += b[2] * sig[i - 2] - a[2] * y[i - 2];
    y[i] = v;
  }
  return y;
}

// Zero-phase (forward + backward) application — equivalent to SciPy filtfilt
function filtfilt(sig: number[], b: [number, number, number], a: [number, number, number]): number[] {
  const fwd = applyIIR(sig, b, a);
  return applyIIR([...fwd].reverse(), b, a).reverse();
}

// ─── Butterworth bandpass (HP cascade LP) ────────────────────────────────────
function bandpass(sig: number[], loHz: number, hiHz: number, fs: number): number[] {
  const hp = butter2HP(loHz, fs);
  const lp = butter2LP(hiHz, fs);
  const afterHP = filtfilt(sig, hp.b, hp.a);
  return filtfilt(afterHP, lp.b, lp.a);
}

// ─── Cooley–Tukey FFT ─────────────────────────────────────────────────────────
function fftMag(sig: number[]): number[] {
  const n = sig.length;
  let sz = 1;
  while (sz < n) sz <<= 1;
  const re = new Float64Array(sz), im = new Float64Array(sz);
  for (let i = 0; i < n; i++) re[i] = sig[i];
  for (let i = 1, j = 0; i < sz; i++) {
    let bit = sz >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= sz; len <<= 1) {
    const ang = (2 * Math.PI) / len, wr = Math.cos(ang), wi = -Math.sin(ang);
    for (let i = 0; i < sz; i += len) {
      let pr = 1, pi = 0;
      for (let j = 0; j < len >> 1; j++) {
        const [ur, ui] = [re[i + j], im[i + j]];
        const vr = re[i + j + len / 2] * pr - im[i + j + len / 2] * pi;
        const vi = re[i + j + len / 2] * pi + im[i + j + len / 2] * pr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = pr * wr - pi * wi; pi = pr * wi + pi * wr; pr = t;
      }
    }
  }
  const mags = new Array(sz >> 1);
  for (let i = 0; i < sz >> 1; i++) mags[i] = Math.sqrt(re[i] ** 2 + im[i] ** 2);
  return mags;
}

// ─── BPM estimator ────────────────────────────────────────────────────────────
function estimateBPM(green: number[], fps: number): { bpm: number; snr: number } {
  const n = green.length;
  if (n < 60) return { bpm: 0, snr: 0 };
  // Hann window
  const w = green.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));
  // 4× zero-pad for finer frequency resolution
  const padded = [...w, ...new Array(n * 3).fill(0)];
  const mags = fftMag(padded);
  const freqRes = fps / padded.length;   // Hz / FFT bin
  const minBin = Math.max(1, Math.floor(45  / 60 / freqRes));
  const maxBin = Math.min(mags.length - 2, Math.ceil(180 / 60 / freqRes));
  let peak = 0, peakBin = minBin, bandSum = 0;
  for (let k = minBin; k <= maxBin; k++) {
    bandSum += mags[k];
    if (mags[k] > peak) { peak = mags[k]; peakBin = k; }
  }
  const bandMean = bandSum / Math.max(1, maxBin - minBin + 1);
  const snr = bandMean > 0 ? peak / bandMean : 0;
  // Parabolic interpolation for sub-bin resolution
  let freq = peakBin * freqRes;
  if (peakBin > 0 && peakBin < mags.length - 1) {
    const al = mags[peakBin - 1], b = mags[peakBin], ar = mags[peakBin + 1];
    const denom = al - 2 * b + ar;
    if (Math.abs(denom) > 1e-12) freq = (peakBin + 0.5 * (al - ar) / denom) * freqRes;
  }
  return { bpm: Math.max(45, Math.min(180, Math.round(freq * 60))), snr };
}

// ─── Full pipeline ────────────────────────────────────────────────────────────
function runPipeline(
  raw: [number, number, number][],
  fps: number
): { signal: number[]; bpm: number; snr: number } {
  if (raw.length < 60) return { signal: [], bpm: 0, snr: 0 };

  // Green channel
  const green = raw.map(v => v[1]);

  // Step 1: linear detrend
  const detrended = linearDetrend(green);

  // Step 2: Butterworth bandpass 0.75–3.0 Hz (45–180 BPM), zero-phase
  const filtered = bandpass(detrended, 0.75, 3.0, fps);

  // Step 3: FFT → BPM
  const { bpm, snr } = estimateBPM(filtered, fps);

  // Normalize for display
  const s = std(filtered) || 1;
  return { signal: filtered.map(v => v / s), bpm, snr };
}

// ─── ROI candidate regions (fraction of frame) ────────────────────────────────
// Format: [x0, y0, x1, y1]  (fractions of video width/height)
const ROIS: [number, number, number, number][] = [
  [0.20, 0.10, 0.80, 0.55],   // A — upper-centre  (forehead + cheeks)
  [0.20, 0.30, 0.80, 0.75],   // B — mid-centre    (cheeks, nose)
  [0.15, 0.10, 0.85, 0.80],   // C — full face
  [0.25, 0.05, 0.75, 0.35],   // D — top-centre    (forehead)
  [0.25, 0.40, 0.75, 0.80],   // E — lower face    (cheeks)
];
const ROI_LABELS = ["UPPER", "MID", "FULL", "TOP", "LOWER"];

function sampleROI(
  ctx: CanvasRenderingContext2D,
  vw: number, vh: number,
  roi: [number, number, number, number]
): { r: number; g: number; b: number; ok: boolean } {
  const x = Math.floor(roi[0] * vw), y = Math.floor(roi[1] * vh);
  const w = Math.max(1, Math.floor((roi[2] - roi[0]) * vw));
  const h = Math.max(1, Math.floor((roi[3] - roi[1]) * vh));
  let r = 0, g = 0, b = 0, cnt = 0;
  try {
    const d = ctx.getImageData(x, y, w, h).data;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; cnt++; }
  } catch { return { r: 0, g: 0, b: 0, ok: false }; }
  if (!cnt) return { r: 0, g: 0, b: 0, ok: false };
  r /= cnt; g /= cnt; b /= cnt;
  // Valid if pixels are neither black nor saturated white
  const ok = r > 25 && g > 15 && b > 10 && r < 248 && g < 248 && b < 248;
  return { r, g, b, ok };
}

// Skin score: green mean closest to 120 (typical lit skin green value)
const skinScore = (g: number) => -Math.abs(g - 120);

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useHeartbeat(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const cvRef     = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef<number>(0);
  const rawRef    = useRef<[number, number, number][]>([]);
  const bpmRef    = useRef<number | null>(null);
  const frameRef  = useRef<number>(0);
  const calRef    = useRef<number>(0);
  const fpsRef    = useRef<number>(30);
  const prevMsRef = useRef<number>(0);
  const roiRef    = useRef<number>(2);   // default to full-face ROI

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "G-rPPG (Butterworth)",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { rafRef.current = requestAnimationFrame(processFrame); return; }

    // Track real FPS
    const now = performance.now();
    if (prevMsRef.current > 0) {
      const dt = (now - prevMsRef.current) / 1000;
      if (dt > 0.001) fpsRef.current = fpsRef.current * 0.95 + (1 / dt) * 0.05;
    }
    prevMsRef.current = now;
    frameRef.current++;
    calRef.current++;

    // Canvas init / resize
    if (!cvRef.current) cvRef.current = document.createElement("canvas");
    const cv = cvRef.current;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (cv.width !== vw) cv.width = vw;
    if (cv.height !== vh) cv.height = vh;
    ctx.drawImage(video, 0, 0);

    // ── Every 30 frames: re-evaluate all candidate ROIs ────────────────────
    if (frameRef.current % 30 === 1) {
      let bestScore = -Infinity, best = 2;
      for (let i = 0; i < ROIS.length; i++) {
        const { g, ok } = sampleROI(ctx, vw, vh, ROIS[i]);
        if (ok) { const s = skinScore(g); if (s > bestScore) { bestScore = s; best = i; } }
      }
      roiRef.current = best;
    }

    // ── Sample selected ROI ──────────────────────────────────────────────────
    const { r, g, b, ok } = sampleROI(ctx, vw, vh, ROIS[roiRef.current]);
    if (ok) {
      rawRef.current.push([r, g, b]);
      const maxN = Math.round(fpsRef.current * 12);   // 12-second rolling window
      if (rawRef.current.length > maxN) rawRef.current.shift();
    }

    // ── Run pipeline every 10 frames once we have ≥ 10 s of data ───────────
    const MIN_S = Math.round(fpsRef.current * 10);   // need 10 s
    const CAL_F = 150;                                 // 5 s calibration display

    if (frameRef.current % 10 === 0 && rawRef.current.length >= MIN_S) {
      const fps = Math.min(60, Math.max(15, fpsRef.current));
      const { signal, bpm, snr } = runPipeline(rawRef.current.slice(), fps);

      const SNR_MIN = 2.0;
      const isCalibrating = calRef.current < CAL_F;

      if (!isCalibrating && snr >= SNR_MIN && bpm >= 45 && bpm <= 180) {
        const prev = bpmRef.current ?? bpm;
        if (Math.abs(bpm - prev) <= 22 || bpmRef.current === null) {
          // Higher SNR → faster adaptation
          const alpha = snr >= 5 ? 0.40 : 0.22;
          bpmRef.current = Math.max(45, Math.min(180, Math.round(prev * (1 - alpha) + bpm * alpha)));
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";
      const isCal = isCalibrating || finalBpm === null;
      const conf = snr >= SNR_MIN ? Math.min(95, Math.round(((snr - SNR_MIN) / 4) * 95)) : 0;

      setData(prev => ({
        bpm: isCal ? null : finalBpm,
        confidence: conf,
        signal: signal.slice(-80),
        isActive: true,
        stress,
        trend: (finalBpm != null && prev.bpm != null)
          ? (finalBpm > prev.bpm + 3 ? "rising" : finalBpm < prev.bpm - 3 ? "falling" : "stable")
          : "stable",
        algorithm: "G-rPPG (Butterworth)",
        faceDetected: ok,
        frameRate: Math.round(fps),
        calibrating: isCal,
        roiDebug: ROI_LABELS[roiRef.current],
      }));

    } else if (frameRef.current % 30 === 0) {
      setData(prev => ({
        ...prev,
        isActive: true,
        faceDetected: ok,
        frameRate: Math.round(fpsRef.current),
        calibrating: bpmRef.current === null,
        roiDebug: ROI_LABELS[roiRef.current],
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef]);

  const start = useCallback(() => {
    rawRef.current = [];
    frameRef.current = 0;
    calRef.current = 0;
    bpmRef.current = null;
    fpsRef.current = 30;
    prevMsRef.current = 0;
    roiRef.current = 2;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Demo mode: bypass algorithm for presentations
  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18);
    calRef.current = 999;
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9);
    calRef.current = 999;
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
