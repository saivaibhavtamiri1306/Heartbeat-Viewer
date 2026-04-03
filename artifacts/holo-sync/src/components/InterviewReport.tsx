import { useState, useEffect } from "react";
import type { SpeechAnalytics } from "../hooks/useSpeechRecognition";
import type { EyeContactData } from "../hooks/useEyeContact";

interface AnswerEvaluation {
  question: string;
  answer: string;
  score: number;
  strengths: string;
  weaknesses: string;
  suggestion: string;
  timeTaken: number;
  avatarName?: string;
}

interface InterviewReportProps {
  domain: { label: string; color: string; icon: string };
  difficulty: string;
  score: { communication: number; technical: number; stress: number };
  analytics: SpeechAnalytics;
  eyeContact: EyeContactData;
  bpmHistory: number[];
  sessionTime: number;
  answerCount: number;
  evaluations: AnswerEvaluation[];
  adaptiveTriggers: number;
  bluffTriggers: number;
  onClose: () => void;
}

function StatCard({ label, value, unit, color, icon }: {
  label: string; value: string | number; unit?: string; color: string; icon: string;
}) {
  return (
    <div className="flex flex-col items-center p-3 rounded-lg border bg-black/40" style={{ borderColor: `${color}33` }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-black font-mono" style={{ color }}>{value}<span className="text-xs opacity-60">{unit}</span></div>
      <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mt-1 text-center">{label}</div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(value), 100); }, [value]);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-gray-400">{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 8px ${color}44` }} />
      </div>
    </div>
  );
}

function MiniChart({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return <div className="text-xs text-gray-600 font-mono">No data</div>;
  const max = Math.max(...data, 120);
  const min = Math.min(...data, 50);
  const range = max - min || 1;
  const w = 300;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(" ");

  const fillPoints = `0,${height} ${points} ${w},${height}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polygon points={fillPoints} fill={`${color}15`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <text x="5" y="12" fill={`${color}88`} fontSize="9" fontFamily="monospace">{max} BPM</text>
      <text x="5" y={height - 3} fill={`${color}88`} fontSize="9" fontFamily="monospace">{min} BPM</text>
    </svg>
  );
}

export default function InterviewReport({
  domain, difficulty, score, analytics, eyeContact,
  bpmHistory, sessionTime, answerCount, evaluations,
  adaptiveTriggers, bluffTriggers, onClose,
}: InterviewReportProps) {
  const overall = Math.round((score.communication + score.technical + score.stress) / 3);
  const avgBpm = bpmHistory.length > 0
    ? Math.round(bpmHistory.reduce((a, b) => a + b, 0) / bpmHistory.length)
    : 0;
  const maxBpm = bpmHistory.length > 0 ? Math.max(...bpmHistory) : 0;
  const minBpm = bpmHistory.length > 0 ? Math.min(...bpmHistory) : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const avgTimePer = answerCount > 0 ? Math.round(sessionTime / answerCount) : 0;

  const grade = overall >= 90 ? "A+" : overall >= 80 ? "A" : overall >= 70 ? "B+" :
    overall >= 60 ? "B" : overall >= 50 ? "C" : overall >= 40 ? "D" : "F";
  const gradeColor = overall >= 80 ? "#00ff88" : overall >= 60 ? "#00d4ff" : overall >= 40 ? "#ffaa00" : "#ff4444";

  const speechRate = analytics.wordCount > 0 && sessionTime > 0
    ? Math.round(analytics.wordCount / (sessionTime / 60))
    : 0;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 pb-20">
        <div className="text-center mb-8">
          <div className="text-xs font-mono text-cyan-500/60 uppercase tracking-[0.3em] mb-2">Interview Complete</div>
          <div className="text-3xl font-black font-mono mb-1"
            style={{ background: "linear-gradient(135deg,#00d4ff,#7700ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            PERFORMANCE REPORT
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-sm font-mono" style={{ color: domain.color }}>{domain.icon} {domain.label}</span>
            <span className="text-xs font-mono text-gray-500">|</span>
            <span className={`text-xs font-mono uppercase ${difficulty === "hard" ? "text-red-400" : difficulty === "easy" ? "text-green-400" : "text-yellow-400"}`}>{difficulty}</span>
          </div>
        </div>

        <div className="flex items-center justify-center mb-8">
          <div className="relative w-32 h-32">
            <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
              <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="64" cy="64" r="56" fill="none" stroke={gradeColor} strokeWidth="8"
                strokeDasharray={`${(overall / 100) * 352} 352`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px ${gradeColor})`, transition: "stroke-dasharray 1.5s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-black font-mono" style={{ color: gradeColor }}>{grade}</div>
              <div className="text-sm font-mono text-gray-400">{overall}%</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon="⏱" label="Duration" value={formatTime(sessionTime)} color="#00d4ff" />
          <StatCard icon="💬" label="Answers" value={answerCount} color="#7700ff" />
          <StatCard icon="❤️" label="Avg BPM" value={avgBpm} color="#ff4444" />
          <StatCard icon="👁" label="Eye Contact" value={`${eyeContact.percentage}%`} color="#00ff88" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg border border-cyan-500/20 bg-black/40">
            <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">Core Scores</div>
            <div className="flex flex-col gap-3">
              <ScoreBar label="Communication" value={score.communication} color="#00d4ff" />
              <ScoreBar label="Technical Knowledge" value={score.technical} color="#7700ff" />
              <ScoreBar label="Stress Management" value={score.stress} color={score.stress > 60 ? "#00ff88" : "#ff4444"} />
              <ScoreBar label="Eye Contact" value={eyeContact.percentage} color="#00ff88" />
              <ScoreBar label="Vocabulary" value={analytics.vocabularyScore} color="#ffaa00" />
              <ScoreBar label="Confidence" value={analytics.confidenceScore} color="#ff6600" />
            </div>
          </div>

          <div className="p-4 rounded-lg border border-cyan-500/20 bg-black/40">
            <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">Heart Rate Timeline</div>
            <MiniChart data={bpmHistory} color="#ff4444" height={80} />
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-green-400">{minBpm}</div>
                <div className="text-xs font-mono text-gray-500">Min BPM</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-cyan-400">{avgBpm}</div>
                <div className="text-xs font-mono text-gray-500">Avg BPM</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-red-400">{maxBpm}</div>
                <div className="text-xs font-mono text-gray-500">Max BPM</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon="🗣" label="Words Spoken" value={analytics.wordCount} color="#00d4ff" />
          <StatCard icon="⚡" label="Words/Min" value={speechRate} color="#7700ff" />
          <StatCard icon="😬" label="Filler Words" value={analytics.fillerCount} color={analytics.fillerCount > 10 ? "#ff4444" : "#00ff88"} />
          <StatCard icon="⏱" label="Avg Time/Ans" value={avgTimePer} unit="s" color="#ffaa00" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <StatCard icon="🧬" label="Adaptive Triggers" value={adaptiveTriggers} color="#7700ff" />
          <StatCard icon="🔍" label="Bluff Detections" value={bluffTriggers} color="#ff4444" />
          <StatCard icon="📊" label="Overall Grade" value={grade} color={gradeColor} />
        </div>

        {evaluations.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">Answer-by-Answer Breakdown</div>
            <div className="flex flex-col gap-3">
              {evaluations.map((ev, i) => (
                <div key={i} className="p-4 rounded-lg border border-cyan-500/10 bg-black/30">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-cyan-400/40 mb-1">Q{i + 1}{ev.avatarName ? ` — ${ev.avatarName}` : ""}</div>
                      <div className="text-sm text-gray-300 line-clamp-2">{ev.question}</div>
                    </div>
                    <div className="shrink-0 ml-3 flex items-center gap-1">
                      <div className={`text-lg font-black font-mono ${ev.score >= 7 ? "text-green-400" : ev.score >= 5 ? "text-yellow-400" : "text-red-400"}`}>
                        {ev.score}/10
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono line-clamp-1 mb-2 italic">"{ev.answer.slice(0, 100)}{ev.answer.length > 100 ? "…" : ""}"</div>
                  <div className="flex flex-wrap gap-4 text-xs font-mono">
                    <div><span className="text-green-400/60">✓</span> <span className="text-gray-400">{ev.strengths}</span></div>
                    <div><span className="text-red-400/60">✗</span> <span className="text-gray-400">{ev.weaknesses}</span></div>
                  </div>
                  {ev.suggestion && (
                    <div className="mt-1 text-xs font-mono text-cyan-400/50">💡 {ev.suggestion}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 rounded-lg border border-cyan-500/20 bg-black/40 mb-8">
          <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">Key Recommendations</div>
          <div className="flex flex-col gap-2 text-sm font-mono text-gray-300">
            {analytics.fillerCount > 5 && (
              <div className="flex gap-2"><span className="text-yellow-400">⚠</span> Reduce filler words ({analytics.fillerCount} detected). Practice pausing instead of using "um" or "uh".</div>
            )}
            {eyeContact.percentage < 60 && (
              <div className="flex gap-2"><span className="text-yellow-400">⚠</span> Eye contact was {eyeContact.percentage}%. Aim for 60-70% to appear confident and engaged.</div>
            )}
            {score.communication < 60 && (
              <div className="flex gap-2"><span className="text-yellow-400">⚠</span> Communication score is below average. Structure answers using STAR method (Situation, Task, Action, Result).</div>
            )}
            {avgBpm > 100 && (
              <div className="flex gap-2"><span className="text-yellow-400">⚠</span> Average heart rate was elevated ({avgBpm} BPM). Practice box breathing before interviews.</div>
            )}
            {speechRate < 100 && speechRate > 0 && (
              <div className="flex gap-2"><span className="text-cyan-400">💡</span> Speaking pace was slow ({speechRate} WPM). Aim for 120-150 WPM for clarity.</div>
            )}
            {speechRate > 180 && (
              <div className="flex gap-2"><span className="text-yellow-400">⚠</span> Speaking too fast ({speechRate} WPM). Slow down for clarity — aim for 120-150 WPM.</div>
            )}
            {score.technical >= 70 && score.communication >= 70 && (
              <div className="flex gap-2"><span className="text-green-400">✓</span> Strong overall performance. Keep practicing to maintain consistency.</div>
            )}
            {bluffTriggers > 0 && (
              <div className="flex gap-2"><span className="text-red-400">⚠</span> Bluff detector triggered {bluffTriggers} time(s). Be honest about what you don't know.</div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
            style={{ background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.4)", color: "#00d4ff" }}
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export type { AnswerEvaluation };
