import { useState, useEffect } from "react";
import { DOMAINS } from "../data/questions";
import type { Domain } from "../data/questions";

interface LandingProps {
  onStart: (domain: Domain) => void;
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            left: `${Math.random() * 100}%`,
            bottom: `-5%`,
            background: i % 3 === 0 ? "rgba(0,212,255,0.5)" : i % 3 === 1 ? "rgba(119,0,255,0.4)" : "rgba(255,0,255,0.3)",
            animation: `float-particle ${8 + Math.random() * 12}s ease-in-out ${Math.random() * 8}s infinite`,
            filter: `blur(${Math.random() > 0.5 ? 1 : 0}px)`,
          }}
        />
      ))}
    </div>
  );
}

function PulseRings() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${200 + i * 120}px`,
            height: `${200 + i * 120}px`,
            borderColor: `rgba(0, 212, 255, ${0.08 - i * 0.02})`,
            animation: `ring-pulse ${3 + i}s ease-in-out ${i * 0.5}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function Landing({ onStart }: LandingProps) {
  const [selected, setSelected] = useState<Domain | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden grid-bg">
      <div className="aurora-bg" />
      <div className="scan-line" />
      <FloatingParticles />

      <div
        className="relative z-10 flex flex-col items-center max-w-5xl w-full px-6 py-12 gap-12"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}
      >
        <div className="flex flex-col items-center gap-6 text-center relative">
          <PulseRings />

          <div className="flex items-center gap-4 relative z-10">
            <div
              className="text-4xl"
              style={{
                color: "#ff4444",
                animation: "heartbeat 1s ease-in-out infinite",
                filter: "drop-shadow(0 0 12px rgba(255, 68, 68, 0.6))",
              }}
            >
              ♥
            </div>
            <div className="flex flex-col items-center">
              <div
                className="text-[10px] font-mono uppercase tracking-[0.5em] mb-2"
                style={{ color: "rgba(0, 212, 255, 0.6)" }}
              >
                Next-Generation Biometric Intelligence
              </div>
              <h1
                className="text-6xl md:text-8xl font-black gradient-text leading-none"
                style={{ fontFamily: "'Orbitron', monospace", letterSpacing: "-0.02em" }}
              >
                HOLO-SYNC
              </h1>
            </div>
            <div
              className="text-4xl"
              style={{
                color: "#ff4444",
                animation: "heartbeat 1s ease-in-out infinite",
                animationDelay: "0.5s",
                filter: "drop-shadow(0 0 12px rgba(255, 68, 68, 0.6))",
              }}
            >
              ♥
            </div>
          </div>

          <div className="neon-line w-48 mx-auto" />

          <p
            className="text-base md:text-lg max-w-2xl leading-relaxed font-light"
            style={{ color: "rgba(180, 220, 240, 0.75)" }}
          >
            The Universal Biometric Interviewer — your webcam reads your heartbeat,
            and our 3D AI adapts in real-time to your emotional state.
          </p>

          <div className="flex gap-3 flex-wrap justify-center mt-1">
            {["rPPG Heart Tracking", "3D Empathetic Avatar", "Cross-Fire Panel Mode", "Bluff Detector"].map(f => (
              <span key={f} className="feature-badge rounded-full px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-cyan-400/70">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="w-full">
          <div className="flex items-center gap-4 mb-5">
            <div className="neon-line flex-1" />
            <span className="text-[10px] font-mono text-cyan-400/50 uppercase tracking-[0.4em]">
              Select Your Domain
            </span>
            <div className="neon-line flex-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOMAINS.map((domain, idx) => {
              const isSelected = selected?.id === domain.id;
              const isHovered = hovered === domain.id;
              return (
                <button
                  key={domain.id}
                  onClick={() => setSelected(domain)}
                  onMouseEnter={() => setHovered(domain.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={`relative text-left rounded-2xl transition-all duration-[400ms] cursor-pointer overflow-hidden group
                    ${isSelected ? "glass-card-selected" : "glass-card"}`}
                  style={{
                    padding: "1.25rem",
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(20px)",
                    transition: `opacity 0.6s ease ${idx * 0.1}s, transform 0.6s ease ${idx * 0.1}s, border-color 0.4s, box-shadow 0.4s, background 0.4s`,
                    boxShadow: isSelected
                      ? `0 0 30px ${domain.color}30, 0 12px 40px rgba(0,0,0,0.4)`
                      : isHovered
                      ? "0 8px 32px rgba(0,0,0,0.3)"
                      : "0 4px 20px rgba(0,0,0,0.2)",
                  }}
                >
                  {isSelected && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${domain.color}, transparent)`,
                        boxShadow: `0 0 20px ${domain.color}60`,
                      }}
                    />
                  )}

                  <div className="absolute inset-0 overflow-hidden rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at 50% 0%, ${domain.color}10 0%, transparent 60%)`,
                      }}
                    />
                  </div>

                  <div className="relative flex items-start gap-3">
                    <div
                      className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
                      style={{
                        background: `${domain.color}12`,
                        border: `1px solid ${domain.color}25`,
                      }}
                    >
                      {domain.icon}
                    </div>
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="font-bold text-sm text-white/90 tracking-wide">{domain.label}</div>
                      <div className="text-xs text-gray-400/80 leading-relaxed">{domain.description}</div>
                      {domain.panelMode && (
                        <div
                          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] mt-0.5"
                          style={{ color: domain.color }}
                        >
                          <span
                            className="inline-block w-1 h-1 rounded-full animate-pulse"
                            style={{ background: domain.color, boxShadow: `0 0 6px ${domain.color}` }}
                          />
                          Panel Mode — 3 Avatars
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 w-full max-w-md">
          {selected && (
            <div
              className="flex flex-col items-center gap-1.5 text-center"
              style={{
                animation: "float 3s ease-in-out infinite",
              }}
            >
              <div className="text-sm font-medium" style={{ color: "rgba(180, 220, 240, 0.7)" }}>
                Selected: <span className="font-bold" style={{ color: selected.color }}>{selected.label}</span>
              </div>
              {selected.panelMode && (
                <div className="text-[10px] font-mono text-amber-400/60 uppercase tracking-wider">
                  3 interviewers will cross-examine you simultaneously
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => selected && onStart(selected)}
            disabled={!selected}
            className={`relative w-full py-4 rounded-2xl font-black text-base uppercase tracking-[0.2em] ${
              selected ? "cta-button text-cyan-300" : "bg-gray-800/30 border border-gray-700/30 text-gray-600 cursor-not-allowed"
            }`}
          >
            <span className="relative z-10">
              {selected ? `Initialize ${selected.label}` : "Select a Domain Above"}
            </span>
          </button>

          <p
            className="text-[10px] font-mono uppercase tracking-[0.2em]"
            style={{ color: "rgba(0, 212, 255, 0.25)" }}
          >
            Camera access required for biometric tracking
          </p>
        </div>
      </div>
    </div>
  );
}
