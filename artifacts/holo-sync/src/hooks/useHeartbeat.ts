/**
 * useHeartbeat — rPPG v8 (research-grade, reference-aligned)
 *
 * Rebuilt from studying:
 *  - UW Ubicomp Lab rPPG-web (temporal normalization, frame differencing)
 *  - Wang et al. 2017 POS algorithm
 *  - De Haan & Jeanne 2013 CHROM algorithm
 *  - UBF-rPPG benchmark methodologies
 *  - FaceHeart industrial approach
 *  - PMC/NIH 2024 rPPG review
 *
 * Key improvements over v7:
 *  - Temporal normalization: (C_n - C_{n-1}) / (C_n + C_{n-1}) removes DC drift
 *  - Time-domain peak counting as additional BPM estimator
 *  - Tighter bandpass (0.75–2.5 Hz = 45–150 BPM) per UW reference
 *  - Running mean normalization for illumination invariance
 *  - Simplified confidence (less penalty stacking)
 *  - Much faster initial lock-on (~2-3 seconds)
 *
 * References:
 *  [1] Wang et al. 2017 — POS (IEEE TBME) https://ieeexplore.ieee.org/document/7565547
 *  [2] De Haan & Jeanne 2013 — CHROM (IEEE TBME) https://ieeexplore.ieee.org/document/9983619
 *  [3] UW Ubicomp Lab — https://github.com/ubicomplab/rppg-web | https://vitals.cs.washington.edu/
 *  [4] UBF-rPPG — https://sites.google.com/view/ybenezeth/ubfcrppg
 *  [5] rPPG-10 — https://github.com/GRodrigues4/rPPG-10
 *  [6] FaceHeart — https://faceheart.com/technology.php
 *  [7] PMC rPPG Review — https://pmc.ncbi.nlm.nih.gov/articles/PMC11362249/
 *  [8] UCLA rPPG Avatars — https://visual.ee.ucla.edu/rppg_avatars.htm/
 *  [9] Optica SQI — https://opg.optica.org/optcon/fulltext.cfm?uri=optcon-2-12-2540
 *  [10] NeurIPS 2023 — https://proceedings.neurips.cc/paper_files/paper/2023/hash/d7d0d548a6317407e02230f15ce75817-Abstract-Datasets_and_Benchmarks.html
 *  [11] St Andrews Review — https://research-portal.st-andrews.ac.uk/en/publications/remote-photoplethysmography-rppg-a-state-of-the-art-review/
 *  [12] Biosensors MDPI — https://www.mdpi.com/2306-5354/10/2/243
 *  [13] Philips rPPG — https://www.philips.com/a-w/about/innovation/ips/ip-licensing/programs/biosensing-by-rppg.html
 *  [14] Noldus — https://noldus.com/blog/what-is-rppg
 *  [15] IMA AppWeb — https://www.ima-appweb.com/blog/remote-photoplethysmography-rppg-development/
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
const MIN_FRAMES = 30;
const BPM_LO = 45;
const BPM_HI = 150;
const FL = BPM_LO / 60;
const FH = BPM_HI / 60;
const HISTORY_LEN = 20;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function mean(arr: number[] | Float64Array): number {
  if (!arr.length) return 0;
  let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function std(arr: number[] | Float64Array, m?: number): number {
  if (arr.length < 2) return 0;
  const mu = m ?? mean(arr);
  let s = 0; for (let i = 0; i < arr.length; i++) s += (arr[i] - mu) ** 2;
  return Math.sqrt(s / arr.length);
}

function detrend(sig: number[]): number[] {
  const N = sig.length;
  if (N < 3) return sig;
  const winSize = Math.max(5, Math.round(N / 3));
  const half = Math.floor(winSize / 2);
  const out = new Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(N - 1, i + half); j++) {
      sum += sig[j]; cnt++;
    }
    out[i] = sig[i] - sum / cnt;
  }
  return out;
}

type BQ = [number, number, number, number, number, number];

function designBW2(wc: number, type: "high" | "low"): BQ {
  const w0 = Math.PI * clamp(wc, 0.001, 0.999);
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
  const pad = Math.min(18, n - 1);
  if (pad < 1) return applyBQ(sig, bq);
  const p = new Array(n + 2 * pad);
  for (let i = 0; i < pad; i++) p[i] = 2 * sig[0] - sig[pad - i];
  for (let i = 0; i < n; i++) p[pad + i] = sig[i];
  for (let i = 0; i < pad; i++) p[pad + n + i] = 2 * sig[n - 1] - sig[n - 2 - i];
  const f = applyBQ(p, bq); f.reverse();
  const r = applyBQ(f, bq); r.reverse();
  return r.slice(pad, pad + n);
}

function bandpass(sig: number[], fps: number, fLow: number, fHigh: number): number[] {
  const nyq = fps / 2;
  if (nyq < fHigh * 1.05) return sig;
  const wL = clamp(fLow / nyq, 0.001, 0.999);
  const wH = clamp(fHigh / nyq, 0.001, 0.999);
  if (wL >= wH) return sig;
  let out = filtfiltBQ(sig, designBW2(wL, "high"));
  out = filtfiltBQ(out, designBW2(wH, "low"));
  return out;
}

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

function fftBpm(sig: number[], fps: number): { bpm: number; snr: number; confidence: number; spectrum: number[] } {
  const N = sig.length;
  let pad = 1;
  while (pad < N * 4) pad <<= 1;
  const re = new Float64Array(pad);
  const im = new Float64Array(pad);
  for (let i = 0; i < N; i++) {
    const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
    re[i] = sig[i] * w;
  }
  fft(re, im);
  const mag = new Float64Array(pad >> 1);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);

  const freqRes = fps / pad;
  const loIdx = Math.max(1, Math.floor(FL / freqRes));
  const hiIdx = Math.min(mag.length - 2, Math.ceil(FH / freqRes));

  let peakVal = 0, peakIdx = loIdx;
  for (let k = loIdx; k <= hiIdx; k++) {
    if (mag[k] > peakVal) { peakVal = mag[k]; peakIdx = k; }
  }

  let freq = peakIdx * freqRes;
  if (peakIdx > loIdx && peakIdx < hiIdx) {
    const a = mag[peakIdx - 1], b = mag[peakIdx], c = mag[peakIdx + 1];
    const d = a - 2 * b + c;
    if (Math.abs(d) > 1e-12) freq = (peakIdx + 0.5 * (a - c) / d) * freqRes;
  }

  const halfFreq = freq * 0.5;
  const halfIdx = Math.round(halfFreq / freqRes);
  if (halfFreq >= FL && halfIdx >= loIdx && halfIdx <= hiIdx) {
    if (mag[halfIdx] > peakVal * 0.6) {
      freq = halfFreq;
      peakIdx = halfIdx;
      peakVal = mag[halfIdx];
    }
  }

  let totalPow = 0;
  for (let k = loIdx; k <= hiIdx; k++) totalPow += mag[k];
  const avgPow = totalPow / Math.max(1, hiIdx - loIdx + 1);
  const snr = avgPow > 0 ? peakVal / avgPow : 0;

  let peakBand = 0, totalBand = 0;
  for (let k = loIdx; k <= hiIdx; k++) {
    const p = mag[k] * mag[k];
    totalBand += p;
    if (Math.abs(k - peakIdx) <= 3) peakBand += p;
  }
  const sqi = totalBand > 1e-12 ? peakBand / totalBand : 0;

  const conf = clamp(Math.round(snr * 15 + sqi * 40), 0, 95);

  const specDisplay: number[] = [];
  for (let k = loIdx; k <= hiIdx; k++) specDisplay.push(mag[k] / (peakVal || 1));

  return {
    bpm: Math.round(clamp(freq * 60, BPM_LO, BPM_HI)),
    snr, confidence: conf, spectrum: specDisplay
  };
}

function peakCountBpm(sig: number[], fps: number): number | null {
  const N = sig.length;
  if (N < 15) return null;

  const sigStd = std(sig);
  if (sigStd < 1e-8) return null;
  const threshold = sigStd * 0.3;
  const minDist = Math.round(fps * 60 / BPM_HI);

  const peaks: number[] = [];
  for (let i = 2; i < N - 2; i++) {
    if (sig[i] > sig[i - 1] && sig[i] > sig[i + 1] &&
        sig[i] > sig[i - 2] && sig[i] > sig[i + 2] &&
        sig[i] > threshold) {
      if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDist) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  if (intervals.length < 1) return null;

  const sorted = [...intervals].sort((a, b) => a - b);
  const medInterval = sorted[Math.floor(sorted.length / 2)];
  const bpm = Math.round(60 * fps / medInterval);

  return (bpm >= BPM_LO && bpm <= BPM_HI) ? bpm : null;
}

function autocorrelationBpm(sig: number[], fps: number): number | null {
  const N = sig.length;
  if (N < 30) return null;
  const minLag = Math.round(fps * 60 / BPM_HI);
  const maxLag = Math.min(N - 1, Math.round(fps * 60 / BPM_LO));
  if (minLag >= maxLag) return null;

  const m = mean(sig);
  const centered = sig.map(v => v - m);
  let ac0 = 0;
  for (let i = 0; i < N; i++) ac0 += centered[i] * centered[i];
  if (ac0 < 1e-12) return null;

  let bestAC = -1, bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0;
    for (let i = 0; i < N - lag; i++) ac += centered[i] * centered[i + lag];
    ac /= ac0;
    if (ac > bestAC) { bestAC = ac; bestLag = lag; }
  }

  if (bestAC < 0.1) return null;
  return Math.round(60 * fps / bestLag);
}

function computePOS(rSig: number[], gSig: number[], bSig: number[], fps: number): number[] {
  const N = rSig.length;
  const winSize = Math.min(N, Math.round(fps * 1.6));
  const step = Math.max(1, Math.round(winSize / 2));
  const posSig = new Float64Array(N);
  const counts = new Float64Array(N);

  for (let start = 0; start <= N - winSize; start += step) {
    let mR = 0, mG = 0, mB = 0;
    for (let i = start; i < start + winSize; i++) { mR += rSig[i]; mG += gSig[i]; mB += bSig[i]; }
    mR /= winSize; mG /= winSize; mB /= winSize;
    if (mR < 0.001 || mG < 0.001 || mB < 0.001) continue;

    const cn: number[][] = [[], [], []];
    for (let i = start; i < start + winSize; i++) {
      cn[0].push(rSig[i] / mR); cn[1].push(gSig[i] / mG); cn[2].push(bSig[i] / mB);
    }

    const S1: number[] = [], S2: number[] = [];
    for (let i = 0; i < winSize; i++) {
      S1.push(cn[1][i] - cn[2][i]);
      S2.push(cn[1][i] + cn[2][i] - 2 * cn[0][i]);
    }

    const stdS1 = std(S1) || 1;
    const stdS2 = std(S2) || 1;
    const alpha = stdS1 / stdS2;

    for (let i = 0; i < winSize; i++) {
      posSig[start + i] += S1[i] + alpha * S2[i];
      counts[start + i]++;
    }
  }

  const posOut: number[] = new Array(N);
  for (let i = 0; i < N; i++) posOut[i] = counts[i] > 0 ? posSig[i] / counts[i] : 0;
  return posOut;
}

function computeCHROM(rSig: number[], gSig: number[], bSig: number[], fps: number): number[] {
  const N = rSig.length;
  const winSize = Math.min(N, Math.round(fps * 1.6));
  const step = Math.max(1, Math.round(winSize / 2));
  const chromSig = new Float64Array(N);
  const counts = new Float64Array(N);

  for (let start = 0; start <= N - winSize; start += step) {
    let mR = 0, mG = 0, mB = 0;
    for (let i = start; i < start + winSize; i++) { mR += rSig[i]; mG += gSig[i]; mB += bSig[i]; }
    mR /= winSize; mG /= winSize; mB /= winSize;
    if (mR < 0.001 || mG < 0.001 || mB < 0.001) continue;

    const X: number[] = [], Y: number[] = [];
    for (let i = start; i < start + winSize; i++) {
      X.push(3 * rSig[i] / mR - 2 * gSig[i] / mG);
      Y.push(1.5 * rSig[i] / mR + gSig[i] / mG - 1.5 * bSig[i] / mB);
    }

    const stdX = std(X) || 1;
    const stdY = std(Y) || 1;
    const alpha = stdX / stdY;

    for (let i = 0; i < winSize; i++) {
      chromSig[start + i] += X[i] - alpha * Y[i];
      counts[start + i]++;
    }
  }

  const out: number[] = new Array(N);
  for (let i = 0; i < N; i++) out[i] = counts[i] > 0 ? chromSig[i] / counts[i] : 0;
  return out;
}

function sampleROI(
  ctx: CanvasRenderingContext2D,
  foreheadBox: FaceBox | null,
  cheekBox: FaceBox | null,
  faceBox: FaceBox | null,
  vw: number, vh: number,
): { r: number; g: number; b: number; ok: boolean; label: string; pixelCount: number } {
  let totalR = 0, totalG = 0, totalB = 0, cnt = 0;
  let label = "";

  const addRegion = (x: number, y: number, w: number, h: number, lbl: string, step = 2) => {
    const xi = Math.max(0, Math.floor(x));
    const yi = Math.max(0, Math.floor(y));
    const wi = Math.max(1, Math.min(Math.floor(w), vw - xi));
    const hi = Math.max(1, Math.min(Math.floor(h), vh - yi));
    if (wi < 3 || hi < 3) return;
    try {
      const d = ctx.getImageData(xi, yi, wi, hi).data;
      for (let py = 0; py < hi; py += step) {
        for (let px = 0; px < wi; px += step) {
          const idx = (py * wi + px) * 4;
          totalR += d[idx]; totalG += d[idx + 1]; totalB += d[idx + 2]; cnt++;
        }
      }
      label = label ? label + "+" + lbl : lbl;
    } catch { /* ignore */ }
  };

  if (foreheadBox && foreheadBox.w > 6 && foreheadBox.h > 4) {
    addRegion(foreheadBox.x, foreheadBox.y, foreheadBox.w, foreheadBox.h, "FH", 2);
  }

  if (cheekBox && cheekBox.w > 8 && cheekBox.h > 6) {
    addRegion(cheekBox.x, cheekBox.y, cheekBox.w, cheekBox.h, "CK", 2);
  }

  if (faceBox && faceBox.w > 20 && faceBox.h > 20) {
    const fx = faceBox.x, fy = faceBox.y, fw = faceBox.w, fh = faceBox.h;
    if (!foreheadBox) {
      addRegion(fx + fw * 0.2, fy + fh * 0.05, fw * 0.6, fh * 0.25, "FH2", 2);
    }
    if (!cheekBox) {
      addRegion(fx + fw * 0.1, fy + fh * 0.4, fw * 0.3, fh * 0.25, "LCK", 2);
      addRegion(fx + fw * 0.6, fy + fh * 0.4, fw * 0.3, fh * 0.25, "RCK", 2);
    }
    addRegion(fx + fw * 0.35, fy + fh * 0.55, fw * 0.30, fh * 0.12, "NS", 2);
  }

  if (cnt < 10) {
    if (faceBox && faceBox.w > 10 && faceBox.h > 10) {
      addRegion(faceBox.x + faceBox.w * 0.15, faceBox.y + faceBox.h * 0.05,
                faceBox.w * 0.7, faceBox.h * 0.5, "FACE", 3);
    }
  }

  if (cnt < 5) return { r: 0, g: 0, b: 0, ok: false, label: "NONE", pixelCount: 0 };

  const r = totalR / cnt, g = totalG / cnt, b = totalB / cnt;
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

  return { r, g, b, ok: brightness > 15 && brightness < 250, label, pixelCount: cnt };
}

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
  const prevRGB = useRef<{ r: number; g: number; b: number } | null>(null);
  const prevNormR = useRef<number[]>([]);
  const prevNormG = useRef<number[]>([]);
  const prevNormB = useRef<number[]>([]);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "POS+CHROM+G",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const reset = () => {
    rBuf.current = []; gBuf.current = []; bBuf.current = [];
    tsBuf.current = [];
    bpmRef.current = null; frameRef.current = 0;
    fpsRef.current = 30; prevMs.current = 0;
    bpmHistory.current = []; noFace.current = 0;
    prevRGB.current = null;
    prevNormR.current = []; prevNormG.current = []; prevNormB.current = [];
  };

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

    const roi = sampleROI(ctx,
      foreheadBoxRef?.current ?? null,
      cheekBoxRef?.current ?? null,
      faceBoxRef?.current ?? null,
      vw, vh);

    if (!roi.ok) {
      noFace.current++;
      if (noFace.current >= 60) {
        reset();
        setData({
          bpm: null, confidence: 0, signal: [], isActive: true, stress: "low",
          trend: "stable", algorithm: "POS+CHROM+G", faceDetected: false,
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

    if (prevRGB.current) {
      const pr = prevRGB.current;
      const sumR = roi.r + pr.r, sumG = roi.g + pr.g, sumB = roi.b + pr.b;
      prevNormR.current.push(sumR > 0.1 ? (roi.r - pr.r) / sumR : 0);
      prevNormG.current.push(sumG > 0.1 ? (roi.g - pr.g) / sumG : 0);
      prevNormB.current.push(sumB > 0.1 ? (roi.b - pr.b) / sumB : 0);
    }
    prevRGB.current = { r: roi.r, g: roi.g, b: roi.b };

    while (rBuf.current.length > BUFFER_SIZE) {
      rBuf.current.shift(); gBuf.current.shift(); bBuf.current.shift(); tsBuf.current.shift();
    }
    while (prevNormR.current.length > BUFFER_SIZE) {
      prevNormR.current.shift(); prevNormG.current.shift(); prevNormB.current.shift();
    }

    const bufLen = rBuf.current.length;
    const normLen = prevNormR.current.length;

    if (frameRef.current % 2 === 0 && bufLen >= MIN_FRAMES) {
      const elapsed = (tsBuf.current[bufLen - 1] - tsBuf.current[0]) / 1000;
      if (elapsed < 0.3) { rafRef.current = requestAnimationFrame(processFrame); return; }
      const actualFps = (bufLen - 1) / elapsed;
      if (actualFps < 3 || actualFps > 120) { rafRef.current = requestAnimationFrame(processFrame); return; }

      const candidates: { bpm: number; weight: number; method: string }[] = [];

      const greenSig = detrend(gBuf.current.slice());
      const greenFiltered = bandpass(greenSig, actualFps, FL, FH);
      const greenResult = fftBpm(greenFiltered, actualFps);
      candidates.push({ bpm: greenResult.bpm, weight: greenResult.snr * 2, method: "G" });

      if (bufLen >= 45) {
        const posSig = computePOS(rBuf.current, gBuf.current, bBuf.current, actualFps);
        const posFiltered = bandpass(posSig, actualFps, FL, FH);
        const posResult = fftBpm(posFiltered, actualFps);
        candidates.push({ bpm: posResult.bpm, weight: posResult.snr * 3, method: "POS" });

        const chromSig = computeCHROM(rBuf.current, gBuf.current, bBuf.current, actualFps);
        const chromFiltered = bandpass(chromSig, actualFps, FL, FH);
        const chromResult = fftBpm(chromFiltered, actualFps);
        candidates.push({ bpm: chromResult.bpm, weight: chromResult.snr * 2.5, method: "CHROM" });
      }

      if (normLen >= 25) {
        const normGreen = detrend(prevNormG.current.slice());
        const normFiltered = bandpass(normGreen, actualFps, FL, FH);
        const normResult = fftBpm(normFiltered, actualFps);
        candidates.push({ bpm: normResult.bpm, weight: normResult.snr * 2.5, method: "NORM" });
      }

      const acSig = bandpass(detrend(gBuf.current.slice()), actualFps, FL, FH);
      const acBpm = autocorrelationBpm(acSig, actualFps);
      if (acBpm !== null) {
        candidates.push({ bpm: acBpm, weight: 2, method: "AC" });
      }

      const peakBpm = peakCountBpm(greenFiltered, actualFps);
      if (peakBpm !== null) {
        candidates.push({ bpm: peakBpm, weight: 1.5, method: "PK" });
      }

      candidates.sort((a, b) => b.weight - a.weight);

      let bestBpm = candidates[0].bpm;
      let bestMethod = candidates[0].method;
      let totalWeight = 0;
      let weightedBpm = 0;
      let agreeCount = 0;

      for (const c of candidates) {
        if (Math.abs(c.bpm - bestBpm) <= 8) {
          weightedBpm += c.bpm * c.weight;
          totalWeight += c.weight;
          agreeCount++;
        }
      }

      if (totalWeight > 0) {
        bestBpm = Math.round(weightedBpm / totalWeight);
      }

      const bestSnr = candidates[0].weight;
      let confidence = clamp(Math.round(bestSnr * 8 + agreeCount * 8), 5, 95);

      if (agreeCount >= 3) confidence = Math.min(95, confidence + 15);
      else if (agreeCount >= 2) confidence = Math.min(95, confidence + 8);

      if (agreeCount >= 2) {
        bestMethod = candidates.filter(c => Math.abs(c.bpm - bestBpm) <= 8)
          .map(c => c.method).join("+");
      }

      if (frameRef.current % 30 === 0) {
        const cStr = candidates.map(c => `${c.method}:${c.bpm}(${c.weight.toFixed(1)})`).join(" ");
        console.log(`[rPPG] buf=${bufLen} fps=${actualFps.toFixed(1)} best=${bestBpm} conf=${confidence} agree=${agreeCount} | ${cStr}`);
      }

      if (bestBpm >= BPM_LO && bestBpm <= BPM_HI) {
        bpmHistory.current.push(bestBpm);
        if (bpmHistory.current.length > HISTORY_LEN) bpmHistory.current.shift();

        const cleaned = iqrFilter(bpmHistory.current);

        if (bpmRef.current === null) {
          if (cleaned.length >= 1) {
            const sorted = [...cleaned].sort((a, b) => a - b);
            bpmRef.current = sorted[Math.floor(sorted.length / 2)];
          }
        } else {
          if (cleaned.length > 0) {
            const sorted = [...cleaned].sort((a, b) => a - b);
            const medBpm = sorted[Math.floor(sorted.length / 2)];
            const jump = Math.abs(medBpm - bpmRef.current);
            const alpha = jump <= 5 ? 0.35
                        : jump <= 12 ? 0.20
                        : 0.10;
            bpmRef.current = Math.round(bpmRef.current * (1 - alpha) + medBpm * alpha);
          }
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";

      const wfStd = std(greenFiltered) || 1;
      const waveform = greenFiltered.slice(-80).map(v => v / wfStd);

      setData(prev => ({
        bpm: finalBpm,
        confidence,
        signal: waveform,
        isActive: true,
        stress,
        trend: (finalBpm != null && prev.bpm != null)
          ? (finalBpm > prev.bpm + 3 ? "rising" : finalBpm < prev.bpm - 3 ? "falling" : "stable")
          : "stable",
        algorithm: bestMethod,
        faceDetected: true,
        frameRate: Math.round(fpsRef.current),
        calibrating: finalBpm === null,
        roiDebug: `${roi.label} px:${roi.pixelCount}`,
      }));
    } else if (frameRef.current % 15 === 0) {
      const rem = Math.max(0, MIN_FRAMES - bufLen);
      setData(prev => ({
        ...prev, isActive: true, faceDetected: true,
        frameRate: Math.round(fpsRef.current),
        calibrating: bpmRef.current === null,
        roiDebug: roi.label + (rem > 0 ? ` (${Math.ceil(rem / fpsRef.current)}s)` : ` px:${roi.pixelCount}`),
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef]);

  const start = useCallback(() => {
    reset();
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
