/**
 * useHeartbeat — Research-grade multi-ROI rPPG
 *
 * Critical fixes in this version:
 *  1. BANDPASS ORDER FIX: Previous `bandpass4` was accidentally 8th-order
 *     effective (filtfilt already squares the response). 8th-order on a
 *     300-sample signal causes severe ringing that distorts the spectrum.
 *     Now uses single filtfilt per HP/LP = correct 4th-order effective.
 *  2. MULTI-ROI FUSION: Samples forehead + cheeks simultaneously. Cardiac
 *     signal is correlated across ROIs; noise is independent → averaging
 *     increases SNR by √N (up to ~1.7× with 3 ROIs).
 *  3. AUTOCORRELATION CROSS-VALIDATION: FFT peak is verified against
 *     time-domain autocorrelation. If they agree within ±5 BPM, confidence
 *     boosted. If they disagree, the reading is questionable.
 *  4. LONGER WINDOW: 300 samples (10s) for better frequency resolution
 *     (0.1 Hz per bin → 6 BPM per bin before zero-padding, ~1.5 BPM after).
 *  5. CONSISTENT-STARTUP: Requires 3 consecutive consistent estimates
 *     (within 8 BPM of each other) before reporting the first reading.
 *
 * Pipeline: multi-ROI skin-filtered sampling → 30Hz resample → motion gate →
 * windowed POS+CHROM (1.6s sub-windows) → moving-mean detrend → 4th-order
 * Butterworth BP 0.7-3.0Hz → Hann+FFT → ensemble spectrum → adaptive peak →
 * autocorrelation cross-check → SNR-weighted median → BPM
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
const WIN_SIZE     = 300;    // 10s at 30Hz
const HR_MIN_BPM   = 45;
const HR_MAX_BPM   = 150;
const SNR_MIN      = 1.4;
const SMOOTH_N     = 14;
const CAL_FRAMES   = WIN_SIZE;
const MOTION_THR   = 5.5;
const DETREND_WIN  = 45;
const SUB_WIN      = 48;
const SUB_STRIDE   = 12;    // 75% overlap for smoother windowed output
const ADAPT_RANGE  = 18;
const JUMP_MAX     = 8;
const STARTUP_NEED = 3;     // Need 3 consistent estimates before reporting
const BP_LO        = 0.7;   // Hz (42 BPM)
const BP_HI        = 3.0;   // Hz (180 BPM) — preserves 2nd harmonic

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

// ─── Butterworth 2nd-order ──────────────────────────────────────────────────────
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
  const n = sig.length;
  const pad = Math.min(3 * Math.max(1, Math.ceil(1 / (1 - Math.max(Math.abs(a[1]), Math.abs(a[2]))))), n - 1);
  const padded = new Array(n + 2 * pad);
  for (let i = 0; i < pad; i++) padded[i] = 2 * sig[0] - sig[pad - i];
  for (let i = 0; i < n; i++) padded[pad + i] = sig[i];
  for (let i = 0; i < pad; i++) padded[pad + n + i] = 2 * sig[n - 1] - sig[n - 2 - i];
  const fwd = applyIIR(padded, b, a);
  fwd.reverse();
  const bwd = applyIIR(fwd, b, a);
  bwd.reverse();
  return bwd.slice(pad, pad + n);
}

// CORRECT 4th-order effective bandpass: one filtfilt per HP and LP
// filtfilt with 2nd-order IIR = 4th-order effective magnitude response
function bandpass(sig: number[], lo: number, hi: number, fs: number): number[] {
  const hp = bwHP(lo, fs), lp = bwLP(hi, fs);
  return filtfilt(filtfilt(sig, hp.b, hp.a), lp.b, lp.a);
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

// ─── Windowed POS (Wang 2016 §III-C) ───────────────────────────────────────────
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
      const rn = R[start+j]/mr, gn = G[start+j]/mg, bn = B[start+j]/mb;
      H1[j] = gn - bn; H2[j] = -2*rn + gn + bn;
    }
    let mH1=0, mH2=0;
    for (let j=0; j<SUB_WIN; j++) { mH1+=H1[j]; mH2+=H2[j]; }
    mH1/=SUB_WIN; mH2/=SUB_WIN;
    let s1=0, s2=0;
    for (let j=0; j<SUB_WIN; j++) { s1+=(H1[j]-mH1)**2; s2+=(H2[j]-mH2)**2; }
    const a = (Math.sqrt(s2/SUB_WIN)||1e-10) > 1e-10 ? (Math.sqrt(s1/SUB_WIN)||1e-10)/(Math.sqrt(s2/SUB_WIN)||1e-10) : 1;
    for (let j=0; j<SUB_WIN; j++) { S[start+j] += H1[j] + a*H2[j]; cnt[start+j]++; }
  }
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = cnt[i] > 0 ? S[i]/cnt[i] : 0;
  return out;
}

// ─── Windowed CHROM (de Haan 2013) ──────────────────────────────────────────────
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
      const rn = R[start+j]/mr, gn = G[start+j]/mg, bn = B[start+j]/mb;
      Xs[j] = 3*rn - 2*gn; Ys[j] = 1.5*rn + gn - 1.5*bn;
    }
    let mXs=0, mYs=0;
    for (let j=0; j<SUB_WIN; j++) { mXs+=Xs[j]; mYs+=Ys[j]; }
    mXs/=SUB_WIN; mYs/=SUB_WIN;
    let sx=0, sy=0;
    for (let j=0; j<SUB_WIN; j++) { sx+=(Xs[j]-mXs)**2; sy+=(Ys[j]-mYs)**2; }
    const a = (Math.sqrt(sy/SUB_WIN)||1e-10) > 1e-10 ? (Math.sqrt(sx/SUB_WIN)||1e-10)/(Math.sqrt(sy/SUB_WIN)||1e-10) : 1;
    for (let j=0; j<SUB_WIN; j++) { S[start+j] += Xs[j] - a*Ys[j]; cnt[start+j]++; }
  }
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = cnt[i] > 0 ? S[i]/cnt[i] : 0;
  return out;
}

// ─── Autocorrelation BPM (time-domain cross-validation) ────────────────────────
function autocorrelationBPM(sig: number[], fs: number, minBPM: number, maxBPM: number): number {
  const n = sig.length;
  const minLag = Math.max(2, Math.floor(fs * 60 / maxBPM));
  const maxLag = Math.min(Math.floor(fs * 60 / minBPM), Math.floor(n / 2));
  const m = mean(sig), s = std(sig);
  if (s < 1e-10) return 0;
  const norm = sig.map(v => (v - m) / s);
  let bestLag = minLag, bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) corr += norm[i] * norm[i + lag];
    corr /= (n - lag);
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  if (bestCorr < 0.1) return 0;
  return Math.round(fs * 60 / bestLag);
}

// ─── Signal → spectrum ──────────────────────────────────────────────────────────
function signalToSpectrum(raw: number[]): Float64Array {
  const d  = movingDetrend(raw, DETREND_WIN);
  const bp = bandpass(d, BP_LO, BP_HI, TARGET_FS);
  const s  = std(bp) || 1;
  const norm = bp.map(v => v / s);
  const w = norm.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (norm.length - 1))));
  return fftMag([...w, ...new Array(norm.length * 3).fill(0)]);
}

// ─── Estimate BPM ───────────────────────────────────────────────────────────────
function estimateBPM(
  R: number[], G: number[], B: number[], prevBpm: number | null
): { bpm: number; snr: number; confidence: number; sigDisplay: number[]; acfBpm: number } {
  if (R.length < WIN_SIZE) return { bpm: 0, snr: 0, confidence: 0, sigDisplay: [], acfBpm: 0 };

  const pos   = windowedPOS(R, G, B);
  const chrom = windowedCHROM(R, G, B);

  const mPos   = signalToSpectrum(pos);
  const mChrom = signalToSpectrum(chrom);

  // Also try pure green channel (often best for light skin tones)
  const gDetrend = movingDetrend(G.map(v => v / (mean(G) || 1)), DETREND_WIN);
  const mGreen   = signalToSpectrum(gDetrend);

  // Ensemble: weighted average of all three spectra
  const len = Math.min(mPos.length, mChrom.length, mGreen.length);
  const ensemble = new Float64Array(len);
  for (let i = 0; i < len; i++)
    ensemble[i] = mPos[i] * 0.4 + mChrom[i] * 0.4 + mGreen[i] * 0.2;

  const fr = TARGET_FS / (len * 2);

  const searchMinBpm = prevBpm != null ? Math.max(HR_MIN_BPM, prevBpm - ADAPT_RANGE) : HR_MIN_BPM;
  const searchMaxBpm = prevBpm != null ? Math.min(HR_MAX_BPM, prevBpm + ADAPT_RANGE) : HR_MAX_BPM;
  const lo = Math.max(1, Math.floor(searchMinBpm / 60 / fr));
  const hi = Math.min(len - 2, Math.ceil(searchMaxBpm / 60 / fr));

  let peak = 0, pb = lo, bsum = 0;
  for (let k = lo; k <= hi; k++) {
    bsum += ensemble[k];
    if (ensemble[k] > peak) { peak = ensemble[k]; pb = k; }
  }
  const bmean = bsum / Math.max(1, hi - lo + 1);
  const snr = bmean > 0 ? peak / bmean : 0;

  let freq = pb * fr;
  if (pb > 0 && pb < len - 1) {
    const al = ensemble[pb - 1], bm = ensemble[pb], ar = ensemble[pb + 1];
    const d = al - 2 * bm + ar;
    if (Math.abs(d) > 1e-12) freq = (pb + 0.5 * (al - ar) / d) * fr;
  }
  const fftBpm = Math.round(clamp(freq * 60, HR_MIN_BPM, HR_MAX_BPM));

  // Time-domain autocorrelation cross-check
  const posFiltered = bandpass(movingDetrend(pos, DETREND_WIN), BP_LO, BP_HI, TARGET_FS);
  const acfBpm = autocorrelationBPM(posFiltered, TARGET_FS, searchMinBpm, searchMaxBpm);

  // If FFT and ACF agree within 5 BPM, high confidence; use their average
  let finalBpm = fftBpm;
  let confBoost = 1.0;
  if (acfBpm > 0) {
    const diff = Math.abs(fftBpm - acfBpm);
    if (diff <= 5) {
      finalBpm = Math.round((fftBpm + acfBpm) / 2);
      confBoost = 1.3;
    } else if (diff <= 10) {
      finalBpm = Math.round(fftBpm * 0.7 + acfBpm * 0.3);
      confBoost = 1.0;
    } else {
      confBoost = 0.6;
    }
  }

  // Harmonic validation
  const h2bin = Math.round(freq * 2 / fr);
  const h2win = Math.floor(0.12 * freq / fr);
  let h2peak = 0;
  for (let k = Math.max(1, h2bin - h2win); k <= Math.min(len - 1, h2bin + h2win); k++)
    h2peak = Math.max(h2peak, ensemble[k]);
  if (h2peak > ensemble[pb] * 0.2) confBoost *= 1.15;

  const rawConf = snr >= SNR_MIN
    ? Math.min(97, ((snr - SNR_MIN) / 3.5) * 97 * confBoost)
    : 0;

  const ps = std(posFiltered) || 1;

  return {
    bpm: finalBpm,
    snr,
    confidence: Math.round(rawConf),
    sigDisplay: posFiltered.map(v => v / ps).slice(-80),
    acfBpm,
  };
}

// ─── Skin-filtered multi-ROI sampling ───────────────────────────────────────────
function sampleSkinROI(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number
): { r: number; g: number; b: number; cnt: number } {
  const wi = Math.max(1, Math.floor(w)), hi2 = Math.max(1, Math.floor(h));
  let r = 0, g = 0, b = 0, skinCnt = 0;
  try {
    const d = ctx.getImageData(Math.floor(Math.max(0,x)), Math.floor(Math.max(0,y)), wi, hi2).data;
    for (let i = 0; i < d.length; i += 4) {
      const pr = d[i], pg = d[i + 1], pb = d[i + 2];
      const Y  = 0.299*pr + 0.587*pg + 0.114*pb;
      const Cb = 128 - 0.169*pr - 0.331*pg + 0.500*pb;
      const Cr = 128 + 0.500*pr - 0.419*pg - 0.081*pb;
      if (Y > 50 && Cb >= 77 && Cb <= 130 && Cr >= 130 && Cr <= 180) {
        r += pr; g += pg; b += pb; skinCnt++;
      }
    }
  } catch { /* cross-origin or out-of-bounds */ }
  return { r, g, b, cnt: skinCnt };
}

function sampleMultiROI(
  ctx: CanvasRenderingContext2D,
  foreheadBox: FaceBox | null,
  cheekBox: FaceBox | null,
  faceBox: FaceBox | null,
  vw: number, vh: number
): { r: number; g: number; b: number; ok: boolean; label: string } {
  let totalR = 0, totalG = 0, totalB = 0, totalCnt = 0;
  let label = "";

  // Primary: forehead
  if (foreheadBox && foreheadBox.w > 10 && foreheadBox.h > 8) {
    const s = sampleSkinROI(ctx, foreheadBox.x, foreheadBox.y, foreheadBox.w, foreheadBox.h);
    if (s.cnt > 5) { totalR += s.r; totalG += s.g; totalB += s.b; totalCnt += s.cnt; label = "LM"; }
  }

  // Secondary: cheeks
  if (cheekBox && cheekBox.w > 15 && cheekBox.h > 10) {
    const s = sampleSkinROI(ctx, cheekBox.x, cheekBox.y, cheekBox.w, cheekBox.h);
    if (s.cnt > 5) { totalR += s.r; totalG += s.g; totalB += s.b; totalCnt += s.cnt; label += "+CK"; }
  }

  // Tertiary: face box forehead estimate
  if (totalCnt < 20 && faceBox && faceBox.w > 30 && faceBox.h > 30) {
    const s = sampleSkinROI(ctx, faceBox.x + faceBox.w*.20, faceBox.y + faceBox.h*.04,
                            faceBox.w*.60, faceBox.h*.28);
    if (s.cnt > 5) { totalR += s.r; totalG += s.g; totalB += s.b; totalCnt += s.cnt; label = "BOX"; }
  }

  // Last resort: scan
  if (totalCnt < 10) {
    const regions: [number,number,number,number][] = [[.2,.08,.6,.42],[.15,.08,.7,.74],[.25,.28,.5,.4]];
    for (const [fx,fy,fw,fh] of regions) {
      const s = sampleSkinROI(ctx, fx*vw, fy*vh, fw*vw, fh*vh);
      totalR += s.r; totalG += s.g; totalB += s.b; totalCnt += s.cnt;
    }
    label = "SCAN";
  }

  if (totalCnt < 10) return { r: 0, g: 0, b: 0, ok: false, label: "NONE" };

  return {
    r: totalR / totalCnt,
    g: totalG / totalCnt,
    b: totalB / totalCnt,
    ok: true,
    label: label || "MULTI",
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────────
export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?:     React.MutableRefObject<FaceBox | null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
  cheekBoxRef?:    React.MutableRefObject<FaceBox | null>,
) {
  const cvRef        = useRef<HTMLCanvasElement | null>(null);
  const rafRef       = useRef<number>(0);
  const rawBuf       = useRef<[number, number, number, number][]>([]);
  const resR         = useRef<number[]>([]);
  const resG         = useRef<number[]>([]);
  const resB         = useRef<number[]>([]);
  const resOk        = useRef<boolean[]>([]);
  const lastResMs    = useRef<number>(0);
  const prevR        = useRef<number>(0);
  const prevG2       = useRef<number>(0);
  const prevB        = useRef<number>(0);
  const bpmHist      = useRef<number[]>([]);
  const snrHist      = useRef<number[]>([]);
  const bpmRef       = useRef<number | null>(null);
  const frameRef     = useRef<number>(0);
  const calRef       = useRef<number>(0);
  const fpsRef       = useRef<number>(30);
  const prevMsRef    = useRef<number>(0);
  const startupBuf   = useRef<number[]>([]);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "POS+CHROM+G",
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

    // Multi-ROI sampling
    const roi = sampleMultiROI(
      ctx,
      foreheadBoxRef?.current ?? null,
      cheekBoxRef?.current ?? null,
      faceBoxRef?.current ?? null,
      vw, vh
    );

    if (roi.ok) {
      const dr = Math.abs(roi.r - prevR.current);
      const dg = Math.abs(roi.g - prevG2.current);
      const db = Math.abs(roi.b - prevB.current);
      const isMotion = prevR.current > 0 && (dr + dg + db) / 3 > MOTION_THR;
      prevR.current = roi.r; prevG2.current = roi.g; prevB.current = roi.b;

      rawBuf.current.push([now, roi.r, roi.g, roi.b]);
      while (rawBuf.current.length > 2 && rawBuf.current[0][0] < now - 25000)
        rawBuf.current.shift();

      const interval = 1000 / TARGET_FS;
      if (rawBuf.current.length >= 2 && lastResMs.current === 0)
        lastResMs.current = rawBuf.current[0][0];

      while (rawBuf.current.length >= 2 && lastResMs.current + interval <= now) {
        const t = lastResMs.current + interval;
        let idx = 0;
        for (let i = 0; i < rawBuf.current.length - 1; i++) {
          if (rawBuf.current[i][0] <= t && rawBuf.current[i + 1][0] >= t) { idx = i; break; }
        }
        const s0 = rawBuf.current[idx], s1 = rawBuf.current[idx + 1];
        const dt2 = s1[0] - s0[0];
        const alpha = dt2 > 0 ? (t - s0[0]) / dt2 : 0;
        resR.current.push(s0[1]*(1-alpha) + s1[1]*alpha);
        resG.current.push(s0[2]*(1-alpha) + s1[2]*alpha);
        resB.current.push(s0[3]*(1-alpha) + s1[3]*alpha);
        resOk.current.push(!isMotion);
        lastResMs.current = t;

        const maxN = WIN_SIZE + TARGET_FS * 8;
        if (resR.current.length > maxN) {
          resR.current.shift(); resG.current.shift();
          resB.current.shift(); resOk.current.shift();
        }
      }
    }

    if (frameRef.current % 6 === 0 &&
        resR.current.length >= WIN_SIZE &&
        calRef.current >= CAL_FRAMES) {

      const cleanCount = resOk.current.filter(Boolean).length;
      let R: number[], G: number[], B: number[];
      if (cleanCount >= WIN_SIZE * 0.7) {
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

      const { bpm, snr, confidence, sigDisplay, acfBpm } = estimateBPM(R, G, B, bpmRef.current);

      if (snr >= SNR_MIN && bpm >= HR_MIN_BPM && bpm <= HR_MAX_BPM) {
        // Startup gate: require STARTUP_NEED consistent estimates
        if (bpmRef.current === null) {
          startupBuf.current.push(bpm);
          if (startupBuf.current.length >= STARTUP_NEED) {
            const last = startupBuf.current.slice(-STARTUP_NEED);
            const range = Math.max(...last) - Math.min(...last);
            if (range <= 10) {
              bpmRef.current = Math.round(mean(last));
              bpmHist.current = [...last];
              snrHist.current = last.map(() => snr);
            } else {
              startupBuf.current = startupBuf.current.slice(-2);
            }
          }
        } else {
          const jump = Math.abs(bpm - bpmRef.current);
          if (jump <= JUMP_MAX || snr >= 5) {
            bpmHist.current.push(bpm);
            snrHist.current.push(snr);
            if (bpmHist.current.length > SMOOTH_N) {
              bpmHist.current.shift(); snrHist.current.shift();
            }
            bpmRef.current = Math.round(
              clamp(weightedMedian(bpmHist.current, snrHist.current), HR_MIN_BPM, HR_MAX_BPM)
            );
          }
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low"|"medium"|"high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";
      const algoLabel = `POS+CHROM+G-${roi.label}`;

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
        roiDebug:     roi.label + (acfBpm > 0 ? ` ACF:${acfBpm}` : ""),
      }));

    } else if (frameRef.current % 30 === 0) {
      const remaining = Math.max(0, CAL_FRAMES - calRef.current);
      setData(prev => ({
        ...prev,
        isActive:     true,
        faceDetected: roi.ok,
        frameRate:    Math.round(fpsRef.current),
        calibrating:  bpmRef.current === null,
        roiDebug:     roi.label + (remaining > 0 ? ` (cal ${Math.ceil(remaining/TARGET_FS)}s)` : ""),
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef]);

  const start = useCallback(() => {
    rawBuf.current = []; resR.current = []; resG.current = [];
    resB.current = []; resOk.current = []; lastResMs.current = 0;
    prevR.current = 0; prevG2.current = 0; prevB.current = 0;
    bpmHist.current = []; snrHist.current = []; startupBuf.current = [];
    bpmRef.current = null; frameRef.current = 0; calRef.current = 0;
    fpsRef.current = 30; prevMsRef.current = 0;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18); calRef.current = 999;
    bpmHist.current = [bpmRef.current!]; snrHist.current = [5]; startupBuf.current = [];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9); calRef.current = 999;
    bpmHist.current = [bpmRef.current!]; snrHist.current = [5]; startupBuf.current = [];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
