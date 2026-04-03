interface WebcamFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  compact?: boolean;
  faceDetected?: boolean;
  roiLabel?: string;
}

export default function WebcamFeed({ videoRef, isActive, compact, faceDetected, roiLabel }: WebcamFeedProps) {
  return (
    <div
      className={`relative rounded-lg overflow-hidden border bg-black ${
        isActive
          ? faceDetected
            ? "border-green-500/60 shadow-[0_0_12px_rgba(0,255,128,0.2)]"
            : "border-cyan-500/40"
          : "border-gray-700"
      } ${compact ? "h-36" : "h-44"}`}
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
          <div className={`absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5 text-xs font-mono ${
            faceDetected ? "text-green-400" : "text-yellow-500/70"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${faceDetected ? "bg-green-400" : "bg-yellow-500 animate-pulse"}`} />
            {faceDetected ? "SIGNAL OK" : "ALIGN FACE"}
          </div>

          {/* Face oval guide — tells user where to position face */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className={`rounded-full border-2 transition-colors duration-500 ${
                faceDetected ? "border-green-400/60" : "border-cyan-400/40 border-dashed"
              }`}
              style={{
                width: "54%",
                height: "80%",
                boxShadow: faceDetected
                  ? "0 0 12px rgba(0,255,128,0.2), inset 0 0 12px rgba(0,255,128,0.05)"
                  : "0 0 10px rgba(0,212,255,0.15), inset 0 0 10px rgba(0,212,255,0.05)",
              }}
            />
          </div>

          {/* Corner brackets */}
          <div className="absolute inset-0 pointer-events-none">
            {[["top-0 left-0", "border-t-2 border-l-2"],
              ["top-0 right-0", "border-t-2 border-r-2"],
              ["bottom-0 left-0", "border-b-2 border-l-2"],
              ["bottom-0 right-0", "border-b-2 border-r-2"]].map(([pos, bord], i) => (
              <div key={i} className={`absolute ${pos} w-3 h-3 ${bord} ${
                faceDetected ? "border-green-400/70" : "border-cyan-400/50"
              }`} />
            ))}
          </div>

          {/* Bottom status */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-500/60 uppercase tracking-wider">
                rPPG {roiLabel ? `· ${roiLabel}` : ""}
              </span>
              {!faceDetected && (
                <span className="text-xs font-mono text-yellow-400/80 animate-pulse">
                  Centre your face ↑
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
