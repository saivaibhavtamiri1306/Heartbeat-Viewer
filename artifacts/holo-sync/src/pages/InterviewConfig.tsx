import { useState } from "react";
import { BACKGROUNDS, TOPICS, type Domain, type Difficulty, type InterviewConfig as IConfig } from "../data/questions";

interface Props {
  domain: Domain;
  onStart: (config: IConfig) => void;
  onBack: () => void;
}

export default function InterviewConfig({ domain, onStart, onBack }: Props) {
  const backgrounds = BACKGROUNDS[domain.id]?.options || [];
  const topics = TOPICS[domain.id] || [];
  const [selectedBg, setSelectedBg] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicId) ? prev.filter(t => t !== topicId) : [...prev, topicId]
    );
  };

  const selectAll = () => setSelectedTopics(topics.map(t => t.id));
  const clearAll = () => setSelectedTopics([]);
  const canStart = selectedBg && selectedTopics.length > 0;

  const handleStart = () => {
    if (!canStart) return;
    onStart({ domain, background: selectedBg, difficulty, topics: selectedTopics });
  };

  const difficultyConfig: { value: Difficulty; label: string; desc: string; color: string; icon: string }[] = [
    { value: "easy", label: "EASY", desc: "Foundational questions, basics & concepts", color: "#00ff88", icon: "🟢" },
    { value: "medium", label: "MEDIUM", desc: "Standard interview level, analytical thinking", color: "#ffaa00", icon: "🟡" },
    { value: "hard", label: "HARD", desc: "Expert level, deep analysis & cross-questioning", color: "#ff4444", icon: "🔴" },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center relative overflow-hidden grid-bg">
      <div className="aurora-bg" />
      <div className="scan-line" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-4 py-8 gap-6 overflow-y-auto" style={{ maxHeight: "100vh" }}>
        <button
          onClick={onBack}
          className="self-start flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-300"
          style={{
            color: "rgba(0, 212, 255, 0.5)",
            border: "1px solid rgba(0, 212, 255, 0.15)",
            background: "rgba(0, 212, 255, 0.04)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.4)";
            e.currentTarget.style.color = "rgba(0, 212, 255, 0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.15)";
            e.currentTarget.style.color = "rgba(0, 212, 255, 0.5)";
          }}
        >
          ← Back to Domains
        </button>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 flex items-center justify-center text-2xl rounded-2xl"
              style={{
                background: `${domain.color}12`,
                border: `1px solid ${domain.color}30`,
                boxShadow: `0 0 20px ${domain.color}15`,
              }}
            >
              {domain.icon}
            </div>
            <div className="text-left">
              <h1 className="text-2xl md:text-3xl font-black tracking-wide" style={{ color: domain.color }}>
                {domain.label}
              </h1>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em]" style={{ color: "rgba(0, 212, 255, 0.4)" }}>
                Interview Configuration
              </div>
            </div>
          </div>
          {domain.panelMode && (
            <div
              className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] px-3 py-1 rounded-full"
              style={{
                color: "#ffaa00",
                background: "rgba(255, 170, 0, 0.06)",
                border: "1px solid rgba(255, 170, 0, 0.2)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Panel Mode — 3 Interviewers
            </div>
          )}
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="flex flex-col gap-4">
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full" style={{ background: domain.color }} />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(0, 212, 255, 0.5)" }}>
                  {BACKGROUNDS[domain.id]?.label || "Educational Background"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                {backgrounds.map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setSelectedBg(bg)}
                    className="text-left px-4 py-2.5 rounded-xl text-sm transition-all duration-300 cursor-pointer"
                    style={{
                      background: selectedBg === bg ? "rgba(0, 212, 255, 0.1)" : "rgba(255, 255, 255, 0.02)",
                      border: selectedBg === bg ? "1px solid rgba(0, 212, 255, 0.35)" : "1px solid rgba(255, 255, 255, 0.04)",
                      color: selectedBg === bg ? "#e0f0ff" : "rgba(180, 190, 210, 0.7)",
                      boxShadow: selectedBg === bg ? "0 0 15px rgba(0, 212, 255, 0.1)" : "none",
                    }}
                  >
                    {selectedBg === bg && <span style={{ color: "#00d4ff" }} className="mr-2">✓</span>}
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-purple-500" />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(0, 212, 255, 0.5)" }}>
                  Difficulty Level
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {difficultyConfig.map((d) => {
                  const isActive = difficulty === d.value;
                  return (
                    <button
                      key={d.value}
                      onClick={() => setDifficulty(d.value)}
                      className="text-left px-4 py-3.5 rounded-xl transition-all duration-300 cursor-pointer"
                      style={{
                        background: isActive ? `${d.color}10` : "rgba(255, 255, 255, 0.02)",
                        border: isActive ? `1px solid ${d.color}50` : "1px solid rgba(255, 255, 255, 0.04)",
                        boxShadow: isActive ? `0 0 20px ${d.color}15` : "none",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: d.color }}
                        >
                          {isActive && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }}
                            />
                          )}
                        </div>
                        <div>
                          <div
                            className="font-bold text-sm tracking-wide"
                            style={{ color: isActive ? d.color : "rgba(200, 210, 220, 0.7)" }}
                          >
                            {d.label}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(140, 150, 170, 0.6)" }}>
                            {d.desc}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="glass-panel rounded-2xl p-5 flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(0, 212, 255, 0.5)" }}>
                    Select Topics
                  </span>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{
                      color: selectedTopics.length > 0 ? "#00d4ff" : "rgba(100, 120, 140, 0.5)",
                      background: selectedTopics.length > 0 ? "rgba(0, 212, 255, 0.08)" : "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${selectedTopics.length > 0 ? "rgba(0, 212, 255, 0.2)" : "rgba(255, 255, 255, 0.05)"}`,
                    }}
                  >
                    {selectedTopics.length}/{topics.length}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button onClick={selectAll} className="text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-colors" style={{ color: "rgba(0, 212, 255, 0.4)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "rgba(0, 212, 255, 0.8)"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(0, 212, 255, 0.4)"}>
                    Select All
                  </button>
                  <button onClick={clearAll} className="text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-colors" style={{ color: "rgba(150, 160, 180, 0.4)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "rgba(150, 160, 180, 0.8)"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(150, 160, 180, 0.4)"}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {topics.map((topic) => {
                  const isSelected = selectedTopics.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className="text-left px-3.5 py-3 rounded-xl transition-all duration-300 cursor-pointer flex items-center gap-2.5"
                      style={{
                        background: isSelected ? "rgba(0, 212, 255, 0.07)" : "rgba(255, 255, 255, 0.02)",
                        border: isSelected ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid rgba(255, 255, 255, 0.04)",
                        color: isSelected ? "#e0f0ff" : "rgba(180, 190, 210, 0.6)",
                      }}
                    >
                      <span className="text-base flex-shrink-0">{topic.icon}</span>
                      <span className="text-xs leading-tight">{topic.label}</span>
                      {isSelected && (
                        <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: "#00d4ff" }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 w-full max-w-md mt-2">
          {selectedBg && (
            <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: "rgba(140, 160, 180, 0.6)" }}>
              <span style={{ color: "rgba(0, 212, 255, 0.5)" }}>{selectedBg}</span>
              <span className="w-1 h-1 rounded-full bg-cyan-500/30" />
              <span style={{ color: difficultyConfig.find(d => d.value === difficulty)?.color }}>
                {difficulty.toUpperCase()}
              </span>
              <span className="w-1 h-1 rounded-full bg-cyan-500/30" />
              <span style={{ color: "rgba(0, 212, 255, 0.5)" }}>
                {selectedTopics.length} topic{selectedTopics.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`relative w-full py-4 rounded-2xl font-black text-base uppercase tracking-[0.2em] ${
              canStart ? "cta-button" : "bg-gray-800/30 border border-gray-700/30 cursor-not-allowed"
            }`}
            style={{
              color: canStart ? domain.color : "#555",
              boxShadow: canStart ? `0 0 40px ${domain.color}20` : "none",
            }}
          >
            <span className="relative z-10">
              {canStart ? `Start ${domain.label} Interview` : "Select Background & Topics"}
            </span>
          </button>

          {!selectedBg && (
            <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "rgba(255, 68, 68, 0.4)" }}>
              ↑ Select your educational background
            </p>
          )}
          {selectedBg && selectedTopics.length === 0 && (
            <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "rgba(255, 68, 68, 0.4)" }}>
              ↑ Select at least one topic
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
