/**
 * useFaceDetection — real face tracking using MediaPipe FaceDetector
 *
 * All assets are served from localhost — no external CDN:
 *   WASM runtime  → /mediapipe-wasm/  (copied from node_modules at build time)
 *   Model weights → /mediapipe-models/face_detector.tflite  (downloaded to public/)
 *
 * Falls back to native browser FaceDetector, then YCbCr skin-blob BFS.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

export interface FaceBox { x: number; y: number; w: number; h: number }
export interface FaceKeypoint { x: number; y: number }

export interface FaceDetectionData {
  detected: boolean;
  loading: boolean;
  box: FaceBox | null;
  keypoints: FaceKeypoint[];
  videoW: number;
  videoH: number;
}

// ── Fallback: YCbCr skin BFS (when MediaPipe not available) ──────────────────
const DS_W = 80, DS_H = 60;
function isSkin(r: number, g: number, b: number): boolean {
  const Y  =  0.299  * r + 0.587  * g + 0.114  * b;
  const Cb = -0.1687 * r - 0.3313 * g + 0.5    * b + 128;
  const Cr =  0.5    * r - 0.4187 * g - 0.0813 * b + 128;
  return Y > 35 && Y < 240 && Cb > 83 && Cb < 138 && Cr > 133 && Cr < 183;
}
const _dsCv  = typeof document !== "undefined" ? document.createElement("canvas") : null;
const _dsCtx = _dsCv?.getContext("2d", { willReadFrequently: true }) ?? null;

function skinFallback(srcCtx: CanvasRenderingContext2D, vw: number, vh: number): FaceBox | null {
  if (!_dsCv || !_dsCtx) return null;
  _dsCv.width = DS_W; _dsCv.height = DS_H;
  _dsCtx.drawImage(srcCtx.canvas, 0, 0, vw, vh, 0, 0, DS_W, DS_H);
  const px   = _dsCtx.getImageData(0, 0, DS_W, DS_H).data;
  const mask = new Uint8Array(DS_W * DS_H);
  for (let i = 0; i < mask.length; i++) mask[i] = isSkin(px[i*4], px[i*4+1], px[i*4+2]) ? 1 : 0;

  const visited = new Uint8Array(DS_W * DS_H);
  let best: { minX: number; minY: number; maxX: number; maxY: number; size: number } | null = null;
  const q: number[] = [];
  const x0 = Math.floor(DS_W * 0.18), x1 = Math.floor(DS_W * 0.82);
  const y0 = Math.floor(DS_H * 0.05), y1 = Math.floor(DS_H * 0.78);
  for (let sy = y0; sy < y1; sy++) {
    for (let sx = x0; sx < x1; sx++) {
      const idx = sy * DS_W + sx;
      if (!mask[idx] || visited[idx]) continue;
      q.length = 0; q.push(idx); visited[idx] = 1;
      let minX = sx, maxX = sx, minY = sy, maxY = sy, size = 0, head = 0;
      while (head < q.length) {
        const cur = q[head++];
        const cx = cur % DS_W, cy = (cur / DS_W) | 0;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        size++;
        for (const n of [cur-1, cur+1, cur-DS_W, cur+DS_W]) {
          if (n < 0 || n >= DS_W*DS_H) continue;
          const nx = n % DS_W;
          if (nx < 0 || nx >= DS_W) continue;
          if (!mask[n] || visited[n]) continue;
          visited[n] = 1; q.push(n);
        }
      }
      const bw = maxX-minX+1, bh = maxY-minY+1, ratio = bh/(bw||1);
      if (size >= (x1-x0)*(y1-y0)*0.018 && ratio > 0.65 && ratio < 2.8) {
        if (!best || size > best.size) best = { minX, minY, maxX, maxY, size };
      }
    }
  }
  if (!best) return null;
  const scX = vw/DS_W, scY = vh/DS_H;
  const px2 = Math.round((best.maxX-best.minX)*scX*0.05);
  const py2 = Math.round((best.maxY-best.minY)*scY*0.05);
  const x = Math.max(0, Math.round(best.minX*scX)-px2);
  const y = Math.max(0, Math.round(best.minY*scY)-py2);
  const x2 = Math.min(vw, Math.round(best.maxX*scX)+px2);
  const y2 = Math.min(vh, Math.round(best.maxY*scY)+py2);
  const w = x2-x, h = y2-y;
  return (w > 30 && h > 30) ? { x, y, w, h } : null;
}

function smoothBox(prev: FaceBox | null, next: FaceBox, alpha: number): FaceBox {
  if (!prev) return next;
  return { x: prev.x*(1-alpha)+next.x*alpha, y: prev.y*(1-alpha)+next.y*alpha,
           w: prev.w*(1-alpha)+next.w*alpha, h: prev.h*(1-alpha)+next.h*alpha };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useFaceDetection(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const cvRef       = useRef<HTMLCanvasElement | null>(null);
  const ctxRef      = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef      = useRef<number>(0);
  const mpRef       = useRef<FaceDetector | null>(null);
  const nativeRef   = useRef<unknown>(null);
  const smoothed    = useRef<FaceBox | null>(null);
  const miss        = useRef(0);
  const modeRef     = useRef<"loading"|"mediapipe"|"native"|"skin">("loading");

  const [data, setData] = useState<FaceDetectionData>({
    detected: false, loading: true, box: null, keypoints: [], videoW: 0, videoH: 0,
  });

  // ── Init: try MediaPipe from local files → native browser → skin ──────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // BASE_URL includes trailing slash, public files are at e.g. /holo-sync/mediapipe-wasm/
        const base = import.meta.env.BASE_URL ?? "/";
        const wasmPath  = base + "mediapipe-wasm";
        const modelPath = window.location.origin + base + "mediapipe-models/face_detector.tflite";

        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        const det = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.4,
          minSuppressionThreshold: 0.3,
        });
        if (cancelled) { det.close(); return; }
        mpRef.current  = det;
        modeRef.current = "mediapipe";
        console.info("[FaceDetection] MediaPipe loaded from localhost ✓");
      } catch (e) {
        console.warn("[FaceDetection] MediaPipe failed:", e);
        // Try native browser FaceDetector
        if ("FaceDetector" in window) {
          try {
            // @ts-expect-error — experimental browser API
            nativeRef.current = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: false });
            modeRef.current = "native";
            console.info("[FaceDetection] Using native browser FaceDetector ✓");
          } catch {
            modeRef.current = "skin";
          }
        } else {
          modeRef.current = "skin";
          console.info("[FaceDetection] Using skin-colour fallback");
        }
      }
      if (!cancelled) setData(prev => ({ ...prev, loading: false }));
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Detection loop ─────────────────────────────────────────────────────────
  const loop = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      rafRef.current = requestAnimationFrame(loop); return;
    }
    const vw = video.videoWidth, vh = video.videoHeight;

    // Lazy hidden canvas
    if (!cvRef.current) {
      cvRef.current = document.createElement("canvas");
      ctxRef.current = cvRef.current.getContext("2d", { willReadFrequently: true });
    }
    const cv = cvRef.current, ctx = ctxRef.current;
    if (!cv || !ctx) { rafRef.current = requestAnimationFrame(loop); return; }
    if (cv.width !== vw) cv.width = vw;
    if (cv.height !== vh) cv.height = vh;
    ctx.drawImage(video, 0, 0);

    let rawBox: FaceBox | null = null;
    let keypoints: FaceKeypoint[] = [];

    if (modeRef.current === "mediapipe" && mpRef.current) {
      try {
        const r = mpRef.current.detectForVideo(video, performance.now());
        const d = r.detections?.[0];
        if (d?.boundingBox) {
          const bb = d.boundingBox;
          rawBox = { x: Math.max(0,bb.originX), y: Math.max(0,bb.originY),
                     w: Math.min(vw-bb.originX, bb.width), h: Math.min(vh-bb.originY, bb.height) };
          keypoints = (d.keypoints ?? []).map(k => ({ x: k.x*vw, y: k.y*vh }));
        }
      } catch { modeRef.current = "skin"; }

    } else if (modeRef.current === "native" && nativeRef.current) {
      try {
        // @ts-expect-error
        const r = await nativeRef.current.detect(video);
        if (r.length > 0) {
          const f = r[0];
          rawBox = { x: f.boundingBox.x, y: f.boundingBox.y, w: f.boundingBox.width, h: f.boundingBox.height };
          keypoints = (f.landmarks ?? []).map((lm: {locations:{x:number;y:number}[]}) => lm.locations?.[0] ?? {x:0,y:0});
        }
      } catch { modeRef.current = "skin"; }

    } else if (modeRef.current === "skin") {
      rawBox = skinFallback(ctx, vw, vh);
    }

    // Smooth + miss handling
    if (rawBox) {
      miss.current = 0;
      smoothed.current = smoothBox(smoothed.current, rawBox, 0.3);
    } else {
      miss.current++;
      if (miss.current > 12) smoothed.current = null;
    }

    setData({ detected: smoothed.current !== null, loading: false,
              box: smoothed.current, keypoints, videoW: vw, videoH: vh });

    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (!data.loading) rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data.loading, loop]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    mpRef.current?.close();
  }, []);

  return data;
}
