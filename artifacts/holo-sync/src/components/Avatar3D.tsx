import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, Torus, Text } from "@react-three/drei";
import * as THREE from "three";

interface AvatarProps {
  emotion: "neutral" | "empathetic" | "stern" | "curious" | "stressed";
  isSpeaking: boolean;
  bpm: number;
  name?: string;
  index?: number;
  isActive?: boolean;
  mouthOpenness?: number;
}

const EMOTION_COLORS = {
  neutral:    { primary: 0x00d4ff, secondary: 0x0077ff, emissive: 0x001133, label: "#00d4ff" },
  empathetic: { primary: 0x00ff88, secondary: 0x00cc66, emissive: 0x001122, label: "#00ff88" },
  stern:      { primary: 0xff3333, secondary: 0xcc1111, emissive: 0x220000, label: "#ff3333" },
  curious:    { primary: 0xffaa00, secondary: 0xff6600, emissive: 0x221100, label: "#ffaa00" },
  stressed:   { primary: 0xff00ff, secondary: 0xcc00cc, emissive: 0x220022, label: "#ff00ff" },
};

function NeuralNetwork({ bpm, color }: { bpm: number; color: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const count = 280;

  const { positions, linePositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.2 + Math.random() * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const linePos: number[] = [];
    const threshold = 1.8;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = positions[i*3] - positions[j*3];
        const dy = positions[i*3+1] - positions[j*3+1];
        const dz = positions[i*3+2] - positions[j*3+2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist < threshold && linePos.length < 600) {
          linePos.push(positions[i*3], positions[i*3+1], positions[i*3+2], positions[j*3], positions[j*3+1], positions[j*3+2]);
        }
      }
    }
    return { positions, linePositions: new Float32Array(linePos) };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = bpm > 100 ? 0.12 : 0.06;
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * speed;
      pointsRef.current.rotation.x = t * speed * 0.4;
    }
    if (linesRef.current) {
      linesRef.current.rotation.y = t * speed;
      linesRef.current.rotation.x = t * speed * 0.4;
      const mat = linesRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.08 + Math.sin(t * 2) * 0.04;
    }
  });

  const c = new THREE.Color(color);
  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color={c} transparent opacity={0.7} sizeAttenuation />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={c} transparent opacity={0.1} />
      </lineSegments>
    </group>
  );
}

function DNAHelix({ color }: { color: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const count = 40;
  const { strand1, strand2, bridges } = useMemo(() => {
    const s1 = new Float32Array(count * 3);
    const s2 = new Float32Array(count * 3);
    const b: number[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 4;
      const y = (i / count) * 6 - 3;
      const r = 1.8;
      s1[i*3] = Math.cos(t) * r; s1[i*3+1] = y; s1[i*3+2] = Math.sin(t) * r;
      s2[i*3] = Math.cos(t + Math.PI) * r; s2[i*3+1] = y; s2[i*3+2] = Math.sin(t + Math.PI) * r;
      if (i % 4 === 0) b.push(s1[i*3], s1[i*3+1], s1[i*3+2], s2[i*3], s2[i*3+1], s2[i*3+2]);
    }
    return { strand1: s1, strand2: s2, bridges: new Float32Array(b) };
  }, []);

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.4;
  });

  const c = new THREE.Color(color);
  const c2 = new THREE.Color(color).multiplyScalar(0.6);
  return (
    <group ref={groupRef}>
      <line>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[strand1, 3]} /></bufferGeometry>
        <lineBasicMaterial color={c} transparent opacity={0.5} />
      </line>
      <line>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[strand2, 3]} /></bufferGeometry>
        <lineBasicMaterial color={c2} transparent opacity={0.4} />
      </line>
      <lineSegments>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[bridges, 3]} /></bufferGeometry>
        <lineBasicMaterial color={c} transparent opacity={0.25} />
      </lineSegments>
    </group>
  );
}

function PulseRings({ isSpeaking, bpm, color }: { isSpeaking: boolean; bpm: number; color: number }) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = isSpeaking ? 1 : 0.3;
    const bpmBoost = bpm > 100 ? 1.4 : 1;
    if (ring1Ref.current) {
      ring1Ref.current.scale.setScalar(1 + (Math.sin(t * 2) * 0.08 + 0.08) * pulse * bpmBoost);
      (ring1Ref.current.material as THREE.MeshStandardMaterial).opacity = (0.4 + Math.sin(t * 2) * 0.2) * pulse;
    }
    if (ring2Ref.current) {
      ring2Ref.current.scale.setScalar(1 + (Math.sin(t * 2 + 1) * 0.06 + 0.06) * pulse * bpmBoost);
      (ring2Ref.current.material as THREE.MeshStandardMaterial).opacity = (0.25 + Math.sin(t * 2 + 1) * 0.15) * pulse;
    }
    if (ring3Ref.current) {
      ring3Ref.current.scale.setScalar(1 + (Math.sin(t * 3 + 2) * 0.04 + 0.04) * pulse * bpmBoost);
      (ring3Ref.current.material as THREE.MeshStandardMaterial).opacity = (0.15 + Math.sin(t * 3 + 2) * 0.1) * pulse;
    }
  });

  return (
    <>
      <Torus ref={ring1Ref} args={[1.4, 0.012, 4, 80]} rotation={[Math.PI/2 + 0.3, 0.3, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.4} />
      </Torus>
      <Torus ref={ring2Ref} args={[1.65, 0.008, 4, 80]} rotation={[-Math.PI/4, 0.5, 0.2]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.3} />
      </Torus>
      <Torus ref={ring3Ref} args={[1.9, 0.006, 4, 80]} rotation={[0.8, -0.4, 0.6]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent opacity={0.2} />
      </Torus>
    </>
  );
}

function ActiveSpeakerGlow({ color, isActive }: { color: number; isActive: boolean }) {
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!glowRef.current) return;
    const t = state.clock.elapsedTime;
    const targetOpacity = isActive ? 0.15 + Math.sin(t * 3) * 0.08 : 0;
    const mat = glowRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
    const targetScale = isActive ? 1.8 + Math.sin(t * 2) * 0.15 : 1.3;
    glowRef.current.scale.setScalar(THREE.MathUtils.lerp(glowRef.current.scale.x, targetScale, 0.05));
  });
  return (
    <mesh ref={glowRef} position={[0, 0, -0.5]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0} side={THREE.BackSide} />
    </mesh>
  );
}

function HumanHead({ emotion, isSpeaking, bpm, index = 0, name, isActive = true, mouthOpenness = 0 }: AvatarProps) {
  const headGroupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const jawRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const leftIrisRef = useRef<THREE.Mesh>(null);
  const rightIrisRef = useRef<THREE.Mesh>(null);
  const upperLipRef = useRef<THREE.Mesh>(null);
  const lowerLipRef = useRef<THREE.Mesh>(null);
  const leftBrowRef = useRef<THREE.Mesh>(null);
  const rightBrowRef = useRef<THREE.Mesh>(null);
  const scanRef = useRef<THREE.Mesh>(null);

  const colors = EMOTION_COLORS[emotion];
  const offset = index * (Math.PI * 2 / 3);

  const skinTone = useMemo(() => {
    const base = new THREE.Color(0xdeb887);
    base.lerp(new THREE.Color(colors.primary), 0.12);
    return base;
  }, [colors.primary]);

  const mouthOpen = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    const targetActive = isActive ? 1 : 0.5;

    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.3 + offset) * (isActive ? 0.2 : 0.06);
      headGroupRef.current.rotation.x = Math.sin(t * 0.2 + offset) * 0.05;
      const curScale = headGroupRef.current.scale.x;
      const tgtScale = isActive ? 1.0 : 0.88;
      headGroupRef.current.scale.setScalar(THREE.MathUtils.lerp(curScale, tgtScale, 0.04));
    }

    if (leftEyeRef.current && rightEyeRef.current) {
      const blink = Math.sin(t * 0.5 + offset);
      const blinkScale = blink > 0.94 ? Math.max(0.1, 1 - (blink - 0.94) * 16) : 1;
      leftEyeRef.current.scale.y = blinkScale;
      rightEyeRef.current.scale.y = blinkScale;
    }

    if (leftIrisRef.current && rightIrisRef.current) {
      const lookX = Math.sin(t * 0.4 + offset) * 0.03;
      const lookY = Math.sin(t * 0.3 + offset + 1) * 0.02;
      leftIrisRef.current.position.x = -0.33 + lookX;
      leftIrisRef.current.position.y = 0.22 + lookY;
      rightIrisRef.current.position.x = 0.33 + lookX;
      rightIrisRef.current.position.y = 0.22 + lookY;
    }

    if (leftBrowRef.current && rightBrowRef.current) {
      const browY = emotion === "stern" ? -0.04 : emotion === "curious" ? 0.06 : 0;
      const browTilt = emotion === "stern" ? 0.15 : emotion === "curious" ? -0.08 : 0;
      leftBrowRef.current.position.y = THREE.MathUtils.lerp(leftBrowRef.current.position.y, 0.48 + browY, 0.05);
      rightBrowRef.current.position.y = THREE.MathUtils.lerp(rightBrowRef.current.position.y, 0.48 + browY, 0.05);
      leftBrowRef.current.rotation.z = THREE.MathUtils.lerp(leftBrowRef.current.rotation.z, browTilt, 0.05);
      rightBrowRef.current.rotation.z = THREE.MathUtils.lerp(rightBrowRef.current.rotation.z, -browTilt, 0.05);
    }

    const targetMouth = isSpeaking ? (mouthOpenness ?? (0.3 + Math.abs(Math.sin(t * 12)) * 0.7)) : 0;
    mouthOpen.current = THREE.MathUtils.lerp(mouthOpen.current, targetMouth, 0.25);

    if (upperLipRef.current && lowerLipRef.current && jawRef.current) {
      const open = mouthOpen.current;
      upperLipRef.current.position.y = -0.22 + open * 0.02;
      lowerLipRef.current.position.y = -0.30 - open * 0.12;
      jawRef.current.position.y = -0.35 - open * 0.06;
      jawRef.current.scale.y = 1 + open * 0.08;
    }

    if (coreRef.current) {
      const bpmHz = bpm / 60;
      const pulse = Math.abs(Math.sin(t * bpmHz * Math.PI));
      (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        THREE.MathUtils.lerp(0.05, 0.15, pulse) * targetActive;
    }

    if (scanRef.current) {
      scanRef.current.position.y = Math.sin(t * 0.8) * 1.0;
      (scanRef.current.material as THREE.MeshStandardMaterial).opacity =
        (isActive ? 0.12 : 0.04) + Math.abs(Math.sin(t * 0.8)) * 0.08;
    }
  });

  const skinMat = useMemo(() => ({
    color: skinTone,
    emissive: new THREE.Color(colors.emissive),
    emissiveIntensity: 0.08,
    roughness: 0.65,
    metalness: 0.05,
  }), [skinTone, colors.emissive]);

  const holoOverlay = useMemo(() => ({
    color: colors.primary,
    emissive: colors.primary,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.06,
    roughness: 0,
    metalness: 1,
  }), [colors.primary]);

  return (
    <group>
      <ActiveSpeakerGlow color={colors.primary} isActive={!!(isActive && isSpeaking)} />
      <group ref={headGroupRef}>
        <mesh ref={coreRef}>
          <sphereGeometry args={[0.95, 64, 64]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        <mesh scale={[1, 1.15, 1]}>
          <sphereGeometry args={[0.96, 32, 32]} />
          <meshStandardMaterial {...holoOverlay} />
        </mesh>

        <mesh ref={scanRef} position={[0, 0, 0.9]}>
          <planeGeometry args={[1.8, 0.02]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={2} transparent opacity={0.15} />
        </mesh>

        <mesh position={[0, -0.1, 0.88]} scale={[0.14, 0.12, 0.15]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={skinTone.clone().multiplyScalar(0.95)} roughness={0.7} metalness={0.05} />
        </mesh>
        <mesh position={[0, -0.15, 0.92]} scale={[0.06, 0.04, 0.05]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={skinTone.clone().multiplyScalar(0.85)} roughness={0.7} metalness={0.05} />
        </mesh>

        <group>
          <mesh ref={leftEyeRef} position={[-0.33, 0.22, 0.85]} scale={[0.14, 0.09, 0.06]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color={0xffffff} roughness={0.1} metalness={0} />
          </mesh>
          <mesh ref={rightEyeRef} position={[0.33, 0.22, 0.85]} scale={[0.14, 0.09, 0.06]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color={0xffffff} roughness={0.1} metalness={0} />
          </mesh>
          <mesh ref={leftIrisRef} position={[-0.33, 0.22, 0.9]} scale={[0.055, 0.055, 0.03]}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color={0x2d1b00} emissive={colors.primary} emissiveIntensity={0.3} roughness={0.2} />
          </mesh>
          <mesh ref={rightIrisRef} position={[0.33, 0.22, 0.9]} scale={[0.055, 0.055, 0.03]}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color={0x2d1b00} emissive={colors.primary} emissiveIntensity={0.3} roughness={0.2} />
          </mesh>

          <mesh position={[-0.33, 0.22, 0.82]}>
            <circleGeometry args={[0.16, 16]} />
            <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={0.3} transparent opacity={0.08} />
          </mesh>
          <mesh position={[0.33, 0.22, 0.82]}>
            <circleGeometry args={[0.16, 16]} />
            <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={0.3} transparent opacity={0.08} />
          </mesh>
        </group>

        <mesh ref={leftBrowRef} position={[-0.33, 0.48, 0.84]} scale={[0.18, 0.025, 0.02]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={skinTone.clone().multiplyScalar(0.5)} roughness={0.8} />
        </mesh>
        <mesh ref={rightBrowRef} position={[0.33, 0.48, 0.84]} scale={[0.18, 0.025, 0.02]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={skinTone.clone().multiplyScalar(0.5)} roughness={0.8} />
        </mesh>

        <mesh ref={upperLipRef} position={[0, -0.22, 0.88]} scale={[0.2, 0.035, 0.06]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshStandardMaterial color={new THREE.Color(0xcc7766)} roughness={0.5} metalness={0} />
        </mesh>
        <mesh ref={lowerLipRef} position={[0, -0.30, 0.86]} scale={[0.18, 0.04, 0.05]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshStandardMaterial color={new THREE.Color(0xbb6655)} roughness={0.5} metalness={0} />
        </mesh>

        <mesh ref={jawRef} position={[0, -0.35, 0.3]} scale={[0.75, 0.55, 0.65]}>
          <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        <mesh position={[-0.82, 0.15, 0]} scale={[0.12, 0.18, 0.08]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>
        <mesh position={[0.82, 0.15, 0]} scale={[0.12, 0.18, 0.08]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        {[[-0.62, 0.05, 0.72], [0.62, 0.05, 0.72]].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh>
              <boxGeometry args={[0.12, 0.012, 0.008]} />
              <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={2.5} />
            </mesh>
            <mesh position={[0, -0.03, 0]}>
              <boxGeometry args={[0.06, 0.006, 0.008]} />
              <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={1.5} transparent opacity={0.5} />
            </mesh>
          </group>
        ))}

        <mesh position={[0, 0.65, 0.7]}>
          <boxGeometry args={[0.2, 0.008, 0.008]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={2} transparent opacity={0.6} />
        </mesh>
        <mesh position={[-0.06, 0.58, 0.75]}>
          <boxGeometry args={[0.08, 0.006, 0.008]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={1.5} transparent opacity={0.4} />
        </mesh>
        <mesh position={[0.06, 0.58, 0.75]}>
          <boxGeometry args={[0.08, 0.006, 0.008]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={1.5} transparent opacity={0.4} />
        </mesh>
      </group>

      <PulseRings isSpeaking={!!(isSpeaking && isActive)} bpm={bpm} color={colors.primary} />

      {name && (
        <Text
          position={[0, -1.6, 0]}
          fontSize={0.22}
          color={isActive && isSpeaking ? "#ffffff" : colors.label}
          font={undefined}
          anchorX="center"
          anchorY="middle"
          fillOpacity={isActive ? 1 : 0.5}
        >
          {(isActive && isSpeaking ? "🎙 " : "") + name}
        </Text>
      )}

      {isActive && isSpeaking && (
        <mesh position={[0, -2.0, 0]}>
          <planeGeometry args={[2.2, 0.003]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={3} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function HoloGrid({ color }: { color: number }) {
  const gridRef = useRef<THREE.GridHelper>(null);
  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.position.z = ((state.clock.elapsedTime * 0.3) % 1) - 0.5;
      const mat = gridRef.current.material as THREE.Material;
      if (Array.isArray(mat)) {
        mat.forEach(m => { (m as any).opacity = 0.08 + Math.sin(state.clock.elapsedTime * 0.5) * 0.04; });
      }
    }
  });
  return <gridHelper ref={gridRef} args={[20, 20, color, color]} position={[0, -2.5, 0]} />;
}

function Nebula({ color }: { color: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.02;
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity = 0.04 + Math.sin(state.clock.elapsedTime * 0.3) * 0.02;
    }
  });
  return (
    <mesh ref={meshRef} position={[0, 0, -8]}>
      <torusGeometry args={[6, 4, 16, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.05} />
    </mesh>
  );
}

interface Avatar3DProps {
  emotion: "neutral" | "empathetic" | "stern" | "curious" | "stressed";
  isSpeaking: boolean;
  bpm: number;
  panelMode?: boolean;
  panelAvatars?: Array<{ name: string; emotion: AvatarProps["emotion"] }>;
  activeSpeakerIndex?: number;
  mouthOpenness?: number;
  spokenText?: string;
}

export default function Avatar3D({ emotion, isSpeaking, bpm, panelMode, panelAvatars, activeSpeakerIndex = 0, mouthOpenness = 0, spokenText }: Avatar3DProps) {
  const colors = EMOTION_COLORS[emotion];

  if (panelMode && panelAvatars) {
    return (
      <div className="w-full h-full relative">
        <Canvas
          camera={{ position: [0, 0, 9], fov: 52 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#000408"]} />
          <fog attach="fog" args={["#000408", 12, 40]} />
          <ambientLight intensity={0.25} />
          <pointLight position={[0, 5, 8]} intensity={3} color={0x00d4ff} />
          <pointLight position={[-6, 3, 5]} intensity={2} color={0x7700ff} />
          <pointLight position={[6, 3, 5]} intensity={2} color={0xff0044} />
          <pointLight position={[0, -2, 6]} intensity={1} color={0xffeedd} />
          <Stars radius={60} depth={60} count={3000} factor={2.5} fade speed={0.5} />
          <NeuralNetwork bpm={bpm} color={0x003366} />

          {panelAvatars.map((avatar, i) => {
            const positions: [number, number, number][] = [[-3.8, 0, 0], [0, 0, 0], [3.8, 0, 0]];
            const isThisActive = activeSpeakerIndex === i;
            return (
              <group key={i} position={positions[i]}>
                <HumanHead
                  emotion={isThisActive && isSpeaking ? emotion : avatar.emotion}
                  isSpeaking={isSpeaking && isThisActive}
                  bpm={bpm}
                  name={avatar.name}
                  index={i}
                  isActive={isThisActive || !isSpeaking}
                  mouthOpenness={isThisActive ? mouthOpenness : 0}
                />
              </group>
            );
          })}
          <HoloGrid color={0x003366} />
          <Nebula color={0x0044aa} />
        </Canvas>

        {isSpeaking && spokenText && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-[85%] z-20">
            <div className="bg-black/85 border border-cyan-500/40 rounded-xl px-5 py-3 backdrop-blur-md"
              style={{ boxShadow: "0 0 25px rgba(0,212,255,0.15)" }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: EMOTION_COLORS[panelAvatars[activeSpeakerIndex]?.emotion ?? "neutral"].label }} />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold"
                  style={{ color: EMOTION_COLORS[panelAvatars[activeSpeakerIndex]?.emotion ?? "neutral"].label }}>
                  {panelAvatars[activeSpeakerIndex]?.name ?? "Interviewer"}
                </span>
              </div>
              <p className="text-sm font-mono text-cyan-100 leading-relaxed">{spokenText}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#000408"]} />
        <fog attach="fog" args={["#000408", 10, 35]} />
        <ambientLight intensity={0.2} />
        <pointLight position={[4, 4, 6]} intensity={3} color={colors.primary} />
        <pointLight position={[-4, 4, 6]} intensity={2} color={0x7700ff} />
        <pointLight position={[0, -4, 4]} intensity={1.5} color={0xff0044} />
        <pointLight position={[0, 0, 8]} intensity={0.8} color={0xffeedd} />
        <Stars radius={60} depth={60} count={4000} factor={3} fade speed={0.4} />
        <NeuralNetwork bpm={bpm} color={colors.primary} />
        <DNAHelix color={colors.primary} />
        <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.25}>
          <HumanHead emotion={emotion} isSpeaking={isSpeaking} bpm={bpm} isActive={true} mouthOpenness={mouthOpenness} />
        </Float>
        <HoloGrid color={colors.primary} />
        <Nebula color={colors.primary} />
      </Canvas>

      {isSpeaking && spokenText && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-[85%] z-20">
          <div className="bg-black/85 border border-cyan-500/40 rounded-xl px-5 py-3 backdrop-blur-md"
            style={{ boxShadow: "0 0 25px rgba(0,212,255,0.15)" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-[0.2em] font-bold">
                Interviewer
              </span>
            </div>
            <p className="text-sm font-mono text-cyan-100 leading-relaxed">{spokenText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
