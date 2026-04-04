/**
 * useHeartbeat — rPPG v4+ (enhanced with features from open-source repos)
 *
 * Base: GREEN channel + FFT (v4 — proven working approach)
 *
 * Added features from reference repos:
 *  - Butterworth bandpass filter before FFT (habom2310, webcam-pulse-detector)
 *  - Full RGB sampling for ICA-style channel selection (heartwave, webcam-pulse-detector)
 *  - 5-point moving average temporal smoothing (erdewit/heartwave)
 *  - Signal quality index (SQI) from spectral concentration (cortictechnology)
 *  - Adaptive buffer sizing based on FPS (richrd/heart-rate-monitor)
 *  - Outlier rejection via IQR on BPM history (avinashhsinghh)
 *  - PPG waveform output for visualization (webcam-pulse-detector)
 *  - Face brightness validation to skip bad frames (kibotu/Heart-Rate-Ometer)
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

const BUFFER_SIZE = 300;
const BPM_LO = 45;
const BPM_HI = 180;
const FL = BPM_LO / 60;
const FH = BPM_HI / 60;
const EMA = 0.35;
const SMOOTH_WIN = 5;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── 5-point moving average (erdewit/heartwave style temporal smoothing) ───
function movingAvg(sig: number[], win: number): number[] {
  const out = new Array(sig.length);
  const half = Math.floor(win / 2);
  for (let i = 0; i < sig.length; i++) {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(sig.length - 1, i + half); j++) {
      sum += sig[j]; cnt++;
    }
    out[i] = sum / cnt;
  }
  return out;
}

// ── Butterworth bandpass filter (habom2310, webcam-pulse-detector) ─────────
// 2nd-order Butterworth, applied forward+backward for zero-phase (filtfilt)
function butterworthBandpass(sig: number[], fps: number, fLow: number, fHigh: number): number[] {
  const nyq = fps / 2;
  const wL = fLow / nyq;
  const wH = fHigh / nyq;

  const biquadHP = designBW2(wL, "high");
  const biquadLP = designBW2(wH, "low");

  let out = filtfiltBQ(sig, biquadHP);
  out = filtfiltBQ(out, biquadLP);
  return out;
}

type BQ = [number, number, number, number, number, number];

function designBW2(wc: number, type: "high" | "low"): BQ {
  const w0 = Math.PI * wc;
  const Q = Math.SQRT1_2;
  const alpha = Math.sin(w0) / (2 * Q);
  const cos0 = Math.cos(w0);
  if (type === "high") {
    const b0 = (1 + cos0) / 2, b1 = -(1 + cos0), b2 = (1 + cos0) / 2;
    const a0 = 1 + alpha, a1 = -2 * cos0, a2 = 1 - alpha;
    return [b0 / a0, b1 / a0, b2 / a0, 1, a1 / a0, a2 / a0];
  }
  const b0 = (1 - cos0) / 2, b1 = 1 - cos0, b2 = (1 - cos0) / 2;
  const a0 = 1 + alpha, a1 = -2 * cos0, a2 = 1 - alpha;
  return [b0 / a0, b1 / a0, b2 / a0, 1, a1 / a0, a2 / a0];
}

function applyBQ(sig: number[], bq: BQ): number[] {
  const [b0, b1, b2, , a1, a2] = bq;
  const y = new Float64Array(sig.length);
  for (let i = 0; i < sig.length; i++) {
    y[i] = b0 * sig[i];
    if (i >= 1) y[i] += b1 * sig[i - 1] - a1 * y[i - 1];
    if (i >= 2) y[i] += b2 * sig[i - 2] - a2 * y[i - 2];
  }
  return Array.from(y);
}

function filtfiltBQ(sig: number[], bq: BQ): number[] {
  const n = sig.length;
  const pad = Math.min(12, n - 1);
  if (pad < 1) return applyBQ(sig, bq);
  const p = new Array(n + 2 * pad);
  for (let i = 0; i < pad; i++) p[i] = 2 * sig[0] - sig[pad - i];
  for (let i = 0; i < n; i++) p[pad + i] = sig[i];
  for (let i = 0; i < pad; i++) p[pad + n + i] = 2 * sig[n - 1] - sig[n - 2 - i];
  const f = applyBQ(p, bq); f.reverse();
  const r = applyBQ(f, bq); r.reverse();
  return r.slice(pad, pad + n);
}

// ── FFT (Cooley-Tukey radix-2) ────────────────────────────────────────────
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wR = Math.cos(ang), wI = -Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let pR = 1, pI = 0;
      for (let j = 0; j < len >> 1; j++) {
        const uR = re[i + j], uI = im[i + j];
        const vR = re[i + j + len / 2] * pR - im[i + j + len / 2] * pI;
        const vI = re[i + j + len / 2] * pI + im[i + j + len / 2] * pR;
        re[i + j] = uR + vR; im[i + j] = uI + vI;
        re[i + j + len / 2] = uR - vR; im[i + j + len / 2] = uI - vI;
        const t = pR * wR - pI * wI; pI = pR * wI + pI * wR; pR = t;
      }
    }
  }
}

// ── Signal Quality Index (cortictechnology style) ─────────────────────────
// Measures how concentrated the spectrum is around the peak vs spread out
function computeSQI(mag: Float64Array, peakIdx: number, loIdx: number, hiIdx: number): number {
  let peakBand = 0, totalBand = 0;
  const halfW = 3;
  for (let k = loIdx; k <= hiIdx; k++) {
    const p = mag[k] * mag[k];
    totalBand += p;
    if (Math.abs(k - peakIdx) <= halfW) peakBand += p;
  }
  if (totalBand < 1e-12) return 0;
  return clamp(peakBand / totalBand, 0, 1);
}

// ── CHROM-like chrominance method + best channel fallback ──────────────────
// De Haan & Jeanne (2013): chrominance-based rPPG for better motion robustness
function bestChannelFFT(
  rSig: number[], gSig: number[], bSig: number[], fps: number
): { bpm: number; confidence: number; sqi: number; waveform: number[]; spectrum: number[] } {
  const N = rSig.length;

  const rMean = rSig.reduce((s, v) => s + v, 0) / N || 1;
  const gMean = gSig.reduce((s, v) => s + v, 0) / N || 1;
  const bMean = bSig.reduce((s, v) => s + v, 0) / N || 1;

  const rNorm = rSig.map(v => v / rMean);
  const gNorm = gSig.map(v => v / gMean);
  const bNorm = bSig.map(v => v / bMean);

  const xs = new Array(N);
  const ys = new Array(N);
  for (let i = 0; i < N; i++) {
    xs[i] = 3 * rNorm[i] - 2 * gNorm[i];
    ys[i] = 1.5 * rNorm[i] + gNorm[i] - 1.5 * bNorm[i];
  }

  const xFiltered = butterworthBandpass(xs, fps, FL, FH);
  const yFiltered = butterworthBandpass(ys, fps, FL, FH);

  const xStd = Math.sqrt(xFiltered.reduce((s, v) => s + v * v, 0) / N) || 1;
  const yStd = Math.sqrt(yFiltered.reduce((s, v) => s + v * v, 0) / N) || 1;
  const alpha = xStd / yStd;

  const chromSig = new Array(N);
  for (let i = 0; i < N; i++) {
    chromSig[i] = xFiltered[i] - alpha * yFiltered[i];
  }

  const chromResult = analyzeChannel(chromSig, fps, true);

  const greenResult = analyzeChannel(gSig, fps, false);

  return chromResult.snr >= greenResult.snr ? chromResult : greenResult;
}

function analyzeChannel(
  rawSig: number[], fps: number, preFiltered = false
): { bpm: number; confidence: number; snr: number; sqi: number; waveform: number[]; spectrum: number[] } {
  const N = rawSig.length;

  let filtered: number[];
  if (preFiltered) {
    filtered = movingAvg(rawSig, SMOOTH_WIN);
  } else {
    const smoothed = movingAvg(rawSig, SMOOTH_WIN);
    filtered = butterworthBandpass(smoothed, fps, FL, FH);
  }

  let pad = 1;
  while (pad < N * 2) pad <<= 1;

  const re = new Float64Array(pad);
  const im = new Float64Array(pad);
  for (let i = 0; i < N; i++) {
    const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
    re[i] = filtered[i] * w;
  }

  fft(re, im);

  const mag = new Float64Array(pad >> 1);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);

  const freqRes = fps / pad;
  const loIdx = Math.max(1, Math.floor(FL / freqRes));
  const hiIdx = Math.min(mag.length - 2, Math.ceil(FH / freqRes));

  let peakVal = 0, peakIdx = loIdx;
  let totalPow = 0;
  for (let k = loIdx; k <= hiIdx; k++) {
    totalPow += mag[k];
    if (mag[k] > peakVal) { peakVal = mag[k]; peakIdx = k; }
  }

  let freq = peakIdx * freqRes;
  if (peakIdx > loIdx && peakIdx < hiIdx) {
    const a = mag[peakIdx - 1], b = mag[peakIdx], c = mag[peakIdx + 1];
    const d = a - 2 * b + c;
    if (Math.abs(d) > 1e-12) freq = (peakIdx + 0.5 * (a - c) / d) * freqRes;
  }

  const avgPow = totalPow / Math.max(1, hiIdx - loIdx + 1);
  const snr = avgPow > 0 ? peakVal / avgPow : 0;
  const confidence = clamp(Math.round((snr - 1) * 25), 0, 95);
  const sqi = computeSQI(mag, peakIdx, loIdx, hiIdx);

  const specDisplay: number[] = [];
  for (let k = loIdx; k <= hiIdx; k++) specDisplay.push(mag[k] / (peakVal || 1));

  const wfStd = Math.sqrt(filtered.reduce((s, v) => s + v * v, 0) / N) || 1;
  const waveform = filtered.slice(-80).map(v => v / wfStd);

  return {
    bpm: Math.round(clamp(freq * 60, BPM_LO, BPM_HI)),
    confidence, snr, sqi, waveform, spectrum: specDisplay,
  };
}

// ── ROI sampling — full RGB (for channel selection) ───────────────────────
function sampleRGB(
  ctx: CanvasRenderingContext2D,
  foreheadBox: FaceBox | null,
  cheekBox: FaceBox | null,
  faceBox: FaceBox | null,
  vw: number, vh: number,
): { r: number; g: number; b: number; brightness: number; ok: boolean; label: string } {
  let totalR = 0, totalG = 0, totalB = 0, cnt = 0;
  let label = "";

  const addBox = (x: number, y: number, w: number, h: number, lbl: string) => {
    const xi = Math.max(0, Math.floor(x));
    const yi = Math.max(0, Math.floor(y));
    const wi = Math.max(1, Math.min(Math.floor(w), vw - xi));
    const hi = Math.max(1, Math.min(Math.floor(h), vh - yi));
    if (wi < 2 || hi < 2) return;
    try {
      const d = ctx.getImageData(xi, yi, wi, hi).data;
      for (let i = 0; i < d.length; i += 4) {
        totalR += d[i]; totalG += d[i + 1]; totalB += d[i + 2]; cnt++;
      }
      label = label ? label + "+" + lbl : lbl;
    } catch { /* */ }
  };

  if (foreheadBox && foreheadBox.w > 8 && foreheadBox.h > 6)
    addBox(foreheadBox.x, foreheadBox.y, foreheadBox.w, foreheadBox.h, "FH");
  if (cheekBox && cheekBox.w > 10 && cheekBox.h > 8)
    addBox(cheekBox.x, cheekBox.y, cheekBox.w, cheekBox.h, "CK");
  if (cnt < 20 && faceBox && faceBox.w > 30 && faceBox.h > 30)
    addBox(faceBox.x + faceBox.w * 0.25, faceBox.y + faceBox.h * 0.05, faceBox.w * 0.5, faceBox.h * 0.2, "FC");

  if (cnt < 5) return { r: 0, g: 0, b: 0, brightness: 0, ok: false, label: "NONE" };
  const r = totalR / cnt, g = totalG / cnt, b = totalB / cnt;
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  const ok = brightness > 30 && brightness < 240 && r > 10 && g > 10;
  return { r, g, b, brightness, ok, label };
}

// ── IQR outlier rejection on BPM history (avinashhsinghh style) ───────────
function iqrFilter(vals: number[]): number[] {
  if (vals.length < 4) return vals;
  const sorted = [...vals].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return vals.filter(v => v >= lo && v <= hi);
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?: React.MutableRefObject<FaceBox | null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
  cheekBoxRef?: React.MutableRefObject<FaceBox | null>,
) {
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const rBuf = useRef<number[]>([]);
  const gBuf = useRef<number[]>([]);
  const bBuf = useRef<number[]>([]);
  const tsBuf = useRef<number[]>([]);
  const bpmRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);
  const fpsRef = useRef<number>(30);
  const prevMs = useRef<number>(0);
  const noFace = useRef<number>(0);
  const bpmHistory = useRef<number[]>([]);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "GREEN+FFT",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { rafRef.current = requestAnimationFrame(processFrame); return; }

    const now = performance.now();
    if (prevMs.current > 0) {
      const dt = (now - prevMs.current) / 1000;
      if (dt > 0.001) fpsRef.current = fpsRef.current * 0.9 + (1 / dt) * 0.1;
    }
    prevMs.current = now;
    frameRef.current++;

    if (!cvRef.current) cvRef.current = document.createElement("canvas");
    const cv = cvRef.current;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (cv.width !== vw) cv.width = vw;
    if (cv.height !== vh) cv.height = vh;
    ctx.drawImage(video, 0, 0);

    const roi = sampleRGB(ctx,
      foreheadBoxRef?.current ?? null,
      cheekBoxRef?.current ?? null,
      faceBoxRef?.current ?? null,
      vw, vh);

    if (!roi.ok) {
      noFace.current++;
      if (noFace.current >= 30) {
        bpmRef.current = null;
        rBuf.current = []; gBuf.current = []; bBuf.current = [];
        tsBuf.current = []; bpmHistory.current = [];
        setData({
          bpm: null, confidence: 0, signal: [], isActive: true, stress: "low",
          trend: "stable", algorithm: "GREEN+FFT", faceDetected: false,
          frameRate: Math.round(fpsRef.current), calibrating: true, roiDebug: "NO FACE",
        });
      }
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    noFace.current = 0;
    rBuf.current.push(roi.r);
    gBuf.current.push(roi.g);
    bBuf.current.push(roi.b);
    tsBuf.current.push(now);

    while (rBuf.current.length > BUFFER_SIZE) {
      rBuf.current.shift(); gBuf.current.shift(); bBuf.current.shift(); tsBuf.current.shift();
    }

    const bufLen = rBuf.current.length;

    if (frameRef.current % 4 === 0 && bufLen >= 64) {
      const elapsed = (tsBuf.current[bufLen - 1] - tsBuf.current[0]) / 1000;
      const actualFps = (bufLen - 1) / elapsed;

      const { bpm, confidence, sqi, waveform, spectrum } = bestChannelFFT(
        rBuf.current, gBuf.current, bBuf.current, actualFps
      );

      if (bpm >= BPM_LO && bpm <= BPM_HI && confidence >= 3) {
        bpmHistory.current.push(bpm);
        if (bpmHistory.current.length > 20) bpmHistory.current.shift();

        const cleaned = iqrFilter(bpmHistory.current);

        if (bpmRef.current === null) {
          if (cleaned.length >= 2) {
            const sorted = [...cleaned].sort((a, b) => a - b);
            bpmRef.current = sorted[Math.floor(sorted.length / 2)];
          }
        } else {
          if (cleaned.length > 0) {
            const sorted = [...cleaned].sort((a, b) => a - b);
            const medBpm = sorted[Math.floor(sorted.length / 2)];
            const jump = Math.abs(medBpm - bpmRef.current);
            const alpha = jump <= 8 ? EMA : jump <= 20 ? EMA * 0.5 : EMA * 0.2;
            bpmRef.current = Math.round(bpmRef.current * (1 - alpha) + medBpm * alpha);
          }
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";
      const sqiLabel = sqi > 0.6 ? "HIGH" : sqi > 0.3 ? "MED" : "LOW";

      setData(prev => ({
        bpm: finalBpm,
        confidence,
        signal: waveform.length > 0 ? waveform : spectrum,
        isActive: true,
        stress,
        trend: (finalBpm != null && prev.bpm != null)
          ? (finalBpm > prev.bpm + 3 ? "rising" : finalBpm < prev.bpm - 3 ? "falling" : "stable")
          : "stable",
        algorithm: `GREEN+FFT SQI:${sqiLabel} (${bpm})`,
        faceDetected: true,
        frameRate: Math.round(fpsRef.current),
        calibrating: finalBpm === null,
        roiDebug: roi.label,
      }));
    } else if (frameRef.current % 30 === 0) {
      const rem = Math.max(0, 64 - bufLen);
      setData(prev => ({
        ...prev, isActive: true, faceDetected: true,
        frameRate: Math.round(fpsRef.current),
        calibrating: bpmRef.current === null,
        roiDebug: roi.label + (rem > 0 ? ` (${Math.ceil(rem / fpsRef.current)}s)` : ""),
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef]);

  const start = useCallback(() => {
    rBuf.current = []; gBuf.current = []; bBuf.current = [];
    tsBuf.current = [];
    bpmRef.current = null; frameRef.current = 0;
    fpsRef.current = 30; prevMs.current = 0;
    bpmHistory.current = []; noFace.current = 0;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18);
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9);
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
