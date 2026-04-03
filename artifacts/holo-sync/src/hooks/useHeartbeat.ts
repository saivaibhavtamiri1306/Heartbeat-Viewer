/**
 * useHeartbeat — Browser rPPG with optional MediaPipe face-box ROI
 *
 * When faceBox is provided (from useFaceDetection), uses the exact forehead
 * region of the detected face as ROI — this is how the reference video works.
 * Falls back to multi-candidate scanning when face is not yet detected.
 *
 * Pipeline:
 *  1. ROI extraction — face forehead (top 30% of face box) when detected
 *  2. Linear detrend
 *  3. 2nd-order Butterworth bandpass 0.75–3.0 Hz (45–180 BPM), zero-phase
 *  4. Green channel FFT with 4× zero-padding + parabolic interpolation
 *  5. SNR gate + EMA temporal smoothing
 */
import { useRef, useState, useEffect, useCallback } from "react";
import type { FaceBox } from "./useFaceDetection";

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
const std  = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)) || 1e-10;
};

// ─── Linear detrend ───────────────────────────────────────────────────────────
function linearDetrend(sig: number[]): number[] {
  const n = sig.length;
  if (n < 2) return [...sig];
  const xm = (n - 1) / 2, ym = mean(sig);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xm) * (sig[i] - ym); den += (i - xm) ** 2; }
  const slope = den !== 0 ? num / den : 0;
  const intercept = ym - slope * xm;
  return sig.map((v, i) => v - (slope * i + intercept));
}

// ─── 2nd-order Butterworth via bilinear transform ────────────────────────────
type Coeff3 = [number, number, number];
function butter2HP(fc: number, fs: number): { b: Coeff3; a: Coeff3 } {
  const w = 2 * Math.tan(Math.PI * fc / fs), w2 = w * w, sq2 = Math.SQRT2;
  const norm = 4 + 2 * sq2 * w + w2;
  return { b: [4 / norm, -8 / norm, 4 / norm], a: [1, (2 * w2 - 8) / norm, (4 - 2 * sq2 * w + w2) / norm] };
}
function butter2LP(fc: number, fs: number): { b: Coeff3; a: Coeff3 } {
  const w = 2 * Math.tan(Math.PI * fc / fs), w2 = w * w, sq2 = Math.SQRT2;
  const norm = 4 + 2 * sq2 * w + w2;
  return { b: [w2 / norm, 2 * w2 / norm, w2 / norm], a: [1, (2 * w2 - 8) / norm, (4 - 2 * sq2 * w + w2) / norm] };
}
function applyIIR(sig: number[], b: Coeff3, a: Coeff3): number[] {
  const y = new Array(sig.length).fill(0);
  for (let i = 0; i < sig.length; i++) {
    let v = b[0] * sig[i];
    if (i >= 1) v += b[1] * sig[i - 1] - a[1] * y[i - 1];
    if (i >= 2) v += b[2] * sig[i - 2] - a[2] * y[i - 2];
    y[i] = v;
  }
  return y;
}
function filtfilt(sig: number[], b: Coeff3, a: Coeff3): number[] {
  const fwd = applyIIR(sig, b, a);
  return applyIIR([...fwd].reverse(), b, a).reverse();
}
function bandpass(sig: number[], lo: number, hi: number, fs: number): number[] {
  const hp = butter2HP(lo, fs), lp = butter2LP(hi, fs);
  return filtfilt(filtfilt(sig, hp.b, hp.a), lp.b, lp.a);
}

// ─── FFT ──────────────────────────────────────────────────────────────────────
function fftMag(sig: number[]): number[] {
  const n = sig.length; let sz = 1; while (sz < n) sz <<= 1;
  const re = new Float64Array(sz), im = new Float64Array(sz);
  for (let i = 0; i < n; i++) re[i] = sig[i];
  for (let i = 1, j = 0; i < sz; i++) {
    let bit = sz >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
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
  const m = new Array(sz >> 1);
  for (let i = 0; i < sz >> 1; i++) m[i] = Math.sqrt(re[i] ** 2 + im[i] ** 2);
  return m;
}

// ─── BPM from filtered green signal ──────────────────────────────────────────
function estimateBPM(sig: number[], fps: number): { bpm: number; snr: number } {
  const n = sig.length;
  if (n < 60) return { bpm: 0, snr: 0 };
  const w = sig.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));
  const padded = [...w, ...new Array(n * 3).fill(0)];
  const mags   = fftMag(padded);
  const fr     = fps / padded.length;
  const lo = Math.max(1, Math.floor(45  / 60 / fr));
  const hi = Math.min(mags.length - 2, Math.ceil(180 / 60 / fr));
  let peak = 0, pb = lo, bsum = 0;
  for (let k = lo; k <= hi; k++) { bsum += mags[k]; if (mags[k] > peak) { peak = mags[k]; pb = k; } }
  const bmean = bsum / Math.max(1, hi - lo + 1);
  const snr   = bmean > 0 ? peak / bmean : 0;
  let freq    = pb * fr;
  if (pb > 0 && pb < mags.length - 1) {
    const al = mags[pb - 1], b = mags[pb], ar = mags[pb + 1];
    const d = al - 2 * b + ar;
    if (Math.abs(d) > 1e-12) freq = (pb + 0.5 * (al - ar) / d) * fr;
  }
  return { bpm: Math.max(45, Math.min(180, Math.round(freq * 60))), snr };
}

// ─── Full pipeline ────────────────────────────────────────────────────────────
function runPipeline(raw: [number, number, number][], fps: number) {
  if (raw.length < 60) return { signal: [] as number[], bpm: 0, snr: 0 };
  const green    = raw.map(v => v[1]);
  const detrend  = linearDetrend(green);
  const filtered = bandpass(detrend, 0.75, 3.0, fps);
  const { bpm, snr } = estimateBPM(filtered, fps);
  const s = std(filtered) || 1;
  return { signal: filtered.map(v => v / s), bpm, snr };
}

// ─── ROI candidates (fallback when no face detected) ─────────────────────────
const FALLBACK_ROIS: [number, number, number, number][] = [
  [0.15, 0.08, 0.85, 0.60],
  [0.20, 0.25, 0.80, 0.75],
  [0.15, 0.08, 0.85, 0.82],
  [0.25, 0.05, 0.75, 0.40],
];
const ROI_LABELS = ["FOREHEAD", "CHEEKS", "FULL", "CROWN"];

function samplePixels(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
): { r: number; g: number; b: number; ok: boolean } {
  const wi = Math.max(1, Math.floor(w)), hi = Math.max(1, Math.floor(h));
  let r = 0, g = 0, b = 0, cnt = 0;
  try {
    const d = ctx.getImageData(Math.floor(x), Math.floor(y), wi, hi).data;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; cnt++; }
  } catch { return { r: 0, g: 0, b: 0, ok: false }; }
  if (!cnt) return { r: 0, g: 0, b: 0, ok: false };
  r /= cnt; g /= cnt; b /= cnt;
  return { r, g, b, ok: r > 20 && g > 15 && b > 8 && r < 248 && g < 248 && b < 248 };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?: React.MutableRefObject<FaceBox | null>
) {
  const cvRef     = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef<number>(0);
  const rawRef    = useRef<[number, number, number][]>([]);
  const bpmRef    = useRef<number | null>(null);
  const frameRef  = useRef<number>(0);
  const calRef    = useRef<number>(0);
  const fpsRef    = useRef<number>(30);
  const prevMsRef = useRef<number>(0);
  const roiIdxRef = useRef<number>(2);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "G-rPPG",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { rafRef.current = requestAnimationFrame(processFrame); return; }

    const now = performance.now();
    if (prevMsRef.current > 0) {
      const dt = (now - prevMsRef.current) / 1000;
      if (dt > 0.001) fpsRef.current = fpsRef.current * 0.95 + (1 / dt) * 0.05;
    }
    prevMsRef.current = now;
    frameRef.current++;
    calRef.current++;

    if (!cvRef.current) cvRef.current = document.createElement("canvas");
    const cv  = cvRef.current;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (cv.width !== vw) cv.width = vw;
    if (cv.height !== vh) cv.height = vh;
    ctx.drawImage(video, 0, 0);

    // ── Determine ROI ──────────────────────────────────────────────────────
    let roiResult: { r: number; g: number; b: number; ok: boolean };
    let roiLabel = "FACE";

    const box = faceBoxRef?.current;
    if (box && box.w > 20 && box.h > 20) {
      // Use top-30% of detected face (forehead ROI) — exact like reference video
      const rx = box.x + box.w * 0.15;
      const ry = box.y + box.h * 0.05;
      const rw = box.w * 0.70;
      const rh = box.h * 0.35;
      roiResult = samplePixels(ctx, rx, ry, rw, rh);
      roiLabel  = "FACE-ROI";
    } else {
      // Fallback: rotate through candidates every 30 frames
      if (frameRef.current % 30 === 1) {
        let best = -Infinity, bestI = 2;
        for (let i = 0; i < FALLBACK_ROIS.length; i++) {
          const [fx, fy, fw, fh] = FALLBACK_ROIS[i];
          const s = samplePixels(ctx, fx * vw, fy * vh, (fw - fx) * vw, (fh - fy) * vh);
          if (s.ok) { const sc = -Math.abs(s.g - 120); if (sc > best) { best = sc; bestI = i; } }
        }
        roiIdxRef.current = bestI;
      }
      const [fx, fy, fw, fh] = FALLBACK_ROIS[roiIdxRef.current];
      roiResult = samplePixels(ctx, fx * vw, fy * vh, (fw - fx) * vw, (fh - fy) * vh);
      roiLabel  = ROI_LABELS[roiIdxRef.current];
    }

    if (roiResult.ok) {
      rawRef.current.push([roiResult.r, roiResult.g, roiResult.b]);
      const maxN = Math.round(fpsRef.current * 12);
      if (rawRef.current.length > maxN) rawRef.current.shift();
    }

    // ── Run pipeline every 10 frames ─────────────────────────────────────
    const MIN_S = Math.round(fpsRef.current * 10);
    const CAL_F = 120;

    if (frameRef.current % 10 === 0 && rawRef.current.length >= MIN_S) {
      const fps = Math.min(60, Math.max(15, fpsRef.current));
      const { signal, bpm, snr } = runPipeline(rawRef.current.slice(), fps);
      const SNR_MIN   = 2.0;
      const isCal     = calRef.current < CAL_F;

      if (!isCal && snr >= SNR_MIN && bpm >= 45 && bpm <= 180) {
        const prev = bpmRef.current ?? bpm;
        if (Math.abs(bpm - prev) <= 22 || bpmRef.current === null) {
          const alpha = snr >= 5 ? 0.40 : 0.22;
          bpmRef.current = Math.max(45, Math.min(180, Math.round(prev * (1 - alpha) + bpm * alpha)));
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";
      const calState = isCal || finalBpm === null;

      setData(prev => ({
        bpm:         calState ? null : finalBpm,
        confidence:  snr >= SNR_MIN ? Math.min(95, Math.round(((snr - SNR_MIN) / 4) * 95)) : 0,
        signal:      signal.slice(-80),
        isActive:    true,
        stress,
        trend:       (finalBpm != null && prev.bpm != null)
                       ? (finalBpm > prev.bpm + 3 ? "rising" : finalBpm < prev.bpm - 3 ? "falling" : "stable")
                       : "stable",
        algorithm:   box ? "Face-rPPG" : "G-rPPG",
        faceDetected: roiResult.ok,
        frameRate:   Math.round(fps),
        calibrating: calState,
        roiDebug:    roiLabel,
      }));

    } else if (frameRef.current % 30 === 0) {
      setData(prev => ({
        ...prev,
        isActive:    true,
        faceDetected: roiResult.ok,
        frameRate:   Math.round(fpsRef.current),
        calibrating: bpmRef.current === null,
        roiDebug:    roiLabel,
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef]);

  const start = useCallback(() => {
    rawRef.current = [];
    frameRef.current = 0;
    calRef.current = 0;
    bpmRef.current = null;
    fpsRef.current = 30;
    prevMsRef.current = 0;
    roiIdxRef.current = 2;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

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
