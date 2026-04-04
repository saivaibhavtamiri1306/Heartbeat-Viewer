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

interface AvatarSkin {
  skinColor: number;
  hairColor: number;
  eyeColor: number;
  lipColor: number;
  shirtColor: number;
  hasBeard: boolean;
  hasGlasses: boolean;
  hairType: "short_grey" | "slick_dark" | "long_brown";
}

const SKINS: AvatarSkin[] = [
  { skinColor: 0xf0c8a0, hairColor: 0x888888, eyeColor: 0x4477aa, lipColor: 0xcc8877, shirtColor: 0x1a1a2e, hasBeard: true, hasGlasses: true, hairType: "short_grey" },
  { skinColor: 0xe8be98, hairColor: 0x1a0d05, eyeColor: 0x3a2a1a, lipColor: 0xcc8877, shirtColor: 0x0d1b2a, hasBeard: false, hasGlasses: false, hairType: "slick_dark" },
  { skinColor: 0xfad0b8, hairColor: 0x6b3a2a, eyeColor: 0x44aa66, lipColor: 0xdd6677, shirtColor: 0x1a3a2a, hasBeard: false, hasGlasses: false, hairType: "long_brown" },
];

function buildHead(skin: AvatarSkin, imgSrc: string, renderer: THREE.WebGLRenderer) {
  const group = new THREE.Group();

  const headGeo = new THREE.SphereGeometry(1, 64, 64);
  headGeo.scale(0.95, 1.1, 0.95);

  const jawTarget = new Float32Array(headGeo.attributes.position.count * 3);
  const posArr = headGeo.attributes.position;
  for (let i = 0; i < posArr.count; i++) {
    const x = posArr.getX(i);
    const y = posArr.getY(i);
    const z = posArr.getZ(i);
    jawTarget[i * 3] = 0;
    jawTarget[i * 3 + 1] = 0;
    jawTarget[i * 3 + 2] = 0;
    if (y < -0.2 && z > 0.2) {
      const influence = Math.max(0, 1 - Math.abs(x) / 0.6) * Math.max(0, (-0.2 - y) / 0.8) * Math.max(0, (z - 0.2) / 0.7);
      jawTarget[i * 3 + 1] = -influence * 0.25;
      jawTarget[i * 3 + 2] = -influence * 0.05;
    }
  }
  headGeo.morphAttributes.position = [new THREE.Float32BufferAttribute(jawTarget, 3)];

  const loader = new THREE.TextureLoader();
  const headMat = new THREE.MeshStandardMaterial({
    color: skin.skinColor,
    roughness: 0.65,
    metalness: 0.02,
    morphTargets: true,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.morphTargetInfluences = [0];
  head.name = "head";
  group.add(head);

  const faceGeo = new THREE.PlaneGeometry(1.55, 1.85, 1, 1);
  faceGeo.translate(0, 0.05, 0);
  const faceMat = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    roughness: 0.5,
    depthWrite: false,
  });

  loader.load(imgSrc, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    faceMat.map = tex;
    faceMat.opacity = 1;
    faceMat.needsUpdate = true;
  });

  const faceOverlay = new THREE.Mesh(faceGeo, faceMat);
  faceOverlay.position.set(0, 0, 0.85);
  faceOverlay.renderOrder = 1;
  group.add(faceOverlay);

  const noseGeo = new THREE.SphereGeometry(0.12, 24, 24);
  noseGeo.scale(0.8, 0.7, 1);
  const noseMat = new THREE.MeshStandardMaterial({ color: skin.skinColor, roughness: 0.5 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, -0.05, 0.92);
  group.add(nose);

  const eyeWhiteGeo = new THREE.SphereGeometry(0.13, 24, 24);
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
  const irisGeo = new THREE.SphereGeometry(0.07, 24, 24);
  const irisMat = new THREE.MeshStandardMaterial({ color: skin.eyeColor, roughness: 0.3 });
  const pupilGeo = new THREE.SphereGeometry(0.035, 16, 16);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3 });
  const highlightGeo = new THREE.SphereGeometry(0.015, 8, 8);
  const highlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });

  const eyeGroup = new THREE.Group();
  eyeGroup.name = "eyes";

  [-0.28, 0.28].forEach((x) => {
    const w = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    w.position.set(x, 0.2, 0.78);
    w.scale.set(1, 0.7, 0.45);
    eyeGroup.add(w);
    const ir = new THREE.Mesh(irisGeo, irisMat);
    ir.position.set(x, 0.2, 0.88);
    eyeGroup.add(ir);
    const p = new THREE.Mesh(pupilGeo, pupilMat);
    p.position.set(x, 0.2, 0.92);
    eyeGroup.add(p);
    const h = new THREE.Mesh(highlightGeo, highlightMat);
    h.position.set(x + 0.03, 0.24, 0.94);
    eyeGroup.add(h);

    const lidGeo = new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const lidMat = new THREE.MeshStandardMaterial({ color: skin.skinColor, roughness: 0.6 });
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.set(x, 0.2, 0.79);
    lid.scale.set(1, 0.4, 0.5);
    lid.rotation.x = -Math.PI * 0.5;
    lid.name = x < 0 ? "lidL" : "lidR";
    lid.visible = false;
    eyeGroup.add(lid);
  });
  group.add(eyeGroup);

  const browGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.2, 8);
  const browMat = new THREE.MeshStandardMaterial({ color: skin.hairColor, roughness: 0.8 });
  [-0.28, 0.28].forEach((x, i) => {
    const b = new THREE.Mesh(browGeo, browMat);
    b.position.set(x, 0.36, 0.78);
    b.rotation.z = Math.PI / 2 + (i === 0 ? -0.12 : 0.12);
    group.add(b);
  });

  const upperLipGeo = new THREE.TorusGeometry(0.13, 0.03, 12, 24, Math.PI);
  const lipMat = new THREE.MeshStandardMaterial({ color: skin.lipColor, roughness: 0.4 });
  const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
  upperLip.position.set(0, -0.32, 0.82);
  upperLip.rotation.z = Math.PI;
  upperLip.name = "upperLip";
  group.add(upperLip);

  const lowerLipGeo = new THREE.TorusGeometry(0.13, 0.035, 12, 24, Math.PI);
  const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat.clone());
  lowerLip.position.set(0, -0.32, 0.82);
  lowerLip.name = "lowerLip";
  group.add(lowerLip);

  const mouthGeo = new THREE.PlaneGeometry(0.22, 0.12);
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, side: THREE.DoubleSide });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, -0.34, 0.78);
  mouth.name = "mouthInside";
  mouth.visible = false;
  group.add(mouth);

  const teethGeo = new THREE.PlaneGeometry(0.16, 0.035);
  const teethMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, side: THREE.DoubleSide });
  const teeth = new THREE.Mesh(teethGeo, teethMat);
  teeth.position.set(0, -0.29, 0.79);
  teeth.name = "teeth";
  teeth.visible = false;
  group.add(teeth);

  const tongueGeo = new THREE.SphereGeometry(0.06, 16, 16);
  tongueGeo.scale(1.3, 0.4, 1);
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xcc5555, roughness: 0.5 });
  const tongue = new THREE.Mesh(tongueGeo, tongueMat);
  tongue.position.set(0, -0.38, 0.78);
  tongue.name = "tongue";
  tongue.visible = false;
  group.add(tongue);

  const earGeo = new THREE.SphereGeometry(0.12, 16, 16);
  earGeo.scale(0.4, 0.7, 0.25);
  const earMat = new THREE.MeshStandardMaterial({ color: skin.skinColor, roughness: 0.6 });
  [-0.92, 0.92].forEach((x) => {
    const ear = new THREE.Mesh(earGeo, earMat);
    ear.position.set(x, 0.08, 0);
    group.add(ear);
  });

  const hairMat = new THREE.MeshStandardMaterial({ color: skin.hairColor, roughness: 0.85 });
  if (skin.hairType === "short_grey") {
    const hg = new THREE.SphereGeometry(1.03, 48, 48, 0, Math.PI * 2, 0, Math.PI * 0.52);
    hg.scale(0.97, 1.12, 0.97);
    const h = new THREE.Mesh(hg, hairMat);
    h.position.y = 0.02;
    group.add(h);
  } else if (skin.hairType === "slick_dark") {
    const hg = new THREE.SphereGeometry(1.04, 48, 48, 0, Math.PI * 2, 0, Math.PI * 0.48);
    hg.scale(0.97, 1.14, 1.0);
    const hm = new THREE.MeshStandardMaterial({ color: skin.hairColor, roughness: 0.25, metalness: 0.15 });
    const h = new THREE.Mesh(hg, hm);
    h.position.y = 0.02;
    group.add(h);
  } else {
    const hg = new THREE.SphereGeometry(1.06, 48, 48, 0, Math.PI * 2, 0, Math.PI * 0.58);
    hg.scale(1.0, 1.12, 1.0);
    const h = new THREE.Mesh(hg, hairMat);
    h.position.y = 0.02;
    group.add(h);
    const sg = new THREE.CylinderGeometry(0.13, 0.1, 0.7, 12);
    [-0.82, 0.82].forEach((x) => {
      const s = new THREE.Mesh(sg, hairMat);
      s.position.set(x, -0.45, 0.08);
      group.add(s);
    });
    const bg = new THREE.SphereGeometry(0.75, 32, 32);
    bg.scale(1.2, 0.9, 0.45);
    const b = new THREE.Mesh(bg, hairMat);
    b.position.set(0, -0.35, -0.55);
    group.add(b);
  }

  if (skin.hasBeard) {
    const bg = new THREE.SphereGeometry(0.65, 32, 32);
    bg.scale(0.9, 0.65, 0.55);
    const bm = new THREE.MeshStandardMaterial({ color: skin.hairColor, roughness: 0.95, transparent: true, opacity: 0.65 });
    const b = new THREE.Mesh(bg, bm);
    b.position.set(0, -0.55, 0.35);
    group.add(b);
  }

  if (skin.hasGlasses) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.15, roughness: 0, metalness: 0.3 });
    const frameGeo = new THREE.TorusGeometry(0.16, 0.012, 8, 32);
    [-0.28, 0.28].forEach((x) => {
      const f = new THREE.Mesh(frameGeo, frameMat);
      f.position.set(x, 0.2, 0.84);
      group.add(f);
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), lensMat);
      l.position.set(x, 0.2, 0.84);
      group.add(l);
    });
    const bridgeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6);
    const bridge = new THREE.Mesh(bridgeGeo, frameMat);
    bridge.position.set(0, 0.22, 0.88);
    bridge.rotation.z = Math.PI / 2;
    group.add(bridge);
    const armGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.55, 6);
    [-0.42, 0.42].forEach((x) => {
      const arm = new THREE.Mesh(armGeo, frameMat);
      arm.position.set(x, 0.2, 0.48);
      arm.rotation.x = Math.PI / 2;
      group.add(arm);
    });
  }

  const neckGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.45, 24);
  const neckMat = new THREE.MeshStandardMaterial({ color: skin.skinColor, roughness: 0.6 });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.set(0, -1.3, 0);
  group.add(neck);

  const shoulderGeo = new THREE.SphereGeometry(1.15, 32, 32);
  shoulderGeo.scale(1, 0.38, 0.65);
  const shoulderMat = new THREE.MeshStandardMaterial({ color: skin.shirtColor, roughness: 0.7 });
  const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
  shoulders.position.set(0, -1.7, 0);
  group.add(shoulders);

  return group;
}

function Avatar3DCanvas({
  skinIndex,
  imgSrc,
  isSpeaking,
  getAmplitude,
  color,
  size,
  isActive = true,
  label,
}: {
  skinIndex: number;
  imgSrc: string;
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
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      width: size + "px", height: size + "px", borderRadius: "50%", display: "block",
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.05, 4.2);
    camera.lookAt(0, -0.05, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const kl = new THREE.DirectionalLight(0xfff5e8, 1.0);
    kl.position.set(3, 3, 5);
    scene.add(kl);
    const fl = new THREE.DirectionalLight(0xaaccff, 0.3);
    fl.position.set(-3, 1, 4);
    scene.add(fl);
    const rl = new THREE.PointLight(new THREE.Color(color).getHex(), 0.6, 10);
    rl.position.set(0, 0.5, -3);
    scene.add(rl);

    const skin = SKINS[skinIndex % SKINS.length];
    const avatar = buildHead(skin, imgSrc, renderer);
    scene.add(avatar);

    let smoothAmp = 0;
    let t = Math.random() * 100;
    let blinkTimer = 3 + Math.random() * 4;
    let blinkProg = -1;

    const animate = () => {
      const fid = requestAnimationFrame(animate);
      if (stateRef.current) stateRef.current.frameId = fid;

      t += 0.016;
      const p = propsRef.current;
      const rawAmp = (p.isSpeaking && p.isActive && p.getAmplitude) ? p.getAmplitude() : 0;
      smoothAmp += (rawAmp - smoothAmp) * 0.3;

      const idleY = Math.sin(t * 0.4) * 0.12;
      const idleX = Math.sin(t * 0.3) * 0.04;
      const speakY = p.isSpeaking && p.isActive ? Math.sin(t * 1.6) * smoothAmp * 0.08 : 0;
      const speakNod = p.isSpeaking && p.isActive ? Math.sin(t * 3) * smoothAmp * 0.04 : 0;

      avatar.rotation.y = idleY + speakY;
      avatar.rotation.x = idleX + speakNod;
      avatar.rotation.z = Math.sin(t * 0.2) * 0.012;
      avatar.position.y = Math.sin(t * 0.7) * 0.006;

      const head = avatar.getObjectByName("head") as THREE.Mesh;
      if (head?.morphTargetInfluences) {
        const mouthOpen = p.isSpeaking && p.isActive
          ? smoothAmp * 0.8 + Math.sin(t * 8) * smoothAmp * 0.15
          : 0;
        head.morphTargetInfluences[0] = Math.min(1, Math.max(0, mouthOpen));
      }

      const upperLip = avatar.getObjectByName("upperLip") as THREE.Mesh;
      const lowerLip = avatar.getObjectByName("lowerLip") as THREE.Mesh;
      const mouthInside = avatar.getObjectByName("mouthInside") as THREE.Mesh;
      const teethMesh = avatar.getObjectByName("teeth") as THREE.Mesh;
      const tongueMesh = avatar.getObjectByName("tongue") as THREE.Mesh;

      const mouthAmt = p.isSpeaking && p.isActive ? smoothAmp : 0;

      if (upperLip) {
        upperLip.position.y = -0.30 + mouthAmt * 0.04;
        upperLip.scale.x = 1 + mouthAmt * 0.2;
      }
      if (lowerLip) {
        lowerLip.position.y = -0.34 - mouthAmt * 0.18;
        lowerLip.scale.x = 1 + mouthAmt * 0.3;
      }
      if (mouthInside) {
        mouthInside.visible = mouthAmt > 0.05;
        mouthInside.position.y = -0.34 - mouthAmt * 0.06;
        mouthInside.scale.y = 1 + mouthAmt * 6;
      }
      if (teethMesh) {
        teethMesh.visible = mouthAmt > 0.08;
        teethMesh.position.y = -0.29 + mouthAmt * 0.02;
      }
      if (tongueMesh) {
        tongueMesh.visible = mouthAmt > 0.15;
        tongueMesh.position.y = -0.38 - mouthAmt * 0.08;
      }

      blinkTimer -= 0.016;
      if (blinkTimer <= 0 && blinkProg < 0) {
        blinkProg = 0;
      }
      const lidL = avatar.getObjectByName("lidL") as THREE.Mesh;
      const lidR = avatar.getObjectByName("lidR") as THREE.Mesh;
      if (blinkProg >= 0) {
        blinkProg += 0.12;
        const vis = blinkProg < 0.5;
        if (lidL) { lidL.visible = vis; }
        if (lidR) { lidR.visible = vis; }
        if (blinkProg >= 1) {
          blinkProg = -1;
          blinkTimer = 2.5 + Math.random() * 4;
          if (lidL) lidL.visible = false;
          if (lidR) lidR.visible = false;
        }
      }

      if (!p.isActive) avatar.scale.setScalar(0.9);
      else avatar.scale.setScalar(1);

      renderer.render(scene, camera);
    };

    const fid = requestAnimationFrame(animate);
    stateRef.current = { frameId: fid, renderer };

    return () => {
      if (stateRef.current) cancelAnimationFrame(stateRef.current.frameId);
      stateRef.current = null;
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [skinIndex, imgSrc, size, color]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: size, height: size, borderRadius: "50%", overflow: "hidden",
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
        <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ color, border: `1px solid ${color}${isActive ? "90" : "30"}`, background: isActive ? `${color}15` : "transparent" }}>
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

export default function Avatar3D({ emotion, isSpeaking, bpm, panelMode, activeSpeakerIndex = 0, getAmplitude }: Avatar3DProps) {
  const ec = EMOTION_COLORS[emotion] || "#00d4ff";

  if (panelMode) {
    const pc = ["#ff3333", "#ffaa00", "#00d4ff"];
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-end gap-8">
          {PANEL_AVATARS.map((a, i) => {
            const active = activeSpeakerIndex === i;
            return (
              <Avatar3DCanvas key={a.label} skinIndex={i} imgSrc={a.src} isSpeaking={isSpeaking}
                getAmplitude={active ? getAmplitude : undefined} color={pc[i]}
                size={active ? 180 : 130} isActive={active} label={a.label} />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.3em] px-4 py-1.5 rounded-full"
        style={{ background: `${ec}15`, border: `1px solid ${ec}60`, color: ec, boxShadow: `0 0 20px ${ec}30` }}>
        {emotion.toUpperCase()}
      </div>
      <Avatar3DCanvas skinIndex={1} imgSrc={avatarMember1} isSpeaking={isSpeaking}
        getAmplitude={getAmplitude} color={ec} size={200} />
      <div className="text-xs font-mono tracking-widest flex items-center gap-2" style={{ color: ec }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ec }} />
        {bpm} BPM
      </div>
    </div>
  );
}
