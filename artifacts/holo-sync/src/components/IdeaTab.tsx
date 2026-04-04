import { useState } from "react";

interface IdeaTabProps {
  onBack: () => void;
}

export default function IdeaTab({ onBack }: IdeaTabProps) {
  const [problem, setProblem] = useState("");
  const [approach, setApproach] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const isValid = problem.trim() && approach.trim() && description.trim();

  const handleSubmit = () => {
    if (!isValid) return;
    setSubmitted(true);
  };

  const handleCopy = () => {
    const text = `PROBLEM:\n${problem}\n\nAPPROACH:\n${approach}\n\nDESCRIPTION:\n${description}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setProblem("");
    setApproach("");
    setDescription("");
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden grid-bg">
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
            {Math.random() > 0.5 ? "IDEA_SUB" : "PPT_SYNC"}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-3xl w-full px-6 py-8 gap-6">
        <button
          onClick={onBack}
          className="self-start text-xs font-mono text-cyan-400/60 uppercase tracking-widest hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-2"
        >
          <span>←</span> Back to Home
        </button>

        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-[0.3em]">
            PPT Submission Process
          </div>
          <h1
            className="text-3xl md:text-4xl font-black"
            style={{
              fontFamily: "monospace",
              background: "linear-gradient(135deg, #00d4ff, #7700ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            IDEA TAB
          </h1>
          <p className="text-cyan-300/60 text-sm max-w-lg">
            Paste your problem, approach, and description below
          </p>
        </div>

        {!submitted ? (
          <div className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-cyan-400/70 uppercase tracking-widest">
                Problem
              </label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="What problem does your idea solve?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-700/60 bg-gray-900/60 text-white placeholder-gray-500 font-mono text-sm focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-cyan-400/70 uppercase tracking-widest">
                Approach
              </label>
              <textarea
                value={approach}
                onChange={(e) => setApproach(e.target.value)}
                placeholder="How do you plan to solve this problem? What is your approach?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-700/60 bg-gray-900/60 text-white placeholder-gray-500 font-mono text-sm focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-cyan-400/70 uppercase tracking-widest">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your idea in detail — key features, how it works, technologies used..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-gray-700/60 bg-gray-900/60 text-white placeholder-gray-500 font-mono text-sm focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-300 cursor-pointer mt-2"
              style={{
                background: isValid
                  ? "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(119,0,255,0.2))"
                  : "rgba(50,50,50,0.3)",
                border: isValid
                  ? "2px solid rgba(0,212,255,0.6)"
                  : "2px solid rgba(80,80,80,0.3)",
                color: isValid ? "#00d4ff" : "#555",
                boxShadow: isValid ? "0 0 20px rgba(0,212,255,0.15)" : "none",
                cursor: isValid ? "pointer" : "not-allowed",
              }}
            >
              Submit Idea
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-5">
            <div
              className="w-full rounded-xl border p-5 flex flex-col gap-4"
              style={{
                borderColor: "rgba(0,212,255,0.3)",
                background: "rgba(0,212,255,0.04)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest">
                  Submitted Idea
                </div>
                <div
                  className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(34,197,94,0.15)",
                    color: "#22c55e",
                    border: "1px solid rgba(34,197,94,0.3)",
                  }}
                >
                  Saved
                </div>
              </div>

              <div>
                <div className="text-xs font-mono text-cyan-400/50 uppercase tracking-widest mb-1">
                  Problem
                </div>
                <div className="text-gray-300 text-sm font-mono leading-relaxed whitespace-pre-wrap">
                  {problem}
                </div>
              </div>

              <div>
                <div className="text-xs font-mono text-cyan-400/50 uppercase tracking-widest mb-1">
                  Approach
                </div>
                <div className="text-gray-300 text-sm font-mono leading-relaxed whitespace-pre-wrap">
                  {approach}
                </div>
              </div>

              <div>
                <div className="text-xs font-mono text-cyan-400/50 uppercase tracking-widest mb-1">
                  Description
                </div>
                <div className="text-gray-300 text-sm font-mono leading-relaxed whitespace-pre-wrap">
                  {description}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-300 cursor-pointer"
                style={{
                  background: copied
                    ? "rgba(34,197,94,0.15)"
                    : "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(119,0,255,0.15))",
                  border: copied
                    ? "2px solid rgba(34,197,94,0.5)"
                    : "2px solid rgba(0,212,255,0.4)",
                  color: copied ? "#22c55e" : "#00d4ff",
                }}
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={handleReset}
                className="py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-300 cursor-pointer"
                style={{
                  background: "rgba(50,50,50,0.3)",
                  border: "2px solid rgba(100,100,100,0.3)",
                  color: "#888",
                }}
              >
                New Idea
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
