import { useEffect } from "react";

interface WebcamFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  compact?: boolean;
}

export default function WebcamFeed({ videoRef, isActive, compact }: WebcamFeedProps) {
  return (
    <div
      className={`relative rounded-lg overflow-hidden border ${
        isActive ? "border-cyan-500/60 glow-cyan" : "border-gray-700"
      } bg-black ${compact ? "h-28" : "h-40"}`}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <div className="text-2xl opacity-30">📷</div>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">Camera Offline</div>
        </div>
      )}

      {isActive && (
        <>
          <div className="absolute top-0 left-0 right-0 h-px bg-cyan-500/30">
            <div className="scan-line" />
          </div>
          <div className="absolute top-1 right-1 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-mono text-red-400">LIVE</span>
          </div>
          <div className="absolute bottom-1 left-1 text-xs font-mono text-cyan-500/70 uppercase tracking-widest">
            rPPG Active
          </div>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
            <div
              className="absolute border border-cyan-400/40"
              style={{
                top: "10%", left: "30%", width: "40%", height: "15%",
                boxShadow: "0 0 8px rgba(0,212,255,0.3)"
              }}
            />
            <div className="absolute text-cyan-400/40 font-mono"
              style={{ top: "calc(10% - 14px)", left: "30%", fontSize: "8px" }}>
              FOREHEAD ROI
            </div>
          </div>
        </>
      )}
    </div>
  );
}
