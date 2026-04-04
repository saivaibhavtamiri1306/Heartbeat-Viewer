import { useEffect, useRef, useState } from "react";

const EMOTION_COLORS: Record<string, string> = {
  neutral: "#00d4ff",
  empathetic: "#00ff88",
  stern: "#ff3333",
  curious: "#ffaa00",
  stressed: "#ff00ff",
};

const AVATAR_MODELS = [
  { url: "./avatars/brunette.glb", body: "F" },
  { url: "./avatars/avaturn.glb", body: "F" },
  { url: "./avatars/avatarsdk.glb", body: "M" },
];

const MOOD_MAP: Record<string, string> = {
  neutral: "neutral",
  empathetic: "happy",
  stern: "angry",
  curious: "surprised",
  stressed: "sad",
};

let TalkingHeadClass: any = null;
let thLoadPromise: Promise<any> | null = null;

function loadTalkingHead(): Promise<any> {
  if (TalkingHeadClass) return Promise.resolve(TalkingHeadClass);
  if (thLoadPromise) return thLoadPromise;
  thLoadPromise = import("../vendor/talkinghead.mjs").then((mod) => {
    TalkingHeadClass = mod.TalkingHead;
    return TalkingHeadClass;
  });
  return thLoadPromise;
}

const VISEME_CYCLE = [
  "viseme_aa", "viseme_O", "viseme_E", "viseme_I", "viseme_U",
  "viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD",
];

function TalkingHeadAvatar({
  avatarIndex,
  isSpeaking,
  getAmplitude,
  color,
  size,
  isActive = true,
  label,
  emotion,
}: {
  avatarIndex: number;
  isSpeaking: boolean;
  getAmplitude?: () => number;
  color: string;
  size: number;
  isActive?: boolean;
  label?: string;
  emotion?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<any>(null);
  const initRef = useRef(false);
  const animRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || initRef.current) return;
    initRef.current = true;

    const model = AVATAR_MODELS[avatarIndex % AVATAR_MODELS.length];

    (async () => {
      try {
        const TH = await loadTalkingHead();

        const head = new TH(container, {
          ttsEndpoint: null,
          lipsyncModules: ["en"],
          lipsyncLang: "en",
          cameraView: "head",
          cameraDistance: 0.6,
          cameraX: 0,
          cameraY: 0,
          cameraRotateX: 0,
          cameraRotateY: 0,
          avatarMood: "neutral",
          avatarIdleEyeContact: 0.7,
          statsNode: null,
        });

        await head.showAvatar(
          {
            url: model.url,
            body: model.body,
            avatarMood: "neutral",
            lipsyncLang: "en",
          },
          (ev: any) => {
            if (ev && ev.lengthComputable) {
              const pct = Math.round((ev.loaded / ev.total) * 100);
              if (pct < 100) setLoading(true);
            }
          }
        );

        head.setView("head", { cameraDistance: 0.6 });

        headRef.current = head;
        setLoading(false);
      } catch (err: any) {
        console.error("[TalkingHead] Failed to load:", err);
        setError(err?.message || "Failed to load 3D avatar");
        setLoading(false);
      }
    })();

    return () => {
      cancelAnimationFrame(animRef.current);
      initRef.current = false;
      headRef.current = null;
    };
  }, [avatarIndex]);

  useEffect(() => {
    const head = headRef.current;
    if (!head) return;

    const mood = MOOD_MAP[emotion || "neutral"] || "neutral";
    try {
      head.setMood(mood);
    } catch {}
  }, [emotion]);

  useEffect(() => {
    const head = headRef.current;
    if (!head) return;

    cancelAnimationFrame(animRef.current);

    if (isSpeaking && isActive && getAmplitude) {
      let frameCount = 0;

      const pump = () => {
        const amp = getAmplitude?.() || 0;
        frameCount++;

        if (head.mtAvatar) {
          const jawOpen = head.mtAvatar["jawOpen"];
          if (jawOpen) {
            jawOpen.value = amp * 0.7;
            jawOpen.needsUpdate = true;
          }

          const vi = Math.floor(frameCount / 4) % VISEME_CYCLE.length;
          for (let i = 0; i < VISEME_CYCLE.length; i++) {
            const vk = VISEME_CYCLE[i];
            const mt = head.mtAvatar[vk];
            if (mt) {
              if (i === vi && amp > 0.05) {
                mt.value = amp * 0.5;
              } else {
                mt.value = mt.baseline || 0;
              }
              mt.needsUpdate = true;
            }
          }
        }

        animRef.current = requestAnimationFrame(pump);
      };
      pump();
    } else {
      if (head.mtAvatar) {
        const jawOpen = head.mtAvatar["jawOpen"];
        if (jawOpen) {
          jawOpen.value = jawOpen.baseline || 0;
          jawOpen.needsUpdate = true;
        }
        for (const vk of VISEME_CYCLE) {
          const mt = head.mtAvatar[vk];
          if (mt) {
            mt.value = mt.baseline || 0;
            mt.needsUpdate = true;
          }
        }
      }
    }

    return () => cancelAnimationFrame(animRef.current);
  }, [isSpeaking, isActive, getAmplitude]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "16px",
          overflow: "hidden",
          border: `2px solid ${isActive ? color : color + "40"}`,
          boxShadow: isActive
            ? `0 0 30px ${color}60, 0 0 60px ${color}20, 0 10px 40px rgba(0,0,0,0.5)`
            : `0 4px 20px rgba(0,0,0,0.3)`,
          opacity: isActive ? 1 : 0.45,
          transition: "all 0.4s ease",
          background: "#0a0e18",
          position: "relative",
        }}
      >
        <div
          ref={containerRef}
          style={{
            width: size,
            height: size,
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />
        {loading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: "rgba(0,4,8,0.9)" }}
          >
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: `${color}40`, borderTopColor: color }}
            />
            <span className="text-[10px] font-mono" style={{ color: color + "80" }}>
              Loading 3D...
            </span>
          </div>
        )}
        {error && (
          <div
            className="absolute inset-0 flex items-center justify-center p-4 text-center"
            style={{ background: "rgba(0,4,8,0.95)" }}
          >
            <span className="text-[10px] font-mono text-red-400">{error}</span>
          </div>
        )}
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
  emotion,
  isSpeaking,
  bpm,
  panelMode,
  activeSpeakerIndex = 0,
  getAmplitude,
}: Avatar3DProps) {
  const ec = EMOTION_COLORS[emotion] || "#00d4ff";

  if (panelMode) {
    const pc = ["#ff3333", "#ffaa00", "#00d4ff"];
    const labels = ["Chairman", "Member 1", "Member 2"];
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-end gap-6">
          {[0, 1, 2].map((i) => {
            const active = activeSpeakerIndex === i;
            return (
              <TalkingHeadAvatar
                key={i}
                avatarIndex={i}
                isSpeaking={isSpeaking && active}
                getAmplitude={active ? getAmplitude : undefined}
                color={pc[i]}
                size={active ? 200 : 150}
                isActive={active}
                label={labels[i]}
                emotion={emotion}
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
        style={{
          background: `${ec}15`,
          border: `1px solid ${ec}60`,
          color: ec,
          boxShadow: `0 0 20px ${ec}30`,
        }}
      >
        {emotion.toUpperCase()}
      </div>
      <TalkingHeadAvatar
        avatarIndex={1}
        isSpeaking={isSpeaking}
        getAmplitude={getAmplitude}
        color={ec}
        size={240}
        emotion={emotion}
      />
      <div className="text-xs font-mono tracking-widest flex items-center gap-2" style={{ color: ec }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ec }} />
        {bpm} BPM
      </div>
    </div>
  );
}
