import { useEffect, useRef, useState } from "react";
import type { HeartbeatData } from "../hooks/useHeartbeat";

interface HeartbeatMonitorProps {
  data: HeartbeatData;
  onPanic?: () => void;
}

export default function HeartbeatMonitor({ data, onPanic }: HeartbeatMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);
  const [displayBpm, setDisplayBpm] = useState(data.bpm);

  useEffect(() => {
    let target = data.bpm;
    let current = displayBpm;
    const step = () => {
      current += (target - current) * 0.1;
      setDisplayBpm(Math.round(current));
    };
    const interval = setInterval(step, 50);
    return () => clearInterval(interval);
  }, [data.bpm]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const stressColor =
        data.stress === "high" ? "#ff4444" :
        data.stress === "medium" ? "#ffaa00" :
        "#00d4ff";

      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, w, h);

      if (data.signal.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = stressColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = stressColor;
        ctx.shadowBlur = 8;

        const step = w / (data.signal.length - 1);
        const mid = h / 2;
        const amplitude = h * 0.4;

        data.signal.forEach((val, i) => {
          const x = i * step;
          const y = mid - val * amplitude;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        const gradStroke = ctx.createLinearGradient(0, 0, w, 0);
        gradStroke.addColorStop(0, stressColor + "00");
        gradStroke.addColorStop(0.5, stressColor + "88");
        gradStroke.addColorStop(1, stressColor + "00");

        ctx.beginPath();
        ctx.strokeStyle = gradStroke;
        ctx.lineWidth = 1;
        data.signal.forEach((val, i) => {
          const x = i * step;
          const y = mid - val * amplitude;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.strokeStyle = "#00d4ff33";
        ctx.lineWidth = 1;
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [data.signal, data.stress]);

  const stressLabel =
    data.stress === "high" ? "CRITICAL" :
    data.stress === "medium" ? "ELEVATED" :
    "NORMAL";

  const stressColor =
    data.stress === "high" ? "text-red-400 text-glow-red" :
    data.stress === "medium" ? "text-yellow-400" :
    "text-cyan-400 text-glow-cyan";

  const bpmColor =
    data.bpm > 100 ? "#ff4444" :
    data.bpm > 80 ? "#ffaa00" :
    "#00d4ff";

  return (
    <div className="relative flex flex-col gap-2 p-3 rounded-lg border border-cyan-500/30 bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="animate-heartbeat"
            style={{ color: bpmColor, fontSize: "16px" }}
          >
            ♥
          </div>
          <span className="text-xs font-mono text-cyan-300 uppercase tracking-widest">Biometric Feed</span>
        </div>
        <div className={`text-xs font-bold uppercase tracking-widest ${stressColor}`}>
          {data.isActive ? stressLabel : "OFFLINE"}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <div
            className="text-5xl font-black font-mono leading-none"
            style={{ color: bpmColor, textShadow: `0 0 20px ${bpmColor}88` }}
          >
            {displayBpm}
          </div>
          <div className="text-xs text-cyan-500 font-mono mt-1 uppercase tracking-widest">BPM</div>
        </div>

        <div className="flex-1 flex flex-col gap-1">
          <canvas
            ref={canvasRef}
            width={200}
            height={60}
            className="w-full h-16 rounded"
            style={{ background: "rgba(0,212,255,0.03)" }}
          />
          <div className="flex justify-between text-xs font-mono text-cyan-600">
            <span>{data.trend === "rising" ? "↑ RISING" : data.trend === "falling" ? "↓ FALLING" : "→ STABLE"}</span>
            <span>{data.isActive ? "● LIVE" : "○ INACTIVE"}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, ((data.bpm - 50) / 100) * 100)}%`,
              background: `linear-gradient(90deg, #00d4ff, ${bpmColor})`,
              boxShadow: `0 0 8px ${bpmColor}66`,
            }}
          />
        </div>
        <span className="text-xs font-mono text-cyan-600">
          {data.bpm < 60 ? "50" : data.bpm > 140 ? "150+" : data.bpm} bpm
        </span>
      </div>

      {onPanic && (
        <button
          onMouseDown={onPanic}
          className="mt-1 text-xs font-bold font-mono uppercase tracking-widest text-red-400 border border-red-400/30 rounded px-2 py-1 hover:bg-red-400/10 transition-colors"
        >
          ⚠ Simulate Panic
        </button>
      )}
    </div>
  );
}
