/**
 * useHeartbeat — POS rPPG with fixed 30Hz resampling
 *
 * Algorithm (Wang et al. 2016 — Algorithmic Principles of Remote-PPG):
 *  1. ROI: forehead landmarks (precise) > face box forehead > fallback scan
 *  2. Fixed 30Hz resampling via linear interpolation (counteracts FPS variation)
 *  3. Normalize channels by temporal mean
 *  4. POS: H1 = Gn-Bn,  H2 = -2Rn+Gn+Bn,  S = H1 + α*H2
 *  5. Linear detrend
 *  6. 2nd-order Butterworth bandpass 0.67–4.0 Hz, zero-phase (filtfilt)
 *  7. Hann-windowed 4× zero-padded FFT + parabolic interpolation
 *  8. 10-estimate rolling median → final BPM
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

// ─── Constants ─────────────────────────────────────────────────────────────────
const TARGET_FS  = 30;     // Fixed resampling rate (Hz)
const WIN_SIZE   = 256;    // 8.53 s @ 30Hz (power-of-2 for FFT)
const HR_MIN_BPM = 40;
const HR_MAX_BPM = 200;
const SNR_MIN    = 1.8;
const SMOOTH_N   = 10;     // Rolling median window size
const CAL_FRAMES = WIN_SIZE; // Wait for one full window before reporting

// ─── Math helpers ──────────────────────────────────────────────────────────────
const mean = (a: number[]) => a.reduce((s,v)=>s+v,0)/(a.length||1);
const std  = (a: number[]) => {
  const m=mean(a);
  return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length||1))||1e-10;
};
const median = (arr: number[]) => {
  const s=[...arr].sort((a,b)=>a-b);
  const m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
};

// ─── Linear detrend ────────────────────────────────────────────────────────────
function detrend(sig: number[]): number[] {
  const n=sig.length; if (n<2) return [...sig];
  const xm=(n-1)/2, ym=mean(sig);
  let num=0,den=0;
  for (let i=0;i<n;i++){num+=(i-xm)*(sig[i]-ym);den+=(i-xm)**2;}
  const slope=den?num/den:0, ic=ym-slope*xm;
  return sig.map((v,i)=>v-(slope*i+ic));
}

// ─── Butterworth 2nd-order (bilinear transform) ─────────────────────────────────
type C3=[number,number,number];
function bwHP(fc:number,fs:number):{b:C3;a:C3}{
  const w=2*Math.tan(Math.PI*fc/fs),w2=w*w,s2=Math.SQRT2;
  const n=4+2*s2*w+w2;
  return{b:[4/n,-8/n,4/n],a:[1,(2*w2-8)/n,(4-2*s2*w+w2)/n]};
}
function bwLP(fc:number,fs:number):{b:C3;a:C3}{
  const w=2*Math.tan(Math.PI*fc/fs),w2=w*w,s2=Math.SQRT2;
  const n=4+2*s2*w+w2;
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
function ff(sig:number[],b:C3,a:C3):number[]{return iir([...iir(sig,b,a)].reverse(),b,a).reverse();}
function bp(sig:number[],lo:number,hi:number,fs:number):number[]{
  const hp=bwHP(lo,fs),lp=bwLP(hi,fs);
  return ff(ff(sig,hp.b,hp.a),lp.b,lp.a);
}

// ─── FFT ───────────────────────────────────────────────────────────────────────
function fftMag(sig:number[]):number[]{
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
        const vr=re[i+j+len/2]*pr-im[i+j+len/2]*pi,vi=re[i+j+len/2]*pi+im[i+j+len/2]*pr;
        re[i+j]=ur+vr;im[i+j]=ui+vi;re[i+j+len/2]=ur-vr;im[i+j+len/2]=ui-vi;
        const t=pr*wr-pi*wi;pi=pr*wi+pi*wr;pr=t;
      }
    }
  }
  const m=new Array(sz>>1);
  for(let i=0;i<sz>>1;i++)m[i]=Math.sqrt(re[i]**2+im[i]**2);
  return m;
}

// ─── POS algorithm (Wang et al. 2016, exact formula) ───────────────────────────
function posSignal(R:number[],G:number[],B:number[]):number[]{
  const mr=mean(R)||1, mg=mean(G)||1, mb=mean(B)||1;
  // Normalize to unit mean (illumination invariant)
  const Rn=R.map(v=>v/mr), Gn=G.map(v=>v/mg), Bn=B.map(v=>v/mb);
  // POS projections (orthogonal to skin-tone axis)
  const H1=Gn.map((v,i)=>v-Bn[i]);             // [0, 1, -1] · [Rn,Gn,Bn]
  const H2=Rn.map((v,i)=>-2*v+Gn[i]+Bn[i]);    // [-2, 1, 1] · [Rn,Gn,Bn]
  const s1=std(H1), s2=std(H2);
  const alpha=s2>1e-10?s1/s2:1;
  return H1.map((v,i)=>v+alpha*H2[i]);
}

// ─── BPM from filtered signal ──────────────────────────────────────────────────
function estimateBPM(sig:number[],fs:number):{bpm:number;snr:number}{
  const n=sig.length; if(n<WIN_SIZE)return{bpm:0,snr:0};
  const w=sig.map((v,i)=>v*(0.5-0.5*Math.cos(2*Math.PI*i/(n-1))));
  const padded=[...w,...new Array(n*3).fill(0)];
  const mags=fftMag(padded);
  const fr=fs/padded.length;
  const lo=Math.max(1,Math.floor(HR_MIN_BPM/60/fr));
  const hi=Math.min(mags.length-2,Math.ceil(HR_MAX_BPM/60/fr));
  let peak=0,pb=lo,bsum=0;
  for(let k=lo;k<=hi;k++){bsum+=mags[k];if(mags[k]>peak){peak=mags[k];pb=k;}}
  const bmean=bsum/Math.max(1,hi-lo+1);
  const snr=bmean>0?peak/bmean:0;
  let freq=pb*fr;
  if(pb>0&&pb<mags.length-1){
    const al=mags[pb-1],bm=mags[pb],ar=mags[pb+1];
    const d=al-2*bm+ar;
    if(Math.abs(d)>1e-12)freq=(pb+.5*(al-ar)/d)*fr;
  }
  return{bpm:Math.max(HR_MIN_BPM,Math.min(HR_MAX_BPM,Math.round(freq*60))),snr};
}

// ─── ROI sampling ──────────────────────────────────────────────────────────────
function sampleROI(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number):
  {r:number;g:number;b:number;ok:boolean} {
  const wi=Math.max(1,Math.floor(w)),hi=Math.max(1,Math.floor(h));
  let r=0,g=0,b=0,cnt=0;
  try {
    const d=ctx.getImageData(Math.floor(x),Math.floor(y),wi,hi).data;
    for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];cnt++;}
  } catch {return{r:0,g:0,b:0,ok:false};}
  if(!cnt)return{r:0,g:0,b:0,ok:false};
  r/=cnt;g/=cnt;b/=cnt;
  return{r,g,b,ok:r>20&&g>15&&b>8&&r<248&&g<248&&b<248};
}

// ─── Fallback ROIs ─────────────────────────────────────────────────────────────
const FALLBACK_ROIS:[number,number,number,number][] = [
  [0.20,0.08,0.80,0.50],
  [0.15,0.08,0.85,0.82],
  [0.25,0.28,0.75,0.68],
];
const ROI_LABELS=["FOREHEAD","FULL-FACE","CHEEKS"];

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement|null>,
  faceBoxRef?:     React.MutableRefObject<FaceBox|null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox|null>,
) {
  const cvRef    = useRef<HTMLCanvasElement|null>(null);
  const rafRef   = useRef<number>(0);

  // Timed raw sample buffer: [timestamp_ms, r, g, b]
  const rawBuf   = useRef<[number,number,number,number][]>([]);
  // Resampled fixed-rate buffers
  const resR     = useRef<number[]>([]);
  const resG     = useRef<number[]>([]);
  const resB     = useRef<number[]>([]);
  const lastResMs= useRef<number>(0);

  const bpmHist  = useRef<number[]>([]);
  const bpmRef   = useRef<number|null>(null);
  const frameRef = useRef<number>(0);
  const calRef   = useRef<number>(0);
  const fpsRef   = useRef<number>(30);
  const prevMsRef= useRef<number>(0);
  const roiIdxRef= useRef<number>(1);

  const [data,setData]=useState<HeartbeatData>({
    bpm:null,confidence:0,signal:[],isActive:false,
    stress:"low",trend:"stable",algorithm:"POS-rPPG",
    faceDetected:false,frameRate:30,calibrating:true,
  });

  const processFrame=useCallback(()=>{
    const video=videoRef.current;
    if(!video||!video.videoWidth){rafRef.current=requestAnimationFrame(processFrame);return;}

    const now=performance.now();
    if(prevMsRef.current>0){
      const dt=(now-prevMsRef.current)/1000;
      if(dt>0.001)fpsRef.current=fpsRef.current*.97+(1/dt)*.03;
    }
    prevMsRef.current=now;
    frameRef.current++;
    calRef.current++;

    if(!cvRef.current)cvRef.current=document.createElement("canvas");
    const cv=cvRef.current;
    const ctx=cv.getContext("2d",{willReadFrequently:true});
    if(!ctx){rafRef.current=requestAnimationFrame(processFrame);return;}
    const vw=video.videoWidth,vh=video.videoHeight;
    if(cv.width!==vw)cv.width=vw;
    if(cv.height!==vh)cv.height=vh;
    ctx.drawImage(video,0,0);

    // ── ROI selection (priority: forehead landmarks > face box > fallback) ──
    let roi:{r:number;g:number;b:number;ok:boolean};
    let roiLabel="SCANNING";

    const fhBox=foreheadBoxRef?.current;
    const faceBox=faceBoxRef?.current;

    if(fhBox&&fhBox.w>10&&fhBox.h>8){
      roi=sampleROI(ctx,fhBox.x,fhBox.y,fhBox.w,fhBox.h);
      roiLabel="LM-FOREHEAD";
    } else if(faceBox&&faceBox.w>30&&faceBox.h>30){
      // Estimate forehead: top 25%, centre 60%
      roi=sampleROI(ctx,faceBox.x+faceBox.w*.20,faceBox.y+faceBox.h*.04,faceBox.w*.60,faceBox.h*.28);
      roiLabel="BOX-FOREHEAD";
    } else {
      if(frameRef.current%30===1){
        let best=-Infinity,bestI=1;
        for(let i=0;i<FALLBACK_ROIS.length;i++){
          const[fx,fy,fw,fh]=FALLBACK_ROIS[i];
          const s=sampleROI(ctx,fx*vw,fy*vh,(fw-fx)*vw,(fh-fy)*vh);
          if(s.ok){const sc=-Math.abs(s.g-120);if(sc>best){best=sc;bestI=i;}}
        }
        roiIdxRef.current=bestI;
      }
      const[fx,fy,fw,fh]=FALLBACK_ROIS[roiIdxRef.current];
      roi=sampleROI(ctx,fx*vw,fy*vh,(fw-fx)*vw,(fh-fy)*vh);
      roiLabel=ROI_LABELS[roiIdxRef.current];
    }

    if(roi.ok){
      rawBuf.current.push([now,roi.r,roi.g,roi.b]);
      // Keep max 20s of raw data
      const maxMs=20000;
      while(rawBuf.current.length>2&&rawBuf.current[0][0]<now-maxMs)
        rawBuf.current.shift();
    }

    // ── Resample raw data to fixed TARGET_FS Hz ────────────────────────────
    // Fill one new 30Hz tick per target interval
    const targetInterval=1000/TARGET_FS;
    if(rawBuf.current.length>=2&&lastResMs.current===0)
      lastResMs.current=rawBuf.current[0][0];

    while(rawBuf.current.length>=2&&lastResMs.current+targetInterval<=now){
      const tTarget=lastResMs.current+targetInterval;
      // Find bracketing samples
      let lo=0;
      for(let i=0;i<rawBuf.current.length-1;i++){
        if(rawBuf.current[i][0]<=tTarget&&rawBuf.current[i+1][0]>=tTarget){lo=i;break;}
      }
      const s0=rawBuf.current[lo],s1=rawBuf.current[lo+1];
      const dt2=s1[0]-s0[0];
      const t=(dt2>0?(tTarget-s0[0])/dt2:0);
      resR.current.push(s0[1]*(1-t)+s1[1]*t);
      resG.current.push(s0[2]*(1-t)+s1[2]*t);
      resB.current.push(s0[3]*(1-t)+s1[3]*t);
      lastResMs.current=tTarget;

      // Keep exactly WIN_SIZE + extra for processing
      const maxN=WIN_SIZE+TARGET_FS*5;
      if(resR.current.length>maxN){
        resR.current.shift();resG.current.shift();resB.current.shift();
      }
    }

    // ── Run pipeline every 8 frames once we have enough data ──────────────
    if(frameRef.current%8===0&&resR.current.length>=WIN_SIZE&&calRef.current>=CAL_FRAMES){
      const R=resR.current.slice(-WIN_SIZE);
      const G=resG.current.slice(-WIN_SIZE);
      const B=resB.current.slice(-WIN_SIZE);

      // POS → detrend → bandpass 0.67–4.0 Hz @ TARGET_FS
      const pos=posSignal(R,G,B);
      const det=detrend(pos);
      const filtered=bp(det,0.67,4.0,TARGET_FS);
      const {bpm,snr}=estimateBPM(filtered,TARGET_FS);

      // Signal for display
      const s=std(filtered)||1;
      const sigDisplay=filtered.map(v=>v/s).slice(-80);

      if(snr>=SNR_MIN&&bpm>=HR_MIN_BPM&&bpm<=HR_MAX_BPM){
        const prev=bpmRef.current??bpm;
        if(Math.abs(bpm-prev)<=20||bpmRef.current===null){
          // Add to rolling median history
          bpmHist.current.push(bpm);
          if(bpmHist.current.length>SMOOTH_N)bpmHist.current.shift();
          const finalBpm=Math.round(median(bpmHist.current));
          bpmRef.current=Math.max(HR_MIN_BPM,Math.min(HR_MAX_BPM,finalBpm));
        }
      }

      const finalBpm=bpmRef.current;
      const stress:"low"|"medium"|"high"=
        finalBpm!=null?(finalBpm>100?"high":finalBpm>83?"medium":"low"):"low";

      setData(prev=>({
        bpm:         finalBpm,
        confidence:  snr>=SNR_MIN?Math.min(95,Math.round(((snr-SNR_MIN)/6)*95)):0,
        signal:      sigDisplay,
        isActive:    true,
        stress,
        trend:       (finalBpm!=null&&prev.bpm!=null)
                       ?(finalBpm>prev.bpm+3?"rising":finalBpm<prev.bpm-3?"falling":"stable")
                       :"stable",
        algorithm:   fhBox?"POS-LM":(faceBox?"POS-Box":"POS-Scan"),
        faceDetected: roi.ok,
        frameRate:   Math.round(fpsRef.current),
        calibrating: finalBpm===null,
        roiDebug:    roiLabel,
      }));

    } else if(frameRef.current%30===0){
      const remaining=Math.max(0,CAL_FRAMES-calRef.current);
      setData(prev=>({
        ...prev,
        isActive:    true,
        faceDetected: roi.ok,
        frameRate:   Math.round(fpsRef.current),
        calibrating: bpmRef.current===null,
        roiDebug:    roiLabel+(remaining>0?` (cal ${Math.round(remaining/TARGET_FS)}s)`:""),
      }));
    }

    rafRef.current=requestAnimationFrame(processFrame);
  },[videoRef,faceBoxRef,foreheadBoxRef]);

  const start=useCallback(()=>{
    rawBuf.current=[];resR.current=[];resG.current=[];resB.current=[];
    lastResMs.current=0;bpmHist.current=[];bpmRef.current=null;
    frameRef.current=0;calRef.current=0;fpsRef.current=30;
    prevMsRef.current=0;roiIdxRef.current=1;
    rafRef.current=requestAnimationFrame(processFrame);
  },[processFrame]);

  const stop=useCallback(()=>{
    cancelAnimationFrame(rafRef.current);
    setData(prev=>({...prev,isActive:false}));
  },[]);

  useEffect(()=>()=>cancelAnimationFrame(rafRef.current),[]);

  const panic=useCallback(()=>{
    bpmRef.current=116+Math.floor(Math.random()*18);calRef.current=999;
    bpmHist.current=[bpmRef.current];
    setData(prev=>({...prev,bpm:bpmRef.current,stress:"high",trend:"rising",confidence:87,calibrating:false}));
  },[]);
  const calm=useCallback(()=>{
    bpmRef.current=60+Math.floor(Math.random()*9);calRef.current=999;
    bpmHist.current=[bpmRef.current];
    setData(prev=>({...prev,bpm:bpmRef.current,stress:"low",trend:"falling",confidence:84,calibrating:false}));
  },[]);

  return{data,start,stop,panic,calm};
}
