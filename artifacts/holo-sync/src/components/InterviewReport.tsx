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

interface StressMarker {
  questionIndex: number;
  bpm: number;
  type: string;
  timestamp: number;
  confidence?: number;
}

interface SessionRecord {
  date: string;
  domain: string;
  difficulty: string;
  overall: number;
  stressEndurance: number;
  eyeContact: number;
  composureBreaks: number;
  avgBpm: number;
  communication: number;
  technical: number;
  fillerCount: number;
  speechRate: number;
}

function getSessionHistory(): SessionRecord[] {
  try {
    return JSON.parse(localStorage.getItem("holosync_sessions") || "[]");
  } catch { return []; }
}

function saveSession(record: SessionRecord) {
  const history = getSessionHistory();
  history.push(record);
  if (history.length > 20) history.splice(0, history.length - 20);
  localStorage.setItem("holosync_sessions", JSON.stringify(history));
}

function computeProgress(current: SessionRecord, history: SessionRecord[]) {
  const past = history.filter(h => h.domain === current.domain);
  if (past.length < 1) return null;

  const recent = past.slice(-3);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const pastEye = avg(recent.map(s => s.eyeContact));
  const pastEndurance = avg(recent.map(s => s.stressEndurance));
  const pastOverall = avg(recent.map(s => s.overall));
  const pastComm = avg(recent.map(s => s.communication));
  const pastBreaks = avg(recent.map(s => s.composureBreaks));
  const pastFiller = avg(recent.map(s => s.fillerCount));

  return {
    sessionCount: past.length + 1,
    eyeContactDelta: Math.round(current.eyeContact - pastEye),
    enduranceDelta: Math.round(current.stressEndurance - pastEndurance),
    overallDelta: Math.round(current.overall - pastOverall),
    commDelta: Math.round(current.communication - pastComm),
    breaksDelta: Math.round(current.composureBreaks - pastBreaks),
    fillerDelta: Math.round(current.fillerCount - pastFiller),
  };
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
  stressMarkers: StressMarker[];
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

function PressureTimeline({ data, stressMarkers, height = 100 }: { data: number[]; stressMarkers: StressMarker[]; height?: number }) {
  if (data.length < 2) return <div className="text-xs text-gray-600 font-mono">No biometric data collected</div>;
  const max = Math.max(...data, 120);
  const min = Math.min(...data, 50);
  const range = max - min || 1;
  const w = 500;
  const baseline = data.slice(0, Math.min(10, data.length)).reduce((a, b) => a + b, 0) / Math.min(10, data.length);
  const stressThreshold = Math.max(baseline + 15, 95);

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 20) - 10;
    return `${x},${y}`;
  }).join(" ");

  const fillPoints = `0,${height} ${points} ${w},${height}`;
  const thresholdY = height - ((stressThreshold - min) / range) * (height - 20) - 10;

  const spikeZones: {startX: number; endX: number}[] = [];
  let inSpike = false;
  let spikeStart = 0;
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    if (v > stressThreshold && !inSpike) { inSpike = true; spikeStart = x; }
    if (v <= stressThreshold && inSpike) { inSpike = false; spikeZones.push({ startX: spikeStart, endX: x }); }
  });
  if (inSpike) spikeZones.push({ startX: spikeStart, endX: w });

  return (
    <svg width="100%" height={height + 20} viewBox={`0 0 ${w} ${height + 20}`} preserveAspectRatio="none">
      {spikeZones.map((zone, i) => (
        <rect key={i} x={zone.startX} y={0} width={zone.endX - zone.startX} height={height}
          fill="rgba(255,68,68,0.08)" />
      ))}
      <line x1="0" y1={thresholdY} x2={w} y2={thresholdY} stroke="rgba(255,68,68,0.3)" strokeWidth="1" strokeDasharray="4 4" />
      <polygon points={fillPoints} fill="rgba(255,68,68,0.08)" />
      <polyline points={points} fill="none" stroke="#ff4444" strokeWidth="2" strokeLinejoin="round" />
      {stressMarkers.map((m, i) => {
        const firstTs = stressMarkers.length > 0 && data.length > 1 ? stressMarkers[0].timestamp : m.timestamp;
        const lastTs = stressMarkers.length > 0 ? stressMarkers[stressMarkers.length - 1].timestamp : m.timestamp;
        const timeRange = lastTs - firstTs || 1;
        const timeFraction = data.length > 1 ? Math.max(0, Math.min(1, (m.timestamp - firstTs) / timeRange)) : 0;
        const markerX = timeFraction * w;
        const nearestIdx = Math.round(timeFraction * (data.length - 1));
        const markerBpm = data[nearestIdx] || m.bpm;
        const markerY = height - ((markerBpm - min) / range) * (height - 20) - 10;
        return (
          <g key={i}>
            <circle cx={markerX} cy={markerY} r="4" fill="#ff4444" stroke="#fff" strokeWidth="1.5" />
            <text x={markerX} y={markerY - 8} fill="#ff6b6b" fontSize="7" fontFamily="monospace" textAnchor="middle">
              {m.type === "composure_break" ? "BROKE" : m.type === "hr_spike" ? "SPIKE" : "STRESS"}
            </text>
          </g>
        );
      })}
      <text x="5" y="12" fill="rgba(255,68,68,0.6)" fontSize="8" fontFamily="monospace">{max} BPM</text>
      <text x="5" y={height - 3} fill="rgba(255,68,68,0.6)" fontSize="8" fontFamily="monospace">{min} BPM</text>
      <text x={w - 5} y={thresholdY - 4} fill="rgba(255,68,68,0.4)" fontSize="7" fontFamily="monospace" textAnchor="end">STRESS LINE</text>
    </svg>
  );
}

function computeStressEndurance(bpmHistory: number[]) {
  if (bpmHistory.length < 5) return { stability: 50, recovery: 50, endurance: 50, overall: 50 };

  const baseline = bpmHistory.slice(0, Math.min(10, bpmHistory.length)).reduce((a, b) => a + b, 0) / Math.min(10, bpmHistory.length);
  const stressThreshold = Math.max(baseline + 15, 95);

  let stressFrames = 0;
  let maxConsecutiveCalm = 0;
  let currentCalm = 0;
  let stressEpisodes = 0;
  let recoveries = 0;
  let wasStressed = false;

  bpmHistory.forEach(bpm => {
    if (bpm > stressThreshold) {
      stressFrames++;
      if (!wasStressed) { wasStressed = true; stressEpisodes++; }
      currentCalm = 0;
    } else {
      if (wasStressed) { recoveries++; wasStressed = false; }
      currentCalm++;
      maxConsecutiveCalm = Math.max(maxConsecutiveCalm, currentCalm);
    }
  });

  const stressRatio = stressFrames / bpmHistory.length;
  const stability = Math.round(Math.max(0, Math.min(100, (1 - stressRatio) * 100)));

  const recoveryScore = stressEpisodes > 0
    ? Math.round(Math.min(100, (recoveries / stressEpisodes) * 80 + 20))
    : stressFrames === 0 ? 90 : 20;

  const endurance = Math.round(Math.max(0, Math.min(100, (maxConsecutiveCalm / bpmHistory.length) * 100 + 20)));

  const overall = Math.round((stability * 0.4 + recoveryScore * 0.3 + endurance * 0.3));

  return { stability, recovery: recoveryScore, endurance, overall };
}

export default function InterviewReport({
  domain, difficulty, score, analytics, eyeContact,
  bpmHistory, sessionTime, answerCount, evaluations,
  adaptiveTriggers, bluffTriggers, stressMarkers, onClose,
}: InterviewReportProps) {
  const overall = Math.round((score.communication + score.technical + score.stress) / 3);
  const avgBpm = bpmHistory.length > 0
    ? Math.round(bpmHistory.reduce((a, b) => a + b, 0) / bpmHistory.length)
    : 0;
  const maxBpm = bpmHistory.length > 0 ? Math.max(...bpmHistory) : 0;
  const minBpm = bpmHistory.length > 0 ? Math.min(...bpmHistory) : 0;
  const stressEndurance = computeStressEndurance(bpmHistory);
  const composureBreaks = stressMarkers.filter(m => m.type === "composure_break");
  const telemetryEvents = stressMarkers.filter(m => m.type !== "composure_break");

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const avgTimePer = answerCount > 0 ? Math.round(sessionTime / answerCount) : 0;

  const speechRate = analytics.wordCount > 0 && sessionTime > 0
    ? Math.round(analytics.wordCount / (sessionTime / 60))
    : 0;

  const currentRecord: SessionRecord = {
    date: new Date().toISOString(),
    domain: domain.label,
    difficulty,
    overall,
    stressEndurance: stressEndurance.overall,
    eyeContact: eyeContact.percentage,
    composureBreaks: composureBreaks.length,
    avgBpm,
    communication: score.communication,
    technical: score.technical,
    fillerCount: analytics.fillerCount,
    speechRate,
  };

  const [progress, setProgress] = useState<ReturnType<typeof computeProgress>>(null);
  const [sessionNum, setSessionNum] = useState(1);

  useEffect(() => {
    const history = getSessionHistory();
    const prog = computeProgress(currentRecord, history);
    setProgress(prog);
    setSessionNum((history.filter(h => h.domain === domain.label).length) + 1);
    saveSession(currentRecord);
  }, []);

  const grade = overall >= 90 ? "A+" : overall >= 80 ? "A" : overall >= 70 ? "B+" :
    overall >= 60 ? "B" : overall >= 50 ? "C" : overall >= 40 ? "D" : "F";
  const gradeColor = overall >= 80 ? "#00ff88" : overall >= 60 ? "#00d4ff" : overall >= 40 ? "#ffaa00" : "#ff4444";

  const seColor = stressEndurance.overall >= 70 ? "#00ff88" : stressEndurance.overall >= 50 ? "#ffaa00" : "#ff4444";

  return (
    <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 pb-20">
        <div className="text-center mb-8">
          <div className="text-xs font-mono text-red-500/60 uppercase tracking-[0.3em] mb-2">Pressure Training Complete</div>
          <div className="text-3xl font-black font-mono mb-1"
            style={{ background: "linear-gradient(135deg,#ff4444,#ff8800)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            PERFORMANCE DEBRIEF
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-sm font-mono" style={{ color: domain.color }}>{domain.icon} {domain.label}</span>
            <span className="text-xs font-mono text-gray-500">|</span>
            <span className={`text-xs font-mono uppercase ${difficulty === "hard" ? "text-red-400" : difficulty === "easy" ? "text-green-400" : "text-yellow-400"}`}>{difficulty}</span>
            <span className="text-xs font-mono text-gray-500">|</span>
            <span className="text-xs font-mono text-cyan-400/60">Session #{sessionNum}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 mb-8">
          <div className="relative w-28 h-28">
            <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
              <circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
              <circle cx="56" cy="56" r="48" fill="none" stroke={gradeColor} strokeWidth="7"
                strokeDasharray={`${(overall / 100) * 302} 302`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px ${gradeColor})`, transition: "stroke-dasharray 1.5s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-black font-mono" style={{ color: gradeColor }}>{grade}</div>
              <div className="text-xs font-mono text-gray-400">{overall}%</div>
            </div>
          </div>

          <div className="relative w-28 h-28">
            <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
              <circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
              <circle cx="56" cy="56" r="48" fill="none" stroke={seColor} strokeWidth="7"
                strokeDasharray={`${(stressEndurance.overall / 100) * 302} 302`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px ${seColor})`, transition: "stroke-dasharray 1.5s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-black font-mono" style={{ color: seColor }}>{stressEndurance.overall}</div>
              <div className="text-[9px] font-mono text-gray-400 uppercase">Endurance</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon="⏱" label="Duration" value={formatTime(sessionTime)} color="#4ecdc4" />
          <StatCard icon="💬" label="Answers" value={answerCount} color="#a78bfa" />
          <StatCard icon="❤️" label="Avg BPM" value={avgBpm} color="#ff4444" />
          <StatCard icon="👁" label="Eye Contact" value={`${eyeContact.percentage}%`} color="#00ff88" />
        </div>

        <div className="p-4 rounded-lg border border-red-500/20 bg-black/40 mb-6">
          <div className="text-xs font-mono text-red-400/60 uppercase tracking-widest mb-3">⚔ Pressure Timeline</div>
          <PressureTimeline data={bpmHistory} stressMarkers={stressMarkers} height={100} />
          <div className="grid grid-cols-4 gap-2 mt-3">
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
              <div className="text-xs font-mono text-gray-500">Peak BPM</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-orange-400">{composureBreaks.length}</div>
              <div className="text-xs font-mono text-gray-500">Composure Breaks</div>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-orange-500/20 bg-black/40 mb-6">
          <div className="text-xs font-mono text-orange-400/60 uppercase tracking-widest mb-3">⚡ Stress Endurance Score</div>
          <div className="flex flex-col gap-3">
            <ScoreBar label="Stability Under Pressure" value={stressEndurance.stability} color={stressEndurance.stability >= 60 ? "#00ff88" : "#ff4444"} />
            <ScoreBar label="Recovery Speed" value={stressEndurance.recovery} color={stressEndurance.recovery >= 60 ? "#4ecdc4" : "#ff8800"} />
            <ScoreBar label="Composure Endurance" value={stressEndurance.endurance} color={stressEndurance.endurance >= 60 ? "#a78bfa" : "#ff4444"} />
          </div>
        </div>

        {progress && (
          <div className="p-4 rounded-lg border border-green-500/20 bg-black/40 mb-6">
            <div className="text-xs font-mono text-green-400/60 uppercase tracking-widest mb-3">📈 Progress Since Last {progress.sessionCount > 2 ? `${Math.min(progress.sessionCount - 1, 3)} Sessions` : "Session"}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Eye Contact", delta: progress.eyeContactDelta, unit: "%" },
                { label: "Stress Endurance", delta: progress.enduranceDelta, unit: "pts" },
                { label: "Overall Score", delta: progress.overallDelta, unit: "pts" },
                { label: "Communication", delta: progress.commDelta, unit: "pts" },
                { label: "Composure Breaks", delta: progress.breaksDelta, unit: "", invert: true },
                { label: "Filler Words", delta: progress.fillerDelta, unit: "", invert: true },
              ].map(({ label, delta, unit, invert }) => {
                const displayDelta = invert ? -delta : delta;
                const improved = displayDelta > 0;
                const neutral = displayDelta === 0;
                return (
                  <div key={label} className="flex items-center gap-2 p-2 rounded-lg border bg-black/30"
                    style={{ borderColor: improved ? "rgba(0,255,136,0.15)" : neutral ? "rgba(128,128,128,0.15)" : "rgba(255,68,68,0.15)" }}>
                    <div className="text-lg">{improved ? "📈" : neutral ? "➡" : "📉"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-gray-400">{label}</div>
                      <div className={`text-sm font-bold font-mono ${improved ? "text-green-400" : neutral ? "text-gray-400" : "text-red-400"}`}>
                        {invert ? (delta < 0 ? `${Math.abs(delta)} fewer` : delta > 0 ? `${delta} more` : "Same") : `${displayDelta > 0 ? "+" : ""}${displayDelta}${unit}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg border border-cyan-500/20 bg-black/40">
            <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">Core Scores</div>
            <div className="flex flex-col gap-3">
              <ScoreBar label="Communication" value={score.communication} color="#4ecdc4" />
              <ScoreBar label="Technical Knowledge" value={score.technical} color="#a78bfa" />
              <ScoreBar label="Stress Management" value={score.stress} color={score.stress > 60 ? "#00ff88" : "#ff4444"} />
              <ScoreBar label="Eye Contact" value={eyeContact.percentage} color="#00ff88" />
              <ScoreBar label="Vocabulary" value={analytics.vocabularyScore} color="#ffc078" />
              <ScoreBar label="Confidence" value={analytics.confidenceScore} color="#ff6600" />
            </div>
          </div>

          <div className="p-4 rounded-lg border border-cyan-500/20 bg-black/40">
            <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">Speech Analytics</div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="🗣" label="Words Spoken" value={analytics.wordCount} color="#4ecdc4" />
              <StatCard icon="⚡" label="Words/Min" value={speechRate} color="#a78bfa" />
              <StatCard icon="😬" label="Filler Words" value={analytics.fillerCount} color={analytics.fillerCount > 10 ? "#ff4444" : "#00ff88"} />
              <StatCard icon="⏱" label="Avg Time/Ans" value={avgTimePer} unit="s" color="#ffc078" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <StatCard icon="⬆" label="Pressure Escalations" value={adaptiveTriggers} color="#ff4444" />
          <StatCard icon="🔍" label="Bluff Detections" value={bluffTriggers} color="#ff8800" />
          <StatCard icon="📊" label="Overall Grade" value={grade} color={gradeColor} />
        </div>

        {composureBreaks.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-mono text-red-400/60 uppercase tracking-widest mb-3">🔴 Composure Break Points</div>
            <div className="flex flex-col gap-2">
              {composureBreaks.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-red-500/10 bg-black/30">
                  <div className="text-red-400 text-lg">⚠</div>
                  <div className="flex-1">
                    <div className="text-xs font-mono text-gray-300">
                      Q{m.questionIndex + 1} — Lost composure under pressure
                      {m.confidence ? <span className="text-red-400/60 ml-2">(Confidence: {m.confidence}%)</span> : null}
                    </div>
                    <div className="text-xs font-mono text-gray-500">{m.bpm > 0 ? `${m.bpm} BPM` : "Elevated"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {telemetryEvents.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-mono text-orange-400/60 uppercase tracking-widest mb-3">📊 Stress Events</div>
            <div className="flex flex-col gap-2">
              {telemetryEvents.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-orange-500/10 bg-black/30">
                  <div className="text-orange-400 text-lg">{m.type === "hr_spike" ? "📈" : "⚡"}</div>
                  <div className="flex-1">
                    <div className="text-xs font-mono text-gray-300">
                      Q{m.questionIndex + 1} — {m.type === "hr_spike" ? "Heart rate spike" : m.type === "sustained_stress" ? "Sustained elevated HR" : "Stress detected"}
                      {m.confidence ? <span className="text-orange-400/60 ml-2">(Confidence: {m.confidence}%)</span> : null}
                    </div>
                    <div className="text-xs font-mono text-gray-500">{m.bpm > 0 ? `${m.bpm} BPM` : "Elevated"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        <div className="p-4 rounded-lg border border-red-500/20 bg-black/40 mb-8">
          <div className="text-xs font-mono text-red-400/60 uppercase tracking-widest mb-3">Pressure Training Feedback</div>
          <div className="flex flex-col gap-2 text-sm font-mono text-gray-300">
            {composureBreaks.length > 2 && (
              <div className="flex gap-2"><span className="text-red-400">⚠</span> You lost composure {composureBreaks.length} times. This is a clear area for improvement. Practice exposure to high-pressure scenarios.</div>
            )}
            {composureBreaks.length === 0 && bpmHistory.length > 10 && (
              <div className="flex gap-2"><span className="text-green-400">✓</span> No composure breaks detected. Strong stress resistance. Try harder difficulty next time.</div>
            )}
            {analytics.fillerCount > 5 && (
              <div className="flex gap-2"><span className="text-red-400">⚠</span> {analytics.fillerCount} filler words detected. In real interviews, this signals uncertainty. Eliminate them.</div>
            )}
            {eyeContact.percentage < 60 && (
              <div className="flex gap-2"><span className="text-red-400">⚠</span> Eye contact was only {eyeContact.percentage}%. Interviewers interpret this as lack of confidence or dishonesty.</div>
            )}
            {score.communication < 60 && (
              <div className="flex gap-2"><span className="text-orange-400">△</span> Communication needs work. Structure answers with STAR method. Be concise and direct.</div>
            )}
            {avgBpm > 100 && (
              <div className="flex gap-2"><span className="text-red-400">⚠</span> Average heart rate was {avgBpm} BPM — elevated throughout. Your body is betraying your nerves. Train more.</div>
            )}
            {speechRate < 100 && speechRate > 0 && (
              <div className="flex gap-2"><span className="text-orange-400">△</span> Speaking pace was {speechRate} WPM — too slow. Aim for 120-150 WPM. Speed signals confidence.</div>
            )}
            {speechRate > 180 && (
              <div className="flex gap-2"><span className="text-orange-400">△</span> Speaking at {speechRate} WPM — too fast. Rushing suggests panic. Slow down, maintain control.</div>
            )}
            {score.technical >= 70 && score.communication >= 70 && composureBreaks.length <= 1 && (
              <div className="flex gap-2"><span className="text-green-400">✓</span> Strong performance under pressure. You're building real interview resilience.</div>
            )}
            {bluffTriggers > 0 && (
              <div className="flex gap-2"><span className="text-red-400">⚠</span> Bluff detected {bluffTriggers} time(s). Real interviewers will catch this. Own what you don't know.</div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
            style={{ background: "rgba(78,205,196,0.15)", border: "1px solid rgba(78,205,196,0.4)", color: "#4ecdc4" }}
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export type { AnswerEvaluation };
