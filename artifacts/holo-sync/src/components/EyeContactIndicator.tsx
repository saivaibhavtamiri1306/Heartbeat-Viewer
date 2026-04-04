import type { EyeContactData } from "../hooks/useEyeContact";

interface EyeContactIndicatorProps {
  data: EyeContactData;
}

export default function EyeContactIndicator({ data }: EyeContactIndicatorProps) {
  const color = data.isLooking ? "#00ff88" : "#ff4444";

  return (
    <div className="glass-panel flex flex-col gap-2 p-3 rounded-2xl">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(0, 212, 255, 0.4)" }}>Eye Contact</div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full transition-colors duration-300"
            style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
          />
          <span className="text-[10px] font-mono font-bold tracking-[0.1em]" style={{ color }}>
            {data.isLooking ? "ENGAGED" : "AWAY"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(20, 30, 50, 0.6)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${data.percentage}%`,
              background: `linear-gradient(90deg, ${data.percentage > 60 ? "#00ff88" : data.percentage > 40 ? "#ffaa00" : "#ff4444"}, ${data.percentage > 60 ? "#00d4ff" : "#ff6644"})`,
              boxShadow: `0 0 6px ${data.percentage > 60 ? "#00ff8844" : "#ff444444"}`,
            }}
          />
        </div>
        <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: "rgba(160, 180, 200, 0.6)" }}>
          {data.percentage}%
        </span>
      </div>
    </div>
  );
}
