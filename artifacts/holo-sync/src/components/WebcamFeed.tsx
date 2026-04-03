import { useEffect, useRef } from "react";
import type { FaceBox, FaceKeypoint } from "../hooks/useFaceDetection";

interface WebcamFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  compact?: boolean;
  faceDetected?: boolean;
  faceBox?: FaceBox | null;
  keypoints?: FaceKeypoint[];
  videoW?: number;
  videoH?: number;
  bpm?: number | null;
  calibrating?: boolean;
  faceLoading?: boolean;
}

export default function WebcamFeed({
  videoRef, isActive, compact,
  faceDetected, faceBox, keypoints = [], videoW = 0, videoH = 0,
  bpm, calibrating, faceLoading,
}: WebcamFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Draw face overlay ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container || videoW === 0 || videoH === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas to display size
    const dw = container.clientWidth, dh = container.clientHeight;
    canvas.width = dw;
    canvas.height = dh;
    ctx.clearRect(0, 0, dw, dh);

    if (!faceBox || !isActive) return;

    // The video element is displayed with CSS `scaleX(-1)` (mirror).
    // Our bounding box is in original (un-mirrored) pixel coords.
    // Map: original x → display x (mirrored)
    //   dispX = dw - (x / videoW) * dw - (w / videoW) * dw  = dw * (1 - (x+w)/videoW)
    const scaleX = dw / videoW;
    const scaleY = dh / videoH;

    const boxX = dw - (faceBox.x + faceBox.w) * scaleX;  // mirrored origin
    const boxY = faceBox.y * scaleY;
    const boxW = faceBox.w * scaleX;
    const boxH = faceBox.h * scaleY;

    // ── Glowing rectangle ──────────────────────────────────────────────────
    const color = faceDetected ? "#00d4ff" : "#ffaa00";
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Corner L-brackets (thicker accent lines)
    const cs = Math.min(boxW, boxH) * 0.18;
    ctx.lineWidth = 3;
    const corners: [number, number, number, number, number, number, number, number][] = [
      [boxX, boxY, boxX + cs, boxY, boxX, boxY + cs, boxX, boxY],                        // TL
      [boxX + boxW - cs, boxY, boxX + boxW, boxY, boxX + boxW, boxY + cs, boxX + boxW, boxY],     // TR
      [boxX, boxY + boxH - cs, boxX, boxY + boxH, boxX + cs, boxY + boxH, boxX, boxY + boxH],   // BL
      [boxX + boxW - cs, boxY + boxH, boxX + boxW, boxY + boxH, boxX + boxW, boxY + boxH - cs, boxX + boxW, boxY + boxH], // BR
    ];
    corners.forEach(([ax, ay, bx, by, cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy);
      ctx.stroke();
    });
    ctx.restore();

    // ── Keypoints (eyes, nose, mouth, ears) ───────────────────────────────
    const KP_COLORS = ["#00ffff", "#00ffff", "#ff88ff", "#ffaa44", "#00ff88", "#00ff88"];
    keypoints.forEach((kp, i) => {
      const kx = dw - kp.x * scaleX;   // mirror x
      const ky = kp.y * scaleY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(kx, ky, 3, 0, Math.PI * 2);
      ctx.fillStyle = KP_COLORS[i] ?? "#00ffff";
      ctx.shadowColor = KP_COLORS[i] ?? "#00ffff";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    });

    // ── BPM readout above the box ─────────────────────────────────────────
    const bpmText = calibrating ? "CALIBRATING…" : bpm != null ? `♥ ${bpm} BPM` : "READING…";
    const bpmColor = bpm != null && !calibrating
      ? (bpm > 100 ? "#ff4444" : bpm > 83 ? "#ffaa44" : "#00ff88")
      : "#00d4ff";
    ctx.save();
    ctx.font = `bold ${Math.max(11, Math.round(boxW * 0.13))}px 'Orbitron', monospace`;
    ctx.textAlign = "left";
    ctx.fillStyle = bpmColor;
    ctx.shadowColor = bpmColor;
    ctx.shadowBlur = 10;
    ctx.fillText(bpmText, boxX, Math.max(14, boxY - 6));
    ctx.restore();

    // ── "FACE LOCKED" label bottom-right of box ───────────────────────────
    ctx.save();
    ctx.font = `${Math.max(9, Math.round(boxW * 0.09))}px 'Orbitron', monospace`;
    ctx.textAlign = "right";
    ctx.fillStyle = color + "cc";
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillText("FACE LOCKED", boxX + boxW, boxY + boxH + 14);
    ctx.restore();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceBox, keypoints, videoW, videoH, bpm, calibrating, faceDetected, isActive]);

  return (
    <div
      className={`relative rounded-lg overflow-hidden border bg-black ${
        isActive
          ? faceDetected
            ? "border-cyan-400/70 shadow-[0_0_14px_rgba(0,212,255,0.25)]"
            : "border-cyan-500/30"
          : "border-gray-700"
      } ${compact ? "h-36" : "h-44"}`}
    >
      {/* Mirrored video */}
      <video
        ref={videoRef}
        muted playsInline autoPlay
        className="w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Face tracking canvas overlay — NOT mirrored (we mirror coords in JS) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Offline placeholder */}
      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="text-3xl opacity-30">📷</div>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">Camera Offline</div>
        </div>
      )}

      {isActive && (
        <>
          {/* Scan line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-cyan-500/20">
            <div className="scan-line" />
          </div>

          {/* LIVE badge */}
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-mono text-red-400">LIVE</span>
          </div>

          {/* Face detection status */}
          <div className={`absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/70 rounded px-1.5 py-0.5 text-xs font-mono transition-colors duration-300 ${
            faceLoading
              ? "text-gray-400"
              : faceDetected
                ? "text-cyan-300"
                : "text-yellow-400"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              faceLoading ? "bg-gray-400 animate-pulse"
              : faceDetected ? "bg-cyan-400"
              : "bg-yellow-500 animate-pulse"
            }`} />
            {faceLoading ? "LOADING AI…" : faceDetected ? "TRACKING" : "FIND FACE"}
          </div>

          {/* Guide oval only when face not found yet */}
          {!faceDetected && !faceLoading && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="rounded-full border-2 border-dashed border-cyan-400/30 animate-pulse"
                style={{ width: "52%", height: "78%" }}
              />
            </div>
          )}

          {/* Align hint */}
          {!faceDetected && !faceLoading && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 flex justify-center">
              <span className="text-xs font-mono text-yellow-400/80 animate-pulse">
                ↑ Centre your face in frame
              </span>
            </div>
          )}

          {/* Corner brackets */}
          <div className="absolute inset-0 pointer-events-none">
            {[["top-0 left-0", "border-t border-l"],
              ["top-0 right-0", "border-t border-r"],
              ["bottom-0 left-0", "border-b border-l"],
              ["bottom-0 right-0", "border-b border-r"]].map(([pos, bord], i) => (
              <div key={i} className={`absolute ${pos} w-2.5 h-2.5 ${bord} border-cyan-400/40`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
