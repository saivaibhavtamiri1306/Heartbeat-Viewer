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

const BPM_LO = 42;
const BPM_HI = 180;
const EMA_ALPHA = 0.3;
const CDN_URL = "https://cdn.jsdelivr.net/npm/vitallens@0.4.5/dist/vitallens.browser.js";

let vlModulePromise: Promise<any> | null = null;

function loadVitalLens(): Promise<any> {
  if (vlModulePromise) return vlModulePromise;

  vlModulePromise = new Promise((resolve, reject) => {
    if ((window as any).VitalLens) {
      resolve((window as any).VitalLens);
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    const inlineCode = `
      import { VitalLens } from "${CDN_URL}";
      window.__VitalLensClass = VitalLens;
      window.dispatchEvent(new Event("vitallens-loaded"));
    `;
    const blob = new Blob([inlineCode], { type: "application/javascript" });
    script.src = URL.createObjectURL(blob);

    const onLoaded = () => {
      window.removeEventListener("vitallens-loaded", onLoaded);
      if ((window as any).__VitalLensClass) {
        resolve((window as any).__VitalLensClass);
      } else {
        reject(new Error("VitalLens class not found after load"));
      }
    };
    window.addEventListener("vitallens-loaded", onLoaded);

    script.onerror = () => {
      window.removeEventListener("vitallens-loaded", onLoaded);
      vlModulePromise = null;
      reject(new Error("Failed to load VitalLens CDN script"));
    };

    setTimeout(() => {
      window.removeEventListener("vitallens-loaded", onLoaded);
      if (!(window as any).__VitalLensClass) {
        vlModulePromise = null;
        reject(new Error("VitalLens load timeout"));
      }
    }, 15000);

    document.head.appendChild(script);
  });
  return vlModulePromise;
}

export function useHeartbeat(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  _faceBoxRef?: React.MutableRefObject<FaceBox | null>,
  _foreheadBoxRef?: React.MutableRefObject<FaceBox | null>,
  _cheekBoxRef?: React.MutableRefObject<FaceBox | null>,
) {
  const vlRef = useRef<any>(null);
  const bpmRef = useRef<number | null>(null);
  const waveformRef = useRef<number[]>([]);
  const startedRef = useRef(false);
  const histBpm = useRef<number[]>([]);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const [data, setData] = useState<HeartbeatData>({
    bpm: null, confidence: 0, signal: [], isActive: false,
    stress: "low", trend: "stable", algorithm: "VitalLens-POS",
    faceDetected: false, frameRate: 30, calibrating: true,
  });

  const handleResult = useCallback((result: any) => {
    if (cancelledRef.current) return;
    try {
      const vs = result.vital_signs || result.vitals;
      if (!vs) return;

      const hr = vs.heart_rate;
      if (!hr || typeof hr.value !== "number") return;

      const rawBpm = Math.round(hr.value);
      const conf = typeof hr.confidence === "number" ? Math.round(hr.confidence * 100) : 50;
      const hasFace = result.face?.confidence?.length > 0 &&
        result.face.confidence.some((c: number) => c > 0.3);

      if (rawBpm < BPM_LO || rawBpm > BPM_HI || conf < 10) {
        setData(prev => ({
          ...prev,
          isActive: true,
          faceDetected: hasFace,
          calibrating: bpmRef.current === null,
          algorithm: "VitalLens-POS",
          roiDebug: hasFace ? "FACE" : "NO FACE",
        }));
        return;
      }

      if (bpmRef.current === null) {
        bpmRef.current = rawBpm;
        histBpm.current = [rawBpm];
      } else {
        const jump = Math.abs(rawBpm - bpmRef.current);
        if (jump <= 25 || conf >= 50) {
          const alpha = jump <= 5 ? EMA_ALPHA : jump <= 12 ? EMA_ALPHA * 0.6 : EMA_ALPHA * 0.3;
          bpmRef.current = Math.round(bpmRef.current * (1 - alpha) + rawBpm * alpha);
          histBpm.current.push(bpmRef.current);
          if (histBpm.current.length > 20) histBpm.current.shift();
        }
      }

      const ppgData = vs.ppg_waveform?.data || vs.ppg_waveform?.value;
      if (Array.isArray(ppgData)) {
        waveformRef.current = ppgData.slice(-80);
      }

      const finalBpm = bpmRef.current;
      const stress: "low" | "medium" | "high" =
        finalBpm != null ? (finalBpm > 100 ? "high" : finalBpm > 83 ? "medium" : "low") : "low";

      setData(prev => ({
        bpm: finalBpm,
        confidence: conf,
        signal: waveformRef.current,
        isActive: true,
        stress,
        trend: (finalBpm != null && prev.bpm != null)
          ? (finalBpm > prev.bpm + 2 ? "rising" : finalBpm < prev.bpm - 2 ? "falling" : "stable")
          : "stable",
        algorithm: "VitalLens-POS",
        faceDetected: hasFace,
        frameRate: result.fps || result.estFps || 30,
        calibrating: false,
        roiDebug: hasFace ? "FACE" : "NO FACE",
      }));
    } catch (e) {
      console.warn("[VitalLens] result parse error:", e);
    }
  }, []);

  const clearPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    cancelledRef.current = false;

    bpmRef.current = null;
    histBpm.current = [];
    waveformRef.current = [];

    setData({
      bpm: null, confidence: 0, signal: [], isActive: true,
      stress: "low", trend: "stable", algorithm: "VitalLens-POS",
      faceDetected: false, frameRate: 30, calibrating: true,
    });

    try {
      const VitalLensClass = await loadVitalLens();

      if (cancelledRef.current) return;

      const vl = new VitalLensClass({ method: "pos" });
      vl.on("result", handleResult);
      vlRef.current = vl;

      const tryConnect = () => {
        if (cancelledRef.current) return;
        const v = videoRef.current;
        if (v && v.srcObject instanceof MediaStream) {
          vl.processStream(v.srcObject);
        } else {
          pollingTimerRef.current = setTimeout(tryConnect, 500);
        }
      };
      tryConnect();
    } catch (err) {
      console.error("[VitalLens] init error:", err);
      startedRef.current = false;
      setData(prev => ({
        ...prev,
        algorithm: "VitalLens-ERR",
        roiDebug: String(err),
      }));
    }
  }, [videoRef, handleResult, clearPolling]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    startedRef.current = false;
    clearPolling();
    try { vlRef.current?.stop?.(); } catch {}
    vlRef.current = null;
    setData(prev => ({ ...prev, isActive: false }));
  }, [clearPolling]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearPolling();
      try { vlRef.current?.stop?.(); } catch {}
    };
  }, [clearPolling]);

  const panic = useCallback(() => {
    bpmRef.current = 116 + Math.floor(Math.random() * 18);
    histBpm.current = [bpmRef.current!];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "high", trend: "rising", confidence: 87, calibrating: false }));
  }, []);

  const calm = useCallback(() => {
    bpmRef.current = 60 + Math.floor(Math.random() * 9);
    histBpm.current = [bpmRef.current!];
    setData(prev => ({ ...prev, bpm: bpmRef.current, stress: "low", trend: "falling", confidence: 84, calibrating: false }));
  }, []);

  return { data, start, stop, panic, calm };
}
