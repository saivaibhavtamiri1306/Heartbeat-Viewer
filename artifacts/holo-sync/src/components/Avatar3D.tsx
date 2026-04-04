import { useRef } from "react";
import avatarImage from "@assets/studio-shot-photo-professional-headshot-260nw-2752558817_1775288452602.webp";

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
                className="relative w-32 h-40 rounded-xl flex items-center justify-center font-bold text-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${avatar.color}20, ${avatar.color}10)`,
                  border: `2px solid ${avatar.color}`,
                  boxShadow:
                    idx === activeSpeakerIndex && isSpeaking
                      ? `0 0 30px ${avatar.color}, inset 0 0 30px ${avatar.color}15`
                      : `0 0 15px ${avatar.color}66`,
                }}
              >
                <img
                  src={avatarImage}
                  alt={avatar.name}
                  className="w-full h-full object-cover"
                />
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
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          width: "280px",
          height: "340px",
          border: `3px solid ${emotionColor}`,
          boxShadow: `0 0 40px ${emotionColor}66, inset 0 0 40px ${emotionColor}22`,
        }}
      >
        <img
          src={avatarImage}
          alt="Avatar"
          className="w-full h-full object-cover"
          style={{
            filter: isSpeaking ? `drop-shadow(0 0 20px ${emotionColor})` : "none",
            transition: "filter 0.3s ease",
          }}
        />
      </div>

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
      <div className="absolute bottom-4 text-xs font-mono" style={{ color: emotionColor }}>
        {bpm} BPM
      </div>
    </div>
  );
}
