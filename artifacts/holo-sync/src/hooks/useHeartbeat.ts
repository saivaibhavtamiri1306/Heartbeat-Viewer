/**
 * useHeartbeat — Time-domain peak-counting rPPG
 *
 * Fundamental change: uses TIME-DOMAIN PEAK COUNTING as the primary method
 * instead of relying on FFT alone. Peaks are actual heartbeat events — more
 * robust than frequency estimation, and closer to how real watches work.
 *
 * Triple-validation: peak counting + FFT + autocorrelation must agree.
 *
 * Pipeline:
 *  1. Large-area face ROI (all skin pixels — more data = better SNR)
 *  2. 30Hz fixed resampling
 *  3. 3-point temporal smoothing (reduces quantization noise)
 *  4. Windowed POS normalization (1.6s sub-windows)
 *  5. Moving-mean detrend
 *  6. 4th-order Butterworth bandpass 0.75–2.5 Hz
 *  7. THREE independent estimators:
 *     a) Peak counting: detect local maxima → inter-beat intervals → BPM
 *     b) FFT: Hann + zero-pad → spectral peak
 *     c) Autocorrelation: lag-domain peak
 *  8. Consensus: if 2+ methods agree within ±6 BPM, use their average.
 *     If all disagree, use the peak-counting result (most robust).
 *  9. EMA smoothing on output BPM (α=0.3)
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
const WIN         = 300;     // 10s at 30Hz
const BPM_LO      = 45;
const BPM_HI      = 150;
const BP_LO       = 0.75;   // Hz
const BP_HI       = 2.5;    // Hz (150 BPM)
const SUB_W       = 48;     // ~1.6s normalization sub-window
const SUB_S       = 12;     // stride (75% overlap)
const DET_WIN     = 45;     // detrend window
const EMA_ALPHA   = 0.3;    // smoothing factor
const AGREE_THR   = 6;      // BPM — methods must agree within this

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std  = (a: number[]) => {
  const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v-m)**2, 0) / (a.length||1)) || 1e-10;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const median = (a: number[]) => {
  const s = [...a].sort((x,y)=>x-y); const m = s.length>>1;
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
};

// ─── 3-point moving average (smooths quantization noise) ────────────────────────
function smooth3(sig: number[]): number[] {
  const n = sig.length; if (n < 3) return [...sig];
  const o = new Array(n);
  o[0] = (sig[0] + sig[1]) / 2;
  for (let i = 1; i < n-1; i++) o[i] = (sig[i-1] + sig[i] + sig[i+1]) / 3;
  o[n-1] = (sig[n-2] + sig[n-1]) / 2;
  return o;
}

// ─── Moving-mean detrend ────────────────────────────────────────────────────────
function detrend(sig: number[], win: number): number[] {
  const half = Math.floor(win/2);
  return sig.map((v,i) => {
    const lo = Math.max(0,i-half), hi = Math.min(sig.length-1,i+half);
    let s=0; for (let j=lo;j<=hi;j++) s+=sig[j];
    return v - s/(hi-lo+1);
  });
}

// ─── Butterworth 2nd-order ──────────────────────────────────────────────────────
type C3 = [number,number,number];
function bwHP(fc:number,fs:number):{b:C3;a:C3}{
  const w=2*Math.tan(Math.PI*fc/fs),w2=w*w,s2=Math.SQRT2,n=4+2*s2*w+w2;
  return{b:[4/n,-8/n,4/n],a:[1,(2*w2-8)/n,(4-2*s2*w+w2)/n]};
}
function bwLP(fc:number,fs:number):{b:C3;a:C3}{
  const w=2*Math.tan(Math.PI*fc/fs),w2=w*w,s2=Math.SQRT2,n=4+2*s2*w+w2;
  return{b:[w2/n,2*w2/n,w2/n],a:[1,(2*w2-8)/n,(4-2*s2*w+w2)/n]};
}
function iir(sig:number[],b:C3,a:C3):number[]{
  const y=new Array(sig.length).fill(0);
  for(let i=0;i<sig.length;i++){
    let v=b[0]*sig[i];
    if(i>=1)v+=b[1]*sig[i-1]-a[1]*y[i-1];
    if(i>=2)v+=b[2]*sig[i-2]-a[2]*y[i-2];
    y[i]=v;
  }
  return y;
}
function filtfilt(sig:number[],b:C3,a:C3):number[]{
  const n=sig.length;
  const pad=Math.min(12,n-1);
  const p=new Array(n+2*pad);
  for(let i=0;i<pad;i++) p[i]=2*sig[0]-sig[pad-i];
  for(let i=0;i<n;i++) p[pad+i]=sig[i];
  for(let i=0;i<pad;i++) p[pad+n+i]=2*sig[n-1]-sig[n-2-i];
  const f=iir(p,b,a); f.reverse();
  const r=iir(f,b,a); r.reverse();
  return r.slice(pad,pad+n);
}
function bandpass(sig:number[],lo:number,hi:number,fs:number):number[]{
  return filtfilt(filtfilt(sig,bwHP(lo,fs).b,bwHP(lo,fs).a),bwLP(hi,fs).b,bwLP(hi,fs).a);
}

// ─── FFT ────────────────────────────────────────────────────────────────────────
function fftMag(sig:number[]):Float64Array{
  const n=sig.length; let sz=1; while(sz<n)sz<<=1;
  const re=new Float64Array(sz),im=new Float64Array(sz);
  for(let i=0;i<n;i++)re[i]=sig[i];
  for(let i=1,j=0;i<sz;i++){
    let bit=sz>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
    if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}
  }
  for(let len=2;len<=sz;len<<=1){
    const ang=(2*Math.PI)/len,wr=Math.cos(ang),wi=-Math.sin(ang);
    for(let i=0;i<sz;i+=len){
      let pr=1,pi=0;
      for(let j=0;j<len>>1;j++){
        const[ur,ui]=[re[i+j],im[i+j]];
        const vr=re[i+j+len/2]*pr-im[i+j+len/2]*pi;
        const vi=re[i+j+len/2]*pi+im[i+j+len/2]*pr;
        re[i+j]=ur+vr;im[i+j]=ui+vi;
        re[i+j+len/2]=ur-vr;im[i+j+len/2]=ui-vi;
        const t=pr*wr-pi*wi;pi=pr*wi+pi*wr;pr=t;
      }
    }
  }
  const m=new Float64Array(sz>>1);
  for(let i=0;i<sz>>1;i++)m[i]=Math.sqrt(re[i]**2+im[i]**2);
  return m;
}

// ─── Windowed POS (Wang 2016) ───────────────────────────────────────────────────
function windowedPOS(R:number[],G:number[],B:number[]):number[]{
  const n=R.length,S=new Float64Array(n),cnt=new Float64Array(n);
  for(let s=0;s+SUB_W<=n;s+=SUB_S){
    let mr=0,mg=0,mb=0;
    for(let i=s;i<s+SUB_W;i++){mr+=R[i];mg+=G[i];mb+=B[i];}
    mr=(mr/SUB_W)||1;mg=(mg/SUB_W)||1;mb=(mb/SUB_W)||1;
    const H1=new Float64Array(SUB_W),H2=new Float64Array(SUB_W);
    for(let j=0;j<SUB_W;j++){
      const rn=R[s+j]/mr,gn=G[s+j]/mg,bn=B[s+j]/mb;
      H1[j]=gn-bn; H2[j]=-2*rn+gn+bn;
    }
    const s1=std(Array.from(H1)),s2=std(Array.from(H2));
    const a=s2>1e-10?s1/s2:1;
    for(let j=0;j<SUB_W;j++){S[s+j]+=H1[j]+a*H2[j];cnt[s+j]++;}
  }
  return Array.from(S).map((v,i)=>cnt[i]>0?v/cnt[i]:0);
}

// ─── METHOD 1: Peak counting (time-domain) ─────────────────────────────────────
function peakCountBPM(sig: number[], fs: number): number {
  const n = sig.length;
  if (n < fs * 2) return 0;

  // Find all local maxima
  const peaks: number[] = [];
  const threshold = std(sig) * 0.4;
  for (let i = 2; i < n - 2; i++) {
    if (sig[i] > sig[i-1] && sig[i] > sig[i+1] &&
        sig[i] > sig[i-2] && sig[i] > sig[i+2] &&
        sig[i] > threshold) {
      peaks.push(i);
    }
  }
  if (peaks.length < 3) return 0;

  // Enforce minimum distance between peaks (corresponding to max HR)
  const minDist = Math.floor(fs * 60 / BPM_HI); // ~12 samples for 150BPM
  const filtered: number[] = [peaks[0]];
  for (let i = 1; i < peaks.length; i++) {
    if (peaks[i] - filtered[filtered.length-1] >= minDist) {
      filtered.push(peaks[i]);
    } else if (sig[peaks[i]] > sig[filtered[filtered.length-1]]) {
      filtered[filtered.length-1] = peaks[i];
    }
  }
  if (filtered.length < 3) return 0;

  // Compute inter-beat intervals
  const ibis: number[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const ibi = (filtered[i] - filtered[i-1]) / fs;
    const bpm = 60 / ibi;
    if (bpm >= BPM_LO && bpm <= BPM_HI) ibis.push(ibi);
  }
  if (ibis.length < 2) return 0;

  // Reject outlier IBIs (outside 1.5× IQR)
  const sorted = [...ibis].sort((a,b)=>a-b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const valid = ibis.filter(v => v >= q1 - 1.5*iqr && v <= q3 + 1.5*iqr);
  if (valid.length < 2) return 0;

  return Math.round(60 / median(valid));
}

// ─── METHOD 2: FFT peak ────────────────────────────────────────────────────────
function fftBPM(sig: number[], fs: number): { bpm: number; snr: number } {
  const s2 = std(sig); if (s2 < 1e-10) return { bpm: 0, snr: 0 };
  const norm = sig.map(v => v / s2);
  const w = norm.map((v,i) => v * (0.5 - 0.5*Math.cos(2*Math.PI*i/(norm.length-1))));
  const m = fftMag([...w, ...new Array(norm.length*3).fill(0)]);
  const fr = fs / (m.length * 2);
  const lo = Math.max(1, Math.floor(BPM_LO/60/fr));
  const hi = Math.min(m.length-2, Math.ceil(BPM_HI/60/fr));
  let peak=0, pb=lo, bsum=0;
  for (let k=lo; k<=hi; k++) { bsum+=m[k]; if(m[k]>peak){peak=m[k];pb=k;} }
  const bmean = bsum / Math.max(1, hi-lo+1);
  const snr = bmean > 0 ? peak / bmean : 0;
  let freq = pb * fr;
  if (pb > 0 && pb < m.length-1) {
    const al=m[pb-1], bm2=m[pb], ar=m[pb+1], d=al-2*bm2+ar;
    if (Math.abs(d) > 1e-12) freq = (pb + 0.5*(al-ar)/d) * fr;
  }
  return { bpm: Math.round(clamp(freq*60, BPM_LO, BPM_HI)), snr };
}

// ─── METHOD 3: Autocorrelation ─────────────────────────────────────────────────
function acfBPM(sig: number[], fs: number): number {
  const n = sig.length;
  const minLag = Math.max(2, Math.floor(fs*60/BPM_HI));
  const maxLag = Math.min(Math.floor(fs*60/BPM_LO), Math.floor(n/2));
  const m2 = mean(sig), s2 = std(sig);
  if (s2 < 1e-10) return 0;
  const norm = sig.map(v => (v-m2)/s2);
  let best = -Infinity, bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < n-lag; i++) c += norm[i] * norm[i+lag];
    c /= (n - lag);
    if (c > best) { best = c; bestLag = lag; }
  }
  if (best < 0.15) return 0;
  return Math.round(fs * 60 / bestLag);
}

// ─── Consensus voting ──────────────────────────────────────────────────────────
function consensus(peakBpm: number, fftBpmVal: number, acfBpmVal: number): { bpm: number; conf: number } {
  const methods = [peakBpm, fftBpmVal, acfBpmVal].filter(v => v >= BPM_LO && v <= BPM_HI);
  if (methods.length === 0) return { bpm: 0, conf: 0 };
  if (methods.length === 1) return { bpm: methods[0], conf: 30 };

  // Check pairwise agreement
  const agreements: [number, number][] = [];
  for (let i = 0; i < methods.length; i++)
    for (let j = i+1; j < methods.length; j++)
      if (Math.abs(methods[i] - methods[j]) <= AGREE_THR)
        agreements.push([methods[i], methods[j]]);

  if (agreements.length > 0) {
    // Use the average of all agreeing methods
    const all = agreements.flat();
    const avgBpm = Math.round(mean(all));
    const conf = agreements.length >= 2 ? 90 : (agreements.length === 1 ? 70 : 40);
    return { bpm: avgBpm, conf };
  }

  // No agreement — use peak counting (most robust for real heartbeats)
  if (peakBpm >= BPM_LO && peakBpm <= BPM_HI) return { bpm: peakBpm, conf: 35 };
  return { bpm: Math.round(median(methods)), conf: 25 };
}

// ─── Full-face ROI sampling (no skin filter for landmark-based ROI) ─────────────
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

  if (foreheadBox && foreheadBox.w > 8 && foreheadBox.h > 6)
    addBox(foreheadBox.x, foreheadBox.y, foreheadBox.w, foreheadBox.h, "FH");

  if (cheekBox && cheekBox.w > 10 && cheekBox.h > 8)
    addBox(cheekBox.x, cheekBox.y, cheekBox.w, cheekBox.h, "CK");

  if (cnt < 50 && faceBox && faceBox.w > 30 && faceBox.h > 30)
    addBox(faceBox.x + faceBox.w*.15, faceBox.y + faceBox.h*.03,
           faceBox.w*.70, faceBox.h*.55, "FC");

  if (cnt < 30) {
    addBox(vw*.2, vh*.08, vw*.6, vh*.42, "SC");
  }

  if (cnt < 10) return { r: 0, g: 0, b: 0, ok: false, label: "NONE" };
  const r = totalR/cnt, g = totalG/cnt, b = totalB/cnt;
  return { r, g, b, ok: r > 15 && g > 10 && r < 250, label };
}

// ─── Hook ───────────────────────────────────────────────────────────────────────
export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?:     React.MutableRefObject<FaceBox | null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
  cheekBoxRef?:    React.MutableRefObject<FaceBox | null>,
) {
  const cvRef     = useRef<HTMLCanvasElement|null>(null);
  const rafRef    = useRef<number>(0);
  const rawBuf    = useRef<[number,number,number,number][]>([]);
  const resR      = useRef<number[]>([]);
  const resG      = useRef<number[]>([]);
  const resB      = useRef<number[]>([]);
  const lastResMs = useRef<number>(0);
  const bpmRef    = useRef<number|null>(null);
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
      while (rawBuf.current.length > 2 && rawBuf.current[0][0] < now - 25000)
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

        const maxN = WIN + FS * 8;
        if (resR.current.length > maxN) {
          resR.current.shift(); resG.current.shift(); resB.current.shift();
        }
      }
    }

    // ── Run analysis every 5 frames after calibration ──────────────────────
    if (frameRef.current % 5 === 0 &&
        resR.current.length >= WIN &&
        calRef.current >= WIN) {

      const len = resR.current.length;
      const R = resR.current.slice(len - WIN);
      const G = resG.current.slice(len - WIN);
      const B = resB.current.slice(len - WIN);

      // Pre-smooth to reduce quantization noise
      const Rs = smooth3(R), Gs = smooth3(G), Bs = smooth3(B);

      // Extract pulse signal via windowed POS
      const pulse = windowedPOS(Rs, Gs, Bs);
      const filtered = bandpass(detrend(pulse, DET_WIN), BP_LO, BP_HI, FS);

      // Also try pure green channel
      const greenNorm = Gs.map(v => v / (mean(Gs)||1));
      const greenFilt = bandpass(detrend(greenNorm, DET_WIN), BP_LO, BP_HI, FS);

      // Use whichever has higher variance (stronger signal)
      const posVar = std(filtered);
      const greenVar = std(greenFilt);
      const bestSig = posVar > greenVar * 0.8 ? filtered : greenFilt;
      const sigLabel = posVar > greenVar * 0.8 ? "POS" : "GREEN";

      // Triple estimation
      const peakBpm  = peakCountBPM(bestSig, FS);
      const { bpm: fftBpmVal, snr } = fftBPM(bestSig, FS);
      const acfBpmVal = acfBPM(bestSig, FS);

      const { bpm: consBpm, conf } = consensus(peakBpm, fftBpmVal, acfBpmVal);

      if (consBpm >= BPM_LO && consBpm <= BPM_HI && conf >= 25) {
        if (bpmRef.current === null) {
          // First reading — accept directly
          bpmRef.current = consBpm;
          histBpm.current = [consBpm];
        } else {
          // EMA smoothing
          const jump = Math.abs(consBpm - bpmRef.current);
          if (jump <= 12 || conf >= 70) {
            const alpha = jump <= 5 ? EMA_ALPHA : EMA_ALPHA * 0.5;
            bpmRef.current = Math.round(bpmRef.current * (1 - alpha) + consBpm * alpha);
            histBpm.current.push(bpmRef.current);
            if (histBpm.current.length > 20) histBpm.current.shift();
          }
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low"|"medium"|"high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";

      const sigStd = std(bestSig) || 1;
      const display = bestSig.map(v => v / sigStd).slice(-80);

      setData(prev => ({
        bpm:          finalBpm,
        confidence:   conf,
        signal:       display,
        isActive:     true,
        stress,
        trend:        (finalBpm != null && prev.bpm != null)
                        ? (finalBpm > prev.bpm+2 ? "rising" : finalBpm < prev.bpm-2 ? "falling" : "stable")
                        : "stable",
        algorithm:    `${sigLabel} P:${peakBpm} F:${fftBpmVal} A:${acfBpmVal}`,
        faceDetected: roi.ok,
        frameRate:    Math.round(fpsRef.current),
        calibrating:  finalBpm === null,
        roiDebug:     roi.label,
      }));

    } else if (frameRef.current % 30 === 0) {
      const rem = Math.max(0, WIN - calRef.current);
      setData(prev => ({
        ...prev,
        isActive:     true,
        faceDetected: roi.ok,
        frameRate:    Math.round(fpsRef.current),
        calibrating:  bpmRef.current === null,
        roiDebug:     roi.label + (rem > 0 ? ` (${Math.ceil(rem/FS)}s)` : ""),
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef]);

  const start = useCallback(() => {
    rawBuf.current=[]; resR.current=[]; resG.current=[]; resB.current=[];
    lastResMs.current=0; bpmRef.current=null; frameRef.current=0;
    calRef.current=0; fpsRef.current=30; prevMsRef.current=0; histBpm.current=[];
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random()*18); calRef.current = 999;
    histBpm.current = [bpmRef.current!];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random()*9); calRef.current = 999;
    histBpm.current = [bpmRef.current!];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
