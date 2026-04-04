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
  const [collapsed, setCollapsed] = useState(false);

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

  useEffect(() => {
    const canvas = ecgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stressColor =
      data.stress === "high" ? "#ff6b6b" :
      data.stress === "medium" ? "#ffc078" :
      "#4ecdc4";

    const stressGlow =
      data.stress === "high" ? "rgba(255,107,107,0.3)" :
      data.stress === "medium" ? "rgba(255,192,120,0.3)" :
      "rgba(78,205,196,0.3)";

    if (data.signal.length > 0) {
      trailRef.current = [...trailRef.current, ...data.signal.slice(-3)].slice(-120);
    }

    let phase = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(78,205,196,0.04)";
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

      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        ctx.strokeStyle = stressColor;
        ctx.lineWidth = pass === 0 ? 2.5 : 1.2;
        ctx.shadowColor = stressColor;
        ctx.shadowBlur = pass === 0 ? 10 : 0;

        trail.forEach((v, i) => {
          const x = i * step;
          const y = mid - v * amp;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      const headX = (trail.length - 1) * step;
      const headY = mid - (trail[trail.length - 1] ?? 0) * amp;
      ctx.beginPath();
      ctx.arc(headX, headY, 3, 0, Math.PI * 2);
      ctx.fillStyle = stressColor;
      ctx.shadowColor = stressColor;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(78,205,196,0.1)";
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
    data.stress === "high" ? "#ff6b6b" :
    data.stress === "medium" ? "#ffc078" :
    "#4ecdc4";

  const stressLabel =
    data.stress === "high" ? "HIGH" :
    data.stress === "medium" ? "MODERATE" :
    "RELAXED";

  const trendIcon =
    data.trend === "rising" ? "↑" :
    data.trend === "falling" ? "↓" :
    "→";

  return (
    <div className="glass-panel flex flex-col rounded-2xl overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors duration-200 w-full"
      >
        <div className="flex items-center gap-2">
          <div
            className="text-base animate-heartbeat leading-none"
            style={{ color: stressColor, filter: `drop-shadow(0 0 6px ${stressColor}80)` }}
          >
            ♥
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(120, 180, 200, 0.5)" }}>
            Heart Rate
          </span>
          {displayBpm !== null && !data.calibrating && (
            <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: stressColor }}>
              {displayBpm} BPM
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
            style={{
              color: stressColor,
              background: `${stressColor}12`,
              border: `1px solid ${stressColor}20`,
            }}>
            {data.isActive ? stressLabel : "OFFLINE"}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 12 12"
            className="transition-transform duration-300"
            style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", color: "rgba(120,180,200,0.4)" }}
          >
            <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </button>

      <div
        className="transition-all duration-400 ease-in-out overflow-hidden"
        style={{
          maxHeight: collapsed ? "0px" : "300px",
          opacity: collapsed ? 0 : 1,
        }}
      >
        <div className="flex items-stretch gap-2 px-3 pt-1">
          <div className="flex flex-col justify-center items-start w-20 shrink-0">
            {data.calibrating || displayBpm === null ? (
              <div className="flex flex-col gap-1">
                <div
                  className="text-2xl font-black font-mono leading-none tracking-widest animate-pulse"
                  style={{ color: "rgba(78,205,196,0.4)" }}
                >
                  ---
                </div>
                <div className="text-xs font-mono uppercase tracking-wider leading-tight" style={{ color: "rgba(78,205,196,0.35)" }}>
                  {data.isActive && data.faceDetected ? (
                    data.roiDebug?.includes("s)") ? `Cal ${data.roiDebug.match(/\((\d+)s\)/)?.[1] || ""}s` : "Calibrating"
                  ) : data.isActive ? "Detecting" : "Offline"}
                </div>
                <div className="flex gap-0.5 mt-0.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "rgba(78,205,196,0.4)", animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div
                  className="text-4xl font-black font-mono leading-none tabular-nums"
                  style={{
                    color: stressColor,
                    textShadow: `0 0 15px ${stressColor}60, 0 0 30px ${stressColor}30`,
                  }}
                >
                  {displayBpm}
                </div>
                <div className="font-mono uppercase tracking-[0.2em] mt-1" style={{ fontSize: "9px", color: "rgba(120, 180, 200, 0.35)" }}>BPM</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs font-mono" style={{ color: stressColor }}>{trendIcon}</span>
                  <span className="text-[10px] font-mono" style={{ color: "rgba(120, 180, 200, 0.4)" }}>
                    {data.trend.toUpperCase()}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex-1 relative">
            <canvas
              ref={ecgCanvasRef}
              width={220}
              height={72}
              className="w-full h-full rounded-lg"
              style={{ background: "rgba(0,12,20,0.4)" }}
            />
          </div>
        </div>

        <div className="px-3 mt-2">
          <div className="flex justify-between font-mono mb-1">
            <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "rgba(120, 180, 200, 0.3)" }}>Signal Quality</span>
            <span className="text-[10px] tabular-nums" style={{ color: data.confidence > 60 ? "#4ecdc4" : data.confidence > 30 ? "#ffc078" : "#ff6b6b" }}>
              {data.isActive ? `${data.confidence}%` : "---"}
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(20, 35, 50, 0.5)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${data.isActive ? data.confidence : 0}%`,
                background: `linear-gradient(90deg, rgba(78,205,196,0.4), ${stressColor})`,
                boxShadow: `0 0 6px ${stressColor}44`,
              }}
            />
          </div>
        </div>

        <div className="px-3 mt-2">
          <div className="flex justify-between font-mono mb-1">
            <span className="text-[10px] tabular-nums" style={{ color: "rgba(120, 180, 200, 0.2)" }}>40</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-center" style={{ color: "rgba(120, 180, 200, 0.3)" }}>Heart Rate Range</span>
            <span className="text-[10px] tabular-nums" style={{ color: "rgba(120, 180, 200, 0.2)" }}>180</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden relative" style={{ background: "rgba(20, 35, 50, 0.5)" }}>
            <div className="absolute inset-y-0 left-[15%] right-[33%]" style={{ background: "rgba(78,205,196,0.08)" }} />
            <div className="absolute inset-y-0 left-[43%] right-[18%]" style={{ background: "rgba(255,192,120,0.08)" }} />
            <div className="absolute inset-y-0 left-[58%] right-0" style={{ background: "rgba(255,107,107,0.08)" }} />
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${displayBpm !== null ? Math.min(100, Math.max(0, ((displayBpm - 40) / 140) * 100)) : 0}%`,
                background: `linear-gradient(90deg, #4ecdc4, #ffc078, ${stressColor})`,
                boxShadow: `0 0 8px ${stressColor}60`,
              }}
            />
          </div>
          <div className="flex justify-between font-mono mt-0.5" style={{ fontSize: "8px", color: "rgba(120, 180, 200, 0.18)" }}>
            <span>REST</span>
            <span>MODERATE</span>
            <span>HIGH</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2 font-mono" style={{ fontSize: "9px" }}>
          <span className="flex items-center gap-1">
            <span style={{ color: "rgba(120, 180, 200, 0.2)" }}>ALGO</span>
            <span style={{ color: "rgba(120, 180, 200, 0.45)" }}>{data.algorithm}</span>
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: "rgba(120, 180, 200, 0.2)" }}>FPS</span>
            <span style={{ color: "rgba(120, 180, 200, 0.45)" }}>{data.frameRate}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${data.faceDetected ? "animate-pulse" : ""}`}
              style={{ background: data.faceDetected ? "#4ecdc4" : "#ff6b6b", boxShadow: data.faceDetected ? "0 0 4px #4ecdc4" : "none" }} />
            <span style={{ color: data.faceDetected ? "rgba(78, 205, 196, 0.5)" : "rgba(255, 107, 107, 0.5)" }}>
              {data.faceDetected ? "FACE OK" : "NO FACE"}
            </span>
          </span>
          <span style={{ color: data.isActive ? "rgba(78, 205, 196, 0.5)" : "rgba(255, 107, 107, 0.5)" }}>
            {data.isActive ? "LIVE" : "OFF"}
          </span>
        </div>

        {(onPanic || onCalm) && (
          <div className="flex gap-1.5 px-3 pb-2.5">
            {onPanic && (
              <button
                onClick={onPanic}
                className="flex-1 font-bold font-mono uppercase tracking-[0.1em] rounded-xl px-2 py-1.5 transition-all duration-300 cursor-pointer"
                style={{ fontSize: "9px", color: "#ff6b6b", background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.15)" }}
              >
                Stress Demo
              </button>
            )}
            {onCalm && (
              <button
                onClick={onCalm}
                className="flex-1 font-bold font-mono uppercase tracking-[0.1em] rounded-xl px-2 py-1.5 transition-all duration-300 cursor-pointer"
                style={{ fontSize: "9px", color: "#4ecdc4", background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)" }}
              >
                Calm Demo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
