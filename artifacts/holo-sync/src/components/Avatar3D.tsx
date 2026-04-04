import { useState, useEffect, useRef, useCallback } from "react";
import avatarChairman from "@assets/8c9509071f0cc8c00e1d0d40ddb37f56_1775290103056.jpg";
import avatarMember1 from "@assets/3bdea5f546bb0eae992501ddbbb71394_1775290075982.jpg";
import avatarMember2 from "@assets/539a7c4c33978728de8528842fa08a59_1775290062146.jpg";

const PANEL_AVATARS_IMG = [
  { src: avatarChairman, label: "Chairman" },
  { src: avatarMember1, label: "Member 1" },
  { src: avatarMember2, label: "Member 2" },
];

const EMOTION_COLORS: Record<string, { primary: string }> = {
  neutral:    { primary: "#00d4ff" },
  empathetic: { primary: "#00ff88" },
  stern:      { primary: "#ff3333" },
  curious:    { primary: "#ffaa00" },
  stressed:   { primary: "#ff00ff" },
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
  src,
  emotion,
  isSpeaking,
  label,
  isActive,
  getAmplitude,
  size = "medium",
}: {
  src: string;
  emotion: string;
  isSpeaking: boolean;
  label?: string;
  isActive?: boolean;
  getAmplitude?: () => number;
  size?: "small" | "medium";
}) {
  const ec = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const [amp, setAmp] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [rotX, setRotX] = useState(0);
  const timeRef = useRef(0);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      timeRef.current += 0.016;

      const currentAmp = (isSpeaking && getAmplitude) ? getAmplitude() : 0;
      setAmp(prev => prev + (currentAmp - prev) * 0.25);

      setRotY(Math.sin(timeRef.current * 0.5) * 8);
      setRotX(Math.sin(timeRef.current * 0.35) * 3);

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frameRef.current); };
  }, [isSpeaking, getAmplitude]);

  const px = size === "small" ? 112 : 180;
  const speaking = isSpeaking && isActive !== false;
  const mouthH = speaking ? 4 + amp * 20 : 0;
  const mouthW = speaking ? 18 + amp * 14 : 16;
  const mouthBottom = size === "small" ? 26 : 42;
  const glowIntensity = speaking ? 0.6 + amp * 0.4 : 0.3;

  return (
    <div className="flex flex-col items-center gap-2" style={{ perspective: "600px" }}>
      <div
        ref={containerRef}
        style={{
          width: px,
          height: px,
          borderRadius: "50%",
          overflow: "hidden",
          position: "relative",
          border: `3px solid ${ec.primary}`,
          boxShadow: isActive !== false
            ? `0 0 ${20 + amp * 30}px ${ec.primary}${Math.round(glowIntensity * 255).toString(16).padStart(2, "0")}, 0 0 ${40 + amp * 40}px ${ec.primary}40, 0 8px 32px rgba(0,0,0,0.5)`
            : "0 4px 16px rgba(0,0,0,0.3)",
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${1 + (speaking ? amp * 0.04 : 0)})`,
          transformStyle: "preserve-3d",
          transition: "box-shadow 0.15s ease",
          opacity: isActive === false ? 0.45 : 1,
        }}
      >
        <img
          src={src}
          alt="AI Interviewer"
          className="w-full h-full object-cover"
          style={{
            filter: `brightness(${isActive !== false ? 1.05 : 0.7}) contrast(1.1) saturate(1.15)`,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${ec.primary}10 0%, transparent 40%, transparent 60%, ${ec.primary}08 100%)`,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "15%",
            width: "70%",
            height: "30%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)",
            borderRadius: "50%",
            pointerEvents: "none",
            filter: "blur(6px)",
          }}
        />

        {speaking && (
          <div
            style={{
              position: "absolute",
              bottom: mouthBottom,
              left: "50%",
              transform: "translateX(-50%)",
              width: mouthW,
              height: Math.max(mouthH, 2),
              borderRadius: "50%",
              background: `radial-gradient(ellipse, rgba(60,20,20,0.85) 30%, rgba(40,10,10,0.6) 100%)`,
              border: "1px solid rgba(180,80,80,0.3)",
              transition: "width 0.05s, height 0.05s",
              pointerEvents: "none",
            }}
          />
        )}

        {speaking && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              boxShadow: `inset 0 0 20px ${ec.primary}30`,
              pointerEvents: "none",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {label && (
        <span
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{
            color: ec.primary,
            border: `1px solid ${ec.primary}40`,
            background: isActive !== false ? `${ec.primary}15` : "transparent",
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
  const ec = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;

  if (panelMode) {
    const panelEmotions = ["stern", "curious", "neutral"];

    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-end gap-8">
          {PANEL_AVATARS_IMG.map((avatar, i) => (
            <AvatarCard
              key={i}
              src={avatar.src}
              emotion={panelEmotions[i]}
              isSpeaking={isSpeaking && activeSpeakerIndex === i}
              label={avatar.label}
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
          background: `${ec.primary}15`,
          border: `1px solid ${ec.primary}60`,
          color: ec.primary,
          boxShadow: `0 0 20px ${ec.primary}30`,
        }}
      >
        {emotion.toUpperCase()}
      </div>

      <AvatarCard
        src={avatarMember1}
        emotion={emotion}
        isSpeaking={isSpeaking}
        getAmplitude={getAmplitude}
        size="medium"
      />

      <div
        className="text-xs font-mono tracking-widest flex items-center gap-2"
        style={{ color: ec.primary }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ec.primary }} />
        {bpm} BPM
      </div>
    </div>
  );
}
