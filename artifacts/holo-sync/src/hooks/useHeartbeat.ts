/**
 * useHeartbeat — rPPG v3 (fixed)
 *
 * References: Wang 2017 POS, Tarvainen 2002 detrending, prouast/heartbeat-js
 *
 * Critical fixes from code review:
 *  - POS receives RAW RGB (not z-scored) — per-window normalization inside POS
 *  - Single filtfilt pass = effective 4th-order (not double-applied)
 *  - Correct Butterworth Q = 1/√2 = 0.7071
 *  - Bandpass 0.67–2.5 Hz (40–150 BPM)
 *  - Harmonic rejection with proper state tracking
 *  - λ=10 detrending per Tarvainen 2002
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

const FS        = 30;
const WIN       = 300;
const BPM_LO    = 40;
const BPM_HI    = 150;
const BP_LO     = BPM_LO / 60;
const BP_HI     = BPM_HI / 60;
const SUB_W     = 48;
const EMA_ALPHA = 0.15;
const AGREE_THR = 10;
const LAM       = 10;

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std  = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)) || 1e-10;
};
const clamp  = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function detrendSP(sig: number[], lambda: number): number[] {
  const n = sig.length;
  if (n < 5) return sig;
  const l2 = lambda * lambda;
  const d = new Float64Array(n);
  const dl = new Float64Array(n);
  const du = new Float64Array(n);
  const dll = new Float64Array(n);
  const duu = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = 1;
    if (i === 0 || i === n - 1) v += l2;
    else if (i === 1 || i === n - 2) v += 5 * l2;
    else v += 6 * l2;
    d[i] = v;
  }
  for (let i = 1; i < n; i++) {
    const v = (i === 1 || i === n - 1) ? -2 * l2 : -4 * l2;
    dl[i] = v;
    du[i - 1] = v;
  }
  for (let i = 2; i < n; i++) { dll[i] = l2; duu[i - 2] = l2; }
  const trend = new Float64Array(n);
  for (let i = 0; i < n; i++) trend[i] = sig[i];
  for (let iter = 0; iter < 20; iter++) {
    for (let i = 0; i < n; i++) {
      let rhs = sig[i];
      if (i >= 1) rhs -= dl[i] * trend[i - 1];
      if (i >= 2) rhs -= dll[i] * trend[i - 2];
      if (i < n - 1) rhs -= du[i] * trend[i + 1];
      if (i < n - 2) rhs -= duu[i] * trend[i + 2];
      trend[i] = rhs / d[i];
    }
  }
  return sig.map((v, i) => v - trend[i]);
}

type Biquad = { b0: number; b1: number; b2: number; a0: number; a1: number; a2: number };

function bwHP(fc: number, fs: number): Biquad {
  const w0 = 2 * Math.PI * fc / fs;
  const Q = Math.SQRT1_2;
  const alpha = Math.sin(w0) / (2 * Q);
  return {
    b0: (1 + Math.cos(w0)) / 2,
    b1: -(1 + Math.cos(w0)),
    b2: (1 + Math.cos(w0)) / 2,
    a0: 1 + alpha,
    a1: -2 * Math.cos(w0),
    a2: 1 - alpha,
  };
}

function bwLP(fc: number, fs: number): Biquad {
  const w0 = 2 * Math.PI * fc / fs;
  const Q = Math.SQRT1_2;
  const alpha = Math.sin(w0) / (2 * Q);
  return {
    b0: (1 - Math.cos(w0)) / 2,
    b1: 1 - Math.cos(w0),
    b2: (1 - Math.cos(w0)) / 2,
    a0: 1 + alpha,
    a1: -2 * Math.cos(w0),
    a2: 1 - alpha,
  };
}

function applyBiquad(sig: number[], bq: Biquad): number[] {
  const { b0, b1, b2, a0, a1, a2 } = bq;
  const y = new Float64Array(sig.length);
  for (let i = 0; i < sig.length; i++) {
    y[i] = (b0 / a0) * sig[i];
    if (i >= 1) y[i] += (b1 / a0) * sig[i - 1] - (a1 / a0) * y[i - 1];
    if (i >= 2) y[i] += (b2 / a0) * sig[i - 2] - (a2 / a0) * y[i - 2];
  }
  return Array.from(y);
}

function filtfilt(sig: number[], bq: Biquad): number[] {
  const n = sig.length;
  const pad = Math.min(12, n - 1);
  if (pad < 1) return applyBiquad(sig, bq);
  const p = new Array(n + 2 * pad);
  for (let i = 0; i < pad; i++) p[i] = 2 * sig[0] - sig[pad - i];
  for (let i = 0; i < n; i++) p[pad + i] = sig[i];
  for (let i = 0; i < pad; i++) p[pad + n + i] = 2 * sig[n - 1] - sig[n - 2 - i];
  const f = applyBiquad(p, bq);
  f.reverse();
  const r = applyBiquad(f, bq);
  r.reverse();
  return r.slice(pad, pad + n);
}

function bandpass(sig: number[], lo: number, hi: number, fs: number): number[] {
  return filtfilt(filtfilt(sig, bwHP(lo, fs)), bwLP(hi, fs));
}

function fftMag(sig: number[]): Float64Array {
  const n = sig.length;
  let sz = 1;
  while (sz < n) sz <<= 1;
  const re = new Float64Array(sz);
  const im = new Float64Array(sz);
  for (let i = 0; i < n; i++) re[i] = sig[i];
  for (let i = 1, j = 0; i < sz; i++) {
    let bit = sz >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= sz; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = -Math.sin(ang);
    for (let i = 0; i < sz; i += len) {
      let pr = 1, pi = 0;
      for (let j = 0; j < len >> 1; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * pr - im[i + j + len / 2] * pi;
        const vi = re[i + j + len / 2] * pi + im[i + j + len / 2] * pr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = pr * wr - pi * wi; pi = pr * wi + pi * wr; pr = t;
      }
    }
  }
  const m = new Float64Array(sz >> 1);
  for (let i = 0; i < sz >> 1; i++) m[i] = Math.sqrt(re[i] ** 2 + im[i] ** 2);
  return m;
}

function windowedPOS(R: number[], G: number[], B: number[]): number[] {
  const n = R.length;
  const H = new Float64Array(n);
  for (let t = SUB_W; t <= n; t++) {
    const m = t - SUB_W;
    let mr = 0, mg = 0, mb = 0;
    for (let i = m; i < t; i++) { mr += R[i]; mg += G[i]; mb += B[i]; }
    mr /= SUB_W; mg /= SUB_W; mb /= SUB_W;
    if (Math.abs(mr) < 1) mr = 1;
    if (Math.abs(mg) < 1) mg = 1;
    if (Math.abs(mb) < 1) mb = 1;

    const S0 = new Float64Array(SUB_W);
    const S1 = new Float64Array(SUB_W);
    for (let j = 0; j < SUB_W; j++) {
      const rn = R[m + j] / mr;
      const gn = G[m + j] / mg;
      const bn = B[m + j] / mb;
      S0[j] = gn - bn;
      S1[j] = -2 * rn + gn + bn;
    }

    let s0m = 0, s1m = 0;
    for (let j = 0; j < SUB_W; j++) { s0m += S0[j]; s1m += S1[j]; }
    s0m /= SUB_W; s1m /= SUB_W;
    let v0 = 0, v1 = 0;
    for (let j = 0; j < SUB_W; j++) {
      v0 += (S0[j] - s0m) ** 2;
      v1 += (S1[j] - s1m) ** 2;
    }
    const std0 = Math.sqrt(v0 / SUB_W) || 1e-10;
    const std1 = Math.sqrt(v1 / SUB_W) || 1e-10;
    const alpha = std0 / std1;

    let hMean = 0;
    const h = new Float64Array(SUB_W);
    for (let j = 0; j < SUB_W; j++) { h[j] = S0[j] + alpha * S1[j]; hMean += h[j]; }
    hMean /= SUB_W;
    for (let j = 0; j < SUB_W; j++) H[m + j] += h[j] - hMean;
  }
  return Array.from(H);
}

function welchBPM(sig: number[], fs: number): { bpm: number; snr: number } {
  const s2 = std(sig);
  if (s2 < 1e-10) return { bpm: 0, snr: 0 };
  const norm = sig.map(v => v / s2);

  const segLen = Math.min(norm.length, 256);
  const overlap = Math.floor(segLen * 0.5);
  const step = segLen - overlap;
  const nSegs = Math.max(1, Math.floor((norm.length - segLen) / step) + 1);

  let sz = 1;
  while (sz < segLen * 4) sz <<= 1;
  const avgPow = new Float64Array(sz >> 1);

  for (let s = 0; s < nSegs; s++) {
    const start = s * step;
    const seg = norm.slice(start, start + segLen);
    const w = seg.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (segLen - 1))));
    const padded = [...w, ...new Array(sz - segLen).fill(0)];
    const m = fftMag(padded);
    for (let k = 0; k < avgPow.length; k++) avgPow[k] += m[k] * m[k];
  }
  for (let k = 0; k < avgPow.length; k++) avgPow[k] /= nSegs;

  const fr = fs / (avgPow.length * 2);
  const lo = Math.max(1, Math.floor(BP_LO / fr));
  const hi = Math.min(avgPow.length - 2, Math.ceil(BP_HI / fr));

  const peaks: { bin: number; pow: number }[] = [];
  for (let k = lo + 1; k < hi; k++) {
    if (avgPow[k] > avgPow[k - 1] && avgPow[k] > avgPow[k + 1]) {
      peaks.push({ bin: k, pow: avgPow[k] });
    }
  }
  if (peaks.length === 0) {
    let best = lo, bestP = avgPow[lo];
    for (let k = lo; k <= hi; k++) if (avgPow[k] > bestP) { bestP = avgPow[k]; best = k; }
    peaks.push({ bin: best, pow: bestP });
  }
  peaks.sort((a, b) => b.pow - a.pow);

  let chosenBin = peaks[0].bin;
  let chosenPow = peaks[0].pow;

  for (const pk of peaks) {
    const f = pk.bin * fr;
    if (f > 1.2) {
      const halfBin = Math.round(pk.bin / 2);
      if (halfBin >= lo && halfBin <= hi && avgPow[halfBin] > pk.pow * 0.3) {
        const halfF = halfBin * fr * 60;
        if (halfF >= BPM_LO && halfF <= BPM_HI) {
          chosenBin = halfBin;
          chosenPow = avgPow[halfBin];
          break;
        }
      }
    }
    if (f > 1.8) {
      const thirdBin = Math.round(pk.bin / 3);
      if (thirdBin >= lo && thirdBin <= hi && avgPow[thirdBin] > pk.pow * 0.3) {
        const thirdF = thirdBin * fr * 60;
        if (thirdF >= BPM_LO && thirdF <= BPM_HI) {
          chosenBin = thirdBin;
          chosenPow = avgPow[thirdBin];
          break;
        }
      }
    }
    chosenBin = pk.bin;
    chosenPow = pk.pow;
    break;
  }

  let freq = chosenBin * fr;
  if (chosenBin > lo && chosenBin < hi) {
    const al = avgPow[chosenBin - 1], bm = avgPow[chosenBin], ar = avgPow[chosenBin + 1];
    const d = al - 2 * bm + ar;
    if (Math.abs(d) > 1e-12) freq = (chosenBin + 0.5 * (al - ar) / d) * fr;
  }

  let bsum = 0;
  for (let k = lo; k <= hi; k++) bsum += avgPow[k];
  const bmean = bsum / Math.max(1, hi - lo + 1);
  const snr = bmean > 0 ? chosenPow / bmean : 0;

  return { bpm: Math.round(clamp(freq * 60, BPM_LO, BPM_HI)), snr };
}

function peakCountBPM(sig: number[], fs: number): { bpm: number; conf: number } {
  const n = sig.length;
  if (n < fs * 3) return { bpm: 0, conf: 0 };
  const sigma = std(sig);
  const thr = sigma * 0.4;
  const minDist = Math.floor(fs * 60 / BPM_HI);
  const peaks: number[] = [];

  for (let i = 2; i < n - 2; i++) {
    if (sig[i] > sig[i - 1] && sig[i] > sig[i + 1] &&
        sig[i] > sig[i - 2] && sig[i] > sig[i + 2] && sig[i] > thr) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDist) {
        peaks.push(i);
      } else if (sig[i] > sig[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = i;
      }
    }
  }
  if (peaks.length < 3) return { bpm: 0, conf: 0 };

  const ibis: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const ibi = (peaks[i] - peaks[i - 1]) / fs;
    const bpm = 60 / ibi;
    if (bpm >= BPM_LO && bpm <= BPM_HI) ibis.push(ibi);
  }
  if (ibis.length < 2) return { bpm: 0, conf: 0 };

  const sorted = [...ibis].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const valid = ibis.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
  if (valid.length < 2) return { bpm: 0, conf: 0 };

  const ibiMean = mean(valid);
  const ibiStd = std(valid);
  const regularity = Math.max(0, 1 - ibiStd / ibiMean);
  return {
    bpm: Math.round(60 / median(valid)),
    conf: Math.round(regularity * 100 * Math.min(1, valid.length / 5)),
  };
}

function acfBPM(sig: number[], fs: number): { bpm: number; conf: number } {
  const n = sig.length;
  const minLag = Math.max(2, Math.floor(fs * 60 / BPM_HI));
  const maxLag = Math.min(Math.floor(fs * 60 / BPM_LO), Math.floor(n / 2));
  const m2 = mean(sig), s2 = std(sig);
  if (s2 < 1e-10) return { bpm: 0, conf: 0 };
  const norm = sig.map(v => (v - m2) / s2);

  const acf: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += norm[i] * norm[i + lag];
    c /= (n - lag);
    acf.push(c);
  }

  let bestIdx = 0, bestVal = acf[0];
  for (let i = 1; i < acf.length - 1; i++) {
    if (acf[i] > acf[i - 1] && acf[i] > acf[i + 1] && acf[i] > 0.1) {
      bestIdx = i;
      bestVal = acf[i];
      break;
    }
  }
  if (bestVal < 0.1) {
    for (let i = 0; i < acf.length; i++) {
      if (acf[i] > bestVal) { bestVal = acf[i]; bestIdx = i; }
    }
  }
  if (bestVal < 0.05) return { bpm: 0, conf: 0 };

  let refinedLag = minLag + bestIdx;
  if (bestIdx > 0 && bestIdx < acf.length - 1) {
    const a = acf[bestIdx - 1], b = acf[bestIdx], c2 = acf[bestIdx + 1];
    const d = a - 2 * b + c2;
    if (Math.abs(d) > 1e-12) refinedLag = minLag + bestIdx + 0.5 * (a - c2) / d;
  }

  return { bpm: Math.round(fs * 60 / refinedLag), conf: Math.round(Math.min(100, bestVal * 100)) };
}

function consensus(
  peak: { bpm: number; conf: number },
  fft: { bpm: number; snr: number },
  acf: { bpm: number; conf: number },
): { bpm: number; conf: number; method: string } {
  const cands: { bpm: number; w: number; l: string }[] = [];
  if (peak.bpm >= BPM_LO && peak.bpm <= BPM_HI && peak.conf > 20)
    cands.push({ bpm: peak.bpm, w: peak.conf, l: "P" });
  if (fft.bpm >= BPM_LO && fft.bpm <= BPM_HI && fft.snr > 2)
    cands.push({ bpm: fft.bpm, w: Math.min(100, fft.snr * 15), l: "F" });
  if (acf.bpm >= BPM_LO && acf.bpm <= BPM_HI && acf.conf > 15)
    cands.push({ bpm: acf.bpm, w: acf.conf, l: "A" });

  if (!cands.length) return { bpm: 0, conf: 0, method: "NONE" };
  if (cands.length === 1) return { bpm: cands[0].bpm, conf: Math.min(45, cands[0].w), method: cands[0].l };

  let bestAgree: { bpm: number; w: number; labels: string } | null = null;
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      if (Math.abs(cands[i].bpm - cands[j].bpm) <= AGREE_THR) {
        const w = cands[i].w + cands[j].w;
        const avg = Math.round((cands[i].bpm * cands[i].w + cands[j].bpm * cands[j].w) / w);
        if (!bestAgree || w > bestAgree.w) bestAgree = { bpm: avg, w, labels: cands[i].l + "+" + cands[j].l };
      }
    }
  }
  if (bestAgree) return { bpm: bestAgree.bpm, conf: Math.min(95, Math.round(bestAgree.w * 0.55)), method: bestAgree.labels };

  cands.sort((a, b) => b.w - a.w);
  return { bpm: cands[0].bpm, conf: Math.min(35, cands[0].w), method: cands[0].l + "?" };
}

function sampleROI(
  ctx: CanvasRenderingContext2D,
  foreheadBox: FaceBox | null,
  cheekBox: FaceBox | null,
  faceBox: FaceBox | null,
  vw: number, vh: number,
): { r: number; g: number; b: number; ok: boolean; label: string } {
  let totalR = 0, totalG = 0, totalB = 0, cnt = 0;
  let label = "";

  const addBox = (x: number, y: number, w: number, h: number, lbl: string) => {
    const xi = Math.max(0, Math.floor(x));
    const yi = Math.max(0, Math.floor(y));
    const wi = Math.max(1, Math.min(Math.floor(w), vw - xi));
    const hi = Math.max(1, Math.min(Math.floor(h), vh - yi));
    try {
      const d = ctx.getImageData(xi, yi, wi, hi).data;
      for (let i = 0; i < d.length; i += 4) { totalR += d[i]; totalG += d[i + 1]; totalB += d[i + 2]; cnt++; }
      label = label ? label + "+" + lbl : lbl;
    } catch { /* */ }
  };

  if (foreheadBox && foreheadBox.w > 8 && foreheadBox.h > 6)
    addBox(foreheadBox.x, foreheadBox.y, foreheadBox.w, foreheadBox.h, "FH");
  if (cheekBox && cheekBox.w > 10 && cheekBox.h > 8)
    addBox(cheekBox.x, cheekBox.y, cheekBox.w, cheekBox.h, "CK");
  if (cnt < 50 && faceBox && faceBox.w > 30 && faceBox.h > 30)
    addBox(faceBox.x + faceBox.w * 0.3, faceBox.y + faceBox.h * 0.1, faceBox.w * 0.4, faceBox.h * 0.15, "FC");

  if (cnt < 10) return { r: 0, g: 0, b: 0, ok: false, label: "NONE" };
  const r = totalR / cnt, g = totalG / cnt, b = totalB / cnt;
  return { r, g, b, ok: r > 15 && g > 10 && r < 250, label };
}

export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?: React.MutableRefObject<FaceBox | null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
  cheekBoxRef?: React.MutableRefObject<FaceBox | null>,
) {
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const rawBuf = useRef<[number, number, number, number][]>([]);
  const resR = useRef<number[]>([]);
  const resG = useRef<number[]>([]);
  const resB = useRef<number[]>([]);
  const lastResMs = useRef<number>(0);
  const bpmRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);
  const fpsRef = useRef<number>(30);
  const prevMsRef = useRef<number>(0);
  const noFaceFrames = useRef<number>(0);
  const rawBpmHist = useRef<number[]>([]);
  const outputHist = useRef<number[]>([]);
  const FACE_LOST = 15;

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "POS+WELCH+ACF",
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

    if (roi.ok) {
      noFaceFrames.current = 0;
      rawBuf.current.push([now, roi.r, roi.g, roi.b]);
      while (rawBuf.current.length > 2 && rawBuf.current[0][0] < now - 30000) rawBuf.current.shift();

      const interval = 1000 / FS;
      if (rawBuf.current.length >= 2 && lastResMs.current === 0)
        lastResMs.current = rawBuf.current[0][0];

      while (rawBuf.current.length >= 2 && lastResMs.current + interval <= now) {
        const t = lastResMs.current + interval;
        let idx = 0;
        for (let i = 0; i < rawBuf.current.length - 1; i++) {
          if (rawBuf.current[i][0] <= t && rawBuf.current[i + 1][0] >= t) { idx = i; break; }
        }
        const s0 = rawBuf.current[idx], s1 = rawBuf.current[idx + 1];
        const dt = s1[0] - s0[0];
        const a = dt > 0 ? (t - s0[0]) / dt : 0;
        resR.current.push(s0[1] * (1 - a) + s1[1] * a);
        resG.current.push(s0[2] * (1 - a) + s1[2] * a);
        resB.current.push(s0[3] * (1 - a) + s1[3] * a);
        lastResMs.current = t;

        const maxN = WIN + FS * 10;
        if (resR.current.length > maxN) { resR.current.shift(); resG.current.shift(); resB.current.shift(); }
      }
    } else {
      noFaceFrames.current++;
      if (noFaceFrames.current === FACE_LOST) {
        bpmRef.current = null;
        rawBuf.current = []; resR.current = []; resG.current = []; resB.current = [];
        lastResMs.current = 0; rawBpmHist.current = []; outputHist.current = [];
        setData({ bpm: null, confidence: 0, signal: [], isActive: true, stress: "low", trend: "stable",
          algorithm: "POS+WELCH+ACF", faceDetected: false, frameRate: Math.round(fpsRef.current), calibrating: true, roiDebug: "NO FACE" });
      }
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (frameRef.current % 3 === 0 && resR.current.length >= WIN) {
      const len = resR.current.length;
      const R = resR.current.slice(len - WIN);
      const G = resG.current.slice(len - WIN);
      const B = resB.current.slice(len - WIN);

      const posPulse = windowedPOS(R, G, B);
      const posD = detrendSP(posPulse, LAM);
      const posF = bandpass(posD, BP_LO, BP_HI, FS);

      const greenD = detrendSP(G.map(v => v - mean(G)), LAM);
      const greenF = bandpass(greenD, BP_LO, BP_HI, FS);

      const posFft = welchBPM(posF, FS);
      const greenFft = welchBPM(greenF, FS);
      const bestSig = posFft.snr >= greenFft.snr ? posF : greenF;
      const sigLabel = posFft.snr >= greenFft.snr ? "POS" : "GRN";

      const peakResult = peakCountBPM(bestSig, FS);
      const fftResult = posFft.snr >= greenFft.snr ? posFft : greenFft;
      const acfResult = acfBPM(bestSig, FS);

      const { bpm: consBpm, conf, method } = consensus(peakResult, fftResult, acfResult);

      if (consBpm >= BPM_LO && consBpm <= BPM_HI && conf >= 15) {
        rawBpmHist.current.push(consBpm);
        if (rawBpmHist.current.length > 30) rawBpmHist.current.shift();

        if (bpmRef.current === null) {
          if (rawBpmHist.current.length >= 5) {
            bpmRef.current = Math.round(median(rawBpmHist.current.slice(-7)));
            outputHist.current = [bpmRef.current];
          }
        } else {
          const jump = Math.abs(consBpm - bpmRef.current);
          if (jump <= 25 || conf >= 55) {
            const alpha = jump <= 5 ? EMA_ALPHA : jump <= 15 ? EMA_ALPHA * 0.5 : EMA_ALPHA * 0.25;
            bpmRef.current = Math.round(bpmRef.current * (1 - alpha) + consBpm * alpha);
          }
          outputHist.current.push(bpmRef.current);
          if (outputHist.current.length > 5) outputHist.current.shift();
        }
      }

      const finalBpm = outputHist.current.length >= 3
        ? Math.round(median(outputHist.current))
        : bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";

      const sigStd = std(bestSig) || 1;
      const display = bestSig.map(v => v / sigStd).slice(-80);

      setData(prev => ({
        bpm: finalBpm, confidence: conf, signal: display, isActive: true, stress,
        trend: (finalBpm != null && prev.bpm != null)
          ? (finalBpm > prev.bpm + 2 ? "rising" : finalBpm < prev.bpm - 2 ? "falling" : "stable") : "stable",
        algorithm: `${sigLabel}:${method} P:${peakResult.bpm} F:${fftResult.bpm} A:${acfResult.bpm}`,
        faceDetected: true, frameRate: Math.round(fpsRef.current),
        calibrating: finalBpm === null, roiDebug: roi.label,
      }));
    } else if (frameRef.current % 30 === 0) {
      const rem = Math.max(0, WIN - resR.current.length);
      setData(prev => ({ ...prev, isActive: true, faceDetected: roi.ok,
        frameRate: Math.round(fpsRef.current), calibrating: bpmRef.current === null,
        roiDebug: roi.label + (rem > 0 ? ` (${Math.ceil(rem / FS)}s)` : "") }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef]);

  const start = useCallback(() => {
    rawBuf.current = []; resR.current = []; resG.current = []; resB.current = [];
    lastResMs.current = 0; bpmRef.current = null; frameRef.current = 0;
    fpsRef.current = 30; prevMsRef.current = 0;
    rawBpmHist.current = []; outputHist.current = [];
    noFaceFrames.current = 0;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18);
    outputHist.current = [bpmRef.current!];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9);
    outputHist.current = [bpmRef.current!];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
