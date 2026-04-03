/**
 * useFaceDetection — face tracking using the browser's built-in FaceDetector API.
 *
 * Tier 1: window.FaceDetector (Chrome native, zero CDN, instant load)
 * Tier 2: Skin-colour blob detector on a 160×120 downsampled canvas (fallback)
 *
 * Returns face bounding box + eye keypoints in original video pixel coords.
 * The webcam video has CSS scaleX(-1) applied, so the caller must mirror coords.
 */
import { useRef, useState, useEffect, useCallback } from "react";

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

// ─── Tier 2: fast skin-colour blob detector ──────────────────────────────────
// Runs on a 160×120 downsampled canvas — cheap enough to run every frame.
const DS_W = 160, DS_H = 120;

function isSkin(r: number, g: number, b: number): boolean {
  // YCbCr skin rule (standard for all lighting & skin tones)
  const Y  =  0.299  * r + 0.587  * g + 0.114  * b;
  const Cb = -0.1687 * r - 0.3313 * g + 0.5    * b + 128;
  const Cr =  0.5    * r - 0.4187 * g - 0.0813 * b + 128;
  return (
    Y  > 40 && Y  < 235 &&
    Cb > 85 && Cb < 135 &&
    Cr > 135 && Cr < 180
  );
}

function skinBlobDetect(
  ctx: CanvasRenderingContext2D,
  vw: number, vh: number
): FaceBox | null {
  const dsCtx = skinBlobDetect._dsCtx;
  const dsCV  = skinBlobDetect._dsCv;
  if (!dsCtx || !dsCV) return null;

  dsCV.width = DS_W; dsCV.height = DS_H;
  dsCtx.drawImage(ctx.canvas, 0, 0, vw, vh, 0, 0, DS_W, DS_H);
  const px = dsCtx.getImageData(0, 0, DS_W, DS_H).data;

  let minX = DS_W, maxX = 0, minY = DS_H, maxY = 0, cnt = 0;
  for (let py = 0; py < DS_H; py++) {
    for (let px2 = 0; px2 < DS_W; px2++) {
      const i = (py * DS_W + px2) * 4;
      if (isSkin(px[i], px[i + 1], px[i + 2])) {
        if (px2 < minX) minX = px2;
        if (px2 > maxX) maxX = px2;
        if (py  < minY) minY = py;
        if (py  > maxY) maxY = py;
        cnt++;
      }
    }
  }

  // Need at least 4% of frame to be skin-coloured
  if (cnt < DS_W * DS_H * 0.04) return null;

  // Scale back to original video coordinates
  const scX = vw / DS_W, scY = vh / DS_H;
  const pad = Math.round(Math.min(scX, scY) * 3);
  const x = Math.max(0, Math.round(minX * scX) - pad);
  const y = Math.max(0, Math.round(minY * scY) - pad);
  const x2 = Math.min(vw, Math.round(maxX * scX) + pad);
  const y2 = Math.min(vh, Math.round(maxY * scY) + pad);
  const w = x2 - x, h = y2 - y;
  if (w < 40 || h < 40) return null;
  return { x, y, w, h };
}
skinBlobDetect._dsCv  = typeof document !== "undefined" ? document.createElement("canvas") : null as unknown as HTMLCanvasElement;
skinBlobDetect._dsCtx = skinBlobDetect._dsCv?.getContext("2d", { willReadFrequently: true }) ?? null as unknown as CanvasRenderingContext2D;

// ─── Smooth face box with exponential moving average ─────────────────────────
function smoothBox(
  prev: FaceBox | null, next: FaceBox, alpha: number
): FaceBox {
  if (!prev) return next;
  return {
    x: prev.x * (1 - alpha) + next.x * alpha,
    y: prev.y * (1 - alpha) + next.y * alpha,
    w: prev.w * (1 - alpha) + next.w * alpha,
    h: prev.h * (1 - alpha) + next.h * alpha,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  // Hidden canvas for pixel reads
  const cvRef       = useRef<HTMLCanvasElement | null>(null);
  const ctxRef      = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef      = useRef<number>(0);
  const nativeDet   = useRef<FaceDetector | null>(null);
  const smoothedBox = useRef<FaceBox | null>(null);
  const missFrames  = useRef<number>(0);

  const [data, setData] = useState<FaceDetectionData>({
    detected: false, loading: true,
    box: null, keypoints: [],
    videoW: 0, videoH: 0,
  });

  // ── Init: try native FaceDetector ─────────────────────────────────────────
  useEffect(() => {
    if ("FaceDetector" in window) {
      try {
        // @ts-expect-error — FaceDetector is a browser API, not in TS lib yet
        nativeDet.current = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: false });
        console.info("[FaceDetection] Using native browser FaceDetector ✓");
      } catch {
        console.info("[FaceDetection] Native FaceDetector unavailable, using skin-colour fallback");
      }
    } else {
      console.info("[FaceDetection] FaceDetector API not available, using skin-colour fallback");
    }
    setData(prev => ({ ...prev, loading: false }));
  }, []);

  // ── Detection loop ─────────────────────────────────────────────────────────
  const loop = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const vw = video.videoWidth, vh = video.videoHeight;

    // Lazy canvas init
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

    // ── Tier 1: native browser FaceDetector ──────────────────────────────────
    if (nativeDet.current) {
      try {
        // @ts-expect-error
        const results: FaceDetectorResult[] = await nativeDet.current.detect(video);
        if (results.length > 0) {
          const f = results[0];
          rawBox = {
            x: f.boundingBox.x,
            y: f.boundingBox.y,
            w: f.boundingBox.width,
            h: f.boundingBox.height,
          };
          // Landmarks: { x, y } in image pixels
          keypoints = (f.landmarks ?? []).map((lm: { locations: { x: number; y: number }[] }) =>
            lm.locations?.[0] ?? { x: 0, y: 0 }
          );
        }
      } catch {
        nativeDet.current = null;   // disable if it errors
      }
    }

    // ── Tier 2: skin-colour blob fallback ────────────────────────────────────
    if (!rawBox) {
      rawBox = skinBlobDetect(ctx, vw, vh);
    }

    // ── Smoothing + miss-frame decay ──────────────────────────────────────────
    if (rawBox) {
      missFrames.current = 0;
      smoothedBox.current = smoothBox(smoothedBox.current, rawBox, 0.35);
    } else {
      missFrames.current++;
      // Keep the last box for up to 10 missed frames (handles blinks / occlusion)
      if (missFrames.current > 10) smoothedBox.current = null;
    }

    const box = smoothedBox.current;
    setData({
      detected: box !== null,
      loading:  false,
      box,
      keypoints,
      videoW: vw,
      videoH: vh,
    });

    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (!data.loading) {
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [data.loading, loop]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return data;
}
