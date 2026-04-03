/**
 * useFaceDetection — MediaPipe FaceDetector in the browser
 *
 * Provides:
 *  - faceBox: { x, y, w, h } in original (non-mirrored) pixel coords
 *  - keypoints: 6 facial landmarks [rightEye, leftEye, noseTip, mouth, rightEar, leftEar]
 *    in original pixel coords
 *  - detected: true when a face is found
 *  - loading: true while model is initialising
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

// CDN WASM path
const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  const detectorRef = useRef<FaceDetector | null>(null);
  const rafRef      = useRef<number>(0);
  const lastTs      = useRef<number>(-1);

  const [data, setData] = useState<FaceDetectionData>({
    detected: false, loading: true,
    box: null, keypoints: [],
    videoW: 0, videoH: 0,
  });

  // ── Initialise MediaPipe FaceDetector ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        const det = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
          minSuppressionThreshold: 0.3,
        });
        if (cancelled) { det.close(); return; }
        detectorRef.current = det;
        setData(prev => ({ ...prev, loading: false }));
      } catch (e) {
        console.warn("[FaceDetector] init failed:", e);
        if (!cancelled) setData(prev => ({ ...prev, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Continuous detection loop ────────────────────────────────────────────
  const loop = useCallback(() => {
    const video = videoRef.current;
    const det   = detectorRef.current;
    if (!video || !det || !video.videoWidth || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const ts = performance.now();
    if (ts === lastTs.current) { rafRef.current = requestAnimationFrame(loop); return; }
    lastTs.current = ts;

    const vw = video.videoWidth, vh = video.videoHeight;

    try {
      const result = det.detectForVideo(video, ts);
      const det0   = result.detections?.[0];

      if (det0?.boundingBox) {
        const bb = det0.boundingBox;
        // Clamp to frame bounds
        const x = Math.max(0, bb.originX);
        const y = Math.max(0, bb.originY);
        const w = Math.min(vw - x, bb.width);
        const h = Math.min(vh - y, bb.height);

        // Keypoints are normalised [0,1] → convert to pixel coords
        const kps: FaceKeypoint[] = (det0.keypoints ?? []).map(k => ({
          x: k.x * vw,
          y: k.y * vh,
        }));

        setData({ detected: true, loading: false, box: { x, y, w, h }, keypoints: kps, videoW: vw, videoH: vh });
      } else {
        setData(prev => ({ ...prev, detected: false, box: null, keypoints: [], videoW: vw, videoH: vh }));
      }
    } catch {
      // ignore frame errors
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    if (!data.loading) {
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [data.loading, loop]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    detectorRef.current?.close();
  }, []);

  return data;
}
