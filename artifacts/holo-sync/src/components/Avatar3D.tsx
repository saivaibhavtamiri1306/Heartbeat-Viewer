import { useEffect, useRef } from "react";

interface Avatar3DProps {
  emotion: string;
  isSpeaking: boolean;
  bpm: number;
  panelMode?: boolean;
  panelAvatars?: Array<{ name: string; color: string; icon: string }>;
  activeSpeakerIndex?: number;
  mouthOpenness?: number;
  spokenText?: string;
}

export default function Avatar3D({
  emotion,
  isSpeaking,
  bpm,
  panelMode,
  panelAvatars,
  activeSpeakerIndex = 0,
  spokenText,
}: Avatar3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getEmotionColor = () => {
    switch (emotion) {
      case "stern": return "#ff6b6b";
      case "empathetic": return "#00ff88";
      case "curious": return "#ffaa00";
      case "stressed": return "#ff4444";
      default: return "#00d4ff";
    }
  };

  const getGlowIntensity = () => {
    if (!isSpeaking) return "0 0 20px";
    return "0 0 40px";
  };

  if (panelMode && panelAvatars) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center relative"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      >
        <div className="flex gap-8">
          {panelAvatars.map((avatar, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center gap-3 transition-all duration-300"
              style={{
                opacity: idx === activeSpeakerIndex && isSpeaking ? 1 : 0.6,
                transform: idx === activeSpeakerIndex && isSpeaking ? "scale(1.1)" : "scale(1)",
              }}
            >
              <div
                className="relative w-32 h-40 rounded-xl flex items-center justify-center font-bold text-2xl"
                style={{
                  background: `linear-gradient(135deg, ${avatar.color}20, ${avatar.color}10)`,
                  border: `2px solid ${avatar.color}`,
                  boxShadow:
                    idx === activeSpeakerIndex && isSpeaking
                      ? `0 0 30px ${avatar.color}, inset 0 0 30px ${avatar.color}15`
                      : `0 0 15px ${avatar.color}66`,
                }}
              >
                <div
                  style={{
                    fontSize: "3rem",
                    animation: idx === activeSpeakerIndex && isSpeaking ? "pulse 0.8s ease-in-out infinite" : "none",
                  }}
                >
                  {avatar.icon}
                </div>
              </div>
              <div className="text-xs font-mono uppercase tracking-widest text-center" style={{ color: avatar.color }}>
                {avatar.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const emotionColor = getEmotionColor();

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)",
      }}
    >
      <svg
        width="300"
        height="400"
        viewBox="0 0 300 400"
        style={{
          filter: `drop-shadow(${getGlowIntensity()} ${emotionColor})`,
        }}
      >
        {/* Holographic head outline */}
        <g stroke={emotionColor} strokeWidth="2" fill="none">
          {/* Head circle */}
          <circle cx="150" cy="100" r="60" opacity="0.8" />

          {/* Face structure */}
          <path d="M 120 80 L 180 80" opacity="0.6" />
          <path d="M 110 100 L 190 100" opacity="0.7" />
          <path d="M 130 110 L 170 110" opacity="0.6" />

          {/* Eyes */}
          <circle cx="135" cy="95" r="5" opacity={isSpeaking ? 1 : 0.7} />
          <circle cx="165" cy="95" r="5" opacity={isSpeaking ? 1 : 0.7} />

          {/* Nose */}
          <path d="M 150 95 L 150 115" opacity="0.6" />

          {/* Mouth */}
          <path
            d="M 140 120 Q 150 125 160 120"
            opacity={isSpeaking ? 1 : 0.5}
            strokeWidth={isSpeaking ? 3 : 2}
          />

          {/* Shoulders/Neck */}
          <path d="M 120 160 Q 150 170 180 160" opacity="0.7" />
          <rect x="110" y="160" width="80" height="80" rx="10" opacity="0.6" />

          {/* Holographic lines effect */}
          {[0, 30, 60, 90, 120].map((offset) => (
            <line
              key={`hline-${offset}`}
              x1="120"
              y1={100 + offset}
              x2="180"
              y2={100 + offset}
              opacity="0.2"
              strokeDasharray="5,5"
            />
          ))}
        </g>
      </svg>

      {/* Emotion indicator */}
      <div
        className="absolute bottom-12 text-xs font-mono uppercase tracking-widest px-3 py-1.5 rounded-full"
        style={{
          background: `${emotionColor}20`,
          border: `1px solid ${emotionColor}`,
          color: emotionColor,
          boxShadow: `0 0 10px ${emotionColor}`,
        }}
      >
        {emotion.toUpperCase()}
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute top-12 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={`audio-${i}`}
              className="w-1 bg-cyan-400 rounded-full"
              style={{
                height: `${8 + Math.sin(Date.now() / 100 + i) * 8}px`,
                animation: "pulse 0.5s ease-in-out infinite",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* BPM display */}
      <div className="absolute bottom-4 text-xs font-mono text-cyan-400" style={{ color: emotionColor }}>
        {bpm} BPM
      </div>
    </div>
  );
}
