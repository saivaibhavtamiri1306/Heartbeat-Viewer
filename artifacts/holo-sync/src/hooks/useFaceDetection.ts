/**
 * useFaceDetection — MediaPipe FaceLandmarker (478 landmarks, local WASM)
 *
 * Tier 1: FaceLandmarker — 478 precise landmarks, forehead/cheek ROI
 * Tier 2: FaceDetector  — bounding box only
 * Tier 3: YCbCr BFS     — fully offline fallback
 *
 * All assets served from localhost — no external CDN requests.
 *   WASM  → /mediapipe-wasm/
 *   Model → /mediapipe-models/face_landmarker.task
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { FaceLandmarker, FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

export interface FaceBox { x: number; y: number; w: number; h: number }
export interface FaceKeypoint { x: number; y: number }

export interface FaceDetectionData {
  detected: boolean;
  loading: boolean;
  box: FaceBox | null;         // Tight face oval box
  foreheadBox: FaceBox | null; // Forehead-only ROI for rPPG
  cheekBox: FaceBox | null;    // Cheek ROI (fallback rPPG)
  keypoints: FaceKeypoint[];
  videoW: number;
  videoH: number;
}

// ── MediaPipe face oval landmark indices ─────────────────────────────────────
const FACE_OVAL = [
  10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,
  400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109
];

// Forehead landmarks (above eyebrows, below hairline)
const FOREHEAD_LM = [10,338,297,332,284,9,8,107,66,105,63,70,46,53,52,65,55,193,168,6,197,195];

// Cheek landmarks (left + right)
const CHEEK_L = [234,93,132,58,172,136,150,149];
const CHEEK_R = [454,323,361,288,397,365,379,378];

// Key display keypoints (eyes, nose, mouth corners)
const DISPLAY_KP = [33, 133, 362, 263, 1, 61, 291, 199, 4];

// ── YCbCr skin-blob BFS fallback ─────────────────────────────────────────────
const DS_W = 80, DS_H = 60;
function isSkin(r: number, g: number, b: number): boolean {
  const Y  =  0.299*r + 0.587*g + 0.114*b;
  const Cb = -0.1687*r - 0.3313*g + 0.5*b + 128;
  const Cr =  0.5*r - 0.4187*g - 0.0813*b + 128;
  return Y>35 && Y<240 && Cb>83 && Cb<138 && Cr>133 && Cr<183;
}
const _dsCv  = typeof document !== "undefined" ? document.createElement("canvas") : null;
const _dsCtx = _dsCv?.getContext("2d", { willReadFrequently: true }) ?? null;

function skinFallback(srcCtx: CanvasRenderingContext2D, vw: number, vh: number): FaceBox | null {
  if (!_dsCv || !_dsCtx) return null;
  _dsCv.width=DS_W; _dsCv.height=DS_H;
  _dsCtx.drawImage(srcCtx.canvas,0,0,vw,vh,0,0,DS_W,DS_H);
  const px = _dsCtx.getImageData(0,0,DS_W,DS_H).data;
  const mask = new Uint8Array(DS_W*DS_H);
  for (let i=0;i<mask.length;i++) mask[i]=isSkin(px[i*4],px[i*4+1],px[i*4+2])?1:0;
  const vis=new Uint8Array(DS_W*DS_H);
  let best: {minX:number;minY:number;maxX:number;maxY:number;size:number}|null=null;
  const q:number[]=[];
  const x0=Math.floor(DS_W*.18),x1=Math.floor(DS_W*.82);
  const y0=Math.floor(DS_H*.05),y1=Math.floor(DS_H*.78);
  for (let sy=y0;sy<y1;sy++) for (let sx=x0;sx<x1;sx++) {
    const idx=sy*DS_W+sx;
    if (!mask[idx]||vis[idx]) continue;
    q.length=0;q.push(idx);vis[idx]=1;
    let minX=sx,maxX=sx,minY=sy,maxY=sy,size=0,head=0;
    while (head<q.length) {
      const cur=q[head++],cx=cur%DS_W,cy=(cur/DS_W)|0;
      if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;size++;
      for (const n of [cur-1,cur+1,cur-DS_W,cur+DS_W]) {
        if(n<0||n>=DS_W*DS_H||!mask[n]||vis[n])continue;vis[n]=1;q.push(n);
      }
    }
    const bw=maxX-minX+1,bh=maxY-minY+1,ratio=bh/(bw||1);
    if(size>=(x1-x0)*(y1-y0)*.018&&ratio>.65&&ratio<2.8)
      if(!best||size>best.size) best={minX,minY,maxX,maxY,size};
  }
  if(!best) return null;
  const scX=vw/DS_W,scY=vh/DS_H;
  const px2=Math.round((best.maxX-best.minX)*scX*.06);
  const py2=Math.round((best.maxY-best.minY)*scY*.06);
  const x=Math.max(0,Math.round(best.minX*scX)-px2);
  const y=Math.max(0,Math.round(best.minY*scY)-py2);
  const x2=Math.min(vw,Math.round(best.maxX*scX)+px2);
  const y2=Math.min(vh,Math.round(best.maxY*scY)+py2);
  const w=x2-x,h=y2-y;
  return(w>30&&h>30)?{x,y,w,h}:null;
}

function smoothBox(prev: FaceBox|null, next: FaceBox, alpha: number): FaceBox {
  if (!prev) return next;
  return {x:prev.x*(1-alpha)+next.x*alpha,y:prev.y*(1-alpha)+next.y*alpha,
          w:prev.w*(1-alpha)+next.w*alpha,h:prev.h*(1-alpha)+next.h*alpha};
}

function lmBox(lms: {x:number;y:number;z:number}[], indices: number[], vw:number, vh:number, padX=0, padY=0): FaceBox|null {
  const pts = indices.map(i=>lms[i]).filter(Boolean);
  if (!pts.length) return null;
  const xs=pts.map(p=>p.x*vw), ys=pts.map(p=>p.y*vh);
  const x=Math.max(0,Math.min(...xs)-padX), y=Math.max(0,Math.min(...ys)-padY);
  const x2=Math.min(vw,Math.max(...xs)+padX), y2=Math.min(vh,Math.max(...ys)+padY);
  return {x,y,w:x2-x,h:y2-y};
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useFaceDetection(videoRef: React.RefObject<HTMLVideoElement|null>) {
  const cvRef      = useRef<HTMLCanvasElement|null>(null);
  const ctxRef     = useRef<CanvasRenderingContext2D|null>(null);
  const rafRef     = useRef<number>(0);
  const lmRef      = useRef<FaceLandmarker|null>(null);
  const detRef     = useRef<FaceDetector|null>(null);
  const nativeRef  = useRef<unknown>(null);
  const modeRef    = useRef<"loading"|"landmark"|"detector"|"native"|"skin">("loading");
  const smoothed   = useRef<FaceBox|null>(null);
  const sFore      = useRef<FaceBox|null>(null);
  const sCheek     = useRef<FaceBox|null>(null);
  const miss       = useRef(0);

  const [data, setData] = useState<FaceDetectionData>({
    detected:false,loading:true,box:null,foreheadBox:null,cheekBox:null,keypoints:[],videoW:0,videoH:0
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = import.meta.env.BASE_URL ?? "/";
      const wasmPath  = base + "mediapipe-wasm";
      const modelBase = window.location.origin + base + "mediapipe-models/";

      try {
        const vision = await FilesetResolver.forVisionTasks(wasmPath);

        // Try FaceLandmarker first (full 478 landmarks)
        try {
          const lm = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: modelBase + "face_landmarker.task", delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.4,
            minFacePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          });
          if (cancelled) { lm.close(); return; }
          lmRef.current = lm; modeRef.current = "landmark";
          console.info("[FaceDetection] FaceLandmarker loaded ✓ (478 landmarks)");
        } catch {
          // Fall back to FaceDetector
          const det = await FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: modelBase + "face_detector.tflite", delegate: "GPU" },
            runningMode: "VIDEO", minDetectionConfidence: 0.4, minSuppressionThreshold: 0.3,
          });
          if (cancelled) { det.close(); return; }
          detRef.current = det; modeRef.current = "detector";
          console.info("[FaceDetection] FaceDetector loaded ✓");
        }
      } catch {
        if ("FaceDetector" in window) {
          try {
            // @ts-expect-error
            nativeRef.current = new window.FaceDetector({ maxDetectedFaces:1, fastMode:false });
            modeRef.current = "native";
          } catch { modeRef.current = "skin"; }
        } else { modeRef.current = "skin"; }
        console.warn("[FaceDetection] Using fallback mode:", modeRef.current);
      }
      if (!cancelled) setData(prev=>({...prev,loading:false}));
    })();
    return () => { cancelled=true; };
  }, []);

  const loop = useCallback(async () => {
    const video = videoRef.current;
    if (!video||video.readyState<2||!video.videoWidth) {
      rafRef.current=requestAnimationFrame(loop); return;
    }
    const vw=video.videoWidth, vh=video.videoHeight;
    if (!cvRef.current) {
      cvRef.current=document.createElement("canvas");
      ctxRef.current=cvRef.current.getContext("2d",{willReadFrequently:true});
    }
    const cv=cvRef.current, ctx=ctxRef.current;
    if (!cv||!ctx) { rafRef.current=requestAnimationFrame(loop); return; }
    if (cv.width!==vw) cv.width=vw;
    if (cv.height!==vh) cv.height=vh;
    ctx.drawImage(video,0,0);

    let rawBox:FaceBox|null=null;
    let rawFore:FaceBox|null=null;
    let rawCheek:FaceBox|null=null;
    let keypoints:FaceKeypoint[]=[];
    const ts=performance.now();

    if (modeRef.current==="landmark" && lmRef.current) {
      try {
        const r = lmRef.current.detectForVideo(video, ts);
        const face = r.faceLandmarks?.[0];
        if (face && face.length > 0) {
          rawBox  = lmBox(face, FACE_OVAL, vw, vh, 5, 5);
          rawFore = lmBox(face, FOREHEAD_LM, vw, vh, 4, 6);
          const cheekL = lmBox(face, CHEEK_L, vw, vh, 5, 5);
          const cheekR = lmBox(face, CHEEK_R, vw, vh, 5, 5);
          rawCheek = cheekL && cheekR ? {
            x:Math.min(cheekL.x,cheekR.x), y:Math.min(cheekL.y,cheekR.y),
            w:Math.max(cheekL.x+cheekL.w,cheekR.x+cheekR.w)-Math.min(cheekL.x,cheekR.x),
            h:Math.max(cheekL.y+cheekL.h,cheekR.y+cheekR.h)-Math.min(cheekL.y,cheekR.y),
          } : (cheekL ?? cheekR);
          keypoints = DISPLAY_KP.map(i => ({ x: face[i].x*vw, y: face[i].y*vh }));
        }
      } catch { modeRef.current="skin"; }

    } else if (modeRef.current==="detector" && detRef.current) {
      try {
        const r = detRef.current.detectForVideo(video, ts);
        const d = r.detections?.[0];
        if (d?.boundingBox) {
          const bb=d.boundingBox;
          rawBox={x:Math.max(0,bb.originX),y:Math.max(0,bb.originY),
                  w:Math.min(vw-bb.originX,bb.width),h:Math.min(vh-bb.originY,bb.height)};
          keypoints=(d.keypoints??[]).map(k=>({x:k.x*vw,y:k.y*vh}));
          // Estimate forehead from face box
          if (rawBox) rawFore={x:rawBox.x+rawBox.w*.15,y:rawBox.y+rawBox.h*.04,
                                w:rawBox.w*.70,h:rawBox.h*.28};
        }
      } catch { modeRef.current="skin"; }

    } else if (modeRef.current==="native" && nativeRef.current) {
      try {
        // @ts-expect-error
        const r = await nativeRef.current.detect(video);
        if (r.length>0) {
          const f=r[0];
          rawBox={x:f.boundingBox.x,y:f.boundingBox.y,w:f.boundingBox.width,h:f.boundingBox.height};
          if (rawBox) rawFore={x:rawBox.x+rawBox.w*.15,y:rawBox.y+rawBox.h*.04,
                                w:rawBox.w*.70,h:rawBox.h*.28};
        }
      } catch { modeRef.current="skin"; }

    } else if (modeRef.current==="skin") {
      rawBox=skinFallback(ctx,vw,vh);
      if (rawBox) rawFore={x:rawBox.x+rawBox.w*.15,y:rawBox.y+rawBox.h*.04,
                            w:rawBox.w*.70,h:rawBox.h*.28};
    }

    if (rawBox) {
      miss.current=0;
      smoothed.current=smoothBox(smoothed.current,rawBox,.3);
      if (rawFore)  sFore.current=smoothBox(sFore.current,rawFore,.3);
      if (rawCheek) sCheek.current=smoothBox(sCheek.current,rawCheek,.3);
    } else {
      miss.current++;
      if (miss.current>12) { smoothed.current=null; sFore.current=null; sCheek.current=null; }
    }

    setData({detected:smoothed.current!==null,loading:false,
             box:smoothed.current,foreheadBox:sFore.current,cheekBox:sCheek.current,
             keypoints,videoW:vw,videoH:vh});

    rafRef.current=requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (!data.loading) rafRef.current=requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data.loading, loop]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    lmRef.current?.close();
    detRef.current?.close();
  }, []);

  return data;
}
