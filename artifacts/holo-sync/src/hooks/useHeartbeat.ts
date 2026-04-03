/**
 * useHeartbeat — Browser rPPG
 *
 * Pipeline (prouast + habom2310 pattern):
 *  1. Multi-region ROI — 5 candidate boxes, pick the one with most skin-like mean
 *  2. Collect R, G, B means per frame into a 15-second ring buffer
 *  3. Denoise: reject frames where any channel jumped > 4σ (head movement)
 *  4. Standardise (zero-mean, unit-variance per channel)
 *  5. Tarvainen-style HP detrend (subtract 6 s rolling mean)
 *  6. 3-pass moving-average smoothing (kernel ≈ fps/6)
 *  7. Select green channel (proven optimal in both reference repos)
 *  8. Hann window + 4× zero-pad FFT
 *  9. Find spectral peak in 42–180 BPM, SNR gate ≥ 2.0
 * 10. Temporal EMA smoothing of BPM
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
  roiDebug?: string;   // debug: which region is being used
}

// ─── Math helpers ─────────────────────────────────────────────────────────────
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std  = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)) || 1e-8;
};

// ─── Step 1: ROI extraction ───────────────────────────────────────────────────
// We sample 5 candidate regions across the frame and pick the best one.
// "Best" = closest to typical skin mean in green channel (100-180).
const CANDIDATE_ROIS = [
  // (x%, y%, w%, h%)   — fractional offsets into the video frame
  [0.20, 0.10, 0.60, 0.45],   // A — upper centre  (forehead + eyes)
  [0.20, 0.30, 0.60, 0.45],   // B — mid centre    (cheeks + nose)
  [0.15, 0.15, 0.70, 0.65],   // C — full face      (whole face area)
  [0.25, 0.05, 0.50, 0.35],   // D — top-centre    (forehead heavy)
  [0.25, 0.35, 0.50, 0.40],   // E — lower-centre  (cheeks heavy)
];
const ROI_LABELS = ["UPPER", "MID", "FULL", "TOP", "LOWER"];

function sampleRegion(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
): { r: number; g: number; b: number; ok: boolean } {
  let r = 0, g = 0, b = 0, cnt = 0;
  try {
    const d = ctx.getImageData(x, y, w, h).data;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]; g += d[i + 1]; b += d[i + 2]; cnt++;
    }
  } catch { return { r: 0, g: 0, b: 0, ok: false }; }
  if (!cnt) return { r: 0, g: 0, b: 0, ok: false };
  r /= cnt; g /= cnt; b /= cnt;
  // "ok" — pixel looks like lit skin: not black, not white, some brightness
  const ok = r > 30 && g > 20 && b > 10 && r < 245 && g < 245 && b < 245;
  return { r, g, b, ok };
}

// Score: how close is the green mean to the ideal skin green (≈130)?
const skinScore = (g: number) => -Math.abs(g - 130);

// ─── Step 3: Denoise (reject frames where a channel jumps > 4σ) ──────────────
function denoise(rgb: [number, number, number][]): [number, number, number][] {
  if (rgb.length < 4) return rgb;
  const out = [...rgb];
  for (let c = 0; c < 3; c++) {
    const vals = rgb.map(v => v[c]);
    const diffs = vals.slice(1).map((v, i) => v - vals[i]);
    const dm = mean(diffs), ds = std(diffs) * 4;
    let adj = 0;
    for (let i = 1; i < out.length; i++) {
      const d = vals[i] - vals[i - 1];
      if (Math.abs(d - dm) > ds) adj += dm - d;
      (out[i] as number[])[c] = vals[i] + adj;
    }
  }
  return out;
}

// ─── Step 4: Standardise ─────────────────────────────────────────────────────
function standardise(rgb: [number, number, number][]): number[][] {
  return [0, 1, 2].map(c => {
    const ch = rgb.map(v => v[c]);
    const m = mean(ch), s = std(ch);
    return ch.map(v => (v - m) / s);
  });
}

// ─── Step 5: Tarvainen-style HP detrend ──────────────────────────────────────
function detrend(sig: number[], fps: number): number[] {
  const winLen = Math.max(5, Math.round(fps * 6));
  const half   = Math.floor(winLen / 2);
  return sig.map((v, i) => {
    const lo = Math.max(0, i - half), hi = Math.min(sig.length - 1, i + half);
    let s = 0;
    for (let j = lo; j <= hi; j++) s += sig[j];
    return v - s / (hi - lo + 1);
  });
}

// ─── Step 6: Moving average ───────────────────────────────────────────────────
function movingAvg(sig: number[], passes: number, k: number): number[] {
  let s = [...sig];
  for (let p = 0; p < passes; p++) {
    const out = new Array(s.length).fill(0);
    const half = Math.floor(k / 2);
    for (let i = 0; i < s.length; i++) {
      const lo = Math.max(0, i - half), hi = Math.min(s.length - 1, i + half);
      let sum = 0;
      for (let j = lo; j <= hi; j++) sum += s[j];
      out[i] = sum / (hi - lo + 1);
    }
    s = out;
  }
  return s;
}

// ─── Step 8: Cooley–Tukey FFT ────────────────────────────────────────────────
function fftMag(sig: number[]): number[] {
  const n = sig.length;
  let sz = 1;
  while (sz < n) sz <<= 1;
  const re = new Float64Array(sz), im = new Float64Array(sz);
  for (let i = 0; i < n; i++) re[i] = sig[i];
  // Bit-reversal
  for (let i = 1, j = 0; i < sz; i++) {
    let bit = sz >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // Butterfly
  for (let len = 2; len <= sz; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = -Math.sin(ang);
    for (let i = 0; i < sz; i += len) {
      let pr = 1, pi = 0;
      for (let j = 0; j < len >> 1; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * pr - im[i + j + len / 2] * pi;
        const vi = re[i + j + len / 2] * pi + im[i + j + len / 2] * pr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = pr * wr - pi * wi;
        pi = pr * wi + pi * wr; pr = t;
      }
    }
  }
  const mags = new Array(sz / 2);
  for (let i = 0; i < sz / 2; i++) mags[i] = Math.sqrt(re[i] ** 2 + im[i] ** 2);
  return mags;
}

// ─── Step 9: BPM from green signal ───────────────────────────────────────────
function estimateBPM(green: number[], fps: number) {
  const n = green.length;
  if (n < 30) return { bpm: 0, confidence: 0, snr: 0 };
  // Hann window
  const windowed = green.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));
  // 4× zero-pad
  const padded = [...windowed, ...new Array(n * 3).fill(0)];
  const mags   = fftMag(padded);
  const freqRes = fps / padded.length;         // Hz per FFT bin
  const minBin  = Math.floor(42  / 60 / freqRes);
  const maxBin  = Math.ceil (180 / 60 / freqRes);
  if (minBin >= mags.length || maxBin <= 0) return { bpm: 0, confidence: 0, snr: 0 };
  const hi = Math.min(maxBin, mags.length - 1);
  let peakMag = 0, peakBin = minBin, bandSum = 0;
  for (let k = minBin; k <= hi; k++) {
    bandSum += mags[k];
    if (mags[k] > peakMag) { peakMag = mags[k]; peakBin = k; }
  }
  const bandMean = bandSum / (hi - minBin + 1 || 1);
  const snr      = bandMean > 0 ? peakMag / bandMean : 0;
  // Parabolic interpolation for sub-bin accuracy
  let freq = peakBin * freqRes;
  if (peakBin > 0 && peakBin < mags.length - 1) {
    const a = mags[peakBin - 1], b = mags[peakBin], c = mags[peakBin + 1];
    const denom = a - 2 * b + c;
    if (Math.abs(denom) > 1e-10) freq = (peakBin + 0.5 * (a - c) / denom) * freqRes;
  }
  const bpm = Math.round(freq * 60);
  const confidence = snr < 2.0 ? 0 : Math.min(95, Math.round(((snr - 2.0) / 4.0) * 95));
  return { bpm: Math.max(42, Math.min(180, bpm)), confidence, snr };
}

// ─── Full pipeline ────────────────────────────────────────────────────────────
function runPipeline(raw: [number, number, number][], fps: number) {
  if (raw.length < 30) return { signal: [] as number[], bpm: 0, confidence: 0, snr: 0 };
  const denoised     = denoise(raw);
  const [, green]    = standardise(denoised);
  const detrended    = detrend(green, fps);
  const kernel       = Math.max(2, Math.floor(fps / 6));
  const smoothed     = movingAvg(detrended, 3, kernel);
  const result       = estimateBPM(smoothed, fps);
  const s            = std(smoothed) || 1;
  return { signal: smoothed.map(v => v / s), ...result };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useHeartbeat(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const cvRef      = useRef<HTMLCanvasElement | null>(null);
  const rafRef     = useRef<number>(0);
  const rawRef     = useRef<[number, number, number][]>([]);
  const bpmRef     = useRef<number | null>(null);
  const frameRef   = useRef<number>(0);
  const calRef     = useRef<number>(0);
  const fpsRef     = useRef<number>(30);
  const prevMsRef  = useRef<number>(0);
  const roiIdxRef  = useRef<number>(2);          // start with "full face" ROI
  const roiScoreRef = useRef<number>(-Infinity);

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
    const cv = cvRef.current;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }

    const vw = video.videoWidth, vh = video.videoHeight;
    if (cv.width !== vw) cv.width = vw;
    if (cv.height !== vh) cv.height = vh;
    ctx.drawImage(video, 0, 0);

    // ── Every 30 frames: evaluate all ROI candidates, pick best ──────────────
    if (frameRef.current % 30 === 1) {
      let bestScore = -Infinity, bestIdx = 2;
      for (let i = 0; i < CANDIDATE_ROIS.length; i++) {
        const [fx, fy, fw, fh] = CANDIDATE_ROIS[i];
        const x = Math.floor(fx * vw), y = Math.floor(fy * vh);
        const w = Math.max(1, Math.floor(fw * vw)), h = Math.max(1, Math.floor(fh * vh));
        const { g, ok } = sampleRegion(ctx, x, y, w, h);
        if (ok) {
          const score = skinScore(g);
          if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
      }
      roiIdxRef.current = bestIdx;
      roiScoreRef.current = bestScore;
    }

    // ── Sample current best ROI ───────────────────────────────────────────────
    const [fx, fy, fw, fh] = CANDIDATE_ROIS[roiIdxRef.current];
    const x = Math.floor(fx * vw), y = Math.floor(fy * vh);
    const w = Math.max(1, Math.floor(fw * vw)), h = Math.max(1, Math.floor(fh * vh));
    const { r, g, b, ok } = sampleRegion(ctx, x, y, w, h);

    if (ok) {
      rawRef.current.push([r, g, b]);
      const maxSamples = Math.round(fpsRef.current * 15);
      if (rawRef.current.length > maxSamples) rawRef.current.shift();
    }

    // ── Run pipeline every 10 frames ─────────────────────────────────────────
    const MIN_SAMPLES = Math.round(fpsRef.current * 5);  // need 5 s
    const CAL_FRAMES  = 120;                               // 4 s calibration display

    if (frameRef.current % 10 === 0 && rawRef.current.length >= MIN_SAMPLES) {
      const fps      = Math.min(60, Math.max(15, fpsRef.current));
      const snapshot = rawRef.current.slice();
      const { signal, bpm, confidence, snr } = runPipeline(snapshot, fps);

      const SNR_MIN = 2.0;
      const calState = calRef.current < CAL_FRAMES;

      if (!calState && snr >= SNR_MIN && bpm >= 42 && bpm <= 180) {
        const prev  = bpmRef.current ?? bpm;
        if (Math.abs(bpm - prev) <= 25 || bpmRef.current === null) {
          const alpha   = snr >= 5 ? 0.35 : 0.18;
          const smoothed = Math.round(prev * (1 - alpha) + bpm * alpha);
          bpmRef.current = Math.max(42, Math.min(180, smoothed));
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm !== null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";
      const isCal = calState || finalBpm === null;

      setData(prev => ({
        bpm:        isCal ? null : finalBpm,
        confidence: snr >= SNR_MIN ? Math.min(95, Math.round(((snr - SNR_MIN) / 4) * 95)) : 0,
        signal:     signal.slice(-80),
        isActive:   true,
        stress,
        trend:      (finalBpm !== null && prev.bpm !== null)
                      ? (finalBpm > prev.bpm + 3 ? "rising" : finalBpm < prev.bpm - 3 ? "falling" : "stable")
                      : "stable",
        algorithm:  "G-rPPG",
        faceDetected: ok,
        frameRate:  Math.round(fps),
        calibrating: isCal,
        roiDebug:   ROI_LABELS[roiIdxRef.current],
      }));
    } else if (frameRef.current % 30 === 0) {
      setData(prev => ({
        ...prev,
        isActive:    true,
        faceDetected: ok,
        frameRate:   Math.round(fpsRef.current),
        calibrating: bpmRef.current === null,
        roiDebug:    ROI_LABELS[roiIdxRef.current],
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
    roiIdxRef.current = 2;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Demo overrides
  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18);
    calRef.current = 300;
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9);
    calRef.current = 300;
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
