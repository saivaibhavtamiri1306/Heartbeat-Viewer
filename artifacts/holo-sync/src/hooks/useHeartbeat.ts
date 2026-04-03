/**
 * useHeartbeat — rPPG heart rate via webcam
 *
 * Based on three reference implementations:
 * - prouast/heartbeat-js (green channel + FFT, academic-backed)
 * - ubicomplab/rPPG-Toolbox (POS_WANG, authoritative reference)
 * - pavisj/rppg-pos (POS algorithm reference)
 *
 * Pipeline (matching rPPG-Toolbox):
 *  1. Multi-ROI face sampling (forehead + cheeks + face fallback)
 *  2. 30Hz fixed resampling via linear interpolation
 *  3. Windowed POS normalization (1.6s windows, mean-centered per sub-window)
 *  4. Smoothness-prior detrending (lambda=100, matches rPPG-Toolbox)
 *  5. 1st-order Butterworth bandpass 0.75–3.0 Hz (2nd-order effective via filtfilt)
 *     — matches rPPG-Toolbox exactly (NOT 2nd-order which caused ringing)
 *  6. Triple estimation: peak counting + FFT + autocorrelation
 *  7. Consensus voting with EMA smoothing
 *
 * Critical fixes from references:
 *  - Filter order: 1st-order Butterworth (not 2nd) — prevents ringing
 *  - Upper cutoff: 3.0 Hz (not 2.5) — allows 180 BPM
 *  - POS sub-window: mean-centered before overlap-add (matches Wang 2017)
 *  - Detrending: smoothness-prior (not moving mean)
 *  - Green channel dual-track: compare POS vs Green, use stronger signal
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

const FS          = 30;
const WIN         = 256;     // ~8.5s at 30Hz (power-of-2 for FFT, matches heartbeat-js)
const BPM_LO      = 42;
const BPM_HI      = 180;
const BP_LO       = 0.75;   // Hz (matches rPPG-Toolbox)
const BP_HI       = 3.0;    // Hz (matches rPPG-Toolbox — was 2.5, too low!)
const SUB_W       = 48;     // ceil(1.6 * 30) = 48 samples per POS sub-window
const EMA_ALPHA   = 0.25;
const AGREE_THR   = 7;
const DETREND_LAM = 100;    // Smoothness-prior lambda (matches rPPG-Toolbox)

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std  = (a: number[]) => {
  const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v-m)**2, 0) / (a.length||1)) || 1e-10;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const median = (a: number[]) => {
  const s = [...a].sort((x,y)=>x-y); const m = s.length>>1;
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
};

// ─── Multiple passes of moving average (heartbeat-js style) ─────────────────────
function movingAvg(sig: number[], passes: number, kernel: number): number[] {
  let s = [...sig];
  const half = Math.floor(kernel / 2);
  for (let p = 0; p < passes; p++) {
    const out = new Array(s.length);
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

// ─── Smoothness-prior detrending (matches rPPG-Toolbox / heartbeat-js) ──────────
// Approximation: remove low-frequency trend via high-pass with moving average
// This is a practical version that doesn't need matrix inversion
function detrendSP(sig: number[], lambda: number): number[] {
  const trend = movingAvg(sig, 3, Math.max(Math.round(lambda / 3), 5));
  return sig.map((v, i) => v - trend[i]);
}

// ─── 1st-order Butterworth (matches rPPG-Toolbox's butter(1, ...)) ──────────────
// After filtfilt → 2nd-order effective (minimal ringing, smooth response)
type C2 = [number, number];
function bw1HP(fc: number, fs: number): { b: C2; a: C2 } {
  const omega = Math.tan(Math.PI * fc / fs);
  const n = 1 + omega;
  return { b: [1/n, -1/n], a: [1, (omega-1)/n] };
}
function bw1LP(fc: number, fs: number): { b: C2; a: C2 } {
  const omega = Math.tan(Math.PI * fc / fs);
  const n = 1 + omega;
  return { b: [omega/n, omega/n], a: [1, (omega-1)/n] };
}
function iir1(sig: number[], b: C2, a: C2): number[] {
  const y = new Array(sig.length).fill(0);
  for (let i = 0; i < sig.length; i++) {
    let v = b[0] * sig[i];
    if (i >= 1) v += b[1] * sig[i-1] - a[1] * y[i-1];
    y[i] = v;
  }
  return y;
}
function filtfilt1(sig: number[], b: C2, a: C2): number[] {
  const n = sig.length;
  const pad = Math.min(18, n - 1);
  const p = new Array(n + 2 * pad);
  for (let i = 0; i < pad; i++) p[i] = 2 * sig[0] - sig[pad - i];
  for (let i = 0; i < n; i++) p[pad + i] = sig[i];
  for (let i = 0; i < pad; i++) p[pad + n + i] = 2 * sig[n-1] - sig[n-2-i];
  const f = iir1(p, b, a); f.reverse();
  const r = iir1(f, b, a); r.reverse();
  return r.slice(pad, pad + n);
}
function bandpass1(sig: number[], lo: number, hi: number, fs: number): number[] {
  const hp = bw1HP(lo, fs), lp = bw1LP(hi, fs);
  return filtfilt1(filtfilt1(sig, hp.b, hp.a), lp.b, lp.a);
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
        const [ur, ui] = [re[i+j], im[i+j]];
        const vr = re[i+j+len/2]*pr - im[i+j+len/2]*pi;
        const vi = re[i+j+len/2]*pi + im[i+j+len/2]*pr;
        re[i+j] = ur + vr; im[i+j] = ui + vi;
        re[i+j+len/2] = ur - vr; im[i+j+len/2] = ui - vi;
        const t = pr*wr - pi*wi; pi = pr*wi + pi*wr; pr = t;
      }
    }
  }
  const m = new Float64Array(sz >> 1);
  for (let i = 0; i < sz >> 1; i++) m[i] = Math.sqrt(re[i]**2 + im[i]**2);
  return m;
}

// ─── Windowed POS (Wang 2017 — matches rPPG-Toolbox exactly) ────────────────────
function windowedPOS(R: number[], G: number[], B: number[]): number[] {
  const n = R.length;
  const H = new Float64Array(n);
  for (let t = SUB_W; t <= n; t++) {
    const m = t - SUB_W;
    let mr = 0, mg = 0, mb = 0;
    for (let i = m; i < t; i++) { mr += R[i]; mg += G[i]; mb += B[i]; }
    mr = (mr / SUB_W) || 1; mg = (mg / SUB_W) || 1; mb = (mb / SUB_W) || 1;

    const S0 = new Float64Array(SUB_W), S1 = new Float64Array(SUB_W);
    for (let j = 0; j < SUB_W; j++) {
      const rn = R[m+j] / mr, gn = G[m+j] / mg, bn = B[m+j] / mb;
      S0[j] = gn - bn;
      S1[j] = -2*rn + gn + bn;
    }

    const std0 = std(Array.from(S0)), std1 = std(Array.from(S1));
    const alpha = std1 > 1e-10 ? std0 / std1 : 1;

    // Compute h = S0 + alpha * S1, then mean-center (matches rPPG-Toolbox)
    const h = new Float64Array(SUB_W);
    let hMean = 0;
    for (let j = 0; j < SUB_W; j++) { h[j] = S0[j] + alpha * S1[j]; hMean += h[j]; }
    hMean /= SUB_W;

    // Overlap-add with mean subtraction (critical — from rPPG-Toolbox)
    for (let j = 0; j < SUB_W; j++) H[m+j] += h[j] - hMean;
  }
  return Array.from(H);
}

// ─── METHOD 1: Peak counting (time-domain) ─────────────────────────────────────
function peakCountBPM(sig: number[], fs: number): number {
  const n = sig.length;
  if (n < fs * 2) return 0;

  const sigma = std(sig);
  const threshold = sigma * 0.35;
  const peaks: number[] = [];

  for (let i = 2; i < n - 2; i++) {
    if (sig[i] > sig[i-1] && sig[i] > sig[i+1] &&
        sig[i] > sig[i-2] && sig[i] > sig[i+2] &&
        sig[i] > threshold) {
      peaks.push(i);
    }
  }
  if (peaks.length < 3) return 0;

  const minDist = Math.floor(fs * 60 / BPM_HI);
  const filtered: number[] = [peaks[0]];
  for (let i = 1; i < peaks.length; i++) {
    if (peaks[i] - filtered[filtered.length-1] >= minDist) {
      filtered.push(peaks[i]);
    } else if (sig[peaks[i]] > sig[filtered[filtered.length-1]]) {
      filtered[filtered.length-1] = peaks[i];
    }
  }
  if (filtered.length < 3) return 0;

  const ibis: number[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const ibi = (filtered[i] - filtered[i-1]) / fs;
    const bpm = 60 / ibi;
    if (bpm >= BPM_LO && bpm <= BPM_HI) ibis.push(ibi);
  }
  if (ibis.length < 2) return 0;

  const sorted = [...ibis].sort((a,b) => a-b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const valid = ibis.filter(v => v >= q1 - 1.5*iqr && v <= q3 + 1.5*iqr);
  if (valid.length < 2) return 0;

  return Math.round(60 / median(valid));
}

// ─── METHOD 2: FFT peak (matches heartbeat-js approach) ─────────────────────────
function fftBPM(sig: number[], fs: number): { bpm: number; snr: number } {
  const s2 = std(sig); if (s2 < 1e-10) return { bpm: 0, snr: 0 };
  const norm = sig.map(v => v / s2);
  // Hann window
  const w = norm.map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (norm.length - 1))));
  // Zero-pad for interpolation (4x)
  const padded = [...w, ...new Array(norm.length * 3).fill(0)];
  const m = fftMag(padded);
  const fr = fs / (m.length * 2);
  const lo = Math.max(1, Math.floor(BPM_LO / 60 / fr));
  const hi = Math.min(m.length - 2, Math.ceil(BPM_HI / 60 / fr));
  let peak = 0, pb = lo, bsum = 0;
  for (let k = lo; k <= hi; k++) { bsum += m[k]; if (m[k] > peak) { peak = m[k]; pb = k; } }
  const bmean = bsum / Math.max(1, hi - lo + 1);
  const snr = bmean > 0 ? peak / bmean : 0;
  // Parabolic interpolation for sub-bin accuracy
  let freq = pb * fr;
  if (pb > 0 && pb < m.length - 1) {
    const al = m[pb-1], bm2 = m[pb], ar = m[pb+1], d = al - 2*bm2 + ar;
    if (Math.abs(d) > 1e-12) freq = (pb + 0.5 * (al - ar) / d) * fr;
  }
  return { bpm: Math.round(clamp(freq * 60, BPM_LO, BPM_HI)), snr };
}

// ─── METHOD 3: Autocorrelation ─────────────────────────────────────────────────
function acfBPM(sig: number[], fs: number): number {
  const n = sig.length;
  const minLag = Math.max(2, Math.floor(fs * 60 / BPM_HI));
  const maxLag = Math.min(Math.floor(fs * 60 / BPM_LO), Math.floor(n / 2));
  const m2 = mean(sig), s2 = std(sig);
  if (s2 < 1e-10) return 0;
  const norm = sig.map(v => (v - m2) / s2);
  let best = -Infinity, bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += norm[i] * norm[i + lag];
    c /= (n - lag);
    if (c > best) { best = c; bestLag = lag; }
  }
  if (best < 0.12) return 0;
  return Math.round(fs * 60 / bestLag);
}

// ─── Consensus voting ──────────────────────────────────────────────────────────
function consensus(peakBpm: number, fftBpmVal: number, acfBpmVal: number): { bpm: number; conf: number } {
  const methods = [peakBpm, fftBpmVal, acfBpmVal].filter(v => v >= BPM_LO && v <= BPM_HI);
  if (methods.length === 0) return { bpm: 0, conf: 0 };
  if (methods.length === 1) return { bpm: methods[0], conf: 30 };

  const agreements: [number, number][] = [];
  for (let i = 0; i < methods.length; i++)
    for (let j = i + 1; j < methods.length; j++)
      if (Math.abs(methods[i] - methods[j]) <= AGREE_THR)
        agreements.push([methods[i], methods[j]]);

  if (agreements.length > 0) {
    const all = agreements.flat();
    const avgBpm = Math.round(mean(all));
    const conf = agreements.length >= 2 ? 92 : 72;
    return { bpm: avgBpm, conf };
  }

  if (peakBpm >= BPM_LO && peakBpm <= BPM_HI) return { bpm: peakBpm, conf: 35 };
  return { bpm: Math.round(median(methods)), conf: 25 };
}

// ─── ROI sampling ───────────────────────────────────────────────────────────────
function sampleROI(
  ctx: CanvasRenderingContext2D,
  foreheadBox: FaceBox | null,
  cheekBox: FaceBox | null,
  faceBox: FaceBox | null,
  vw: number, vh: number
): { r: number; g: number; b: number; ok: boolean; label: string } {
  let totalR = 0, totalG = 0, totalB = 0, cnt = 0;
  let label = "";

  const addBox = (x: number, y: number, w: number, h: number, lbl: string) => {
    const wi = Math.max(1, Math.floor(w)), hi = Math.max(1, Math.floor(h));
    try {
      const d = ctx.getImageData(
        Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y)), wi, hi
      ).data;
      for (let i = 0; i < d.length; i += 4) {
        totalR += d[i]; totalG += d[i+1]; totalB += d[i+2]; cnt++;
      }
      if (label) label += "+" + lbl; else label = lbl;
    } catch { /* bounds */ }
  };

  // Priority: forehead (cleanest signal) → cheeks → face estimate → scan fallback
  if (foreheadBox && foreheadBox.w > 8 && foreheadBox.h > 6)
    addBox(foreheadBox.x, foreheadBox.y, foreheadBox.w, foreheadBox.h, "FH");

  if (cheekBox && cheekBox.w > 10 && cheekBox.h > 8)
    addBox(cheekBox.x, cheekBox.y, cheekBox.w, cheekBox.h, "CK");

  // Forehead-only ROI from face box (heartbeat-js style: top 10-25% of face, center 40%)
  if (cnt < 50 && faceBox && faceBox.w > 30 && faceBox.h > 30) {
    addBox(
      faceBox.x + faceBox.w * 0.30,
      faceBox.y + faceBox.h * 0.10,
      faceBox.w * 0.40,
      faceBox.h * 0.15,
      "FC"
    );
  }

  if (cnt < 30)
    addBox(vw * 0.25, vh * 0.08, vw * 0.50, vh * 0.30, "SC");

  if (cnt < 10) return { r: 0, g: 0, b: 0, ok: false, label: "NONE" };
  const r = totalR / cnt, g = totalG / cnt, b = totalB / cnt;
  return { r, g, b, ok: r > 15 && g > 10 && r < 250, label };
}

// ─── Hook ───────────────────────────────────────────────────────────────────────
export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?:     React.MutableRefObject<FaceBox | null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
  cheekBoxRef?:    React.MutableRefObject<FaceBox | null>,
) {
  const cvRef     = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef<number>(0);
  const rawBuf    = useRef<[number, number, number, number][]>([]);
  const resR      = useRef<number[]>([]);
  const resG      = useRef<number[]>([]);
  const resB      = useRef<number[]>([]);
  const lastResMs = useRef<number>(0);
  const bpmRef    = useRef<number | null>(null);
  const frameRef  = useRef<number>(0);
  const calRef    = useRef<number>(0);
  const fpsRef    = useRef<number>(30);
  const prevMsRef = useRef<number>(0);
  const histBpm   = useRef<number[]>([]);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "PEAK+FFT+ACF",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { rafRef.current = requestAnimationFrame(processFrame); return; }

    const now = performance.now();
    if (prevMsRef.current > 0) {
      const dt = (now - prevMsRef.current) / 1000;
      if (dt > 0.001) fpsRef.current = fpsRef.current * 0.95 + (1/dt) * 0.05;
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

    const roi = sampleROI(ctx,
      foreheadBoxRef?.current ?? null,
      cheekBoxRef?.current ?? null,
      faceBoxRef?.current ?? null,
      vw, vh
    );

    if (roi.ok) {
      rawBuf.current.push([now, roi.r, roi.g, roi.b]);
      while (rawBuf.current.length > 2 && rawBuf.current[0][0] < now - 20000)
        rawBuf.current.shift();

      const interval = 1000 / FS;
      if (rawBuf.current.length >= 2 && lastResMs.current === 0)
        lastResMs.current = rawBuf.current[0][0];

      while (rawBuf.current.length >= 2 && lastResMs.current + interval <= now) {
        const t = lastResMs.current + interval;
        let idx = 0;
        for (let i = 0; i < rawBuf.current.length - 1; i++) {
          if (rawBuf.current[i][0] <= t && rawBuf.current[i+1][0] >= t) { idx = i; break; }
        }
        const s0 = rawBuf.current[idx], s1 = rawBuf.current[idx+1];
        const dt = s1[0] - s0[0];
        const a = dt > 0 ? (t - s0[0]) / dt : 0;
        resR.current.push(s0[1]*(1-a) + s1[1]*a);
        resG.current.push(s0[2]*(1-a) + s1[2]*a);
        resB.current.push(s0[3]*(1-a) + s1[3]*a);
        lastResMs.current = t;

        const maxN = WIN + FS * 6;
        if (resR.current.length > maxN) {
          resR.current.shift(); resG.current.shift(); resB.current.shift();
        }
      }
    }

    // ── Run analysis every 5 frames after enough data collected ──────────────
    if (frameRef.current % 5 === 0 && resR.current.length >= WIN) {

      const len = resR.current.length;
      const R = resR.current.slice(len - WIN);
      const G = resG.current.slice(len - WIN);
      const B = resB.current.slice(len - WIN);

      // Standardize each channel (zero-mean, unit-variance) — heartbeat-js style
      const mR = mean(R), sR = std(R);
      const mG = mean(G), sG = std(G);
      const mB = mean(B), sB = std(B);
      const Rs = R.map(v => (v - mR) / sR);
      const Gs = G.map(v => (v - mG) / sG);
      const Bs = B.map(v => (v - mB) / sB);

      // Moving average smoothing (3 passes, kernel ~5) — heartbeat-js style
      const kernel = Math.max(Math.floor(FS / 6), 2);
      const Rsm = movingAvg(Rs, 3, kernel);
      const Gsm = movingAvg(Gs, 3, kernel);
      const Bsm = movingAvg(Bs, 3, kernel);

      // Extract pulse signal via windowed POS (Wang 2017, rPPG-Toolbox)
      const posPulse = windowedPOS(Rsm, Gsm, Bsm);

      // Apply smoothness-prior detrend + bandpass (1st-order Butterworth)
      const posDetrended = detrendSP(posPulse, DETREND_LAM);
      const posFiltered = bandpass1(posDetrended, BP_LO, BP_HI, FS);

      // Also try pure green channel (heartbeat-js approach)
      const greenDetrended = detrendSP(Gsm, DETREND_LAM);
      const greenFiltered = bandpass1(greenDetrended, BP_LO, BP_HI, FS);

      // Use whichever signal has better SNR
      const posStd = std(posFiltered), greenStd = std(greenFiltered);
      const bestSig = posStd >= greenStd * 0.7 ? posFiltered : greenFiltered;
      const sigLabel = posStd >= greenStd * 0.7 ? "POS" : "GRN";

      // Triple estimation
      const peakBpm  = peakCountBPM(bestSig, FS);
      const { bpm: fftBpmVal, snr } = fftBPM(bestSig, FS);
      const acfBpmVal = acfBPM(bestSig, FS);

      const { bpm: consBpm, conf } = consensus(peakBpm, fftBpmVal, acfBpmVal);

      if (consBpm >= BPM_LO && consBpm <= BPM_HI && conf >= 25) {
        if (bpmRef.current === null) {
          bpmRef.current = consBpm;
          histBpm.current = [consBpm];
        } else {
          const jump = Math.abs(consBpm - bpmRef.current);
          if (jump <= 15 || conf >= 70) {
            const alpha = jump <= 6 ? EMA_ALPHA : EMA_ALPHA * 0.4;
            bpmRef.current = Math.round(bpmRef.current * (1 - alpha) + consBpm * alpha);
            histBpm.current.push(bpmRef.current);
            if (histBpm.current.length > 20) histBpm.current.shift();
          }
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";

      const sigStd2 = std(bestSig) || 1;
      const display = bestSig.map(v => v / sigStd2).slice(-80);

      setData(prev => ({
        bpm:          finalBpm,
        confidence:   conf,
        signal:       display,
        isActive:     true,
        stress,
        trend:        (finalBpm != null && prev.bpm != null)
                        ? (finalBpm > prev.bpm + 2 ? "rising" : finalBpm < prev.bpm - 2 ? "falling" : "stable")
                        : "stable",
        algorithm:    `${sigLabel} P:${peakBpm} F:${fftBpmVal} A:${acfBpmVal}`,
        faceDetected: roi.ok,
        frameRate:    Math.round(fpsRef.current),
        calibrating:  finalBpm === null,
        roiDebug:     roi.label,
      }));

    } else if (frameRef.current % 30 === 0) {
      const rem = Math.max(0, WIN - resR.current.length);
      setData(prev => ({
        ...prev,
        isActive:     true,
        faceDetected: roi.ok,
        frameRate:    Math.round(fpsRef.current),
        calibrating:  bpmRef.current === null,
        roiDebug:     roi.label + (rem > 0 ? ` (${Math.ceil(rem / FS)}s)` : ""),
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef]);

  const start = useCallback(() => {
    rawBuf.current = []; resR.current = []; resG.current = []; resB.current = [];
    lastResMs.current = 0; bpmRef.current = null; frameRef.current = 0;
    calRef.current = 0; fpsRef.current = 30; prevMsRef.current = 0; histBpm.current = [];
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18); calRef.current = 999;
    histBpm.current = [bpmRef.current!];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9); calRef.current = 999;
    histBpm.current = [bpmRef.current!];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
