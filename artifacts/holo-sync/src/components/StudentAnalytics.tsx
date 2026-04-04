import type { SpeechAnalytics } from "../hooks/useSpeechRecognition";

interface StudentAnalyticsProps {
  analytics: SpeechAnalytics;
  isListening: boolean;
  answerCount: number;
  sessionTime: number;
}

function RadialBar({ value, max, color, label, size = 48 }: {
  value: number; max: number; color: string; label: string; size?: number;
}) {
  const pct = Math.min(1, value / max);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: "stroke-dasharray 0.5s ease" }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-black font-mono"
          style={{ color }}
        >
          {Math.round(pct * 100)}
        </div>
      </div>
      <div className="text-xs font-mono text-cyan-600/60 uppercase tracking-wider text-center leading-tight" style={{ fontSize: "9px" }}>
        {label}
      </div>
    </div>
  );
}

const FILLER_COLORS: Record<string, string> = {
  "um": "#ff4444", "uh": "#ff6600", "like": "#ffaa00",
  "basically": "#ff4488", "literally": "#ff44aa",
  "actually": "#ffcc00", "you know": "#ff6644",
  "i mean": "#ff5522", "sort of": "#ff7744",
  "kind of": "#ff8833", "right": "#ffbb22",
};

export default function StudentAnalytics({ analytics, isListening, answerCount, sessionTime }: StudentAnalyticsProps) {
  const mins = Math.floor(sessionTime / 60);
  const secs = sessionTime % 60;

  const wpmColor = analytics.wpm > 140 ? "#ffaa00" : analytics.wpm > 80 ? "#00ff88" : "#00d4ff";
  const vocabColor = analytics.vocabularyScore > 70 ? "#00ff88" : analytics.vocabularyScore > 40 ? "#ffaa00" : "#ff4444";
  const confColor = analytics.confidenceScore > 70 ? "#00ff88" : analytics.confidenceScore > 40 ? "#ffaa00" : "#ff4444";

  return (
    <div className="glass-panel flex flex-col gap-2 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(0, 212, 255, 0.45)" }}>
          Student Analytics
        </span>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isListening ? "bg-green-400 animate-pulse" : "bg-gray-700"}`}
            style={{ boxShadow: isListening ? "0 0 6px #00ff88" : "none" }} />
          <span className="text-[10px] font-mono uppercase tracking-[0.1em]"
            style={{ color: isListening ? "#00ff88" : "rgba(100, 120, 140, 0.4)" }}>
            {isListening ? "LIVE" : "IDLE"}
          </span>
        </div>
      </div>

      {/* Radial meters */}
      <div className="flex justify-around px-3 pb-1">
        <RadialBar value={analytics.wpm} max={160} color={wpmColor} label="WPM" />
        <RadialBar value={analytics.vocabularyScore} max={100} color={vocabColor} label="VOCAB" />
        <RadialBar value={analytics.confidenceScore} max={100} color={confColor} label="CONFID" />
        <RadialBar value={answerCount} max={10} color="#7700ff" label={`Q/${answerCount}`} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1 px-3 text-center">
        {[
          { label: "Words", value: analytics.wordCount },
          { label: "Fillers", value: analytics.fillerCount, bad: analytics.fillerCount > 5 },
          { label: `${mins}m${secs.toString().padStart(2,"0")}s`, value: null, label2: "Time" },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl px-2 py-1.5" style={{ background: "rgba(6, 12, 24, 0.5)", border: "1px solid rgba(0, 212, 255, 0.06)" }}>
            {stat.value !== null ? (
              <div className="text-sm font-black font-mono" style={{ color: stat.bad ? "#ff4444" : "rgba(0, 212, 255, 0.8)" }}>
                {stat.value}
              </div>
            ) : (
              <div className="text-xs font-black font-mono" style={{ color: "#a855f7" }}>
                {stat.label}
              </div>
            )}
            <div className="font-mono uppercase tracking-[0.1em]" style={{ fontSize: "8px", color: "rgba(0, 212, 255, 0.3)" }}>
              {stat.value !== null ? stat.label : stat.label2}
            </div>
          </div>
        ))}
      </div>

      {/* Filler word badges */}
      {analytics.fillerWords.length > 0 && (
        <div className="px-3 pb-2.5">
          <div className="font-mono uppercase tracking-[0.15em] mb-1" style={{ fontSize: "9px", color: "rgba(0, 212, 255, 0.3)" }}>
            Detected Fillers
          </div>
          <div className="flex flex-wrap gap-1">
            {analytics.fillerWords.slice(0, 6).map((w) => (
              <span
                key={w}
                className="font-mono px-1.5 py-0.5 rounded-lg"
                style={{
                  background: `${FILLER_COLORS[w] || "#ff4444"}0D`,
                  border: `1px solid ${FILLER_COLORS[w] || "#ff4444"}20`,
                  color: FILLER_COLORS[w] || "#ff4444",
                  fontSize: "9px",
                }}
              >
                "{w}"
              </span>
            ))}
            {analytics.fillerWords.length > 6 && (
              <span className="font-mono" style={{ fontSize: "9px", color: "rgba(0, 212, 255, 0.25)" }}>
                +{analytics.fillerWords.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {analytics.wordCount > 30 && (
        <div className="mx-3 mb-2.5 px-2.5 py-2 rounded-xl" style={{ background: "rgba(0, 212, 255, 0.03)", border: "1px solid rgba(0, 212, 255, 0.08)" }}>
          <div className="font-mono uppercase tracking-[0.15em] mb-0.5" style={{ fontSize: "9px", color: "rgba(0, 212, 255, 0.4)" }}>
            AI Coach
          </div>
          <div className="font-mono leading-relaxed" style={{ fontSize: "10px", color: "rgba(180, 220, 255, 0.6)" }}>
            {analytics.confidenceScore < 40
              ? "Reduce filler words — pause instead of saying 'um'."
              : analytics.wpm > 150
              ? "Slow down — you're speaking too fast for clarity."
              : analytics.vocabularyScore < 40
              ? "Use more domain-specific vocabulary in answers."
              : "Great delivery! Keep up the strong articulation."}
          </div>
        </div>
      )}
    </div>
  );
}
