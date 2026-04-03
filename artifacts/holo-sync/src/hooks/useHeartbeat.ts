/**
 * useHeartbeat — Browser rPPG heart rate from webcam
 *
 * Algorithm matches prouast/heartbeat-js + habom2310 pipeline:
 *   1. Forehead ROI (30-70% width, 8-25% height — same as prouast makeMask)
 *   2. Collect R, G, B channel means per frame
 *   3. Denoise (remove sudden channel jumps)
 *   4. Standardize (zero-mean, unit-variance per channel)
 *   5. Tarvainen-style detrend (lambda≈10 HP filter)
 *   6. 3-pass moving average (kernel ≈ fps/6)
 *   7. Select green channel
 *   8. Hann window + 4× zero-pad FFT
 *   9. Find spectral peak in 42–180 BPM with SNR gate
 *  10. Temporal smoothing of BPM
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
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function mean(a: number[]): number {
  return a.length === 0 ? 0 : a.reduce((s, v) => s + v, 0) / a.length;
}
function std(a: number[]): number {
  if (a.length < 2) return 1e-8;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1e-8;
}

// ─── 1. Denoise: remove frames where a channel jumped > 3σ ───────────────────
function denoise(rgb: [number, number, number][]): [number, number, number][] {
  if (rgb.length < 4) return rgb;
  const out = [...rgb];
  for (let c = 0; c < 3; c++) {
    const vals = rgb.map(v => v[c]);
    const diffs = vals.slice(1).map((v, i) => v - vals[i]);
    const dm = mean(diffs);
    const ds = std(diffs) * 3;
    let adj = 0;
    for (let i = 1; i < out.length; i++) {
      const d = vals[i] - vals[i - 1];
      if (Math.abs(d - dm) > ds) adj += dm - d;
      (out[i] as number[])[c] = vals[i] + adj;
    }
  }
  return out;
}

// ─── 2. Standardize each channel ─────────────────────────────────────────────
function standardize(rgb: [number, number, number][]): number[][] {
  return [0, 1, 2].map(c => {
    const ch = rgb.map(v => v[c]);
    const m = mean(ch), s = std(ch);
    return ch.map(v => (v - m) / s);
  });
}

// ─── 3. Tarvainen-style HP detrend ───────────────────────────────────────────
// Approximated as: subtract the result of a very-long smoothing filter.
// lambda≈10 → cutoff ≈ 0.3 Hz (removes everything below ~18 BPM).
function tarvainen(sig: number[], fps: number): number[] {
  // Use a running-average of length = fps * 6s as the "trend"
  const winLen = Math.max(3, Math.round(fps * 6));
  const trend = new Array(sig.length).fill(0);
  for (let i = 0; i < sig.length; i++) {
    const lo = Math.max(0, i - Math.floor(winLen / 2));
    const hi = Math.min(sig.length - 1, i + Math.floor(winLen / 2));
    let s = 0;
    for (let j = lo; j <= hi; j++) s += sig[j];
    trend[i] = s / (hi - lo + 1);
  }
  return sig.map((v, i) => v - trend[i]);
}

// ─── 4. Moving average (n passes) ────────────────────────────────────────────
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

// ─── 5. FFT magnitude (DFT, O(N log N) approximation via Cooley–Tukey) ───────
function fftMagnitude(sig: number[]): number[] {
  const n = sig.length;
  if (n === 1) return [Math.abs(sig[0])];
  // Pad to power of 2
  let size = 1;
  while (size < n) size <<= 1;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < n; i++) re[i] = sig[i];
  // Cooley–Tukey iterative FFT
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  // FFT butterfly
  for (let len = 2; len <= size; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = -Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let pr = 1, pi = 0;
      for (let j = 0; j < len >> 1; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len/2] * pr - im[i + j + len/2] * pi;
        const vi = re[i + j + len/2] * pi + im[i + j + len/2] * pr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len/2] = ur - vr; im[i + j + len/2] = ui - vi;
        const tmp = pr * wr - pi * wi;
        pi = pr * wi + pi * wr; pr = tmp;
      }
    }
  }
  // Return magnitudes (first half only)
  const mags = new Array(size / 2);
  for (let i = 0; i < size / 2; i++) mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  return mags;
}

// ─── 6. BPM estimation from green signal ─────────────────────────────────────
interface BpmResult { bpm: number; confidence: number; snr: number }

function estimateBPM(green: number[], fps: number): BpmResult {
  const n = green.length;
  if (n < 30) return { bpm: 0, confidence: 0, snr: 0 };

  // Hann window
  const windowed = green.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));

  // 4× zero-pad for higher frequency resolution
  const padded = [...windowed, ...new Array(n * 3).fill(0)];
  const mags = fftMagnitude(padded);
  const fftSize = mags.length; // padded.length / 2 rounded to power-of-2

  const freqRes = fps / padded.length;  // Hz per bin (much finer with zero-padding)

  const LOW_BPM = 42, HIGH_BPM = 180;
  const minBin = Math.max(0, Math.floor(LOW_BPM / 60 / freqRes));
  const maxBin = Math.min(fftSize - 1, Math.ceil(HIGH_BPM / 60 / freqRes));

  if (minBin >= maxBin) return { bpm: 0, confidence: 0, snr: 0 };

  // Find peak in cardiac band
  let peakMag = 0, peakBin = minBin;
  let bandSum = 0, bandCount = 0;
  for (let k = minBin; k <= maxBin; k++) {
    bandSum += mags[k];
    bandCount++;
    if (mags[k] > peakMag) { peakMag = mags[k]; peakBin = k; }
  }
  const bandMean = bandCount > 0 ? bandSum / bandCount : 1e-8;
  const snr = bandMean > 0 ? peakMag / bandMean : 0;

  // Parabolic interpolation for sub-bin accuracy
  let fineFreq = peakBin * freqRes;
  if (peakBin > 0 && peakBin < fftSize - 1) {
    const alpha = mags[peakBin - 1];
    const beta  = mags[peakBin];
    const gamma = mags[peakBin + 1];
    const denom = alpha - 2 * beta + gamma;
    if (Math.abs(denom) > 1e-10) {
      fineFreq = (peakBin + 0.5 * (alpha - gamma) / denom) * freqRes;
    }
  }

  const bpm = Math.round(fineFreq * 60);

  // Confidence: 0% below SNR=1.5, 95% at SNR≥6
  const confidence = snr < 1.5 ? 0 : Math.min(95, Math.round(((snr - 1.5) / 4.5) * 95));

  return { bpm: Math.max(42, Math.min(180, bpm)), confidence, snr };
}

// ─── Full pipeline ────────────────────────────────────────────────────────────
function runPipeline(
  raw: [number, number, number][],
  fps: number
): { signal: number[]; bpm: number; confidence: number; snr: number } {
  if (raw.length < 30) return { signal: [], bpm: 0, confidence: 0, snr: 0 };

  // Step 1-2: denoise + standardize
  const denoised = denoise(raw);
  const [, green] = standardize(denoised);

  // Step 3: Tarvainen detrend
  const detrended = tarvainen(green, fps);

  // Step 4: 3-pass moving average, kernel = max(floor(fps/6), 2)
  const kernel = Math.max(2, Math.floor(fps / 6));
  const smoothed = movingAvg(detrended, 3, kernel);

  // Step 5-6: zero-padded FFT → BPM estimate
  const result = estimateBPM(smoothed, fps);

  // Normalize for display
  const s = std(smoothed);
  const display = s > 0 ? smoothed.map(v => v / s) : smoothed;

  return { signal: display, ...result };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useHeartbeat(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const rafRef     = useRef<number>(0);
  const rawRgbRef  = useRef<[number, number, number][]>([]);
  const confirmedBpmRef = useRef<number | null>(null);
  const frameCountRef   = useRef<number>(0);
  const calFramesRef    = useRef<number>(0);
  const fpsRef          = useRef<number>(30);
  const lastFrameMs     = useRef<number>(0);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "G-rPPG",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  // ── ROI extraction — matches prouast makeMask ────────────────────────────
  // Without a face detector we approximate:
  //   x: 28-72% of frame width  (face typically fills ~70% of a webcam frame)
  //   y: 6-26% of frame height  (forehead region)
  const extractROI = useCallback((
    ctx: CanvasRenderingContext2D, w: number, h: number
  ): { r: number; g: number; b: number; skinOk: boolean } => {
    const x1 = Math.floor(w * 0.28), x2 = Math.floor(w * 0.72);
    const y1 = Math.floor(h * 0.06), y2 = Math.floor(h * 0.26);
    let r = 0, g = 0, b = 0, cnt = 0;
    try {
      const px = ctx.getImageData(x1, y1, x2 - x1, y2 - y1).data;
      for (let i = 0; i < px.length; i += 4) {
        r += px[i]; g += px[i + 1]; b += px[i + 2]; cnt++;
      }
    } catch { /* cross-origin guard */ }
    if (cnt === 0) return { r: 0, g: 0, b: 0, skinOk: false };
    r /= cnt; g /= cnt; b /= cnt;
    // Skin tone check: lit human skin always has r>60, g>30, b>15, r>b, g>b*0.8
    const skinOk = r > 60 && g > 30 && b > 15 && r > b && g > b * 0.8 && r < 248;
    return { r, g, b, skinOk };
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    if (lastFrameMs.current > 0) {
      const dt = (now - lastFrameMs.current) / 1000;
      if (dt > 0) fpsRef.current = fpsRef.current * 0.96 + (1 / dt) * 0.04;
    }
    lastFrameMs.current = now;
    frameCountRef.current++;
    calFramesRef.current++;

    // Lazy canvas init
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }

    cv.width = video.videoWidth;
    cv.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const { r, g, b, skinOk } = extractROI(ctx, cv.width, cv.height);

    if (skinOk) {
      rawRgbRef.current.push([r, g, b]);
      // prouast: windowSize * fps samples max (we use 15 sec)
      const maxSamples = Math.round(fpsRef.current * 15);
      if (rawRgbRef.current.length > maxSamples) rawRgbRef.current.shift();
    }

    // Run pipeline every 10 frames
    const PROCESS_EVERY = 10;
    const MIN_SAMPLES = Math.round(fpsRef.current * 4);  // need 4s minimum
    const CAL_FRAMES  = 90;  // show "calibrating" for first 3s

    if (frameCountRef.current % PROCESS_EVERY === 0 &&
        rawRgbRef.current.length >= MIN_SAMPLES) {

      const fps = Math.min(60, Math.max(15, fpsRef.current));
      const snapshot = rawRgbRef.current.slice();

      const { signal, bpm, confidence, snr } = runPipeline(snapshot, fps);

      const SNR_MIN = 2.0;
      const isCalibrating = calFramesRef.current < CAL_FRAMES;

      if (snr >= SNR_MIN && bpm >= 42 && bpm <= 180) {
        const prev = confirmedBpmRef.current ?? bpm;
        // Reject if jump > 22 BPM (noise spike)
        if (Math.abs(bpm - prev) <= 22 || confirmedBpmRef.current === null) {
          const alpha = snr >= 5 ? 0.35 : 0.18;
          const smoothed = Math.round(prev * (1 - alpha) + bpm * alpha);
          confirmedBpmRef.current = Math.max(42, Math.min(180, smoothed));
        }
      }

      const finalBpm = confirmedBpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm !== null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";

      setData(prev => ({
        bpm: isCalibrating || finalBpm === null ? null : finalBpm,
        confidence: Math.min(95, Math.round(((Math.max(0, snr - SNR_MIN)) / 4) * 95)),
        signal: signal.slice(-80),
        isActive: true,
        stress,
        trend: (finalBpm !== null && prev.bpm !== null)
          ? (finalBpm > prev.bpm + 3 ? "rising" : finalBpm < prev.bpm - 3 ? "falling" : "stable")
          : "stable",
        algorithm: "G-rPPG",
        faceDetected: skinOk,
        frameRate: Math.round(fps),
        calibrating: isCalibrating || finalBpm === null,
      }));

    } else if (frameCountRef.current % PROCESS_EVERY === 0) {
      setData(prev => ({
        ...prev,
        isActive: true,
        faceDetected: skinOk,
        frameRate: Math.round(fpsRef.current),
        calibrating: confirmedBpmRef.current === null,
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, extractROI]);

  const start = useCallback(() => {
    rawRgbRef.current = [];
    frameCountRef.current = 0;
    calFramesRef.current = 0;
    confirmedBpmRef.current = null;
    fpsRef.current = 30;
    lastFrameMs.current = 0;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Demo overrides
  const panic = useCallback(() => {
    confirmedBpmRef.current = 116 + Math.floor(Math.random() * 18);
    calFramesRef.current = 200;
    setData(prev => ({ ...prev, bpm: confirmedBpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);

  const calm = useCallback(() => {
    confirmedBpmRef.current = 60 + Math.floor(Math.random() * 9);
    calFramesRef.current = 200;
    setData(prev => ({ ...prev, bpm: confirmedBpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
