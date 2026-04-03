/**
 * useHeartbeat — rPPG v4 (simplified, proven approach)
 *
 * Based on the approach used by ALL working open-source implementations:
 *  - habom2310/Heart-rate-measurement-using-camera
 *  - giladoved/webcam-heart-rate-monitor
 *  - erdewit/heartwave
 *  - prouast/heartbeat-js
 *
 * Pipeline (deliberately simple — complexity = bugs):
 *  1. Sample GREEN channel average from forehead ROI
 *  2. Collect 150 frames (~5s buffer at 30fps)
 *  3. Detrend (remove DC + linear drift)
 *  4. Hamming window
 *  5. FFT → find peak in 0.75–3.0 Hz (45–180 BPM)
 *  6. Parabolic interpolation around peak
 *  7. EMA smoothing of output BPM
 *
 * That's it. No POS, no ACF, no consensus voting, no overcomplicated
 * signal processing. This is what actually works in every GitHub repo.
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

const BUFFER_SIZE = 256;
const FPS = 30;
const BPM_LO = 45;
const BPM_HI = 180;
const FL = BPM_LO / 60;
const FH = BPM_HI / 60;
const EMA = 0.3;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wR = Math.cos(ang), wI = -Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let pR = 1, pI = 0;
      for (let j = 0; j < len >> 1; j++) {
        const uR = re[i + j], uI = im[i + j];
        const vR = re[i + j + len / 2] * pR - im[i + j + len / 2] * pI;
        const vI = re[i + j + len / 2] * pI + im[i + j + len / 2] * pR;
        re[i + j] = uR + vR; im[i + j] = uI + vI;
        re[i + j + len / 2] = uR - vR; im[i + j + len / 2] = uI - vI;
        const t = pR * wR - pI * wI; pI = pR * wI + pI * wR; pR = t;
      }
    }
  }
}

function estimateBPM(greenSignal: number[], fps: number): { bpm: number; confidence: number; spectrum: number[] } {
  const N = greenSignal.length;

  const mean = greenSignal.reduce((s, v) => s + v, 0) / N;
  const detrended = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    detrended[i] = greenSignal[i] - mean - (greenSignal[N - 1] - greenSignal[0]) * (i / (N - 1));
  }

  let pad = 1;
  while (pad < N * 2) pad <<= 1;

  const re = new Float64Array(pad);
  const im = new Float64Array(pad);
  for (let i = 0; i < N; i++) {
    const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
    re[i] = detrended[i] * w;
  }

  fft(re, im);

  const mag = new Float64Array(pad >> 1);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);

  const freqRes = fps / pad;
  const loIdx = Math.max(1, Math.floor(FL / freqRes));
  const hiIdx = Math.min(mag.length - 2, Math.ceil(FH / freqRes));

  let peakVal = 0, peakIdx = loIdx;
  let totalPow = 0;
  for (let k = loIdx; k <= hiIdx; k++) {
    totalPow += mag[k];
    if (mag[k] > peakVal) { peakVal = mag[k]; peakIdx = k; }
  }

  let freq = peakIdx * freqRes;
  if (peakIdx > loIdx && peakIdx < hiIdx) {
    const a = mag[peakIdx - 1], b = mag[peakIdx], c = mag[peakIdx + 1];
    const d = a - 2 * b + c;
    if (Math.abs(d) > 1e-12) freq = (peakIdx + 0.5 * (a - c) / d) * freqRes;
  }

  const avgPow = totalPow / Math.max(1, hiIdx - loIdx + 1);
  const snr = avgPow > 0 ? peakVal / avgPow : 0;
  const confidence = clamp(Math.round((snr - 1) * 25), 0, 95);

  const specDisplay: number[] = [];
  for (let k = loIdx; k <= hiIdx; k++) specDisplay.push(mag[k] / (peakVal || 1));

  return {
    bpm: Math.round(clamp(freq * 60, BPM_LO, BPM_HI)),
    confidence,
    spectrum: specDisplay,
  };
}

function sampleGreen(
  ctx: CanvasRenderingContext2D,
  foreheadBox: FaceBox | null,
  cheekBox: FaceBox | null,
  faceBox: FaceBox | null,
  vw: number, vh: number,
): { green: number; ok: boolean; label: string } {
  let totalG = 0, cnt = 0;
  let label = "";

  const addBox = (x: number, y: number, w: number, h: number, lbl: string) => {
    const xi = Math.max(0, Math.floor(x));
    const yi = Math.max(0, Math.floor(y));
    const wi = Math.max(1, Math.min(Math.floor(w), vw - xi));
    const hi = Math.max(1, Math.min(Math.floor(h), vh - yi));
    if (wi < 2 || hi < 2) return;
    try {
      const d = ctx.getImageData(xi, yi, wi, hi).data;
      for (let i = 0; i < d.length; i += 16) {
        totalG += d[i + 1];
        cnt++;
      }
      label = label ? label + "+" + lbl : lbl;
    } catch { /* */ }
  };

  if (foreheadBox && foreheadBox.w > 8 && foreheadBox.h > 6)
    addBox(foreheadBox.x, foreheadBox.y, foreheadBox.w, foreheadBox.h, "FH");
  if (cheekBox && cheekBox.w > 10 && cheekBox.h > 8)
    addBox(cheekBox.x, cheekBox.y, cheekBox.w, cheekBox.h, "CK");
  if (cnt < 20 && faceBox && faceBox.w > 30 && faceBox.h > 30)
    addBox(faceBox.x + faceBox.w * 0.25, faceBox.y + faceBox.h * 0.05, faceBox.w * 0.5, faceBox.h * 0.2, "FC");

  if (cnt < 5) return { green: 0, ok: false, label: "NONE" };
  return { green: totalG / cnt, ok: true, label };
}

export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  faceBoxRef?: React.MutableRefObject<FaceBox | null>,
  foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
  cheekBoxRef?: React.MutableRefObject<FaceBox | null>,
) {
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const greenBuf = useRef<number[]>([]);
  const tsBuf = useRef<number[]>([]);
  const bpmRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);
  const fpsRef = useRef<number>(30);
  const prevMs = useRef<number>(0);
  const noFace = useRef<number>(0);
  const bpmHistory = useRef<number[]>([]);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "GREEN+FFT",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { rafRef.current = requestAnimationFrame(processFrame); return; }

    const now = performance.now();
    if (prevMs.current > 0) {
      const dt = (now - prevMs.current) / 1000;
      if (dt > 0.001) fpsRef.current = fpsRef.current * 0.9 + (1 / dt) * 0.1;
    }
    prevMs.current = now;
    frameRef.current++;

    if (!cvRef.current) cvRef.current = document.createElement("canvas");
    const cv = cvRef.current;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (cv.width !== vw) cv.width = vw;
    if (cv.height !== vh) cv.height = vh;
    ctx.drawImage(video, 0, 0);

    const roi = sampleGreen(ctx,
      foreheadBoxRef?.current ?? null,
      cheekBoxRef?.current ?? null,
      faceBoxRef?.current ?? null,
      vw, vh);

    if (!roi.ok) {
      noFace.current++;
      if (noFace.current >= 30) {
        bpmRef.current = null;
        greenBuf.current = [];
        tsBuf.current = [];
        bpmHistory.current = [];
        setData({
          bpm: null, confidence: 0, signal: [], isActive: true, stress: "low",
          trend: "stable", algorithm: "GREEN+FFT", faceDetected: false,
          frameRate: Math.round(fpsRef.current), calibrating: true, roiDebug: "NO FACE",
        });
      }
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    noFace.current = 0;
    greenBuf.current.push(roi.green);
    tsBuf.current.push(now);

    while (greenBuf.current.length > BUFFER_SIZE) {
      greenBuf.current.shift();
      tsBuf.current.shift();
    }

    const bufLen = greenBuf.current.length;

    if (frameRef.current % 5 === 0 && bufLen >= 90) {
      const elapsed = (tsBuf.current[bufLen - 1] - tsBuf.current[0]) / 1000;
      const actualFps = (bufLen - 1) / elapsed;

      const { bpm, confidence, spectrum } = estimateBPM(greenBuf.current, actualFps);

      if (bpm >= BPM_LO && bpm <= BPM_HI && confidence >= 10) {
        bpmHistory.current.push(bpm);
        if (bpmHistory.current.length > 10) bpmHistory.current.shift();

        if (bpmRef.current === null) {
          if (bpmHistory.current.length >= 3) {
            const sorted = [...bpmHistory.current].sort((a, b) => a - b);
            bpmRef.current = sorted[Math.floor(sorted.length / 2)];
          }
        } else {
          const jump = Math.abs(bpm - bpmRef.current);
          const alpha = jump <= 8 ? EMA : jump <= 20 ? EMA * 0.5 : EMA * 0.2;
          bpmRef.current = Math.round(bpmRef.current * (1 - alpha) + bpm * alpha);
        }
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";

      setData(prev => ({
        bpm: finalBpm,
        confidence,
        signal: spectrum,
        isActive: true,
        stress,
        trend: (finalBpm != null && prev.bpm != null)
          ? (finalBpm > prev.bpm + 3 ? "rising" : finalBpm < prev.bpm - 3 ? "falling" : "stable")
          : "stable",
        algorithm: `GREEN+FFT (${bpm})`,
        faceDetected: true,
        frameRate: Math.round(fpsRef.current),
        calibrating: finalBpm === null,
        roiDebug: roi.label,
      }));
    } else if (frameRef.current % 30 === 0) {
      const rem = Math.max(0, 90 - bufLen);
      setData(prev => ({
        ...prev, isActive: true, faceDetected: true,
        frameRate: Math.round(fpsRef.current),
        calibrating: bpmRef.current === null,
        roiDebug: roi.label + (rem > 0 ? ` (${Math.ceil(rem / fpsRef.current)}s)` : ""),
      }));
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef]);

  const start = useCallback(() => {
    greenBuf.current = []; tsBuf.current = [];
    bpmRef.current = null; frameRef.current = 0;
    fpsRef.current = 30; prevMs.current = 0;
    bpmHistory.current = []; noFace.current = 0;
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setData(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18);
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);
  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9);
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
