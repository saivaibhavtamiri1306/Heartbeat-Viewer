import { useEffect, useRef } from "react";
import type { FaceBox, FaceKeypoint } from "../hooks/useFaceDetection";

interface WebcamFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  compact?: boolean;
  faceDetected?: boolean;
  faceBox?: FaceBox | null;
  foreheadBox?: FaceBox | null;
  cheekBox?: FaceBox | null;
  keypoints?: FaceKeypoint[];
  videoW?: number;
  videoH?: number;
  bpm?: number | null;
  calibrating?: boolean;
  faceLoading?: boolean;
}

export default function WebcamFeed({
  videoRef, isActive, compact,
  faceDetected, faceBox, foreheadBox, cheekBox, keypoints = [], videoW = 0, videoH = 0,
  bpm, calibrating, faceLoading,
}: WebcamFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas pixel size to container CSS size
    const dw = container.clientWidth;
    const dh = container.clientHeight;
    if (canvas.width !== dw) canvas.width = dw;
    if (canvas.height !== dh) canvas.height = dh;
    ctx.clearRect(0, 0, dw, dh);

    if (!faceBox || !isActive || videoW === 0 || videoH === 0) return;

    // ── Compute object-cover transform ───────────────────────────────────────
    // The CSS `object-cover` scales the video to fill the container while
    // preserving aspect ratio — cropping the excess on each side.
    const scaleToFill = Math.max(dw / videoW, dh / videoH);
    const scaledW = videoW * scaleToFill;
    const scaledH = videoH * scaleToFill;
    const offX = (dw - scaledW) / 2;   // negative = left-crop offset
    const offY = (dh - scaledH) / 2;   // negative = top-crop offset

    // Convert face box (original video pixels) → canvas display coords
    const fdX = faceBox.x * scaleToFill + offX;
    const fdY = faceBox.y * scaleToFill + offY;
    const fdW = faceBox.w * scaleToFill;
    const fdH = faceBox.h * scaleToFill;

    // Mirror x to match CSS scaleX(-1) on the video element
    const bx = dw - fdX - fdW;
    const by = fdY;
    const bw = fdW;
    const bh = fdH;

    const color = faceDetected ? "#00d4ff" : "#ffcc00";
    const glow  = faceDetected ? "rgba(0,212,255,0.4)" : "rgba(255,204,0,0.3)";

    // ── Outer glow rect ───────────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();

    // ── Corner L-brackets (accent lines) ─────────────────────────────────────
    const cs = Math.min(bw, bh) * 0.20;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 12;
    const corners: Array<[number, number, number, number, number, number]> = [
      [bx,       by,       bx + cs,  by,       bx,       by + cs   ],  // TL
      [bx + bw,  by,       bx + bw - cs, by,   bx + bw,  by + cs   ],  // TR
      [bx,       by + bh,  bx + cs,  by + bh,  bx,       by + bh - cs], // BL
      [bx + bw,  by + bh,  bx + bw - cs, by + bh, bx + bw, by + bh - cs], // BR
    ];
    corners.forEach(([ax, ay, bx2, by2, cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2);
      ctx.moveTo(ax, ay); ctx.lineTo(cx, cy);
      ctx.stroke();
    });
    ctx.restore();

    // ── Crosshair center-point ────────────────────────────────────────────────
    const cx2 = bx + bw / 2, cy2 = by + bh / 2;
    const cs2 = Math.min(bw, bh) * 0.05;
    ctx.save();
    ctx.strokeStyle = color + "99";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx2 - cs2, cy2); ctx.lineTo(cx2 + cs2, cy2);
    ctx.moveTo(cx2, cy2 - cs2); ctx.lineTo(cx2, cy2 + cs2);
    ctx.stroke();
    ctx.restore();

    // ── Keypoints ─────────────────────────────────────────────────────────────
    const KP_COLORS = ["#00ffff", "#00ffff", "#ff88ff", "#ffaa44", "#44ff88", "#44ff88"];
    keypoints.forEach((kp, i) => {
      const kx = dw - (kp.x * scaleToFill + offX);   // mirror x
      const ky = kp.y * scaleToFill + offY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(kx, ky, 3.5, 0, Math.PI * 2);
      ctx.fillStyle   = KP_COLORS[i] ?? "#00ffff";
      ctx.shadowColor = KP_COLORS[i] ?? "#00ffff";
      ctx.shadowBlur  = 10;
      ctx.fill();
      ctx.restore();
    });

    // ── Green ROI box on forehead — small semi-transparent green (habom2310 style)
    if (foreheadBox && foreheadBox.w > 5 && foreheadBox.h > 3) {
      const rx = foreheadBox.x * scaleToFill + offX;
      const ry = foreheadBox.y * scaleToFill + offY;
      const rw = foreheadBox.w * scaleToFill;
      const rh = foreheadBox.h * scaleToFill;
      const mx = dw - rx - rw;

      ctx.save();
      ctx.fillStyle = "rgba(0, 255, 0, 0.25)";
      ctx.fillRect(mx, ry, rw, rh);
      ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, ry, rw, rh);
      ctx.restore();
    }

    // ── BPM readout (above face box) ──────────────────────────────────────────
    const bpmTxt   = calibrating ? "● CALIBRATING" : bpm != null ? `♥  ${bpm} BPM` : "● READING";
    const bpmColor = (bpm != null && !calibrating)
      ? (bpm > 100 ? "#ff4444" : bpm > 83 ? "#ffaa44" : "#00ff88")
      : color;
    const fontSize = Math.max(10, Math.min(14, Math.round(bw * 0.14)));
    ctx.save();
    ctx.font      = `bold ${fontSize}px 'Orbitron', 'Courier New', monospace`;
    ctx.textAlign = "left";
    const txtY = Math.max(fontSize + 2, by - 5);
    // Pill background
    const txtW = ctx.measureText(bpmTxt).width;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.roundRect?.(bx - 2, txtY - fontSize - 2, txtW + 14, fontSize + 6, 3);
    ctx.fill();
    // Text
    ctx.fillStyle   = bpmColor;
    ctx.shadowColor = bpmColor;
    ctx.shadowBlur  = 8;
    ctx.fillText(bpmTxt, bx + 5, txtY);
    ctx.restore();

    // ── "FACE LOCK" label (bottom of box) ────────────────────────────────────
    const lockTxt  = faceDetected ? "FACE LOCK ✓" : "DETECTING…";
    const lockSize = Math.max(8, Math.min(11, Math.round(bw * 0.09)));
    ctx.save();
    ctx.font      = `${lockSize}px 'Orbitron', monospace`;
    ctx.textAlign = "right";
    ctx.fillStyle   = color + "cc";
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6;
    ctx.fillText(lockTxt, bx + bw, by + bh + lockSize + 3);
    ctx.restore();

  }, [faceBox, foreheadBox, cheekBox, keypoints, videoW, videoH, bpm, calibrating, faceDetected, isActive]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-lg overflow-hidden border bg-black ${
        isActive
          ? faceDetected
            ? "border-cyan-400/70 shadow-[0_0_16px_rgba(0,212,255,0.25)]"
            : "border-cyan-500/25"
          : "border-gray-700"
      } ${compact ? "h-36" : "h-44"}`}
    >
      {/* Video — mirrored for natural selfie view */}
      <video
        ref={videoRef}
        muted playsInline autoPlay
        className="w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Face tracking canvas overlay — coordinates handled in JS, not mirrored by CSS */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Offline */}
      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="text-3xl opacity-30">📷</div>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">Camera Offline</div>
        </div>
      )}

      {isActive && (
        <>
          {/* Scan line */}
          <div className="absolute top-0 inset-x-0 h-px bg-cyan-500/20">
            <div className="scan-line" />
          </div>

          {/* LIVE badge */}
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/65 rounded px-1.5 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">Live</span>
          </div>

          {/* Detection status */}
          <div className={`absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/65 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
            faceLoading ? "text-gray-400" : faceDetected ? "text-cyan-300" : "text-yellow-400"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              faceLoading ? "bg-gray-400 animate-pulse"
              : faceDetected ? "bg-cyan-400"
              : "bg-yellow-400 animate-pulse"
            }`} />
            {faceLoading ? "Initialising" : faceDetected ? "Tracking" : "Find face"}
          </div>

          {/* No-face guide oval */}
          {!faceDetected && !faceLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="rounded-full border-2 border-dashed border-cyan-400/30 animate-pulse"
                style={{ width: "52%", height: "80%" }} />
            </div>
          )}

          {/* Align hint */}
          {!faceDetected && !faceLoading && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1 flex justify-center">
              <span className="text-[10px] font-mono text-yellow-400/80 animate-pulse tracking-wide">
                ↑ Centre your face in frame
              </span>
            </div>
          )}

          {/* Corner accents */}
          <div className="absolute inset-0 pointer-events-none">
            {[["top-0 left-0","border-t border-l"],["top-0 right-0","border-t border-r"],
              ["bottom-0 left-0","border-b border-l"],["bottom-0 right-0","border-b border-r"]
            ].map(([pos, bord], i) => (
              <div key={i} className={`absolute ${pos} w-2.5 h-2.5 ${bord} border-cyan-400/30`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
