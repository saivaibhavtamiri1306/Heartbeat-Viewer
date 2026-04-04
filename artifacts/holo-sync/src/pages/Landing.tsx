import { useState } from "react";
import { DOMAINS } from "../data/questions";
import type { Domain } from "../data/questions";

interface LandingProps {
  onStart: (domain: Domain) => void;
}

export default function Landing({ onStart }: LandingProps) {
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

        </div>

        <div className="w-full">
          <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-4 text-center">
            Select Your Domain
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {DOMAINS.map((domain) => (
              <button
                key={domain.id}
                onClick={() => onStart(domain)}
                onMouseEnter={() => setHovered(domain.id)}
                onMouseLeave={() => setHovered(null)}
                className={`relative text-left p-4 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden group ${
                  hovered === domain.id
                    ? "border-cyan-500/50 bg-cyan-500/5"
                    : "border-gray-700/60 bg-gray-900/40"
                }`}
              >
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

        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <p className="text-xs text-gray-500 text-center font-mono">
            Click a domain to configure your interview
          </p>
          <p className="text-xs text-gray-600 text-center font-mono">
            Camera access required for biometric heart tracking
          </p>
        </div>
      </div>
    </div>
  );
}
