import { useState, useEffect } from "react";
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

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

  const handleClose = () => {
    setVisible(false);
    setTimeout(onBack, 200);
  };

  const difficultyConfig: { value: Difficulty; label: string; desc: string; color: string }[] = [
    { value: "easy", label: "EASY", desc: "Foundational questions, basics & concepts", color: "#00ff88" },
    { value: "medium", label: "MEDIUM", desc: "Standard interview level, analytical thinking", color: "#ffaa00" },
    { value: "hard", label: "HARD", desc: "Expert level, deep analysis & cross-questioning", color: "#ff4444" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        transition: "all 0.25s ease",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div
        className="relative z-10 w-full max-w-4xl mx-4 rounded-2xl border overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0a0f1a 0%, #060b14 100%)",
          borderColor: `${domain.color}40`,
          boxShadow: `0 0 60px ${domain.color}15, 0 0 120px rgba(0,0,0,0.8)`,
          maxHeight: "85vh",
          transition: "all 0.25s ease",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${domain.color}, transparent)` }}
        />

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{domain.icon}</span>
            <div>
              <h2 className="text-lg font-black" style={{ color: domain.color }}>
                {domain.label}
              </h2>
              <div className="text-xs font-mono text-cyan-400/50 uppercase tracking-[0.2em]">
                Interview Configuration
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {domain.panelMode && (
              <div className="text-xs font-mono text-yellow-400/70 px-2 py-1 border border-yellow-400/20 rounded">
                ⚡ Panel Mode
              </div>
            )}
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg border border-gray-700/60 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: "calc(85vh - 140px)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="flex flex-col gap-4">
              <div className="border border-gray-700/50 rounded-xl p-4 bg-gray-900/30">
                <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-3">
                  {BACKGROUNDS[domain.id]?.label || "Educational Background"}
                </div>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
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

              <div className="border border-gray-700/50 rounded-xl p-4 bg-gray-900/30">
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
                      className={`text-left px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer border ${
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
              <div className="border border-gray-700/50 rounded-xl p-4 bg-gray-900/30 flex-1">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {topics.map((topic) => {
                    const isSelected = selectedTopics.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className={`text-left px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer border flex items-center gap-2 ${
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
        </div>

        <div className="px-6 py-4 border-t border-gray-800/60 flex flex-col items-center gap-2">
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
          <div className="flex gap-3 w-full max-w-lg">
            <button
              onClick={handleClose}
              className="px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-300 cursor-pointer border border-gray-700/60 text-gray-400 hover:text-white hover:border-gray-500 bg-gray-900/40"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="relative flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 overflow-hidden group"
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
              {canStart ? `⚡ Start Interview` : "Select Background & Topics"}
            </button>
          </div>
          {!selectedBg && <p className="text-xs text-red-400/60 font-mono">↑ Select your educational background</p>}
          {selectedBg && selectedTopics.length === 0 && <p className="text-xs text-red-400/60 font-mono">↑ Select at least one topic</p>}
        </div>
      </div>
    </div>
  );
}
