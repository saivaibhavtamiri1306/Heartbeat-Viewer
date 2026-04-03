import { useState, useEffect, useRef } from "react";

interface AnswerTimerProps {
  isActive: boolean;
  maxTime: number;
  onTimeUp: () => void;
  difficulty: string;
}

export default function AnswerTimer({ isActive, maxTime, onTimeUp, difficulty }: AnswerTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (!isActive) { setElapsed(0); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const e = Math.floor((Date.now() - start) / 1000);
      setElapsed(e);
      if (e >= maxTime) {
        clearInterval(timer);
        onTimeUpRef.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive, maxTime]);

  if (!isActive) return null;

  const remaining = Math.max(0, maxTime - elapsed);
  const pct = (remaining / maxTime) * 100;
  const isUrgent = remaining <= 15;
  const isCritical = remaining <= 5;

  const color = isCritical ? "#ff4444" : isUrgent ? "#ffaa00" : "#00d4ff";
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: isUrgent ? `0 0 8px ${color}66` : undefined,
          }}
        />
      </div>
      <span
        className={`text-xs font-mono font-bold tabular-nums ${isCritical ? "animate-pulse" : ""}`}
        style={{ color, minWidth: "36px" }}
      >
        {m}:{s.toString().padStart(2, "0")}
      </span>
      {isCritical && <span className="text-xs text-red-400 animate-pulse">⏰</span>}
    </div>
  );
}
