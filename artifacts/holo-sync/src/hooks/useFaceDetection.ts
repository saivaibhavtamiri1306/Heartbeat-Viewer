/**
 * useFaceDetection — face tracking
 *
 * Tier 1: window.FaceDetector (Chrome native, zero CDN)
 * Tier 2: YCbCr skin BFS — finds the largest CONTIGUOUS skin blob in the
 *         central face region (not all skin in frame), constrained to
 *         face-shaped proportions. Gives a tight, face-sized box.
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

// ── Downsampled resolution for fast processing ────────────────────────────────
const DS_W = 80, DS_H = 60;

// ── YCbCr skin check (robust across skin tones & lighting) ───────────────────
function isSkin(r: number, g: number, b: number): boolean {
  const Y  =  0.299  * r + 0.587  * g + 0.114  * b;
  const Cb = -0.1687 * r - 0.3313 * g + 0.5    * b + 128;
  const Cr =  0.5    * r - 0.4187 * g - 0.0813 * b + 128;
  return Y > 35 && Y < 240 && Cb > 83 && Cb < 138 && Cr > 133 && Cr < 183;
}

// ── BFS connected-component: finds the largest skin blob near the frame center ─
function findFaceBlob(
  mask: Uint8Array,   // DS_W × DS_H skin mask (1 = skin, 0 = not)
): { minX: number; minY: number; maxX: number; maxY: number; size: number } | null {
  const visited = new Uint8Array(DS_W * DS_H);
  let bestBlob: { minX: number; minY: number; maxX: number; maxY: number; size: number } | null = null;

  // Only seed BFS from the CENTRAL face zone:
  //   x: 20-80%, y: 5-75% of downsampled frame
  const x0 = Math.floor(DS_W * 0.20), x1 = Math.floor(DS_W * 0.80);
  const y0 = Math.floor(DS_H * 0.05), y1 = Math.floor(DS_H * 0.75);

  const queue: number[] = [];

  for (let sy = y0; sy < y1; sy++) {
    for (let sx = x0; sx < x1; sx++) {
      const idx = sy * DS_W + sx;
      if (!mask[idx] || visited[idx]) continue;

      // BFS from this seed
      queue.length = 0;
      queue.push(idx);
      visited[idx] = 1;
      let minX = sx, maxX = sx, minY = sy, maxY = sy, size = 0;

      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        const cx = cur % DS_W, cy = (cur / DS_W) | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        size++;

        // 4-connectivity neighbours
        const neighbours = [cur - 1, cur + 1, cur - DS_W, cur + DS_W];
        for (const n of neighbours) {
          if (n < 0 || n >= DS_W * DS_H) continue;
          const nx = n % DS_W, ny = (n / DS_W) | 0;
          if (nx < 0 || nx >= DS_W || ny < 0 || ny >= DS_H) continue;
          if (!mask[n] || visited[n]) continue;
          visited[n] = 1;
          queue.push(n);
        }
      }

      // Must be at least 2% of the search area, and face-shaped (h/w in 0.8–2.5)
      const blobW = maxX - minX + 1, blobH = maxY - minY + 1;
      const ratio = blobH / (blobW || 1);
      const minArea = (x1 - x0) * (y1 - y0) * 0.02;
      if (size >= minArea && ratio > 0.7 && ratio < 2.6) {
        if (!bestBlob || size > bestBlob.size) {
          bestBlob = { minX, minY, maxX, maxY, size };
        }
      }
    }
  }

  return bestBlob;
}

// ── Build skin mask from hidden canvas pixel data ─────────────────────────────
const _dsCv  = typeof document !== "undefined" ? document.createElement("canvas") : null as unknown as HTMLCanvasElement;
const _dsCtx = _dsCv?.getContext("2d", { willReadFrequently: true }) ?? null as unknown as CanvasRenderingContext2D;

function skinFaceDetect(
  srcCtx: CanvasRenderingContext2D,
  vw: number, vh: number
): FaceBox | null {
  if (!_dsCv || !_dsCtx) return null;
  _dsCv.width = DS_W; _dsCv.height = DS_H;
  _dsCtx.drawImage(srcCtx.canvas, 0, 0, vw, vh, 0, 0, DS_W, DS_H);
  const px = _dsCtx.getImageData(0, 0, DS_W, DS_H).data;

  // Build binary mask
  const mask = new Uint8Array(DS_W * DS_H);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = isSkin(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) ? 1 : 0;
  }

  const blob = findFaceBlob(mask);
  if (!blob) return null;

  // Scale back to original video pixel coords
  const scX = vw / DS_W, scY = vh / DS_H;

  // Add a small padding (~8% of blob size) for a natural-looking box
  const padX = Math.round((blob.maxX - blob.minX) * scX * 0.06);
  const padY = Math.round((blob.maxY - blob.minY) * scY * 0.06);

  const x = Math.max(0, Math.round(blob.minX * scX) - padX);
  const y = Math.max(0, Math.round(blob.minY * scY) - padY);
  const x2 = Math.min(vw, Math.round(blob.maxX * scX) + padX);
  const y2 = Math.min(vh, Math.round(blob.maxY * scY) + padY);

  const w = x2 - x, h = y2 - y;
  if (w < 30 || h < 30) return null;
  return { x, y, w, h };
}

// ── Smooth with EMA to prevent jitter ────────────────────────────────────────
function smoothBox(prev: FaceBox | null, next: FaceBox, alpha: number): FaceBox {
  if (!prev) return next;
  return {
    x: prev.x * (1 - alpha) + next.x * alpha,
    y: prev.y * (1 - alpha) + next.y * alpha,
    w: prev.w * (1 - alpha) + next.w * alpha,
    h: prev.h * (1 - alpha) + next.h * alpha,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  const cvRef       = useRef<HTMLCanvasElement | null>(null);
  const ctxRef      = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef      = useRef<number>(0);
  const nativeDet   = useRef<unknown>(null);
  const smoothedBox = useRef<FaceBox | null>(null);
  const missFrames  = useRef<number>(0);

  const [data, setData] = useState<FaceDetectionData>({
    detected: false, loading: true,
    box: null, keypoints: [],
    videoW: 0, videoH: 0,
  });

  // Try native browser FaceDetector
  useEffect(() => {
    if ("FaceDetector" in window) {
      try {
        // @ts-expect-error – experimental browser API
        nativeDet.current = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: false });
      } catch { /* not available */ }
    }
    setData(prev => ({ ...prev, loading: false }));
  }, []);

  const loop = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const vw = video.videoWidth, vh = video.videoHeight;

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

    // Tier 1: native browser FaceDetector
    if (nativeDet.current) {
      try {
        // @ts-expect-error
        const results = await nativeDet.current.detect(video);
        if (results.length > 0) {
          const f = results[0];
          rawBox = { x: f.boundingBox.x, y: f.boundingBox.y, w: f.boundingBox.width, h: f.boundingBox.height };
          keypoints = (f.landmarks ?? []).map((lm: { locations: { x: number; y: number }[] }) => lm.locations?.[0] ?? { x: 0, y: 0 });
        }
      } catch { nativeDet.current = null; }
    }

    // Tier 2: YCbCr skin blob (precise face-blob BFS)
    if (!rawBox) rawBox = skinFaceDetect(ctx, vw, vh);

    // Smooth & miss-frame handling
    if (rawBox) {
      missFrames.current = 0;
      smoothedBox.current = smoothBox(smoothedBox.current, rawBox, 0.3);
    } else {
      missFrames.current++;
      if (missFrames.current > 15) smoothedBox.current = null;
    }

    const box = smoothedBox.current;
    setData({ detected: box !== null, loading: false, box, keypoints, videoW: vw, videoH: vh });

    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (!data.loading) rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data.loading, loop]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return data;
}
