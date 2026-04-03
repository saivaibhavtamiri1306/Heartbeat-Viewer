import { useRef, useState, useEffect } from "react";
import type { FaceDetectionData } from "./useFaceDetection";

export interface EyeContactData {
  isLooking: boolean;
  score: number;
  totalLookTime: number;
  totalTime: number;
  percentage: number;
}

export function useEyeContact(face: FaceDetectionData): EyeContactData {
  const [data, setData] = useState<EyeContactData>({
    isLooking: false,
    score: 0,
    totalLookTime: 0,
    totalTime: 0,
    percentage: 0,
  });

  const lookFrames = useRef(0);
  const totalFrames = useRef(0);
  const startTime = useRef(Date.now());
  const lastSetState = useRef(0);
  const faceRef = useRef(face);
  faceRef.current = face;

  useEffect(() => {
    const interval = setInterval(() => {
      const f = faceRef.current;
      totalFrames.current++;
      const now = Date.now();
      const totalTime = (now - startTime.current) / 1000;

      if (!f.detected || !f.box) {
        setData(prev => {
          if (prev.isLooking === false && prev.score === 0) return prev;
          return {
            ...prev,
            isLooking: false,
            score: 0,
            totalTime,
            percentage: totalFrames.current > 0
              ? Math.round((lookFrames.current / totalFrames.current) * 100)
              : 0,
          };
        });
        return;
      }

      const vw = f.videoW || 640;
      const vh = f.videoH || 480;
      const box = f.box;

      const faceCenterX = (box.x + box.w / 2) / vw;
      const faceCenterY = (box.y + box.h / 2) / vh;

      const horizontalDeviation = Math.abs(faceCenterX - 0.5);
      const verticalDeviation = Math.abs(faceCenterY - 0.45);

      const faceWidthRatio = box.w / vw;

      const isLooking =
        horizontalDeviation < 0.18 &&
        verticalDeviation < 0.2 &&
        faceWidthRatio > 0.12 &&
        faceWidthRatio < 0.7;

      if (isLooking) {
        lookFrames.current++;
      }

      const percentage = totalFrames.current > 0
        ? (lookFrames.current / totalFrames.current) * 100
        : 0;

      const qualityScore = Math.max(0, Math.min(100,
        (1 - horizontalDeviation * 3) * 50 +
        (1 - verticalDeviation * 3) * 30 +
        (isLooking ? 20 : 0)
      ));

      setData({
        isLooking,
        score: Math.round(qualityScore),
        totalLookTime: lookFrames.current / 30,
        totalTime,
        percentage: Math.round(percentage),
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return data;
}
