/**
 * useHeartbeat — Ensemble rPPG (POS + CHROM) with motion rejection
 *
 * Accuracy pipeline:
 *  1. ROI: forehead landmarks (precise) > face box estimate > fallback scan
 *  2. Fixed 30Hz resampling via linear interpolation
 *  3. Motion artifact rejection: consecutive-sample delta gating
 *  4. Moving-mean subtraction detrend (removes auto-exposure drift — much
 *     better than linear detrend for consumer webcam)
 *  5. POS  (Wang 2016): H1=Gn-Bn,  H2=-2Rn+Gn+Bn, S=H1+α*H2
 *     CHROM (de Haan 2013): Xs=3Rn-2Gn, Ys=1.5Rn+Gn-1.5Bn, S=Xs-α*Ys
 *  6. Butterworth bandpass 0.75-3.0 Hz (45-180 BPM), zero-phase filtfilt
 *  7. Hann window + 4× zero-padded FFT + parabolic interpolation
 *  8. Ensemble: average POS and CHROM FFT spectra → shared peak search
 *  9. Harmonic check: boost confidence if 2nd harmonic exists
 * 10. SNR-weighted rolling history → Huber-robust median → final BPM
 *
 * Window: 256 samples @ 30Hz = 8.53 s (power-of-2 for optimal FFT)
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

// ─── Constants ──────────────────────────────────────────────────────────────────
const TARGET_FS   = 30;    // Fixed resampling rate (Hz)
const WIN_SIZE    = 256;   // 8.53 s @ 30Hz — power-of-2
const HR_MIN_BPM  = 45;    // Realistic human resting lower bound
const HR_MAX_BPM  = 150;   // Realistic upper bound (exclude artefacts)
const SNR_MIN     = 1.6;
const SMOOTH_N    = 12;    // Rolling history depth
const CAL_FRAMES  = WIN_SIZE;
const MOTION_THR  = 7.0;   // Max allowed per-channel delta between samples
const DETREND_WIN = 45;    // Moving-mean window (1.5 s at 30Hz)

// ─── Math helpers ──────────────────────────────────────────────────────────────
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std  = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)) || 1e-10;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Weighted median: higher-SNR estimates count more
function weightedMedian(vals: number[], weights: number[]): number {
  const pairs = vals.map((v, i) => ({ v, w: weights[i] }))
                    .sort((a, b) => a.v - b.v);
  const total = pairs.reduce((s, p) => s + p.w, 0);
  let cum = 0;
  for (const p of pairs) { cum += p.w; if (cum >= total / 2) return p.v; }
  return pairs[pairs.length - 1].v;
}

// ─── Moving-mean detrend (removes slow auto-exposure drift) ────────────────────
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

// ─── Butterworth 2nd-order (bilinear transform) ────────────────────────────────
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
    const ang = (2*Math.PI)/len, wr = Math.cos(ang), wi = -Math.sin(ang);
    for (let i = 0; i < sz; i += len) {
      let pr = 1, pi = 0;
      for (let j = 0; j < len >> 1; j++) {
        const [ur, ui] = [re[i+j], im[i+j]];
        const vr = re[i+j+len/2]*pr - im[i+j+len/2]*pi;
        const vi = re[i+j+len/2]*pi + im[i+j+len/2]*pr;
        re[i+j] = ur+vr; im[i+j] = ui+vi;
        re[i+j+len/2] = ur-vr; im[i+j+len/2] = ui-vi;
        const t = pr*wr - pi*wi; pi = pr*wi + pi*wr; pr = t;
      }
    }
  }
  const m = new Float64Array(sz >> 1);
  for (let i = 0; i < sz >> 1; i++) m[i] = Math.sqrt(re[i]**2 + im[i]**2);
  return m;
}

// ─── POS algorithm (Wang et al. 2016) ──────────────────────────────────────────
// H1 = Gn-Bn, H2 = -2Rn+Gn+Bn, S = H1 + (std(H1)/std(H2))*H2
function posSignal(R: number[], G: number[], B: number[]): number[] {
  const mr = mean(R)||1, mg = mean(G)||1, mb = mean(B)||1;
  const Rn = R.map(v => v/mr), Gn = G.map(v => v/mg), Bn = B.map(v => v/mb);
  const H1 = Gn.map((v, i) => v - Bn[i]);
  const H2 = Rn.map((v, i) => -2*v + Gn[i] + Bn[i]);
  const a  = std(H2) > 1e-10 ? std(H1)/std(H2) : 1;
  return H1.map((v, i) => v + a * H2[i]);
}

// ─── CHROM algorithm (de Haan & Jeanne 2013) ───────────────────────────────────
// Xs = 3Rn-2Gn, Ys = 1.5Rn+Gn-1.5Bn, S = Xs - (std(Xs)/std(Ys))*Ys
function chromSignal(R: number[], G: number[], B: number[]): number[] {
  const mr = mean(R)||1, mg = mean(G)||1, mb = mean(B)||1;
  const Rn = R.map(v => v/mr), Gn = G.map(v => v/mg), Bn = B.map(v => v/mb);
  const Xs = Rn.map((v, i) => 3*v - 2*Gn[i]);
  const Ys = Rn.map((v, i) => 1.5*v + Gn[i] - 1.5*Bn[i]);
  const a  = std(Ys) > 1e-10 ? std(Xs)/std(Ys) : 1;
  return Xs.map((v, i) => v - a * Ys[i]);
}

// ─── Process one signal through detrend→bandpass→FFT ──────────────────────────
function signalToSpectrum(raw: number[]): Float64Array {
  const d  = movingDetrend(raw, DETREND_WIN);
  const bp = bandpass(d, 0.75, 3.0, TARGET_FS);
  const s  = std(bp) || 1;
  const norm = bp.map(v => v / s);
  // Hann window
  const w = norm.map((v, i) => v * (0.5 - 0.5*Math.cos(2*Math.PI*i/(norm.length-1))));
  // 4× zero-pad
  return fftMag([...w, ...new Array(norm.length * 3).fill(0)]);
}

// ─── Ensemble BPM from averaged POS+CHROM spectra ─────────────────────────────
function estimateBPM(
  R: number[], G: number[], B: number[]
): { bpm: number; snr: number; confidence: number; sigDisplay: number[] } {
  if (R.length < WIN_SIZE) return { bpm: 0, snr: 0, confidence: 0, sigDisplay: [] };

  const pos   = posSignal(R, G, B);
  const chrom = chromSignal(R, G, B);

  const mPos   = signalToSpectrum(pos);
  const mChrom = signalToSpectrum(chrom);

  // Average the two spectra (ensemble)
  const ensemble = new Float64Array(Math.min(mPos.length, mChrom.length));
  for (let i = 0; i < ensemble.length; i++) ensemble[i] = (mPos[i] + mChrom[i]) / 2;

  const fr  = TARGET_FS / (ensemble.length * 2); // frequency resolution (Hz/bin)
  const lo  = Math.max(1, Math.floor(HR_MIN_BPM / 60 / fr));
  const hi  = Math.min(ensemble.length - 2, Math.ceil(HR_MAX_BPM / 60 / fr));

  let peak = 0, pb = lo, bsum = 0;
  for (let k = lo; k <= hi; k++) {
    bsum += ensemble[k];
    if (ensemble[k] > peak) { peak = ensemble[k]; pb = k; }
  }
  const bmean = bsum / Math.max(1, hi - lo + 1);
  const snr   = bmean > 0 ? peak / bmean : 0;

  // Parabolic interpolation for sub-bin accuracy
  let freq = pb * fr;
  if (pb > 0 && pb < ensemble.length - 1) {
    const al = ensemble[pb-1], bm = ensemble[pb], ar = ensemble[pb+1];
    const d = al - 2*bm + ar;
    if (Math.abs(d) > 1e-12) freq = (pb + 0.5*(al - ar)/d) * fr;
  }
  const bpm = Math.round(clamp(freq * 60, HR_MIN_BPM, HR_MAX_BPM));

  // Harmonic check: does a peak exist near 2× the fundamental?
  const h2bin = Math.round(freq * 2 / fr);
  const h2win = Math.floor(0.1 * freq / fr); // ±10% window
  let h2peak = 0;
  for (let k = Math.max(1, h2bin-h2win); k <= Math.min(ensemble.length-1, h2bin+h2win); k++)
    h2peak = Math.max(h2peak, ensemble[k]);
  const harmonicBoost = h2peak > ensemble[pb] * 0.3 ? 1.25 : 1.0;

  // Confidence: SNR-based + harmonic bonus
  const rawConf = snr >= SNR_MIN ? Math.min(95, ((snr - SNR_MIN) / 5) * 95 * harmonicBoost) : 0;

  // Display signal: POS filtered and normalised
  const posF = bandpass(movingDetrend(pos, DETREND_WIN), 0.75, 3.0, TARGET_FS);
  const ps = std(posF) || 1;

  return {
    bpm,
    snr,
    confidence: Math.round(rawConf),
    sigDisplay: posF.map(v => v / ps).slice(-80),
  };
}

// ─── ROI sampling ───────────────────────────────────────────────────────────────
function sampleROI(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number
): { r: number; g: number; b: number; ok: boolean } {
  const wi = Math.max(1, Math.floor(w)), hi = Math.max(1, Math.floor(h));
  let r = 0, g = 0, b = 0, cnt = 0;
  try {
    const d = ctx.getImageData(Math.floor(x), Math.floor(y), wi, hi).data;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; cnt++; }
  } catch { return { r:0, g:0, b:0, ok:false }; }
  if (!cnt) return { r:0, g:0, b:0, ok:false };
  r /= cnt; g /= cnt; b /= cnt;
  return { r, g, b, ok: r>20 && g>15 && b>8 && r<248 && g<248 && b<248 };
}

const FALLBACK_ROIS: [number,number,number,number][] = [
  [0.20,0.08,0.80,0.50],
  [0.15,0.08,0.85,0.82],
  [0.25,0.28,0.75,0.68],
];
const ROI_LABELS = ["FOREHEAD","FULL-FACE","CHEEKS"];

// ─── Hook ───────────────────────────────────────────────────────────────────────
export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?:     React.MutableRefObject<FaceBox | null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
) {
  const cvRef     = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef<number>(0);

  // Timestamped raw buffer for resampling
  const rawBuf    = useRef<[number, number, number, number][]>([]); // [ms, r, g, b]
  // Fixed-rate resampled buffers
  const resR      = useRef<number[]>([]);
  const resG      = useRef<number[]>([]);
  const resB      = useRef<number[]>([]);
  const resOk     = useRef<boolean[]>([]);   // motion mask
  const lastResMs = useRef<number>(0);

  // Previous sample for motion detection
  const prevR     = useRef<number>(0);
  const prevG2    = useRef<number>(0);
  const prevB     = useRef<number>(0);

  // BPM history with SNR weights
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
      if (dt > 0.001) fpsRef.current = fpsRef.current * 0.97 + (1/dt) * 0.03;
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

    // ── ROI selection ─────────────────────────────────────────────────────────
    let roi: { r: number; g: number; b: number; ok: boolean };
    let roiLabel = "SCANNING";

    const fhBox  = foreheadBoxRef?.current;
    const faceBox = faceBoxRef?.current;

    if (fhBox && fhBox.w > 10 && fhBox.h > 8) {
      roi = sampleROI(ctx, fhBox.x, fhBox.y, fhBox.w, fhBox.h);
      roiLabel = "LM-FOREHEAD";
    } else if (faceBox && faceBox.w > 30 && faceBox.h > 30) {
      roi = sampleROI(ctx, faceBox.x + faceBox.w*.20, faceBox.y + faceBox.h*.04,
                      faceBox.w*.60, faceBox.h*.28);
      roiLabel = "BOX-FOREHEAD";
    } else {
      if (frameRef.current % 30 === 1) {
        let best = -Infinity, bestI = 1;
        for (let i = 0; i < FALLBACK_ROIS.length; i++) {
          const [fx,fy,fw,fh] = FALLBACK_ROIS[i];
          const s = sampleROI(ctx, fx*vw, fy*vh, (fw-fx)*vw, (fh-fy)*vh);
          if (s.ok) { const sc = -Math.abs(s.g-120); if (sc > best) { best=sc; bestI=i; } }
        }
        roiIdxRef.current = bestI;
      }
      const [fx,fy,fw,fh] = FALLBACK_ROIS[roiIdxRef.current];
      roi = sampleROI(ctx, fx*vw, fy*vh, (fw-fx)*vw, (fh-fy)*vh);
      roiLabel = ROI_LABELS[roiIdxRef.current];
    }

    if (roi.ok) {
      // ── Motion artifact detection ─────────────────────────────────────────
      const dr = Math.abs(roi.r - prevR.current);
      const dg = Math.abs(roi.g - prevG2.current);
      const db = Math.abs(roi.b - prevB.current);
      const isMotion = prevR.current > 0 && (dr + dg + db) / 3 > MOTION_THR;
      prevR.current = roi.r; prevG2.current = roi.g; prevB.current = roi.b;

      rawBuf.current.push([now, roi.r, roi.g, roi.b]);
      // Keep max 20s of raw
      while (rawBuf.current.length > 2 && rawBuf.current[0][0] < now - 20000)
        rawBuf.current.shift();

      // ── Resample to fixed TARGET_FS Hz ──────────────────────────────────
      const interval = 1000 / TARGET_FS;
      if (rawBuf.current.length >= 2 && lastResMs.current === 0)
        lastResMs.current = rawBuf.current[0][0];

      while (rawBuf.current.length >= 2 && lastResMs.current + interval <= now) {
        const t = lastResMs.current + interval;
        let lo = 0;
        for (let i = 0; i < rawBuf.current.length - 1; i++) {
          if (rawBuf.current[i][0] <= t && rawBuf.current[i+1][0] >= t) { lo = i; break; }
        }
        const s0 = rawBuf.current[lo], s1 = rawBuf.current[lo+1];
        const dt2 = s1[0] - s0[0];
        const alpha = dt2 > 0 ? (t - s0[0]) / dt2 : 0;
        resR.current.push(s0[1]*(1-alpha) + s1[1]*alpha);
        resG.current.push(s0[2]*(1-alpha) + s1[2]*alpha);
        resB.current.push(s0[3]*(1-alpha) + s1[3]*alpha);
        resOk.current.push(!isMotion);
        lastResMs.current = t;

        const maxN = WIN_SIZE + TARGET_FS * 5;
        if (resR.current.length > maxN) {
          resR.current.shift(); resG.current.shift();
          resB.current.shift(); resOk.current.shift();
        }
      }
    }

    // ── Run pipeline every 8 frames once enough data accumulated ──────────
    if (frameRef.current % 8 === 0 &&
        resR.current.length >= WIN_SIZE &&
        calRef.current >= CAL_FRAMES) {

      // Use only motion-clean frames (if too few clean frames, use all)
      const cleanCount = resOk.current.filter(Boolean).length;
      let R: number[], G: number[], B: number[];
      if (cleanCount >= WIN_SIZE * 0.75) {
        // Filter out motion frames, then take last WIN_SIZE
        const clean: [number,number,number][] = [];
        for (let i = 0; i < resR.current.length; i++)
          if (resOk.current[i]) clean.push([resR.current[i], resG.current[i], resB.current[i]]);
        const slice = clean.slice(-WIN_SIZE);
        R = slice.map(v => v[0]); G = slice.map(v => v[1]); B = slice.map(v => v[2]);
      } else {
        // Not enough clean frames — use all (motion rejection would discard too much)
        const len = resR.current.length;
        R = resR.current.slice(len - WIN_SIZE);
        G = resG.current.slice(len - WIN_SIZE);
        B = resB.current.slice(len - WIN_SIZE);
      }

      const { bpm, snr, confidence, sigDisplay } = estimateBPM(R, G, B);

      if (snr >= SNR_MIN && bpm >= HR_MIN_BPM && bpm <= HR_MAX_BPM) {
        const prev = bpmRef.current ?? bpm;
        const jump = Math.abs(bpm - prev);
        // Accept if small jump, or first reading, or very high confidence
        if (jump <= 15 || bpmRef.current === null || snr >= 5) {
          bpmHist.current.push(bpm);
          snrHist.current.push(snr);
          if (bpmHist.current.length > SMOOTH_N) {
            bpmHist.current.shift(); snrHist.current.shift();
          }
          // SNR-weighted median for final BPM
          const finalBpm = Math.round(
            clamp(weightedMedian(bpmHist.current, snrHist.current), HR_MIN_BPM, HR_MAX_BPM)
          );
          bpmRef.current = finalBpm;
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low"|"medium"|"high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";

      const algoLabel = fhBox ? "POS+CHROM-LM" : faceBox ? "POS+CHROM-Box" : "POS+CHROM";

      setData(prev => ({
        bpm:          finalBpm,
        confidence,
        signal:       sigDisplay,
        isActive:     true,
        stress,
        trend:        (finalBpm != null && prev.bpm != null)
                        ? (finalBpm > prev.bpm+3 ? "rising" : finalBpm < prev.bpm-3 ? "falling" : "stable")
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
        roiDebug:     roiLabel + (remaining > 0 ? ` (cal ${Math.ceil(remaining/TARGET_FS)}s)` : ""),
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
