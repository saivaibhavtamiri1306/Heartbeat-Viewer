import { useEffect, useRef, useState } from "react";
import avatarChairman from "@assets/8c9509071f0cc8c00e1d0d40ddb37f56_1775290103056.jpg";
import avatarMember1 from "@assets/3bdea5f546bb0eae992501ddbbb71394_1775290075982.jpg";
import avatarMember2 from "@assets/539a7c4c33978728de8528842fa08a59_1775290062146.jpg";

const PANEL_AVATARS = [
  {
    src: avatarChairman,
    label: "Chairman",
    mouthX: 0.50, mouthY: 0.72,
    mouthW: 0.14, mouthH: 0.04,
    skinColor: "#d4a882",
  },
  {
    src: avatarMember1,
    label: "Member 1",
    mouthX: 0.50, mouthY: 0.73,
    mouthW: 0.13, mouthH: 0.035,
    skinColor: "#d9a98a",
  },
  {
    src: avatarMember2,
    label: "Member 2",
    mouthX: 0.50, mouthY: 0.72,
    mouthW: 0.12, mouthH: 0.035,
    skinColor: "#ecc0a8",
  },
];

const EMOTION_COLORS: Record<string, string> = {
  neutral: "#00d4ff",
  empathetic: "#00ff88",
  stern: "#ff3333",
  curious: "#ffaa00",
  stressed: "#ff00ff",
};

function TalkingAvatar({
  avatarConfig,
  isSpeaking,
  getAmplitude,
  color,
  size,
  isActive = true,
  label,
}: {
  avatarConfig: typeof PANEL_AVATARS[0];
  isSpeaking: boolean;
  getAmplitude?: () => number;
  color: string;
  size: number;
  isActive?: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<number>(0);
  const smoothAmp = useRef(0);
  const timeRef = useRef(Math.random() * 100);
  const blinkTimer = useRef(3 + Math.random() * 4);
  const blinkPhase = useRef(-1);
  const loadedRef = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      loadedRef.current = true;
    };
    img.src = avatarConfig.src;
  }, [avatarConfig.src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let active = true;
    const w = size * 2;
    const h = size * 2;

    const draw = () => {
      if (!active) return;
      frameRef.current = requestAnimationFrame(draw);
      if (!imgRef.current || !loadedRef.current) return;

      const img = imgRef.current;
      timeRef.current += 0.016;
      const t = timeRef.current;

      const rawAmp = (isSpeaking && isActive && getAmplitude) ? getAmplitude() : 0;
      smoothAmp.current += (rawAmp - smoothAmp.current) * 0.25;
      const amp = smoothAmp.current;

      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.clip();

      const imgAspect = img.width / img.height;
      let dw: number, dh: number, dx: number, dy: number;
      if (imgAspect > 1) {
        dh = h;
        dw = h * imgAspect;
        dx = (w - dw) / 2;
        dy = 0;
      } else {
        dw = w;
        dh = w / imgAspect;
        dx = 0;
        dy = (h - dh) / 2;
      }

      const breathe = Math.sin(t * 1.2) * 0.003;
      const bScale = 1 + breathe;
      ctx.translate(w / 2, h / 2);
      ctx.scale(bScale, bScale);
      ctx.translate(-w / 2, -h / 2);

      ctx.drawImage(img, dx, dy, dw, dh);

      if (isSpeaking && isActive && amp > 0.02) {
        const mx = w * avatarConfig.mouthX;
        const my = h * avatarConfig.mouthY;
        const mw = w * avatarConfig.mouthW;
        const baseMh = h * avatarConfig.mouthH;

        const openAmount = amp;
        const mouthOpenH = baseMh + openAmount * h * 0.06;
        const mouthWidth = mw * (1 + openAmount * 0.3);

        ctx.save();

        ctx.beginPath();
        ctx.ellipse(mx, my, mouthWidth * 0.7, mouthOpenH * 1.2, 0, 0, Math.PI * 2);
        ctx.clip();

        const mouthGrad = ctx.createRadialGradient(mx, my, 0, mx, my, mouthWidth * 0.7);
        mouthGrad.addColorStop(0, "#1a0505");
        mouthGrad.addColorStop(0.7, "#2a0808");
        mouthGrad.addColorStop(1, "#3a1010");
        ctx.fillStyle = mouthGrad;
        ctx.fill();

        if (openAmount > 0.15) {
          ctx.beginPath();
          const teethY = my - mouthOpenH * 0.5;
          const teethW = mouthWidth * 0.55;
          const teethH = mouthOpenH * 0.22;
          ctx.roundRect(mx - teethW, teethY, teethW * 2, teethH, 2);
          ctx.fillStyle = "#f0ece4";
          ctx.fill();
        }

        if (openAmount > 0.2) {
          ctx.beginPath();
          const tongueY = my + mouthOpenH * 0.3;
          ctx.ellipse(mx, tongueY, mouthWidth * 0.35, mouthOpenH * 0.25, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#cc6666";
          ctx.fill();
        }

        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(mx - mouthWidth * 0.65, my);
        ctx.quadraticCurveTo(mx, my - baseMh * 0.6, mx + mouthWidth * 0.65, my);
        ctx.strokeStyle = avatarConfig.skinColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(mx - mouthWidth * 0.65, my);
        ctx.quadraticCurveTo(mx, my + mouthOpenH * 1.5, mx + mouthWidth * 0.65, my);
        ctx.strokeStyle = avatarConfig.skinColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      blinkTimer.current -= 0.016;
      if (blinkTimer.current <= 0 && blinkPhase.current < 0) {
        blinkPhase.current = 0;
      }
      if (blinkPhase.current >= 0) {
        blinkPhase.current += 0.1;
        const blink = Math.sin(blinkPhase.current * Math.PI);

        if (blink > 0.1) {
          const eyeY = h * 0.42;
          const eyeW = w * 0.065;
          const eyeH = eyeW * 0.35 * blink;

          ctx.fillStyle = avatarConfig.skinColor;
          ctx.beginPath();
          ctx.ellipse(w * 0.39, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(w * 0.61, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        if (blinkPhase.current >= 1) {
          blinkPhase.current = -1;
          blinkTimer.current = 2.5 + Math.random() * 4;
        }
      }

      ctx.restore();
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      active = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [avatarConfig, isSpeaking, getAmplitude, isActive, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: size, height: size, borderRadius: "50%", overflow: "hidden",
          border: `3px solid ${isActive ? color : color + "40"}`,
          boxShadow: isActive
            ? `0 0 25px ${color}60, 0 0 50px ${color}25, 0 8px 32px rgba(0,0,0,0.4)`
            : `0 4px 16px rgba(0,0,0,0.3)`,
          opacity: isActive ? 1 : 0.45,
          transition: "all 0.3s ease",
        }}
      >
        <canvas
          ref={canvasRef}
          width={size * 2}
          height={size * 2}
          style={{ width: size, height: size, display: "block" }}
        />
      </div>
      {label && (
        <span
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{
            color,
            border: `1px solid ${color}${isActive ? "90" : "30"}`,
            background: isActive ? `${color}15` : "transparent",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

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

export default function Avatar3D({
  emotion, isSpeaking, bpm, panelMode, activeSpeakerIndex = 0, getAmplitude,
}: Avatar3DProps) {
  const ec = EMOTION_COLORS[emotion] || "#00d4ff";

  if (panelMode) {
    const pc = ["#ff3333", "#ffaa00", "#00d4ff"];
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-end gap-6">
          {PANEL_AVATARS.map((a, i) => {
            const active = activeSpeakerIndex === i;
            return (
              <TalkingAvatar
                key={a.label}
                avatarConfig={a}
                isSpeaking={isSpeaking && active}
                getAmplitude={active ? getAmplitude : undefined}
                color={pc[i]}
                size={active ? 170 : 120}
                isActive={active}
                label={a.label}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <div
        className="text-[10px] font-mono uppercase tracking-[0.3em] px-4 py-1.5 rounded-full"
        style={{ background: `${ec}15`, border: `1px solid ${ec}60`, color: ec, boxShadow: `0 0 20px ${ec}30` }}
      >
        {emotion.toUpperCase()}
      </div>
      <TalkingAvatar
        avatarConfig={PANEL_AVATARS[1]}
        isSpeaking={isSpeaking}
        getAmplitude={getAmplitude}
        color={ec}
        size={200}
      />
      <div className="text-xs font-mono tracking-widest flex items-center gap-2" style={{ color: ec }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ec }} />
        {bpm} BPM
      </div>
    </div>
  );
}
