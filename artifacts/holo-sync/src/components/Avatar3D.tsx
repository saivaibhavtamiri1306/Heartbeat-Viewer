import { useEffect, useRef } from "react";
import * as THREE from "three";
import avatarChairman from "@assets/8c9509071f0cc8c00e1d0d40ddb37f56_1775290103056.jpg";
import avatarMember1 from "@assets/3bdea5f546bb0eae992501ddbbb71394_1775290075982.jpg";
import avatarMember2 from "@assets/539a7c4c33978728de8528842fa08a59_1775290062146.jpg";

const PANEL_AVATARS = [
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

function ThreeImageAvatar({
  src,
  isSpeaking,
  getAmplitude,
  color,
  size,
  isActive = true,
  label,
}: {
  src: string;
  isSpeaking: boolean;
  getAmplitude?: () => number;
  color: string;
  size: number;
  isActive?: boolean;
  label?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    mesh: THREE.Mesh;
    origPositions: Float32Array;
    frameId: number;
  } | null>(null);
  const propsRef = useRef({ isSpeaking, getAmplitude, isActive });
  propsRef.current = { isSpeaking, getAmplitude, isActive };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const px = size * 2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(px, px);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = size + "px";
    renderer.domElement.style.height = size + "px";
    renderer.domElement.style.borderRadius = "50%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xfff8f0, 1.0);
    key.position.set(2, 2, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xccddff, 0.3);
    fill.position.set(-2, 0, 3);
    scene.add(fill);
    const rim = new THREE.PointLight(new THREE.Color(color).getHex(), 0.6, 10);
    rim.position.set(0, 0, -2);
    scene.add(rim);

    const seg = 50;
    const geo = new THREE.PlaneGeometry(2.2, 2.6, seg, seg);
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const r = Math.sqrt(x * x + (y * 0.85) * (y * 0.85));
      const bulge = Math.max(0, 1 - r * 0.75);
      posAttr.setZ(i, bulge * bulge * 0.55);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();

    const origPositions = new Float32Array(posAttr.array);

    const loader = new THREE.TextureLoader();
    loader.load(src, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;

      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.5,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      let smoothAmp = 0;
      let t = Math.random() * 100;

      const animate = () => {
        const frameId = requestAnimationFrame(animate);
        if (stateRef.current) stateRef.current.frameId = frameId;

        t += 0.016;
        const props = propsRef.current;

        const rawAmp = (props.isSpeaking && props.isActive && props.getAmplitude)
          ? props.getAmplitude() : 0;
        smoothAmp += (rawAmp - smoothAmp) * 0.3;

        const idleY = Math.sin(t * 0.45) * 0.1;
        const idleX = Math.sin(t * 0.32) * 0.04;
        const speakY = props.isSpeaking && props.isActive ? Math.sin(t * 1.8) * smoothAmp * 0.08 : 0;
        const speakX = props.isSpeaking && props.isActive ? Math.sin(t * 2.5) * smoothAmp * 0.04 : 0;
        const nod = props.isSpeaking && props.isActive ? Math.sin(t * 3.0) * smoothAmp * 0.03 : 0;

        mesh.rotation.y = idleY + speakY;
        mesh.rotation.x = idleX + speakX + nod;
        mesh.rotation.z = Math.sin(t * 0.2) * 0.012;
        mesh.position.y = Math.sin(t * 0.8) * 0.006;

        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < posAttr.count; i++) {
          const ox = origPositions[i * 3];
          const oy = origPositions[i * 3 + 1];
          const oz = origPositions[i * 3 + 2];

          let dy = 0;
          let dz = 0;

          if (props.isSpeaking && props.isActive && smoothAmp > 0.01) {
            const mx = ox / 0.32;
            const my = (oy - (-0.55)) / 0.18;
            const md = mx * mx + my * my;

            if (md < 1) {
              const inf = (1 - md) * (1 - md);
              if (oy < -0.55) {
                dy = -inf * smoothAmp * 0.22;
                dz = -inf * smoothAmp * 0.05;
              } else {
                dy = inf * smoothAmp * 0.05;
              }
            }

            const jx = ox / 0.45;
            const jy = (oy - (-0.8)) / 0.3;
            const jd = jx * jx + jy * jy;
            if (jd < 1) {
              const jinf = (1 - jd) * (1 - jd);
              dy -= jinf * smoothAmp * 0.1;
            }
          }

          arr[i * 3 + 1] = oy + dy;
          arr[i * 3 + 2] = oz + dz;
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();

        if (!props.isActive) {
          mesh.scale.setScalar(0.92);
        } else {
          mesh.scale.setScalar(1);
        }

        renderer.render(scene, camera);
      };

      const frameId = requestAnimationFrame(animate);
      stateRef.current = { renderer, scene, camera, mesh, origPositions, frameId };
    });

    return () => {
      if (stateRef.current) {
        cancelAnimationFrame(stateRef.current.frameId);
        stateRef.current = null;
      }
      renderer.dispose();
      geo.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [src, size, color]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          border: `3px solid ${isActive ? color : color + "40"}`,
          boxShadow: isActive
            ? `0 0 30px ${color}80, 0 0 60px ${color}30, 0 10px 40px rgba(0,0,0,0.5)`
            : `0 4px 20px rgba(0,0,0,0.3)`,
          opacity: isActive ? 1 : 0.45,
          transition: "border-color 0.3s, box-shadow 0.3s, opacity 0.3s",
          background: "radial-gradient(ellipse at 50% 40%, #0d1a30, #040810)",
        }}
      >
        <div ref={mountRef} style={{ width: size, height: size }} />
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
    const panelColors = ["#ff3333", "#ffaa00", "#00d4ff"];
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-end gap-8">
          {PANEL_AVATARS.map((avatar, i) => {
            const active = activeSpeakerIndex === i;
            return (
              <ThreeImageAvatar
                key={avatar.label}
                src={avatar.src}
                isSpeaking={isSpeaking}
                getAmplitude={active ? getAmplitude : undefined}
                color={panelColors[i]}
                size={active ? 170 : 120}
                isActive={active}
                label={avatar.label}
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

      <ThreeImageAvatar
        src={avatarMember1}
        isSpeaking={isSpeaking}
        getAmplitude={getAmplitude}
        color={ec}
        size={180}
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
