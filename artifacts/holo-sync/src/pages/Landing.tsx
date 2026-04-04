import { useState } from "react";
import { DOMAINS } from "../data/questions";
import type { Domain } from "../data/questions";

interface LandingProps {
  onStart: (domain: Domain) => void;
  onOpenIdea?: () => void;
}

export default function Landing({ onStart, onOpenIdea }: LandingProps) {
  const [selected, setSelected] = useState<Domain | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden grid-bg">
      <div className="scan-line" />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-cyan-500/10 font-mono text-xs"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `data-stream ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 5}s infinite`,
            }}
          >
            {Math.random() > 0.5 ? "01010110" : "NEURAL_SYN"}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-4xl w-full px-6 py-12 gap-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <div className="text-4xl animate-heartbeat" style={{ color: "#ff4444" }}>♥</div>
            <div>
              <div className="text-xs font-mono text-cyan-400 uppercase tracking-[0.4em] mb-1">
                Next-Generation Biometric Intelligence
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-glow-cyan"
                style={{
                  fontFamily: "monospace",
                  background: "linear-gradient(135deg, #00d4ff, #7700ff, #ff00ff)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.02em",
                }}>
                HOLO-SYNC
              </h1>
            </div>
            <div className="text-4xl animate-heartbeat" style={{ color: "#ff4444", animationDelay: "0.5s" }}>♥</div>
          </div>
          <p className="text-cyan-300/80 text-lg max-w-2xl leading-relaxed font-light">
            The Universal Biometric Interviewer — your webcam reads your heartbeat,
            and our 3D AI adapts in real-time to your emotional state.
          </p>

          <div className="flex gap-4 flex-wrap justify-center text-xs font-mono text-cyan-500/60 uppercase tracking-widest">
            <span className="border border-cyan-500/20 rounded px-2 py-1">rPPG Heart Tracking</span>
            <span className="border border-cyan-500/20 rounded px-2 py-1">3D Empathetic Avatar</span>
            <span className="border border-cyan-500/20 rounded px-2 py-1">Cross-Fire Panel Mode</span>
            <span className="border border-cyan-500/20 rounded px-2 py-1">Bluff Detector</span>
          </div>

          {onOpenIdea && (
            <button
              onClick={onOpenIdea}
              className="mt-2 px-6 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-300 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, rgba(119,0,255,0.2), rgba(0,212,255,0.15))",
                border: "2px solid rgba(119,0,255,0.5)",
                color: "#a855f7",
                boxShadow: "0 0 15px rgba(119,0,255,0.15)",
              }}
            >
              Idea Tab — PPT Submission
            </button>
          )}
        </div>

        <div className="w-full">
          <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-4 text-center">
            Select Your Domain
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {DOMAINS.map((domain) => (
              <button
                key={domain.id}
                onClick={() => setSelected(domain)}
                onMouseEnter={() => setHovered(domain.id)}
                onMouseLeave={() => setHovered(null)}
                className={`relative text-left p-4 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden group ${
                  selected?.id === domain.id
                    ? "border-cyan-400 bg-cyan-500/15"
                    : hovered === domain.id
                    ? "border-cyan-500/50 bg-cyan-500/5"
                    : "border-gray-700/60 bg-gray-900/40"
                }`}
                style={{
                  boxShadow: selected?.id === domain.id
                    ? `0 0 20px ${domain.color}44`
                    : "none",
                }}
              >
                {selected?.id === domain.id && (
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background: domain.color }}
                  />
                )}
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{domain.icon}</span>
                  <div className="flex flex-col gap-1">
                    <div className="font-bold text-sm text-white">{domain.label}</div>
                    <div className="text-xs text-gray-400 leading-relaxed">{domain.description}</div>
                    {domain.panelMode && (
                      <div className="text-xs font-mono uppercase tracking-wider"
                        style={{ color: domain.color }}>
                        ⚡ Panel Mode — 3 Avatars
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          {selected && (
            <div className="text-sm text-cyan-300/80 text-center font-mono">
              Selected: <span className="font-bold" style={{ color: selected.color }}>{selected.label}</span>
              {selected.panelMode && <div className="text-xs text-yellow-400/70 mt-1">⚠ Panel mode — 3 interviewers will cross-examine you simultaneously</div>}
            </div>
          )}

          <button
            onClick={() => selected && onStart(selected)}
            disabled={!selected}
            className="relative w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest transition-all duration-300 overflow-hidden group"
            style={{
              background: selected
                ? "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(119,0,255,0.2))"
                : "rgba(50,50,50,0.3)",
              border: selected ? "2px solid rgba(0,212,255,0.6)" : "2px solid rgba(80,80,80,0.3)",
              color: selected ? "#00d4ff" : "#555",
              boxShadow: selected ? "0 0 30px rgba(0,212,255,0.2)" : "none",
              cursor: selected ? "pointer" : "not-allowed",
            }}
          >
            {selected && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            )}
            {selected ? `⚡ Initialize ${selected.label} Interview` : "Select a Domain Above"}
          </button>

          <p className="text-xs text-gray-600 text-center font-mono">
            Camera access required for biometric heart tracking
          </p>
        </div>
      </div>
    </div>
  );
}
