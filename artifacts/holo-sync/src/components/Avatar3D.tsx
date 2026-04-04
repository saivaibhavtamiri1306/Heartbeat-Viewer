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

function faceDepth(u: number, v: number): number {
  const cx = 0.5, cy = 0.42;
  const dx = (u - cx) * 2;
  const dy = (v - cy) * 2.2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const base = Math.max(0, 1 - dist * 0.9);
  const faceShape = base * base * 0.45;

  const noseDx = (u - 0.5) * 6;
  const noseDy = (v - 0.45) * 4;
  const noseDist = Math.sqrt(noseDx * noseDx + noseDy * noseDy);
  const nose = Math.max(0, 1 - noseDist) * 0.2;

  const browRidge = Math.max(0, 1 - Math.abs(v - 0.32) * 8) *
    Math.max(0, 1 - Math.abs(u - 0.5) * 3.5) * 0.08;

  const cheekL = Math.max(0, 1 - Math.sqrt(((u - 0.3) * 4) ** 2 + ((v - 0.52) * 5) ** 2)) * 0.1;
  const cheekR = Math.max(0, 1 - Math.sqrt(((u - 0.7) * 4) ** 2 + ((v - 0.52) * 5) ** 2)) * 0.1;

  const eyeSocketL = Math.max(0, 1 - Math.sqrt(((u - 0.37) * 7) ** 2 + ((v - 0.38) * 9) ** 2)) * -0.06;
  const eyeSocketR = Math.max(0, 1 - Math.sqrt(((u - 0.63) * 7) ** 2 + ((v - 0.38) * 9) ** 2)) * -0.06;

  const chin = Math.max(0, 1 - Math.sqrt(((u - 0.5) * 4) ** 2 + ((v - 0.72) * 4) ** 2)) * 0.12;

  const temple = Math.max(0, 1 - dist * 1.1) * 0.05;

  return faceShape + nose + browRidge + cheekL + cheekR + eyeSocketL + eyeSocketR + chin + temple;
}

function createFaceGeometry(segments: number) {
  const geo = new THREE.PlaneGeometry(2, 2.4, segments, segments);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = 1 - uv.getY(i);
    const depth = faceDepth(u, v);
    pos.setZ(i, depth);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

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
  const stateRef = useRef<{ frameId: number; renderer: THREE.WebGLRenderer } | null>(null);
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
    renderer.toneMappingExposure = 1.3;
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      width: size + "px",
      height: size + "px",
      borderRadius: "50%",
      display: "block",
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.05, 3.8);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.1);
    keyLight.position.set(3, 3, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.35);
    fillLight.position.set(-3, 1, 4);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(new THREE.Color(color).getHex(), 0.7, 12);
    rimLight.position.set(0, 1, -3);
    scene.add(rimLight);
    const bottomLight = new THREE.DirectionalLight(0x334455, 0.2);
    bottomLight.position.set(0, -3, 2);
    scene.add(bottomLight);

    const seg = 80;
    const geo = createFaceGeometry(seg);
    const origPos = new Float32Array(geo.attributes.position.array);
    const uvAttr = geo.attributes.uv;

    const loader = new THREE.TextureLoader();
    loader.load(src, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.55,
        metalness: 0.02,
        side: THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      let smoothAmp = 0;
      let t = Math.random() * 100;
      const posAttr = geo.attributes.position;

      const animate = () => {
        const fid = requestAnimationFrame(animate);
        if (stateRef.current) stateRef.current.frameId = fid;

        t += 0.016;
        const p = propsRef.current;
        const rawAmp = (p.isSpeaking && p.isActive && p.getAmplitude) ? p.getAmplitude() : 0;
        smoothAmp += (rawAmp - smoothAmp) * 0.3;

        const idleY = Math.sin(t * 0.4) * 0.15;
        const idleX = Math.sin(t * 0.28) * 0.06;
        const speakY = p.isSpeaking && p.isActive ? Math.sin(t * 1.6) * smoothAmp * 0.1 : 0;
        const speakX = p.isSpeaking && p.isActive ? Math.sin(t * 2.2) * smoothAmp * 0.06 : 0;
        const nod = p.isSpeaking && p.isActive ? Math.sin(t * 3.5) * smoothAmp * 0.04 : 0;

        mesh.rotation.y = idleY + speakY;
        mesh.rotation.x = idleX + speakX + nod;
        mesh.rotation.z = Math.sin(t * 0.18) * 0.015;
        mesh.position.y = Math.sin(t * 0.7) * 0.008;

        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < posAttr.count; i++) {
          const oy = origPos[i * 3 + 1];
          const oz = origPos[i * 3 + 2];
          const u = uvAttr.getX(i);
          const v = 1 - uvAttr.getY(i);

          let dy = 0, dz = 0;

          if (p.isSpeaking && p.isActive && smoothAmp > 0.01) {
            const mouthU = 0.5, mouthV = 0.68;
            const mdx = (u - mouthU) / 0.12;
            const mdy = (v - mouthV) / 0.06;
            const md = mdx * mdx + mdy * mdy;

            if (md < 1) {
              const inf = (1 - md);
              const infSq = inf * inf;
              if (v > mouthV) {
                dy -= infSq * smoothAmp * 0.25;
                dz -= infSq * smoothAmp * 0.08;
              } else {
                dy += infSq * smoothAmp * 0.06;
                dz += infSq * smoothAmp * 0.03;
              }
            }

            const jawU = 0.5, jawV = 0.78;
            const jdx = (u - jawU) / 0.2;
            const jdy = (v - jawV) / 0.12;
            const jd = jdx * jdx + jdy * jdy;
            if (jd < 1) {
              dy -= (1 - jd) * smoothAmp * 0.12;
            }
          }

          arr[i * 3 + 1] = oy + dy;
          arr[i * 3 + 2] = oz + dz;
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();

        mesh.scale.setScalar(p.isActive ? 1 : 0.9);

        renderer.render(scene, camera);
      };

      const fid = requestAnimationFrame(animate);
      stateRef.current = { frameId: fid, renderer };
    });

    return () => {
      if (stateRef.current) cancelAnimationFrame(stateRef.current.frameId);
      stateRef.current = null;
      renderer.dispose();
      geo.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
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
        size={200}
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
