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
  const [hovered, setHovered] = useState<string | null>(null);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicId) ? prev.filter(t => t !== topicId) : [...prev, topicId]
    );
  };

  const selectAll = () => {
    setSelectedTopics(topics.map(t => t.id));
  };

  const clearAll = () => {
    setSelectedTopics([]);
  };

  const canStart = selectedBg && selectedTopics.length > 0;

  const handleStart = () => {
    if (!canStart) return;
    onStart({
      domain,
      background: selectedBg,
      difficulty,
      topics: selectedTopics,
    });
  };

  const difficultyConfig: { value: Difficulty; label: string; desc: string; color: string }[] = [
    { value: "easy", label: "EASY", desc: "Foundational questions, basics & concepts", color: "#00ff88" },
    { value: "medium", label: "MEDIUM", desc: "Standard interview level, analytical thinking", color: "#ffaa00" },
    { value: "hard", label: "HARD", desc: "Expert level, deep analysis & cross-questioning", color: "#ff4444" },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center relative overflow-hidden grid-bg">
      <div className="scan-line" />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-cyan-500/10 font-mono text-xs"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `data-stream ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 5}s infinite`,
            }}
          >
            {Math.random() > 0.5 ? "CONFIG_SYN" : "01010110"}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-4 py-8 gap-6 overflow-y-auto" style={{ maxHeight: "100vh" }}>
        <button
          onClick={onBack}
          className="self-start text-xs font-mono text-cyan-500/60 uppercase tracking-wider hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-2"
        >
          ← Back to Domains
        </button>

        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{domain.icon}</span>
            <h1 className="text-2xl md:text-3xl font-black" style={{ color: domain.color }}>
              {domain.label}
            </h1>
          </div>
          <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-[0.3em]">
            Interview Configuration
          </div>
          {domain.panelMode && (
            <div className="text-xs font-mono text-yellow-400/70">
              ⚡ Panel Mode — 3 Interviewers
            </div>
          )}
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div className="border border-gray-700/60 rounded-xl p-4 bg-gray-900/40">
              <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">
                {BACKGROUNDS[domain.id]?.label || "Educational Background"}
              </div>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                {backgrounds.map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setSelectedBg(bg)}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer border ${
                      selectedBg === bg
                        ? "border-cyan-400 bg-cyan-500/15 text-white"
                        : "border-transparent bg-gray-800/30 text-gray-400 hover:bg-gray-800/50 hover:text-gray-300"
                    }`}
                  >
                    {selectedBg === bg && <span className="text-cyan-400 mr-2">✓</span>}
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-gray-700/60 rounded-xl p-4 bg-gray-900/40">
              <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">
                Difficulty Level
              </div>
              <div className="flex flex-col gap-2">
                {difficultyConfig.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    onMouseEnter={() => setHovered(d.value)}
                    onMouseLeave={() => setHovered(null)}
                    className={`text-left px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer border ${
                      difficulty === d.value
                        ? "bg-opacity-15"
                        : hovered === d.value
                        ? "border-gray-600 bg-gray-800/30"
                        : "border-transparent bg-gray-800/20"
                    }`}
                    style={{
                      borderColor: difficulty === d.value ? d.color : undefined,
                      backgroundColor: difficulty === d.value ? `${d.color}15` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: d.color }}
                      >
                        {difficulty === d.value && (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm" style={{ color: difficulty === d.value ? d.color : "#ccc" }}>
                          {d.label}
                        </div>
                        <div className="text-xs text-gray-500">{d.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="border border-gray-700/60 rounded-xl p-4 bg-gray-900/40 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest">
                  Select Topics ({selectedTopics.length}/{topics.length})
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs font-mono text-cyan-500/60 hover:text-cyan-400 cursor-pointer transition-colors"
                  >
                    Select All
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={clearAll}
                    className="text-xs font-mono text-gray-500 hover:text-gray-400 cursor-pointer transition-colors"
                  >
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
                      className={`text-left px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer border flex items-center gap-2 ${
                        isSelected
                          ? "border-cyan-400/60 bg-cyan-500/10 text-white"
                          : "border-gray-700/40 bg-gray-800/20 text-gray-400 hover:bg-gray-800/40 hover:text-gray-300"
                      }`}
                    >
                      <span className="text-base flex-shrink-0">{topic.icon}</span>
                      <span className="text-xs leading-tight">{topic.label}</span>
                      {isSelected && <span className="text-cyan-400 ml-auto text-xs flex-shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 w-full max-w-md mt-2">
          {selectedBg && (
            <div className="text-xs text-center text-gray-500 font-mono">
              <span className="text-cyan-400/60">Background:</span> {selectedBg}
              <span className="mx-2">•</span>
              <span style={{ color: difficultyConfig.find(d => d.value === difficulty)?.color }}>
                {difficulty.toUpperCase()}
              </span>
              <span className="mx-2">•</span>
              <span className="text-cyan-400/60">{selectedTopics.length} topic{selectedTopics.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="relative w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest transition-all duration-300 overflow-hidden group"
            style={{
              background: canStart
                ? "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(119,0,255,0.2))"
                : "rgba(50,50,50,0.3)",
              border: canStart ? `2px solid ${domain.color}99` : "2px solid rgba(80,80,80,0.3)",
              color: canStart ? domain.color : "#555",
              boxShadow: canStart ? `0 0 30px ${domain.color}22` : "none",
              cursor: canStart ? "pointer" : "not-allowed",
            }}
          >
            {canStart && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            )}
            {canStart ? `⚡ Start ${domain.label} Interview` : "Select Background & Topics"}
          </button>

          {!selectedBg && <p className="text-xs text-red-400/60 font-mono">↑ Select your educational background</p>}
          {selectedBg && selectedTopics.length === 0 && <p className="text-xs text-red-400/60 font-mono">↑ Select at least one topic</p>}
        </div>
      </div>
    </div>
  );
}
