import type { EyeContactData } from "../hooks/useEyeContact";

interface EyeContactIndicatorProps {
  data: EyeContactData;
}

export default function EyeContactIndicator({ data }: EyeContactIndicatorProps) {
  const color = data.isLooking ? "#00ff88" : "#ff4444";

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-cyan-500/20 bg-black/30">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest">Eye Contact</div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full transition-colors duration-300"
            style={{ background: color, boxShadow: `0 0 6px ${color}88` }}
          />
          <span className="text-xs font-mono font-bold" style={{ color }}>
            {data.isLooking ? "ENGAGED" : "AWAY"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${data.percentage}%`,
              background: data.percentage > 60 ? "#00ff88" : data.percentage > 40 ? "#ffaa00" : "#ff4444",
              boxShadow: `0 0 4px ${data.percentage > 60 ? "#00ff8844" : "#ff444444"}`,
            }}
          />
        </div>
        <span className="text-xs font-mono font-bold text-gray-400 min-w-[32px] text-right">
          {data.percentage}%
        </span>
      </div>
    </div>
  );
}
