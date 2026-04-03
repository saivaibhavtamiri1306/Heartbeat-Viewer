/**
 * useHeartbeat — Research-grade rPPG with windowed normalization
 *
 * Key accuracy fixes vs previous version:
 *  1. WINDOWED NORMALIZATION (POS paper §III-C): normalize R,G,B in sliding
 *     sub-windows of ~1.6s instead of the full 8.5s window. This is critical
 *     because webcam auto-exposure changes the mean over time — full-window
 *     normalization is wrong for consumer cameras.
 *  2. SKIN-PIXEL FILTERING: YCbCr skin model in ROI sampling — only averages
 *     actual skin pixels, excludes hair/shadow/background that add noise.
 *  3. 4TH-ORDER BUTTERWORTH: cascade 2×2nd-order for steeper rolloff, better
 *     frequency selectivity (2nd-order lets too much noise through).
 *  4. ADAPTIVE SEARCH RANGE: after first estimate, narrow FFT peak search to
 *     ±20 BPM around last reading (avoids locking onto noise peaks).
 *  5. TIGHTER JUMP REJECTION: max 8 BPM change between consecutive estimates
 *     (heart rate doesn't jump 15 BPM while sitting still).
 *
 * Pipeline: ROI → skin filter → 30Hz resample → motion reject → windowed
 * POS+CHROM → moving-mean detrend → 4th-order BP → Hann FFT → ensemble
 * spectrum average → adaptive peak → parabolic interp → weighted median
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

const TARGET_FS    = 30;
const WIN_SIZE     = 256;
const HR_MIN_BPM   = 45;
const HR_MAX_BPM   = 150;
const SNR_MIN      = 1.5;
const SMOOTH_N     = 14;
const CAL_FRAMES   = WIN_SIZE;
const MOTION_THR   = 6.0;
const DETREND_WIN  = 45;
const SUB_WIN      = 48;    // ~1.6s sub-window for normalization (POS paper)
const SUB_STRIDE   = 24;    // 50% overlap
const ADAPT_RANGE  = 20;    // ±20 BPM adaptive search
const JUMP_MAX     = 8;     // Max BPM change between estimates

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std  = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)) || 1e-10;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function weightedMedian(vals: number[], weights: number[]): number {
  const pairs = vals.map((v, i) => ({ v, w: weights[i] })).sort((a, b) => a.v - b.v);
  const total = pairs.reduce((s, p) => s + p.w, 0);
  let cum = 0;
  for (const p of pairs) { cum += p.w; if (cum >= total / 2) return p.v; }
  return pairs[pairs.length - 1].v;
}

// ─── Moving-mean detrend ────────────────────────────────────────────────────────
function movingDetrend(sig: number[], win: number): number[] {
  const half = Math.floor(win / 2);
  return sig.map((v, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(sig.length - 1, i + half);
    let s = 0;
    for (let j = lo; j <= hi; j++) s += sig[j];
    return v - s / (hi - lo + 1);
  });
}

// ─── 2nd-order Butterworth (bilinear transform) ─────────────────────────────────
type C3 = [number, number, number];
function bwHP(fc: number, fs: number): { b: C3; a: C3 } {
  const w = 2 * Math.tan(Math.PI * fc / fs), w2 = w * w, s2 = Math.SQRT2;
  const n = 4 + 2 * s2 * w + w2;
  return { b: [4/n, -8/n, 4/n], a: [1, (2*w2-8)/n, (4-2*s2*w+w2)/n] };
}
function bwLP(fc: number, fs: number): { b: C3; a: C3 } {
  const w = 2 * Math.tan(Math.PI * fc / fs), w2 = w * w, s2 = Math.SQRT2;
  const n = 4 + 2 * s2 * w + w2;
  return { b: [w2/n, 2*w2/n, w2/n], a: [1, (2*w2-8)/n, (4-2*s2*w+w2)/n] };
}
function applyIIR(sig: number[], b: C3, a: C3): number[] {
  const y = new Array(sig.length).fill(0);
  for (let i = 0; i < sig.length; i++) {
    let v = b[0] * sig[i];
    if (i >= 1) v += b[1]*sig[i-1] - a[1]*y[i-1];
    if (i >= 2) v += b[2]*sig[i-2] - a[2]*y[i-2];
    y[i] = v;
  }
  return y;
}
function filtfilt(sig: number[], b: C3, a: C3): number[] {
  return applyIIR([...applyIIR(sig, b, a)].reverse(), b, a).reverse();
}

// 4th-order bandpass: cascade two 2nd-order sections for steeper rolloff
function bandpass4(sig: number[], lo: number, hi: number, fs: number): number[] {
  const hp = bwHP(lo, fs), lp = bwLP(hi, fs);
  let s = filtfilt(sig, hp.b, hp.a);
  s = filtfilt(s, lp.b, lp.a);
  s = filtfilt(s, hp.b, hp.a);
  s = filtfilt(s, lp.b, lp.a);
  return s;
}

// ─── FFT ────────────────────────────────────────────────────────────────────────
function fftMag(sig: number[]): Float64Array {
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
  const m = new Float64Array(sz >> 1);
  for (let i = 0; i < sz >> 1; i++) m[i] = Math.sqrt(re[i] ** 2 + im[i] ** 2);
  return m;
}

// ─── Windowed POS (Wang et al. 2016 — §III-C) ──────────────────────────────────
// Normalizes in sliding sub-windows of ~1.6s instead of the full window.
// This removes auto-exposure drift that corrupts full-window normalization.
function windowedPOS(R: number[], G: number[], B: number[]): number[] {
  const n = R.length;
  const S = new Float64Array(n);
  const cnt = new Float64Array(n);
  for (let start = 0; start + SUB_WIN <= n; start += SUB_STRIDE) {
    const end = start + SUB_WIN;
    let mr = 0, mg = 0, mb = 0;
    for (let i = start; i < end; i++) { mr += R[i]; mg += G[i]; mb += B[i]; }
    mr = (mr / SUB_WIN) || 1; mg = (mg / SUB_WIN) || 1; mb = (mb / SUB_WIN) || 1;

    const H1 = new Float64Array(SUB_WIN);
    const H2 = new Float64Array(SUB_WIN);
    for (let j = 0; j < SUB_WIN; j++) {
      const rn = R[start + j] / mr, gn = G[start + j] / mg, bn = B[start + j] / mb;
      H1[j] = gn - bn;
      H2[j] = -2 * rn + gn + bn;
    }
    let mH1 = 0, mH2 = 0;
    for (let j = 0; j < SUB_WIN; j++) { mH1 += H1[j]; mH2 += H2[j]; }
    mH1 /= SUB_WIN; mH2 /= SUB_WIN;
    let s1 = 0, s2 = 0;
    for (let j = 0; j < SUB_WIN; j++) {
      s1 += (H1[j] - mH1) ** 2; s2 += (H2[j] - mH2) ** 2;
    }
    const stdH1 = Math.sqrt(s1 / SUB_WIN) || 1e-10;
    const stdH2 = Math.sqrt(s2 / SUB_WIN) || 1e-10;
    const alpha = stdH1 / stdH2;

    for (let j = 0; j < SUB_WIN; j++) {
      S[start + j] += H1[j] + alpha * H2[j];
      cnt[start + j]++;
    }
  }
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = cnt[i] > 0 ? S[i] / cnt[i] : 0;
  return out;
}

// ─── Windowed CHROM (de Haan & Jeanne 2013) ─────────────────────────────────────
function windowedCHROM(R: number[], G: number[], B: number[]): number[] {
  const n = R.length;
  const S = new Float64Array(n);
  const cnt = new Float64Array(n);
  for (let start = 0; start + SUB_WIN <= n; start += SUB_STRIDE) {
    const end = start + SUB_WIN;
    let mr = 0, mg = 0, mb = 0;
    for (let i = start; i < end; i++) { mr += R[i]; mg += G[i]; mb += B[i]; }
    mr = (mr / SUB_WIN) || 1; mg = (mg / SUB_WIN) || 1; mb = (mb / SUB_WIN) || 1;

    const Xs = new Float64Array(SUB_WIN);
    const Ys = new Float64Array(SUB_WIN);
    for (let j = 0; j < SUB_WIN; j++) {
      const rn = R[start + j] / mr, gn = G[start + j] / mg, bn = B[start + j] / mb;
      Xs[j] = 3 * rn - 2 * gn;
      Ys[j] = 1.5 * rn + gn - 1.5 * bn;
    }
    let mXs = 0, mYs = 0;
    for (let j = 0; j < SUB_WIN; j++) { mXs += Xs[j]; mYs += Ys[j]; }
    mXs /= SUB_WIN; mYs /= SUB_WIN;
    let sx = 0, sy = 0;
    for (let j = 0; j < SUB_WIN; j++) {
      sx += (Xs[j] - mXs) ** 2; sy += (Ys[j] - mYs) ** 2;
    }
    const stdX = Math.sqrt(sx / SUB_WIN) || 1e-10;
    const stdY = Math.sqrt(sy / SUB_WIN) || 1e-10;
    const alpha = stdX / stdY;

    for (let j = 0; j < SUB_WIN; j++) {
      S[start + j] += Xs[j] - alpha * Ys[j];
      cnt[start + j]++;
    }
  }
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = cnt[i] > 0 ? S[i] / cnt[i] : 0;
  return out;
}

// ─── Signal → spectrum (detrend → 4th-order BP → normalize → Hann → FFT) ─────
function signalToSpectrum(raw: number[]): Float64Array {
  const d  = movingDetrend(raw, DETREND_WIN);
  const bp = bandpass4(d, 0.75, 2.5, TARGET_FS);
  const s  = std(bp) || 1;
  const norm = bp.map(v => v / s);
  const w = norm.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (norm.length - 1))));
  return fftMag([...w, ...new Array(norm.length * 3).fill(0)]);
}

// ─── Estimate BPM with adaptive search range ────────────────────────────────────
function estimateBPM(
  R: number[], G: number[], B: number[], prevBpm: number | null
): { bpm: number; snr: number; confidence: number; sigDisplay: number[] } {
  if (R.length < WIN_SIZE) return { bpm: 0, snr: 0, confidence: 0, sigDisplay: [] };

  const pos   = windowedPOS(R, G, B);
  const chrom = windowedCHROM(R, G, B);

  const mPos   = signalToSpectrum(pos);
  const mChrom = signalToSpectrum(chrom);

  const ensemble = new Float64Array(Math.min(mPos.length, mChrom.length));
  for (let i = 0; i < ensemble.length; i++) ensemble[i] = (mPos[i] + mChrom[i]) / 2;

  const fr = TARGET_FS / (ensemble.length * 2);

  // Adaptive search range: if we have a previous estimate, narrow the search
  const searchMinBpm = prevBpm != null ? Math.max(HR_MIN_BPM, prevBpm - ADAPT_RANGE) : HR_MIN_BPM;
  const searchMaxBpm = prevBpm != null ? Math.min(HR_MAX_BPM, prevBpm + ADAPT_RANGE) : HR_MAX_BPM;
  const lo = Math.max(1, Math.floor(searchMinBpm / 60 / fr));
  const hi = Math.min(ensemble.length - 2, Math.ceil(searchMaxBpm / 60 / fr));

  let peak = 0, pb = lo, bsum = 0;
  for (let k = lo; k <= hi; k++) {
    bsum += ensemble[k];
    if (ensemble[k] > peak) { peak = ensemble[k]; pb = k; }
  }
  const bmean = bsum / Math.max(1, hi - lo + 1);
  const snr = bmean > 0 ? peak / bmean : 0;

  let freq = pb * fr;
  if (pb > 0 && pb < ensemble.length - 1) {
    const al = ensemble[pb - 1], bm = ensemble[pb], ar = ensemble[pb + 1];
    const d = al - 2 * bm + ar;
    if (Math.abs(d) > 1e-12) freq = (pb + 0.5 * (al - ar) / d) * fr;
  }
  const bpm = Math.round(clamp(freq * 60, HR_MIN_BPM, HR_MAX_BPM));

  // Harmonic validation
  const h2bin = Math.round(freq * 2 / fr);
  const h2win = Math.floor(0.1 * freq / fr);
  let h2peak = 0;
  for (let k = Math.max(1, h2bin - h2win); k <= Math.min(ensemble.length - 1, h2bin + h2win); k++)
    h2peak = Math.max(h2peak, ensemble[k]);
  const harmonicBoost = h2peak > ensemble[pb] * 0.25 ? 1.3 : 1.0;

  const rawConf = snr >= SNR_MIN
    ? Math.min(96, ((snr - SNR_MIN) / 4) * 96 * harmonicBoost)
    : 0;

  const posF = bandpass4(movingDetrend(pos, DETREND_WIN), 0.75, 2.5, TARGET_FS);
  const ps = std(posF) || 1;

  return {
    bpm,
    snr,
    confidence: Math.round(rawConf),
    sigDisplay: posF.map(v => v / ps).slice(-80),
  };
}

// ─── Skin-filtered ROI sampling ─────────────────────────────────────────────────
// Only averages pixels that pass a YCbCr skin color model.
// Non-skin pixels (hair, shadows, background at ROI edges) add noise.
function sampleROI(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number
): { r: number; g: number; b: number; ok: boolean } {
  const wi = Math.max(1, Math.floor(w)), hi2 = Math.max(1, Math.floor(h));
  let r = 0, g = 0, b = 0, skinCnt = 0, totalCnt = 0;
  try {
    const d = ctx.getImageData(Math.floor(x), Math.floor(y), wi, hi2).data;
    for (let i = 0; i < d.length; i += 4) {
      const pr = d[i], pg = d[i + 1], pb = d[i + 2];
      totalCnt++;
      const Y  = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      const Cb = 128 - 0.169 * pr - 0.331 * pg + 0.500 * pb;
      const Cr = 128 + 0.500 * pr - 0.419 * pg - 0.081 * pb;
      if (Y > 50 && Cb >= 77 && Cb <= 130 && Cr >= 130 && Cr <= 180) {
        r += pr; g += pg; b += pb; skinCnt++;
      }
    }
  } catch { return { r: 0, g: 0, b: 0, ok: false }; }
  // Need at least 15% of pixels to be skin
  if (skinCnt < 10 || skinCnt < totalCnt * 0.15) {
    // Fallback: use all pixels (some faces don't match skin model well)
    let r2 = 0, g2 = 0, b2 = 0, cnt2 = 0;
    try {
      const d = ctx.getImageData(Math.floor(x), Math.floor(y), wi, hi2).data;
      for (let i = 0; i < d.length; i += 4) { r2 += d[i]; g2 += d[i+1]; b2 += d[i+2]; cnt2++; }
    } catch { return { r: 0, g: 0, b: 0, ok: false }; }
    if (!cnt2) return { r: 0, g: 0, b: 0, ok: false };
    r2 /= cnt2; g2 /= cnt2; b2 /= cnt2;
    return { r: r2, g: g2, b: b2, ok: r2 > 20 && g2 > 15 && b2 > 8 && r2 < 248 && g2 < 248 };
  }
  r /= skinCnt; g /= skinCnt; b /= skinCnt;
  return { r, g, b, ok: true };
}

const FALLBACK_ROIS: [number, number, number, number][] = [
  [0.20, 0.08, 0.80, 0.50],
  [0.15, 0.08, 0.85, 0.82],
  [0.25, 0.28, 0.75, 0.68],
];
const ROI_LABELS = ["FOREHEAD", "FULL-FACE", "CHEEKS"];

// ─── Hook ───────────────────────────────────────────────────────────────────────
export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?:     React.MutableRefObject<FaceBox | null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
) {
  const cvRef     = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef<number>(0);
  const rawBuf    = useRef<[number, number, number, number][]>([]);
  const resR      = useRef<number[]>([]);
  const resG      = useRef<number[]>([]);
  const resB      = useRef<number[]>([]);
  const resOk     = useRef<boolean[]>([]);
  const lastResMs = useRef<number>(0);
  const prevR     = useRef<number>(0);
  const prevG2    = useRef<number>(0);
  const prevB     = useRef<number>(0);
  const bpmHist   = useRef<number[]>([]);
  const snrHist   = useRef<number[]>([]);
  const bpmRef    = useRef<number | null>(null);
  const frameRef  = useRef<number>(0);
  const calRef    = useRef<number>(0);
  const fpsRef    = useRef<number>(30);
  const prevMsRef = useRef<number>(0);
  const roiIdxRef = useRef<number>(1);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "POS+CHROM",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { rafRef.current = requestAnimationFrame(processFrame); return; }

    const now = performance.now();
    if (prevMsRef.current > 0) {
      const dt = (now - prevMsRef.current) / 1000;
      if (dt > 0.001) fpsRef.current = fpsRef.current * 0.97 + (1 / dt) * 0.03;
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

    let roi: { r: number; g: number; b: number; ok: boolean };
    let roiLabel = "SCANNING";

    const fhBox   = foreheadBoxRef?.current;
    const faceBox = faceBoxRef?.current;

    if (fhBox && fhBox.w > 10 && fhBox.h > 8) {
      roi = sampleROI(ctx, fhBox.x, fhBox.y, fhBox.w, fhBox.h);
      roiLabel = "LM-FOREHEAD";
    } else if (faceBox && faceBox.w > 30 && faceBox.h > 30) {
      roi = sampleROI(ctx, faceBox.x + faceBox.w * .20, faceBox.y + faceBox.h * .04,
                      faceBox.w * .60, faceBox.h * .28);
      roiLabel = "BOX-FOREHEAD";
    } else {
      if (frameRef.current % 30 === 1) {
        let best = -Infinity, bestI = 1;
        for (let i = 0; i < FALLBACK_ROIS.length; i++) {
          const [fx, fy, fw, fh] = FALLBACK_ROIS[i];
          const s = sampleROI(ctx, fx * vw, fy * vh, (fw - fx) * vw, (fh - fy) * vh);
          if (s.ok) { const sc = -Math.abs(s.g - 120); if (sc > best) { best = sc; bestI = i; } }
        }
        roiIdxRef.current = bestI;
      }
      const [fx, fy, fw, fh] = FALLBACK_ROIS[roiIdxRef.current];
      roi = sampleROI(ctx, fx * vw, fy * vh, (fw - fx) * vw, (fh - fy) * vh);
      roiLabel = ROI_LABELS[roiIdxRef.current];
    }

    if (roi.ok) {
      const dr = Math.abs(roi.r - prevR.current);
      const dg = Math.abs(roi.g - prevG2.current);
      const db = Math.abs(roi.b - prevB.current);
      const isMotion = prevR.current > 0 && (dr + dg + db) / 3 > MOTION_THR;
      prevR.current = roi.r; prevG2.current = roi.g; prevB.current = roi.b;

      rawBuf.current.push([now, roi.r, roi.g, roi.b]);
      while (rawBuf.current.length > 2 && rawBuf.current[0][0] < now - 20000)
        rawBuf.current.shift();

      const interval = 1000 / TARGET_FS;
      if (rawBuf.current.length >= 2 && lastResMs.current === 0)
        lastResMs.current = rawBuf.current[0][0];

      while (rawBuf.current.length >= 2 && lastResMs.current + interval <= now) {
        const t = lastResMs.current + interval;
        let lo2 = 0;
        for (let i = 0; i < rawBuf.current.length - 1; i++) {
          if (rawBuf.current[i][0] <= t && rawBuf.current[i + 1][0] >= t) { lo2 = i; break; }
        }
        const s0 = rawBuf.current[lo2], s1 = rawBuf.current[lo2 + 1];
        const dt2 = s1[0] - s0[0];
        const alpha = dt2 > 0 ? (t - s0[0]) / dt2 : 0;
        resR.current.push(s0[1] * (1 - alpha) + s1[1] * alpha);
        resG.current.push(s0[2] * (1 - alpha) + s1[2] * alpha);
        resB.current.push(s0[3] * (1 - alpha) + s1[3] * alpha);
        resOk.current.push(!isMotion);
        lastResMs.current = t;

        const maxN = WIN_SIZE + TARGET_FS * 5;
        if (resR.current.length > maxN) {
          resR.current.shift(); resG.current.shift();
          resB.current.shift(); resOk.current.shift();
        }
      }
    }

    if (frameRef.current % 8 === 0 &&
        resR.current.length >= WIN_SIZE &&
        calRef.current >= CAL_FRAMES) {

      const cleanCount = resOk.current.filter(Boolean).length;
      let R: number[], G: number[], B: number[];
      if (cleanCount >= WIN_SIZE * 0.75) {
        const clean: [number, number, number][] = [];
        for (let i = 0; i < resR.current.length; i++)
          if (resOk.current[i]) clean.push([resR.current[i], resG.current[i], resB.current[i]]);
        const slice = clean.slice(-WIN_SIZE);
        R = slice.map(v => v[0]); G = slice.map(v => v[1]); B = slice.map(v => v[2]);
      } else {
        const len = resR.current.length;
        R = resR.current.slice(len - WIN_SIZE);
        G = resG.current.slice(len - WIN_SIZE);
        B = resB.current.slice(len - WIN_SIZE);
      }

      const { bpm, snr, confidence, sigDisplay } = estimateBPM(R, G, B, bpmRef.current);

      if (snr >= SNR_MIN && bpm >= HR_MIN_BPM && bpm <= HR_MAX_BPM) {
        const prev = bpmRef.current ?? bpm;
        const jump = Math.abs(bpm - prev);
        if (jump <= JUMP_MAX || bpmRef.current === null || snr >= 6) {
          bpmHist.current.push(bpm);
          snrHist.current.push(snr);
          if (bpmHist.current.length > SMOOTH_N) {
            bpmHist.current.shift(); snrHist.current.shift();
          }
          const finalBpm = Math.round(
            clamp(weightedMedian(bpmHist.current, snrHist.current), HR_MIN_BPM, HR_MAX_BPM)
          );
          bpmRef.current = finalBpm;
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";
      const algoLabel = fhBox ? "POS+CHROM-LM" : faceBox ? "POS+CHROM-Box" : "POS+CHROM";

      setData(prev => ({
        bpm:          finalBpm,
        confidence,
        signal:       sigDisplay,
        isActive:     true,
        stress,
        trend:        (finalBpm != null && prev.bpm != null)
                        ? (finalBpm > prev.bpm + 2 ? "rising" : finalBpm < prev.bpm - 2 ? "falling" : "stable")
                        : "stable",
        algorithm:    algoLabel,
        faceDetected: roi.ok,
        frameRate:    Math.round(fpsRef.current),
        calibrating:  finalBpm === null,
        roiDebug:     roiLabel,
      }));

    } else if (frameRef.current % 30 === 0) {
      const remaining = Math.max(0, CAL_FRAMES - calRef.current);
      setData(prev => ({
        ...prev,
        isActive:     true,
        faceDetected: roi.ok,
        frameRate:    Math.round(fpsRef.current),
        calibrating:  bpmRef.current === null,
        roiDebug:     roiLabel + (remaining > 0 ? ` (cal ${Math.ceil(remaining / TARGET_FS)}s)` : ""),
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef]);

  const start = useCallback(() => {
    rawBuf.current = []; resR.current = []; resG.current = [];
    resB.current = []; resOk.current = []; lastResMs.current = 0;
    prevR.current = 0; prevG2.current = 0; prevB.current = 0;
    bpmHist.current = []; snrHist.current = [];
    bpmRef.current = null; frameRef.current = 0; calRef.current = 0;
    fpsRef.current = 30; prevMsRef.current = 0; roiIdxRef.current = 1;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18); calRef.current = 999;
    bpmHist.current = [bpmRef.current!]; snrHist.current = [5];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9); calRef.current = 999;
    bpmHist.current = [bpmRef.current!]; snrHist.current = [5];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
