import { useState, useEffect, useRef } from "react";
import avatarImage from "@assets/studio-shot-photo-professional-headshot-260nw-2752558817_1775288452602.webp";

const EMOTION_COLORS: Record<string, { primary: string; glow: string }> = {
  neutral:    { primary: "#00d4ff", glow: "0 0 30px rgba(0,212,255,0.6), 0 0 60px rgba(0,212,255,0.3)" },
  empathetic: { primary: "#00ff88", glow: "0 0 30px rgba(0,255,136,0.6), 0 0 60px rgba(0,255,136,0.3)" },
  stern:      { primary: "#ff3333", glow: "0 0 30px rgba(255,51,51,0.6), 0 0 60px rgba(255,51,51,0.3)" },
  curious:    { primary: "#ffaa00", glow: "0 0 30px rgba(255,170,0,0.6), 0 0 60px rgba(255,170,0,0.3)" },
  stressed:   { primary: "#ff00ff", glow: "0 0 30px rgba(255,0,255,0.6), 0 0 60px rgba(255,0,255,0.3)" },
};

interface Avatar3DProps {
  emotion: string;
  isSpeaking: boolean;
  bpm: number;
  panelMode?: boolean;
  panelAvatars?: Array<{ name: string; color: string; icon: string }>;
  activeSpeakerIndex?: number;
  mouthOpenness?: number;
  spokenText?: string;
  getAmplitude?: () => number;
}

function AvatarCard({
  emotion,
  isSpeaking,
  label,
  isActive,
  getAmplitude,
  size = "medium",
}: {
  emotion: string;
  isSpeaking: boolean;
  label?: string;
  isActive?: boolean;
  getAmplitude?: () => number;
  size?: "small" | "medium";
}) {
  const emotionConfig = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
  const [pulseScale, setPulseScale] = useState(1);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!isSpeaking || !getAmplitude) {
      setPulseScale(1);
      return;
    }
    let active = true;
    const pump = () => {
      if (!active) return;
      const amp = getAmplitude();
      setPulseScale(1 + amp * 0.06);
      frameRef.current = requestAnimationFrame(pump);
    };
    frameRef.current = requestAnimationFrame(pump);
    return () => { active = false; cancelAnimationFrame(frameRef.current); };
  }, [isSpeaking, getAmplitude]);

  const dim = size === "small" ? "w-28 h-28" : "w-44 h-44";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${dim} rounded-full overflow-hidden relative transition-all duration-300`}
        style={{
          border: `3px solid ${emotionConfig.primary}`,
          boxShadow: isActive !== false ? emotionConfig.glow : "none",
          transform: `scale(${pulseScale})`,
          opacity: isActive === false ? 0.5 : 1,
        }}
      >
        <img
          src={avatarImage}
          alt="AI Interviewer"
          className="w-full h-full object-cover"
        />
        {isSpeaking && isActive !== false && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{ background: `radial-gradient(circle, ${emotionConfig.primary}20 0%, transparent 70%)` }}
          />
        )}
      </div>
      {label && (
        <span
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{
            color: emotionConfig.primary,
            border: `1px solid ${emotionConfig.primary}40`,
            background: isActive !== false ? `${emotionConfig.primary}15` : "transparent",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default function Avatar3D({
  emotion,
  isSpeaking,
  bpm,
  panelMode,
  activeSpeakerIndex = 0,
  getAmplitude,
}: Avatar3DProps) {
  const emotionConfig = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;

  if (panelMode) {
    const panelEmotions = ["stern", "curious", "neutral"];
    const panelLabels = ["Chairman", "Member 1", "Member 2"];

    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-end gap-6">
          {panelLabels.map((label, i) => (
            <AvatarCard
              key={i}
              emotion={panelEmotions[i]}
              isSpeaking={isSpeaking && activeSpeakerIndex === i}
              label={label}
              isActive={activeSpeakerIndex === i}
              getAmplitude={activeSpeakerIndex === i ? getAmplitude : undefined}
              size={activeSpeakerIndex === i ? "medium" : "small"}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <div
        className="text-[10px] font-mono uppercase tracking-[0.3em] px-4 py-1.5 rounded-full"
        style={{
          background: `${emotionConfig.primary}15`,
          border: `1px solid ${emotionConfig.primary}60`,
          color: emotionConfig.primary,
          boxShadow: `0 0 20px ${emotionConfig.primary}30`,
        }}
      >
        {emotion.toUpperCase()}
      </div>

      <AvatarCard
        emotion={emotion}
        isSpeaking={isSpeaking}
        getAmplitude={getAmplitude}
        size="medium"
      />

      <div
        className="text-xs font-mono tracking-widest flex items-center gap-2"
        style={{ color: emotionConfig.primary }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: emotionConfig.primary }} />
        {bpm} BPM
      </div>
    </div>
  );
}
