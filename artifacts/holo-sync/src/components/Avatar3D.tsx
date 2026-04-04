import { useEffect, useRef, useCallback } from "react";
import avatarChairman from "@assets/8c9509071f0cc8c00e1d0d40ddb37f56_1775290103056.jpg";
import avatarMember1 from "@assets/3bdea5f546bb0eae992501ddbbb71394_1775290075982.jpg";
import avatarMember2 from "@assets/539a7c4c33978728de8528842fa08a59_1775290062146.jpg";

const PANEL_AVATARS_IMG = [
  { src: avatarChairman, label: "Chairman" },
  { src: avatarMember1, label: "Member 1" },
  { src: avatarMember2, label: "Member 2" },
];

const EMOTION_COLORS: Record<string, string> = {
  neutral: "#00d4ff",
  empathetic: "#00ff88",
  stern: "#ff3333",
  curious: "#ffaa00",
  stressed: "#ff00ff",
};

interface TalkingHeadProps {
  src: string;
  isSpeaking: boolean;
  getAmplitude?: () => number;
  color: string;
  width: number;
  height: number;
  isActive?: boolean;
}

function TalkingHead({ src, isSpeaking, getAmplitude, color, width, height, isActive = true }: TalkingHeadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<number>(0);
  const smoothAmp = useRef(0);
  const timeRef = useRef(0);
  const blinkTimer = useRef(0);
  const isBlinking = useRef(false);
  const blinkProgress = useRef(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      loadedRef.current = true;
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let active = true;

    const draw = () => {
      if (!active) return;
      frameRef.current = requestAnimationFrame(draw);

      const img = imgRef.current;
      if (!img || !loadedRef.current) return;

      timeRef.current += 0.016;
      const t = timeRef.current;

      const rawAmp = (isSpeaking && isActive && getAmplitude) ? getAmplitude() : 0;
      smoothAmp.current += (rawAmp - smoothAmp.current) * 0.3;
      const amp = smoothAmp.current;

      blinkTimer.current += 0.016;
      if (!isBlinking.current && blinkTimer.current > 3 + Math.random() * 4) {
        isBlinking.current = true;
        blinkTimer.current = 0;
        blinkProgress.current = 0;
      }
      if (isBlinking.current) {
        blinkProgress.current += 0.12;
        if (blinkProgress.current >= 1) {
          isBlinking.current = false;
          blinkProgress.current = 0;
        }
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.save();

      const headRotY = Math.sin(t * 0.4) * 3;
      const headRotX = Math.sin(t * 0.3) * 2;
      const headBob = isSpeaking && isActive ? Math.sin(t * 3) * amp * 2 : 0;
      const speakNod = isSpeaking && isActive ? Math.sin(t * 2.5) * amp * 1.5 : 0;

      const cx = w / 2;
      const cy = h / 2;

      ctx.translate(cx, cy);

      const skewX = headRotY * 0.005;
      const scaleX = 1 - Math.abs(headRotY) * 0.003;
      ctx.transform(scaleX, skewX * 0.3, -skewX * 0.15, 1, 0, headBob + speakNod);

      ctx.translate(-cx, -cy);

      const imgAspect = img.width / img.height;
      const canvasAspect = w / h;
      let drawW: number, drawH: number, drawX: number, drawY: number;

      if (imgAspect > canvasAspect) {
        drawH = h;
        drawW = h * imgAspect;
        drawX = (w - drawW) / 2;
        drawY = 0;
      } else {
        drawW = w;
        drawH = w / imgAspect;
        drawX = 0;
        drawY = (h - drawH) / 2;
      }

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      if (isSpeaking && isActive && amp > 0.02) {
        const mouthCx = w * 0.5 + headRotY * 0.8;
        const mouthCy = h * 0.72 + speakNod;
        const mouthW = w * 0.12 + amp * w * 0.08;
        const mouthH = amp * h * 0.08 + 2;

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(mouthCx, mouthCy, mouthW, mouthH, 0, 0, Math.PI * 2);
        ctx.clip();

        ctx.drawImage(img, drawX, drawY + mouthH * 0.6, drawW, drawH);

        const grad = ctx.createRadialGradient(mouthCx, mouthCy, 0, mouthCx, mouthCy, mouthW);
        grad.addColorStop(0, "rgba(30,10,10,0.9)");
        grad.addColorStop(0.6, "rgba(50,15,15,0.7)");
        grad.addColorStop(1, "rgba(80,30,30,0.3)");
        ctx.fillStyle = grad;
        ctx.fill();

        if (amp > 0.15) {
          ctx.beginPath();
          ctx.ellipse(mouthCx, mouthCy - mouthH * 0.25, mouthW * 0.7, mouthH * 0.15, 0, Math.PI, 0);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fill();
        }

        ctx.restore();
      }

      if (isBlinking.current) {
        const bp = Math.sin(blinkProgress.current * Math.PI);
        const eyeY = h * 0.4;
        const eyeW = w * 0.08;
        const eyeH = eyeW * 0.3 * bp;

        ctx.fillStyle = `rgba(200,160,130,${bp * 0.9})`;

        ctx.beginPath();
        ctx.ellipse(w * 0.38 + headRotY * 0.5, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(w * 0.62 + headRotY * 0.5, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      ctx.save();
      const glowAlpha = isSpeaking && isActive ? 0.15 + amp * 0.2 : 0.05;
      const gradient = ctx.createRadialGradient(cx, cy, w * 0.3, cx, cy, w * 0.55);
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(1, `${color}${Math.round(glowAlpha * 255).toString(16).padStart(2, "0")}`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.25, w * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.filter = "blur(15px)";
      ctx.fill();
      ctx.filter = "none";
      ctx.restore();
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => { active = false; cancelAnimationFrame(frameRef.current); };
  }, [src, isSpeaking, getAmplitude, color, width, height, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={width * 2}
      height={height * 2}
      style={{
        width,
        height,
        borderRadius: "50%",
        border: `3px solid ${isActive ? color : color + "40"}`,
        boxShadow: isActive
          ? `0 0 25px ${color}60, 0 0 50px ${color}25, 0 8px 32px rgba(0,0,0,0.4)`
          : "0 4px 16px rgba(0,0,0,0.3)",
        opacity: isActive ? 1 : 0.45,
        transition: "border-color 0.3s, box-shadow 0.3s, opacity 0.3s",
      }}
    />
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
  emotion,
  isSpeaking,
  bpm,
  panelMode,
  activeSpeakerIndex = 0,
  getAmplitude,
}: Avatar3DProps) {
  const ec = EMOTION_COLORS[emotion] || "#00d4ff";

  if (panelMode) {
    const panelColors = ["#ff3333", "#ffaa00", "#00d4ff"];

    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-end gap-8">
          {PANEL_AVATARS_IMG.map((avatar, i) => {
            const active = activeSpeakerIndex === i;
            const sz = active ? 170 : 120;
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <TalkingHead
                  src={avatar.src}
                  isSpeaking={isSpeaking}
                  getAmplitude={active ? getAmplitude : undefined}
                  color={panelColors[i]}
                  width={sz}
                  height={sz}
                  isActive={active}
                />
                <span
                  className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    color: panelColors[i],
                    border: `1px solid ${panelColors[i]}${active ? "90" : "30"}`,
                    background: active ? `${panelColors[i]}15` : "transparent",
                  }}
                >
                  {avatar.label}
                </span>
              </div>
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
        style={{
          background: `${ec}15`,
          border: `1px solid ${ec}60`,
          color: ec,
          boxShadow: `0 0 20px ${ec}30`,
        }}
      >
        {emotion.toUpperCase()}
      </div>

      <TalkingHead
        src={avatarMember1}
        isSpeaking={isSpeaking}
        getAmplitude={getAmplitude}
        color={ec}
        width={180}
        height={180}
      />

      <div
        className="text-xs font-mono tracking-widest flex items-center gap-2"
        style={{ color: ec }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ec }} />
        {bpm} BPM
      </div>
    </div>
  );
}
