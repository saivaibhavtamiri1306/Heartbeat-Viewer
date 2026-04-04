import { useEffect, useRef, useState } from "react";
import type { HeartbeatData } from "../hooks/useHeartbeat";

interface HeartbeatMonitorProps {
  data: HeartbeatData;
  onPanic?: () => void;
  onCalm?: () => void;
}

export default function HeartbeatMonitor({ data, onPanic, onCalm }: HeartbeatMonitorProps) {
  const ecgCanvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const trailRef = useRef<number[]>([]);
  const [displayBpm, setDisplayBpm] = useState<number | null>(data.bpm);

  useEffect(() => {
    if (data.bpm === null) {
      setDisplayBpm(null);
      return;
    }
    let targetBpm = data.bpm;
    let current = displayBpm ?? targetBpm;
    const interval = setInterval(() => {
      const diff = targetBpm - current;
      if (Math.abs(diff) < 0.5) { current = targetBpm; }
      else { current += diff * 0.15; }
      setDisplayBpm(Math.round(current));
    }, 50);
    return () => clearInterval(interval);
  }, [data.bpm]);

  // ECG waveform drawing
  useEffect(() => {
    const canvas = ecgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stressColor =
      data.stress === "high" ? "#ff4444" :
      data.stress === "medium" ? "#ffaa00" :
      "#00d4ff";

    const stressGlow =
      data.stress === "high" ? "rgba(255,68,68,0.4)" :
      data.stress === "medium" ? "rgba(255,170,0,0.4)" :
      "rgba(0,212,255,0.4)";

    // Merge incoming signal into trail
    if (data.signal.length > 0) {
      trailRef.current = [...trailRef.current, ...data.signal.slice(-3)].slice(-120);
    }

    let phase = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = "rgba(0,212,255,0.06)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 15) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const trail = trailRef.current;
      if (trail.length < 2) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const mid = h * 0.5;
      const amp = h * 0.38;
      const step = w / (trail.length - 1);

      // Glow fill
      ctx.beginPath();
      trail.forEach((v, i) => {
        const x = i * step;
        const y = mid - v * amp;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo((trail.length - 1) * step, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, stressGlow);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fill();

      // Main ECG line — draw in segments for glow effect
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        ctx.strokeStyle = stressColor;
        ctx.lineWidth = pass === 0 ? 3 : 1.5;
        ctx.shadowColor = stressColor;
        ctx.shadowBlur = pass === 0 ? 12 : 0;

        trail.forEach((v, i) => {
          const x = i * step;
          const y = mid - v * amp;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Moving scan head (leading edge indicator)
      const headX = (trail.length - 1) * step;
      const headY = mid - (trail[trail.length - 1] ?? 0) * amp;
      ctx.beginPath();
      ctx.arc(headX, headY, 3, 0, Math.PI * 2);
      ctx.fillStyle = stressColor;
      ctx.shadowColor = stressColor;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Baseline
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,212,255,0.15)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();
      ctx.setLineDash([]);

      phase = (phase + 1) % 360;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [data.signal, data.stress]);

  const stressColor =
    data.stress === "high" ? "#ff4444" :
    data.stress === "medium" ? "#ffaa00" :
    "#00d4ff";

  const stressLabel =
    data.stress === "high" ? "CRITICAL" :
    data.stress === "medium" ? "ELEVATED" :
    "NORMAL";

  const stressTextClass =
    data.stress === "high" ? "text-red-400" :
    data.stress === "medium" ? "text-yellow-400" :
    "text-cyan-400";

  const trendIcon =
    data.trend === "rising" ? "↑" :
    data.trend === "falling" ? "↓" :
    "→";

  return (
    <div className="glass-panel flex flex-col gap-2 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-2">
          <div
            className="text-base animate-heartbeat leading-none"
            style={{ color: stressColor, filter: `drop-shadow(0 0 8px ${stressColor})` }}
          >
            ♥
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(0, 212, 255, 0.45)" }}>
            Biometric Monitor
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
            style={{
              color: stressColor,
              background: `${stressColor}10`,
              border: `1px solid ${stressColor}25`,
            }}>
            {data.isActive ? stressLabel : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* BPM + ECG */}
      <div className="flex items-stretch gap-2 px-3">
        {/* BPM Display */}
        <div className="flex flex-col justify-center items-start w-20 shrink-0">
          {data.calibrating || displayBpm === null ? (
            <div className="flex flex-col gap-1">
              <div
                className="text-2xl font-black font-mono leading-none tracking-widest animate-pulse"
                style={{ color: "#00d4ff88" }}
              >
                ---
              </div>
              <div className="text-xs font-mono text-cyan-600/70 uppercase tracking-wider leading-tight">
                {data.isActive && data.faceDetected ? (
                  data.roiDebug?.includes("s)") ? `Cal ${data.roiDebug.match(/\((\d+)s\)/)?.[1] || ""}s` : "Calibrating"
                ) : data.isActive ? "Detecting" : "Offline"}
              </div>
              <div
                className="flex gap-0.5 mt-0.5"
              >
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div
                className="text-5xl font-black font-mono leading-none tabular-nums"
                style={{
                  color: stressColor,
                  textShadow: `0 0 20px ${stressColor}88, 0 0 40px ${stressColor}44`,
                }}
              >
                {displayBpm}
              </div>
              <div className="font-mono uppercase tracking-[0.2em] mt-1" style={{ fontSize: "9px", color: "rgba(0, 212, 255, 0.35)" }}>BPM</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs font-mono" style={{ color: stressColor }}>{trendIcon}</span>
                <span className="text-[10px] font-mono" style={{ color: "rgba(0, 212, 255, 0.4)" }}>
                  {data.trend.toUpperCase()}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ECG Canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={ecgCanvasRef}
            width={220}
            height={72}
            className="w-full h-full rounded-lg"
            style={{ background: "rgba(0,8,16,0.6)" }}
          />
        </div>
      </div>

      <div className="px-3">
        <div className="flex justify-between font-mono mb-1">
          <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "rgba(0, 212, 255, 0.35)" }}>Signal Quality</span>
          <span className="text-[10px] tabular-nums" style={{ color: data.confidence > 60 ? "#00d4ff" : data.confidence > 30 ? "#ffaa00" : "#ff4444" }}>
            {data.isActive ? `${data.confidence}%` : "---"}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(20, 30, 50, 0.6)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${data.isActive ? data.confidence : 0}%`,
              background: `linear-gradient(90deg, #004466, ${stressColor})`,
              boxShadow: `0 0 8px ${stressColor}66`,
            }}
          />
        </div>
      </div>

      <div className="px-3">
        <div className="flex justify-between font-mono mb-1">
          <span className="text-[10px] tabular-nums" style={{ color: "rgba(0, 212, 255, 0.25)" }}>40</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-center" style={{ color: "rgba(0, 212, 255, 0.35)" }}>Heart Rate Range</span>
          <span className="text-[10px] tabular-nums" style={{ color: "rgba(0, 212, 255, 0.25)" }}>180</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden relative" style={{ background: "rgba(20, 30, 50, 0.6)" }}>
          {/* Zone markers */}
          <div className="absolute inset-y-0 left-[15%] right-[33%] bg-green-500/10" />
          <div className="absolute inset-y-0 left-[43%] right-[18%] bg-yellow-500/10" />
          <div className="absolute inset-y-0 left-[58%] right-0 bg-red-500/10" />
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${displayBpm !== null ? Math.min(100, Math.max(0, ((displayBpm - 40) / 140) * 100)) : 0}%`,
              background: `linear-gradient(90deg, #00ff88, #ffaa00, ${stressColor})`,
              boxShadow: `0 0 12px ${stressColor}88`,
            }}
          />
        </div>
        <div className="flex justify-between font-mono mt-0.5" style={{ fontSize: "8px", color: "rgba(0, 212, 255, 0.2)" }}>
          <span>REST</span>
          <span>MODERATE</span>
          <span>HIGH</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 pb-2.5 font-mono" style={{ fontSize: "9px" }}>
        <span className="flex items-center gap-1">
          <span style={{ color: "rgba(0, 212, 255, 0.25)" }}>ALGO</span>
          <span style={{ color: "rgba(0, 212, 255, 0.5)" }}>{data.algorithm}</span>
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: "rgba(0, 212, 255, 0.25)" }}>FPS</span>
          <span style={{ color: "rgba(0, 212, 255, 0.5)" }}>{data.frameRate}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${data.faceDetected ? "animate-pulse" : ""}`}
            style={{ background: data.faceDetected ? "#00ff88" : "#ff4444", boxShadow: data.faceDetected ? "0 0 4px #00ff88" : "none" }} />
          <span style={{ color: data.faceDetected ? "rgba(0, 255, 136, 0.6)" : "rgba(255, 68, 68, 0.6)" }}>
            {data.faceDetected ? "FACE OK" : "NO FACE"}
          </span>
        </span>
        <span style={{ color: data.isActive ? "rgba(0, 255, 136, 0.6)" : "rgba(255, 68, 68, 0.6)" }}>
          {data.isActive ? "LIVE" : "OFF"}
        </span>
      </div>

      {(onPanic || onCalm) && (
        <div className="flex gap-1.5 px-3 pb-2.5">
          {onPanic && (
            <button
              onClick={onPanic}
              className="flex-1 font-bold font-mono uppercase tracking-[0.1em] rounded-xl px-2 py-1.5 transition-all duration-300 cursor-pointer"
              style={{ fontSize: "9px", color: "#ff4444", background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.15)" }}
            >
              Stress Demo
            </button>
          )}
          {onCalm && (
            <button
              onClick={onCalm}
              className="flex-1 font-bold font-mono uppercase tracking-[0.1em] rounded-xl px-2 py-1.5 transition-all duration-300 cursor-pointer"
              style={{ fontSize: "9px", color: "#00ff88", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)" }}
            >
              Calm Demo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
