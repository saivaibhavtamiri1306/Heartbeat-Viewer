import { useEffect, useRef } from "react";
import * as THREE from "three";

const EMOTION_COLORS: Record<string, string> = {
  neutral: "#00d4ff",
  empathetic: "#00ff88",
  stern: "#ff3333",
  curious: "#ffaa00",
  stressed: "#ff00ff",
};

interface AvatarStyle {
  skinColor: number;
  hairColor: number;
  eyeColor: number;
  lipColor: number;
  hasBeard: boolean;
  hasGlasses: boolean;
  hairStyle: "short" | "slick" | "long";
  gender: "male" | "female";
}

const AVATAR_STYLES: AvatarStyle[] = [
  {
    skinColor: 0xf0c8a0,
    hairColor: 0x888888,
    eyeColor: 0x4466aa,
    lipColor: 0xcc7766,
    hasBeard: true,
    hasGlasses: true,
    hairStyle: "short",
    gender: "male",
  },
  {
    skinColor: 0xe8be98,
    hairColor: 0x2a1a0a,
    eyeColor: 0x3a2a1a,
    lipColor: 0xcc8877,
    hasBeard: false,
    hasGlasses: false,
    hairStyle: "slick",
    gender: "male",
  },
  {
    skinColor: 0xfad0b8,
    hairColor: 0x6b3a2a,
    eyeColor: 0x44aa66,
    lipColor: 0xdd6677,
    hasBeard: false,
    hasGlasses: false,
    hairStyle: "long",
    gender: "female",
  },
];

function buildAvatar(scene: THREE.Scene, style: AvatarStyle) {
  const group = new THREE.Group();

  const headGeo = new THREE.SphereGeometry(1, 64, 64);
  headGeo.scale(1, 1.15, 1);
  const headMat = new THREE.MeshStandardMaterial({
    color: style.skinColor,
    roughness: 0.6,
    metalness: 0.05,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  group.add(head);

  const noseGeo = new THREE.SphereGeometry(0.12, 32, 32);
  const noseMat = new THREE.MeshStandardMaterial({
    color: style.skinColor,
    roughness: 0.5,
  });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, -0.05, 0.95);
  nose.scale.set(1, 0.8, 1.2);
  group.add(nose);

  const nostrilGeo = new THREE.SphereGeometry(0.04, 16, 16);
  const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x8a6a5a });
  [-0.06, 0.06].forEach((x) => {
    const nostril = new THREE.Mesh(nostrilGeo, nostrilMat);
    nostril.position.set(x, -0.1, 0.99);
    group.add(nostril);
  });

  const eyeWhiteGeo = new THREE.SphereGeometry(0.16, 32, 32);
  const eyeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.1,
    metalness: 0.0,
  });
  const irisGeo = new THREE.SphereGeometry(0.09, 32, 32);
  const irisMat = new THREE.MeshStandardMaterial({
    color: style.eyeColor,
    roughness: 0.3,
  });
  const pupilGeo = new THREE.SphereGeometry(0.05, 24, 24);
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.1,
    metalness: 0.5,
  });
  const highlightGeo = new THREE.SphereGeometry(0.02, 16, 16);
  const highlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.8,
  });

  const eyes: THREE.Mesh[] = [];
  [-0.32, 0.32].forEach((x) => {
    const eyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeWhite.position.set(x, 0.18, 0.82);
    eyeWhite.scale.set(1, 0.75, 0.5);
    group.add(eyeWhite);

    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(x, 0.18, 0.93);
    group.add(iris);
    eyes.push(iris);

    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(x, 0.18, 0.97);
    group.add(pupil);
    eyes.push(pupil);

    const highlight = new THREE.Mesh(highlightGeo, highlightMat);
    highlight.position.set(x + 0.04, 0.22, 0.99);
    group.add(highlight);
  });

  const browGeo = new THREE.CylinderGeometry(0.01, 0.015, 0.22, 8);
  const browMat = new THREE.MeshStandardMaterial({
    color: style.hairColor,
    roughness: 0.8,
  });
  [-0.32, 0.32].forEach((x, i) => {
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(x, 0.36, 0.82);
    brow.rotation.z = Math.PI / 2 + (i === 0 ? -0.15 : 0.15);
    group.add(brow);
  });

  const upperLipGeo = new THREE.TorusGeometry(0.14, 0.035, 16, 32, Math.PI);
  const lipMat = new THREE.MeshStandardMaterial({
    color: style.lipColor,
    roughness: 0.4,
    metalness: 0.05,
  });
  const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
  upperLip.position.set(0, -0.35, 0.85);
  upperLip.rotation.x = 0;
  upperLip.rotation.z = Math.PI;
  upperLip.name = "upperLip";
  group.add(upperLip);

  const lowerLipGeo = new THREE.TorusGeometry(0.14, 0.04, 16, 32, Math.PI);
  const lowerLipMat = new THREE.MeshStandardMaterial({
    color: style.lipColor,
    roughness: 0.4,
    metalness: 0.05,
  });
  const lowerLip = new THREE.Mesh(lowerLipGeo, lowerLipMat);
  lowerLip.position.set(0, -0.35, 0.85);
  lowerLip.rotation.z = 0;
  lowerLip.name = "lowerLip";
  group.add(lowerLip);

  const mouthInsideGeo = new THREE.PlaneGeometry(0.24, 0.12);
  const mouthInsideMat = new THREE.MeshStandardMaterial({
    color: 0x2a0a0a,
    side: THREE.DoubleSide,
  });
  const mouthInside = new THREE.Mesh(mouthInsideGeo, mouthInsideMat);
  mouthInside.position.set(0, -0.35, 0.83);
  mouthInside.name = "mouthInside";
  mouthInside.visible = false;
  group.add(mouthInside);

  const teethGeo = new THREE.PlaneGeometry(0.18, 0.04);
  const teethMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0e8,
    side: THREE.DoubleSide,
  });
  const teeth = new THREE.Mesh(teethGeo, teethMat);
  teeth.position.set(0, -0.3, 0.84);
  teeth.name = "teeth";
  teeth.visible = false;
  group.add(teeth);

  const tongueGeo = new THREE.SphereGeometry(0.06, 16, 16);
  tongueGeo.scale(1.5, 0.5, 1);
  const tongueMat = new THREE.MeshStandardMaterial({
    color: 0xcc5555,
    roughness: 0.5,
  });
  const tongue = new THREE.Mesh(tongueGeo, tongueMat);
  tongue.position.set(0, -0.4, 0.82);
  tongue.name = "tongue";
  tongue.visible = false;
  group.add(tongue);

  const earGeo = new THREE.SphereGeometry(0.15, 16, 16);
  earGeo.scale(0.5, 0.8, 0.3);
  const earMat = new THREE.MeshStandardMaterial({
    color: style.skinColor,
    roughness: 0.6,
  });
  [-1.0, 1.0].forEach((x) => {
    const ear = new THREE.Mesh(earGeo, earMat);
    ear.position.set(x, 0.05, 0);
    group.add(ear);
  });

  if (style.hairStyle === "short") {
    const hairGeo = new THREE.SphereGeometry(1.05, 64, 64, 0, Math.PI * 2, 0, Math.PI * 0.55);
    hairGeo.scale(1, 1.15, 1);
    const hairMat = new THREE.MeshStandardMaterial({
      color: style.hairColor,
      roughness: 0.9,
    });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.02;
    group.add(hair);
  } else if (style.hairStyle === "slick") {
    const hairGeo = new THREE.SphereGeometry(1.06, 64, 64, 0, Math.PI * 2, 0, Math.PI * 0.5);
    hairGeo.scale(1, 1.15, 1.05);
    const hairMat = new THREE.MeshStandardMaterial({
      color: style.hairColor,
      roughness: 0.3,
      metalness: 0.2,
    });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.02;
    group.add(hair);
  } else if (style.hairStyle === "long") {
    const hairTopGeo = new THREE.SphereGeometry(1.08, 64, 64, 0, Math.PI * 2, 0, Math.PI * 0.6);
    hairTopGeo.scale(1.05, 1.15, 1.02);
    const hairMat = new THREE.MeshStandardMaterial({
      color: style.hairColor,
      roughness: 0.7,
    });
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.y = 0.02;
    group.add(hairTop);

    const sideGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.8, 16);
    [-0.85, 0.85].forEach((x) => {
      const side = new THREE.Mesh(sideGeo, hairMat);
      side.position.set(x, -0.5, 0.1);
      group.add(side);
    });

    const backGeo = new THREE.SphereGeometry(0.8, 32, 32);
    backGeo.scale(1.3, 1, 0.5);
    const back = new THREE.Mesh(backGeo, hairMat);
    back.position.set(0, -0.4, -0.6);
    group.add(back);
  }

  if (style.hasBeard) {
    const beardGeo = new THREE.SphereGeometry(0.7, 32, 32);
    beardGeo.scale(1, 0.7, 0.6);
    const beardMat = new THREE.MeshStandardMaterial({
      color: style.hairColor,
      roughness: 0.95,
      transparent: true,
      opacity: 0.7,
    });
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.set(0, -0.6, 0.4);
    group.add(beard);
  }

  if (style.hasGlasses) {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.3,
      metalness: 0.8,
    });
    const lensGeo = new THREE.TorusGeometry(0.18, 0.015, 8, 32);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.2,
      roughness: 0.0,
      metalness: 0.3,
    });

    [-0.32, 0.32].forEach((x) => {
      const frame = new THREE.Mesh(lensGeo.clone(), frameMat);
      frame.position.set(x, 0.18, 0.88);
      group.add(frame);

      const lensDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.17, 32),
        lensMat
      );
      lensDisc.position.set(x, 0.18, 0.88);
      group.add(lensDisc);
    });

    const bridgeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8);
    const bridge = new THREE.Mesh(bridgeGeo, frameMat);
    bridge.position.set(0, 0.2, 0.92);
    bridge.rotation.z = Math.PI / 2;
    group.add(bridge);

    const armGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.6, 8);
    [-0.48, 0.48].forEach((x) => {
      const arm = new THREE.Mesh(armGeo, frameMat);
      arm.position.set(x, 0.18, 0.5);
      arm.rotation.x = Math.PI / 2;
      group.add(arm);
    });
  }

  const neckGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.5, 32);
  const neckMat = new THREE.MeshStandardMaterial({
    color: style.skinColor,
    roughness: 0.6,
  });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.set(0, -1.35, 0);
  group.add(neck);

  const shoulderGeo = new THREE.SphereGeometry(1.2, 32, 32);
  shoulderGeo.scale(1, 0.4, 0.7);
  const shirtColor = style.gender === "female" ? 0x336655 : 0x1a1a2e;
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: shirtColor,
    roughness: 0.7,
  });
  const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
  shoulders.position.set(0, -1.75, 0);
  group.add(shoulders);

  scene.add(group);
  return group;
}

function ThreeAvatar({
  styleIndex,
  isSpeaking,
  getAmplitude,
  color,
  size,
  isActive = true,
  label,
}: {
  styleIndex: number;
  isSpeaking: boolean;
  getAmplitude?: () => number;
  color: string;
  size: number;
  isActive?: boolean;
  label?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number>(0);
  const smoothAmpRef = useRef(0);
  const timeRef = useRef(Math.random() * 100);
  const blinkRef = useRef(0);
  const isBlinkingRef = useRef(false);
  const blinkProgressRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const px = size * 2;
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.lookAt(0, -0.1, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(px, px);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    renderer.domElement.style.width = size + "px";
    renderer.domElement.style.height = size + "px";
    renderer.domElement.style.borderRadius = "50%";

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.2);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.4);
    fillLight.position.set(-2, 1, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(
      new THREE.Color(color).getHex(),
      0.6
    );
    rimLight.position.set(0, 1, -3);
    scene.add(rimLight);

    const style = AVATAR_STYLES[styleIndex % AVATAR_STYLES.length];
    const avatar = buildAvatar(scene, style);
    avatarRef.current = avatar;

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [styleIndex, size, color]);

  useEffect(() => {
    let active = true;

    const animate = () => {
      if (!active) return;
      frameRef.current = requestAnimationFrame(animate);

      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const avatar = avatarRef.current;
      if (!renderer || !scene || !camera || !avatar) return;

      timeRef.current += 0.016;
      const t = timeRef.current;

      const rawAmp =
        isSpeaking && isActive && getAmplitude ? getAmplitude() : 0;
      smoothAmpRef.current += (rawAmp - smoothAmpRef.current) * 0.3;
      const amp = smoothAmpRef.current;

      const idleRotY = Math.sin(t * 0.4) * 0.08;
      const idleRotX = Math.sin(t * 0.3) * 0.03;
      const speakRotY =
        isSpeaking && isActive ? Math.sin(t * 1.5) * amp * 0.06 : 0;
      const speakRotX =
        isSpeaking && isActive ? Math.sin(t * 2) * amp * 0.04 : 0;
      const speakNod =
        isSpeaking && isActive ? Math.sin(t * 3) * amp * 0.02 : 0;

      avatar.rotation.y = idleRotY + speakRotY;
      avatar.rotation.x = idleRotX + speakRotX + speakNod;
      avatar.rotation.z = Math.sin(t * 0.25) * 0.02;

      const breathe = Math.sin(t * 0.8) * 0.005;
      avatar.position.y = breathe;

      const upperLip = avatar.getObjectByName("upperLip") as THREE.Mesh;
      const lowerLip = avatar.getObjectByName("lowerLip") as THREE.Mesh;
      const mouthInside = avatar.getObjectByName("mouthInside") as THREE.Mesh;
      const teeth = avatar.getObjectByName("teeth") as THREE.Mesh;
      const tongue = avatar.getObjectByName("tongue") as THREE.Mesh;

      if (upperLip && lowerLip) {
        const mouthOpen =
          isSpeaking && isActive ? amp * 0.15 + Math.sin(t * 8) * amp * 0.02 : 0;

        upperLip.position.y = -0.33 + mouthOpen * 0.3;
        lowerLip.position.y = -0.35 - mouthOpen;
        upperLip.scale.x = 1 + mouthOpen * 0.3;
        lowerLip.scale.x = 1 + mouthOpen * 0.5;

        if (mouthInside) {
          mouthInside.visible = mouthOpen > 0.02;
          mouthInside.position.y = -0.35 - mouthOpen * 0.4;
          mouthInside.scale.y = 1 + mouthOpen * 8;
        }
        if (teeth) {
          teeth.visible = mouthOpen > 0.04;
          teeth.position.y = -0.31 + mouthOpen * 0.15;
        }
        if (tongue) {
          tongue.visible = mouthOpen > 0.06;
          tongue.position.y = -0.38 - mouthOpen * 0.5;
        }
      }

      blinkRef.current += 0.016;
      if (!isBlinkingRef.current && blinkRef.current > 3 + Math.random() * 3) {
        isBlinkingRef.current = true;
        blinkRef.current = 0;
        blinkProgressRef.current = 0;
      }
      if (isBlinkingRef.current) {
        blinkProgressRef.current += 0.15;
        if (blinkProgressRef.current >= 1) {
          isBlinkingRef.current = false;
        }
      }

      if (!isActive) {
        avatar.scale.setScalar(0.95);
      } else {
        avatar.scale.setScalar(1);
      }

      renderer.render(scene, camera);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      active = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [isSpeaking, getAmplitude, isActive]);

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
          background: "radial-gradient(ellipse at 50% 30%, #0a1628, #040810)",
        }}
      >
        <div
          ref={mountRef}
          style={{ width: size, height: size }}
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

const PANEL_LABELS = ["Chairman", "Member 1", "Member 2"];

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
          {[0, 1, 2].map((i) => {
            const active = activeSpeakerIndex === i;
            return (
              <ThreeAvatar
                key={i}
                styleIndex={i}
                isSpeaking={isSpeaking}
                getAmplitude={active ? getAmplitude : undefined}
                color={panelColors[i]}
                size={active ? 170 : 120}
                isActive={active}
                label={PANEL_LABELS[i]}
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

      <ThreeAvatar
        styleIndex={1}
        isSpeaking={isSpeaking}
        getAmplitude={getAmplitude}
        color={ec}
        size={180}
      />

      <div
        className="text-xs font-mono tracking-widest flex items-center gap-2"
        style={{ color: ec }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: ec }}
        />
        {bpm} BPM
      </div>
    </div>
  );
}
