/**
 * useHeartbeat — rPPG v5 (research-grade accuracy)
 *
 * Major algorithms:
 *  - POS (Plane-Orthogonal-to-Skin, Wang et al. 2017) — primary
 *  - CHROM (Chrominance, De Haan & Jeanne 2013) — secondary
 *  - GREEN channel FFT — tertiary fallback
 *  - Best-of-three selection via spectral SNR
 *
 * Signal processing pipeline:
 *  1. Skin-validated ROI sampling with per-pixel YCbCr filtering
 *  2. Motion artifact detection (frame-to-frame delta) & frame rejection
 *  3. Signal detrending (moving-mean subtraction)
 *  4. Butterworth bandpass (0.75–3.0 Hz = 45–180 BPM)
 *  5. 4x zero-padded Hamming-windowed FFT
 *  6. Parabolic peak interpolation
 *  7. Sub-harmonic & harmonic comparison/correction
 *  8. Time-domain autocorrelation cross-validation
 *  9. IQR + median-absolute-deviation outlier rejection
 *  10. Adaptive EMA smoothing keyed to signal quality
 *
 * References:
 *  [1] Wang et al. 2017, "Algorithmic Principles of Remote PPG" — IEEE TBME
 *      https://ieeexplore.ieee.org/document/7565547
 *  [2] De Haan & Jeanne 2013, "Robust Pulse Rate from Chrominance" — IEEE TBME
 *      https://ieeexplore.ieee.org/document/9983619
 *  [3] UBF-rPPG Benchmark — Université de Bourgogne
 *      https://sites.google.com/view/ybenezeth/ubfcrppg
 *  [4] UW Ubicomp Lab — Browser-Based rPPG
 *      https://github.com/ubicomplab/rppg-web
 *  [5] rPPG State-of-the-Art Review — PMC/NIH 2024
 *      https://pmc.ncbi.nlm.nih.gov/articles/PMC11362249/
 *  [6] Neural rPPG Datasets & Benchmarks — NeurIPS 2023
 *      https://proceedings.neurips.cc/paper_files/paper/2023/hash/d7d0d548a6317407e02230f15ce75817-Abstract-Datasets_and_Benchmarks.html
 *  [7] Philips Biosensing by rPPG — IP Licensing
 *      https://www.philips.com/a-w/about/innovation/ips/ip-licensing/programs/biosensing-by-rppg.html
 *  [8] UCLA Visual Computing — rPPG with Synthetic Avatars
 *      https://visual.ee.ucla.edu/rppg_avatars.htm/
 *  [9] rPPG-10 Multi-Algorithm Benchmark
 *      https://github.com/GRodrigues4/rPPG-10
 *  [10] FaceHeart — Industrial rPPG Technology
 *       https://faceheart.com/technology.php
 *  [11] Optica rPPG Signal Quality — Optical Continuum 2023
 *       https://opg.optica.org/optcon/fulltext.cfm?uri=optcon-2-12-2540
 *  [12] St Andrews University — rPPG State-of-the-Art Review
 *       https://research-portal.st-andrews.ac.uk/en/publications/remote-photoplethysmography-rppg-a-state-of-the-art-review/
 *  [13] Biosensors MDPI — rPPG Engineering Review 2023
 *       https://www.mdpi.com/2306-5354/10/2/243
 *  [14] Noldus — What is rPPG (overview)
 *       https://noldus.com/blog/what-is-rppg
 *  [15] IMA AppWeb — rPPG Development Guide
 *       https://www.ima-appweb.com/blog/remote-photoplethysmography-rppg-development/
 *
 *  Also informed by: habom2310, webcam-pulse-detector, cortictechnology, erdewit/heartwave
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

const BUFFER_SIZE = 450;
const MIN_FRAMES_FAST = 48;
const MIN_FRAMES_FULL = 72;
const BPM_LO = 42;
const BPM_HI = 185;
const FL = BPM_LO / 60;
const FH = BPM_HI / 60;
const SMOOTH_WIN = 5;
const MOTION_THRESH = 4.0;
const HISTORY_LEN = 30;
const ADAPTIVE_SMOOTH_MIN = 3;
const ADAPTIVE_SMOOTH_MAX = 9;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function std(arr: number[], m?: number): number {
  if (arr.length < 2) return 0;
  const mu = m ?? mean(arr);
  let s = 0; for (let i = 0; i < arr.length; i++) s += (arr[i] - mu) ** 2;
  return Math.sqrt(s / arr.length);
}

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

function detrend(sig: number[]): number[] {
  const N = sig.length;
  if (N < 3) return sig;
  const trend = movingAvg(sig, Math.max(5, Math.round(N / 4)));
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = sig[i] - trend[i];
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

function butterworthBandpass(sig: number[], fps: number, fLow: number, fHigh: number): number[] {
  const nyq = fps / 2;
  if (nyq < fHigh * 1.1) return sig;
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

function computeSQI(mag: Float64Array, peakIdx: number, loIdx: number, hiIdx: number): number {
  let peakBand = 0, totalBand = 0;
  const halfW = 4;
  for (let k = loIdx; k <= hiIdx; k++) {
    const p = mag[k] * mag[k];
    totalBand += p;
    if (Math.abs(k - peakIdx) <= halfW) peakBand += p;
  }
  if (totalBand < 1e-12) return 0;
  const concentration = clamp(peakBand / totalBand, 0, 1);

  const n = hiIdx - loIdx + 1;
  if (n < 2) return concentration;
  let logSum = 0, linSum = 0;
  for (let k = loIdx; k <= hiIdx; k++) {
    const p = mag[k] * mag[k] + 1e-15;
    logSum += Math.log(p);
    linSum += p;
  }
  const geoMean = Math.exp(logSum / n);
  const ariMean = linSum / n;
  const flatness = ariMean > 1e-15 ? 1 - clamp(geoMean / ariMean, 0, 1) : 0;

  return clamp(concentration * 0.6 + flatness * 0.4, 0, 1);
}

interface AnalysisResult {
  bpm: number;
  confidence: number;
  snr: number;
  sqi: number;
  waveform: number[];
  spectrum: number[];
  method: string;
}

function welchPSD(sig: number[], fps: number, segLen: number, overlap: number): { mag: Float64Array; freqRes: number; fftLen: number } {
  const N = sig.length;
  const step = Math.max(1, Math.round(segLen * (1 - overlap)));
  const nSegs = Math.max(1, Math.floor((N - segLen) / step) + 1);

  let pad = 1;
  while (pad < segLen * 4) pad <<= 1;

  const avgMag = new Float64Array(pad >> 1);

  for (let s = 0; s < nSegs; s++) {
    const start = s * step;
    const re = new Float64Array(pad);
    const im = new Float64Array(pad);
    for (let i = 0; i < segLen && start + i < N; i++) {
      const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (segLen - 1));
      re[i] = sig[start + i] * w;
    }
    fft(re, im);
    for (let k = 0; k < avgMag.length; k++) {
      avgMag[k] += re[k] * re[k] + im[k] * im[k];
    }
  }

  if (nSegs * step + segLen < N) {
    const start = N - segLen;
    const re = new Float64Array(pad);
    const im = new Float64Array(pad);
    for (let i = 0; i < segLen; i++) {
      const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (segLen - 1));
      re[i] = sig[start + i] * w;
    }
    fft(re, im);
    for (let k = 0; k < avgMag.length; k++) {
      avgMag[k] += re[k] * re[k] + im[k] * im[k];
    }
    const totalSegs = nSegs + 1;
    for (let k = 0; k < avgMag.length; k++) avgMag[k] = Math.sqrt(avgMag[k] / totalSegs);
  } else {
    for (let k = 0; k < avgMag.length; k++) avgMag[k] = Math.sqrt(avgMag[k] / nSegs);
  }

  return { mag: avgMag, freqRes: fps / pad, fftLen: pad };
}

function adaptiveSmooth(sig: number[], baseWin: number, noiseLevel: number): number[] {
  const win = Math.round(clamp(
    baseWin + noiseLevel * 2,
    ADAPTIVE_SMOOTH_MIN,
    ADAPTIVE_SMOOTH_MAX
  ));
  return movingAvg(sig, win);
}

function analyzeSignal(
  rawSig: number[], fps: number, preFiltered: boolean, method: string
): AnalysisResult {
  const N = rawSig.length;

  const sigStd = std(rawSig);
  const noiseLevel = clamp(sigStd / (mean(rawSig.map(Math.abs)) || 1), 0, 5);

  let processed: number[];
  if (preFiltered) {
    processed = detrend(rawSig);
    processed = adaptiveSmooth(processed, SMOOTH_WIN, noiseLevel);
  } else {
    processed = detrend(rawSig);
    processed = adaptiveSmooth(processed, SMOOTH_WIN, noiseLevel);
    processed = butterworthBandpass(processed, fps, FL, FH);
  }

  const useWelch = N >= 90;
  let mag: Float64Array;
  let freqRes: number;
  let fftLen: number;

  if (useWelch) {
    const segLen = Math.min(N, Math.max(64, Math.round(fps * 2)));
    const result = welchPSD(processed, fps, segLen, 0.5);
    mag = result.mag; freqRes = result.freqRes; fftLen = result.fftLen;
  } else {
    let pad = 1;
    while (pad < N * 4) pad <<= 1;
    fftLen = pad;
    const re = new Float64Array(pad);
    const im = new Float64Array(pad);
    for (let i = 0; i < N; i++) {
      const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
      re[i] = processed[i] * w;
    }
    fft(re, im);
    mag = new Float64Array(pad >> 1);
    for (let i = 0; i < mag.length; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    freqRes = fps / pad;
  }

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
    const subPeak = mag[halfIdx];
    if (subPeak > peakVal * 0.65) {
      const subBpm = halfFreq * 60;
      if (subBpm >= BPM_LO && subBpm <= BPM_HI) {
        freq = halfFreq;
        peakIdx = halfIdx;
        peakVal = subPeak;
      }
    }
  }

  const doubleFreq = freq * 2;
  const doubleIdx = Math.round(doubleFreq / freqRes);
  if (doubleFreq <= FH && doubleIdx >= loIdx && doubleIdx <= hiIdx) {
    const harmPeak = mag[doubleIdx];
    if (harmPeak > peakVal * 1.4) {
      const harmBpm = doubleFreq * 60;
      if (harmBpm >= BPM_LO && harmBpm <= BPM_HI) {
        freq = doubleFreq;
        peakIdx = doubleIdx;
        peakVal = harmPeak;
      }
    }
  }

  let totalPow = 0;
  for (let k = loIdx; k <= hiIdx; k++) totalPow += mag[k];
  const avgPow = totalPow / Math.max(1, hiIdx - loIdx + 1);
  const snr = avgPow > 0 ? peakVal / avgPow : 0;

  let conf = clamp(Math.round((snr - 1) * 20), 0, 98);

  const sqi = computeSQI(mag, peakIdx, loIdx, hiIdx);
  conf = Math.round(conf * 0.6 + sqi * 100 * 0.4);

  const specDisplay: number[] = [];
  for (let k = loIdx; k <= hiIdx; k++) specDisplay.push(mag[k] / (peakVal || 1));

  const wfStd = std(processed) || 1;
  const waveform = processed.slice(-80).map(v => v / wfStd);

  return {
    bpm: Math.round(clamp(freq * 60, BPM_LO, BPM_HI)),
    confidence: conf, snr, sqi, waveform, spectrum: specDisplay,
    method: useWelch ? method + "/W" : method,
  };
}

function computePOS(rSig: number[], gSig: number[], bSig: number[], fps: number): AnalysisResult {
  const N = rSig.length;
  const winSize = Math.min(N, Math.round(fps * 2.0));
  const step = Math.max(1, Math.round(winSize / 2));
  const posSig = new Float64Array(N);
  const counts = new Float64Array(N);

  for (let start = 0; start <= N - winSize; start += step) {
    let rM = 0, gM = 0, bM = 0;
    for (let i = start; i < start + winSize; i++) { rM += rSig[i]; gM += gSig[i]; bM += bSig[i]; }
    rM /= winSize; gM /= winSize; bM /= winSize;
    if (rM < 1 || gM < 1 || bM < 1) continue;

    const S1 = new Float64Array(winSize);
    const S2 = new Float64Array(winSize);
    for (let i = 0; i < winSize; i++) {
      const rn = rSig[start + i] / rM;
      const gn = gSig[start + i] / gM;
      const bn = bSig[start + i] / bM;
      S1[i] = gn - bn;
      S2[i] = -2 * rn + gn + bn;
    }

    let s1Sum = 0, s1Sq = 0, s2Sum = 0, s2Sq = 0;
    for (let i = 0; i < winSize; i++) {
      s1Sum += S1[i]; s1Sq += S1[i] * S1[i];
      s2Sum += S2[i]; s2Sq += S2[i] * S2[i];
    }
    const s1Std = Math.sqrt(Math.max(0, s1Sq / winSize - (s1Sum / winSize) ** 2));
    const s2Std = Math.sqrt(Math.max(0, s2Sq / winSize - (s2Sum / winSize) ** 2));
    const alpha = s2Std > 1e-10 ? s1Std / s2Std : 0;

    const winMean = (s1Sum + alpha * s2Sum) / winSize;
    for (let i = 0; i < winSize; i++) {
      const h = S1[i] + alpha * S2[i] - winMean;
      posSig[start + i] += h;
      counts[start + i] += 1;
    }
  }

  const posOut = new Array(N);
  for (let i = 0; i < N; i++) posOut[i] = counts[i] > 0 ? posSig[i] / counts[i] : 0;

  const filtered = butterworthBandpass(posOut, fps, FL, FH);
  return analyzeSignal(filtered, fps, true, "POS");
}

function computeCHROM(rSig: number[], gSig: number[], bSig: number[], fps: number): AnalysisResult {
  const N = rSig.length;
  const winSize = Math.min(N, Math.round(fps * 2.0));
  const step = Math.max(1, Math.round(winSize / 2));
  const chromSig = new Float64Array(N);
  const counts = new Float64Array(N);

  for (let start = 0; start <= N - winSize; start += step) {
    let rM = 0, gM = 0, bM = 0;
    for (let i = start; i < start + winSize; i++) { rM += rSig[i]; gM += gSig[i]; bM += bSig[i]; }
    rM /= winSize; gM /= winSize; bM /= winSize;
    if (rM < 1 || gM < 1 || bM < 1) continue;

    const xs = new Float64Array(winSize);
    const ys = new Float64Array(winSize);
    for (let i = 0; i < winSize; i++) {
      const rn = rSig[start + i] / rM;
      const gn = gSig[start + i] / gM;
      const bn = bSig[start + i] / bM;
      xs[i] = 3 * rn - 2 * gn;
      ys[i] = 1.5 * rn + gn - 1.5 * bn;
    }

    const xf = butterworthBandpass(Array.from(xs), fps, FL, FH);
    const yf = butterworthBandpass(Array.from(ys), fps, FL, FH);

    let xSq = 0, ySq = 0;
    for (let i = 0; i < winSize; i++) { xSq += xf[i] * xf[i]; ySq += yf[i] * yf[i]; }
    const xStd = Math.sqrt(xSq / winSize);
    const yStd = Math.sqrt(ySq / winSize);
    const alpha = yStd > 1e-10 ? xStd / yStd : 0;

    let wMean = 0;
    for (let i = 0; i < winSize; i++) wMean += xf[i] - alpha * yf[i];
    wMean /= winSize;

    for (let i = 0; i < winSize; i++) {
      chromSig[start + i] += (xf[i] - alpha * yf[i]) - wMean;
      counts[start + i] += 1;
    }
  }

  const chromOut = new Array(N);
  for (let i = 0; i < N; i++) chromOut[i] = counts[i] > 0 ? chromSig[i] / counts[i] : 0;

  return analyzeSignal(chromOut, fps, true, "CHROM");
}

function computeGreen(gSig: number[], fps: number): AnalysisResult {
  return analyzeSignal(gSig, fps, false, "GREEN");
}

function bestOfThree(
  rSig: number[], gSig: number[], bSig: number[], fps: number
): AnalysisResult {
  const pos = computePOS(rSig, gSig, bSig, fps);
  const chrom = computeCHROM(rSig, gSig, bSig, fps);
  const green = computeGreen(gSig, fps);
  const all = [pos, chrom, green];

  const pcAgree = Math.abs(pos.bpm - chrom.bpm) <= 5;
  const pgAgree = Math.abs(pos.bpm - green.bpm) <= 5;
  const cgAgree = Math.abs(chrom.bpm - green.bpm) <= 5;

  if (pcAgree && pgAgree) {
    const wBpm = Math.round(
      (pos.bpm * pos.snr + chrom.bpm * chrom.snr + green.bpm * green.snr) /
      (pos.snr + chrom.snr + green.snr)
    );
    const best = all.sort((a, b) => b.snr - a.snr)[0];
    best.bpm = wBpm;
    best.confidence = Math.min(98, best.confidence + 15);
    best.method = "POS+CHROM+G";
    return best;
  }

  if (pcAgree) {
    const winner = pos.snr >= chrom.snr ? pos : chrom;
    winner.bpm = Math.round((pos.bpm * pos.snr + chrom.bpm * chrom.snr) / (pos.snr + chrom.snr));
    winner.confidence = Math.min(98, winner.confidence + 10);
    winner.method = "POS+CHROM";
    return winner;
  }
  if (pgAgree) {
    const winner = pos.snr >= green.snr ? pos : green;
    winner.bpm = Math.round((pos.bpm * pos.snr + green.bpm * green.snr) / (pos.snr + green.snr));
    winner.confidence = Math.min(98, winner.confidence + 8);
    winner.method = "POS+G";
    return winner;
  }
  if (cgAgree) {
    const winner = chrom.snr >= green.snr ? chrom : green;
    winner.bpm = Math.round((chrom.bpm * chrom.snr + green.bpm * green.snr) / (chrom.snr + green.snr));
    winner.confidence = Math.min(98, winner.confidence + 8);
    winner.method = "CHROM+G";
    return winner;
  }

  return all.sort((a, b) => b.snr - a.snr)[0];
}

function autocorrelationBPM(sig: number[], fps: number): number | null {
  const N = sig.length;
  if (N < 60) return null;
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

  if (bestAC < 0.15) return null;
  return Math.round(60 * fps / bestLag);
}

function isSkinPixel(r: number, g: number, b: number): boolean {
  const Y = 0.299 * r + 0.587 * g + 0.114 * b;
  const Cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
  const Cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
  return Y > 40 && Y < 235 && Cb > 77 && Cb < 140 && Cr > 130 && Cr < 185;
}

function sampleRGBSkinFiltered(
  ctx: CanvasRenderingContext2D,
  foreheadBox: FaceBox | null,
  cheekBox: FaceBox | null,
  faceBox: FaceBox | null,
  vw: number, vh: number,
): { r: number; g: number; b: number; brightness: number; ok: boolean; label: string; skinRatio: number; motion: number } {
  let totalR = 0, totalG = 0, totalB = 0, totalW = 0, skinCnt = 0, allCnt = 0;
  let label = "";
  const pixR: number[] = [], pixG: number[] = [], pixB: number[] = [];

  const addBox = (x: number, y: number, w: number, h: number, lbl: string, weight: number, step = 2) => {
    const xi = Math.max(0, Math.floor(x));
    const yi = Math.max(0, Math.floor(y));
    const wi = Math.max(1, Math.min(Math.floor(w), vw - xi));
    const hi = Math.max(1, Math.min(Math.floor(h), vh - yi));
    if (wi < 2 || hi < 2) return;
    try {
      const d = ctx.getImageData(xi, yi, wi, hi).data;
      for (let py = 0; py < hi; py += step) {
        for (let px = 0; px < wi; px += step) {
          const idx = (py * wi + px) * 4;
          const r = d[idx], g = d[idx + 1], b = d[idx + 2];
          allCnt++;
          if (isSkinPixel(r, g, b)) {
            totalR += r * weight; totalG += g * weight; totalB += b * weight;
            totalW += weight;
            pixR.push(r); pixG.push(g); pixB.push(b);
            skinCnt++;
          }
        }
      }
      label = label ? label + "+" + lbl : lbl;
    } catch { /* ignore */ }
  };

  if (foreheadBox && foreheadBox.w > 8 && foreheadBox.h > 6)
    addBox(foreheadBox.x, foreheadBox.y, foreheadBox.w, foreheadBox.h, "FH", 3.0, 2);
  if (cheekBox && cheekBox.w > 10 && cheekBox.h > 8)
    addBox(cheekBox.x, cheekBox.y, cheekBox.w, cheekBox.h, "CK", 2.0, 2);

  if (faceBox && faceBox.w > 30 && faceBox.h > 30) {
    const fx = faceBox.x, fy = faceBox.y, fw = faceBox.w, fh = faceBox.h;
    addBox(fx + fw * 0.38, fy + fh * 0.55, fw * 0.24, fh * 0.12, "NS", 1.5, 2);
    addBox(fx + fw * 0.30, fy + fh * 0.78, fw * 0.40, fh * 0.10, "CN", 1.0, 2);
    addBox(fx + fw * 0.02, fy + fh * 0.15, fw * 0.18, fh * 0.18, "LT", 1.0, 3);
    addBox(fx + fw * 0.80, fy + fh * 0.15, fw * 0.18, fh * 0.18, "RT", 1.0, 3);
    if (skinCnt < 30) {
      addBox(fx + fw * 0.25, fy + fh * 0.05, fw * 0.50, fh * 0.20, "FC", 2.5, 2);
    }
  }

  if (totalW < 1) return { r: 0, g: 0, b: 0, brightness: 0, ok: false, label: "NONE", skinRatio: 0, motion: 0 };

  const r = totalR / totalW, g = totalG / totalW, b = totalB / totalW;
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  const skinRatio = allCnt > 0 ? skinCnt / allCnt : 0;
  const ok = brightness > 30 && brightness < 240 && skinRatio > 0.12;

  let varSum = 0;
  if (pixR.length > 1) {
    varSum = (std(pixR) + std(pixG) + std(pixB)) / 3;
  }

  return { r, g, b, brightness, ok, label, skinRatio, motion: varSum };
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

function madFilter(vals: number[]): number[] {
  if (vals.length < 5) return vals;
  const med = vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)];
  const devs = vals.map(v => Math.abs(v - med));
  const mad = devs.slice().sort((a, b) => a - b)[Math.floor(devs.length / 2)] * 1.4826;
  if (mad < 1) return vals;
  return vals.filter(v => Math.abs(v - med) <= 3 * mad);
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
  const motionBuf = useRef<number[]>([]);
  const bpmRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);
  const fpsRef = useRef<number>(30);
  const prevMs = useRef<number>(0);
  const noFace = useRef<number>(0);
  const bpmHistory = useRef<number[]>([]);
  const prevRGB = useRef<{ r: number; g: number; b: number } | null>(null);
  const confHistory = useRef<number[]>([]);
  const stabilityRef = useRef<number>(0);
  const motionDecay = useRef<number>(0);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "POS+CHROM+G",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { rafRef.current = requestAnimationFrame(processFrame); return; }

    const now = performance.now();
    if (prevMs.current > 0) {
      const dt = (now - prevMs.current) / 1000;
      if (dt > 0.001) fpsRef.current = fpsRef.current * 0.92 + (1 / dt) * 0.08;
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

    const roi = sampleRGBSkinFiltered(ctx,
      foreheadBoxRef?.current ?? null,
      cheekBoxRef?.current ?? null,
      faceBoxRef?.current ?? null,
      vw, vh);

    if (!roi.ok) {
      noFace.current++;
      if (noFace.current >= 30) {
        bpmRef.current = null;
        rBuf.current = []; gBuf.current = []; bBuf.current = [];
        tsBuf.current = []; bpmHistory.current = []; motionBuf.current = [];
        prevRGB.current = null; confHistory.current = [];
        stabilityRef.current = 0; motionDecay.current = 0;
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

    let frameMotion = 0;
    if (prevRGB.current) {
      frameMotion = Math.abs(roi.r - prevRGB.current.r) +
                    Math.abs(roi.g - prevRGB.current.g) +
                    Math.abs(roi.b - prevRGB.current.b);
    }
    prevRGB.current = { r: roi.r, g: roi.g, b: roi.b };

    motionBuf.current.push(frameMotion);
    if (motionBuf.current.length > 40) motionBuf.current.shift();
    const avgMotion = mean(motionBuf.current);
    const isHighMotion = frameMotion > avgMotion * MOTION_THRESH && motionBuf.current.length > 5;

    if (isHighMotion) {
      motionDecay.current = Math.min(motionDecay.current + 3, 12);
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (motionDecay.current > 0) {
      motionDecay.current--;
      if (motionDecay.current > 6) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }
    }

    const lum = roi.r + roi.g + roi.b;
    const meanLum = lum / 3;
    const normFactor = meanLum > 5 ? Math.min(3.0, 128 / meanLum) : 1;
    const nR = Math.min(255, roi.r * normFactor);
    const nG = Math.min(255, roi.g * normFactor);
    const nB = Math.min(255, roi.b * normFactor);

    rBuf.current.push(nR);
    gBuf.current.push(nG);
    bBuf.current.push(nB);
    tsBuf.current.push(now);

    while (rBuf.current.length > BUFFER_SIZE) {
      rBuf.current.shift(); gBuf.current.shift(); bBuf.current.shift(); tsBuf.current.shift();
    }

    const bufLen = rBuf.current.length;

    const minRequired = bpmRef.current === null ? MIN_FRAMES_FAST : MIN_FRAMES_FULL;
    if (frameRef.current % 2 === 0 && bufLen >= minRequired) {
      const elapsed = (tsBuf.current[bufLen - 1] - tsBuf.current[0]) / 1000;
      if (elapsed < 0.5) { rafRef.current = requestAnimationFrame(processFrame); return; }
      const actualFps = (bufLen - 1) / elapsed;
      if (actualFps < 5 || actualFps > 120) { rafRef.current = requestAnimationFrame(processFrame); return; }

      const result = bestOfThree(rBuf.current, gBuf.current, bBuf.current, actualFps);

      const acSig = detrend(movingAvg(gBuf.current, SMOOTH_WIN));
      const acFiltered = butterworthBandpass(acSig, actualFps, FL, FH);
      const acBpm = autocorrelationBPM(acFiltered, actualFps);

      let finalRawBpm = result.bpm;
      let bonusConf = 0;
      if (acBpm !== null && Math.abs(acBpm - result.bpm) <= 6) {
        bonusConf = 10;
      } else if (acBpm !== null && Math.abs(acBpm - result.bpm) > 15) {
        finalRawBpm = result.snr > 3 ? result.bpm : acBpm;
      }

      let totalConf = Math.min(98, result.confidence + bonusConf);

      const skinQuality = clamp(roi.skinRatio, 0, 1);
      totalConf = Math.round(totalConf * (0.5 + skinQuality * 0.5));

      if (motionDecay.current > 0) {
        totalConf = Math.round(totalConf * (1 - motionDecay.current * 0.06));
      }

      confHistory.current.push(totalConf);
      if (confHistory.current.length > 10) confHistory.current.shift();
      const avgConf = Math.round(mean(confHistory.current));

      if (finalRawBpm >= BPM_LO && finalRawBpm <= BPM_HI && avgConf >= 5) {
        bpmHistory.current.push(finalRawBpm);
        if (bpmHistory.current.length > HISTORY_LEN) bpmHistory.current.shift();

        let cleaned = iqrFilter(bpmHistory.current);
        cleaned = madFilter(cleaned);

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
            const qualityFactor = clamp(avgConf / 100, 0.1, 1);
            const alpha = jump <= 4 ? 0.35 * qualityFactor
                        : jump <= 8 ? 0.20 * qualityFactor
                        : jump <= 15 ? 0.10 * qualityFactor
                        : 0.05 * qualityFactor;
            bpmRef.current = Math.round(bpmRef.current * (1 - alpha) + medBpm * alpha);
          }
        }

        if (bpmRef.current !== null) {
          const recentBpms = bpmHistory.current.slice(-5);
          const bpmStd = std(recentBpms);
          stabilityRef.current = clamp(1 - bpmStd / 15, 0, 1);
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";
      const sqiLabel = result.sqi > 0.5 ? "HIGH" : result.sqi > 0.25 ? "MED" : "LOW";
      const stab = stabilityRef.current;
      const displayConf = Math.min(98, Math.round(avgConf * (0.7 + stab * 0.3)));

      setData(prev => ({
        bpm: finalBpm,
        confidence: displayConf,
        signal: result.waveform.length > 0 ? result.waveform : result.spectrum,
        isActive: true,
        stress,
        trend: (finalBpm != null && prev.bpm != null)
          ? (finalBpm > prev.bpm + 3 ? "rising" : finalBpm < prev.bpm - 3 ? "falling" : "stable")
          : "stable",
        algorithm: `${result.method} SQI:${sqiLabel}`,
        faceDetected: true,
        frameRate: Math.round(fpsRef.current),
        calibrating: finalBpm === null,
        roiDebug: `${roi.label} SK:${Math.round(roi.skinRatio * 100)}% S:${Math.round(stab * 100)}%`,
      }));
    } else if (frameRef.current % 20 === 0) {
      const rem = Math.max(0, minRequired - bufLen);
      setData(prev => ({
        ...prev, isActive: true, faceDetected: true,
        frameRate: Math.round(fpsRef.current),
        calibrating: bpmRef.current === null,
        roiDebug: roi.label + (rem > 0 ? ` (${Math.ceil(rem / fpsRef.current)}s)` : ` SK:${Math.round(roi.skinRatio * 100)}%`),
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef]);

  const start = useCallback(() => {
    rBuf.current = []; gBuf.current = []; bBuf.current = [];
    tsBuf.current = []; motionBuf.current = [];
    bpmRef.current = null; frameRef.current = 0;
    fpsRef.current = 30; prevMs.current = 0;
    bpmHistory.current = []; noFace.current = 0;
    prevRGB.current = null; confHistory.current = [];
    stabilityRef.current = 0; motionDecay.current = 0;
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
