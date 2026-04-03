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
  const leftPupilRef = useRef<THREE.Mesh>(null);
  const rightPupilRef = useRef<THREE.Mesh>(null);
  const upperLipRef = useRef<THREE.Mesh>(null);
  const lowerLipRef = useRef<THREE.Mesh>(null);
  const leftBrowRef = useRef<THREE.Mesh>(null);
  const rightBrowRef = useRef<THREE.Mesh>(null);
  const leftLidRef = useRef<THREE.Mesh>(null);
  const rightLidRef = useRef<THREE.Mesh>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const neckRef = useRef<THREE.Mesh>(null);

  const colors = EMOTION_COLORS[emotion];
  const offset = index * (Math.PI * 2 / 3);

  const skinTone = useMemo(() => {
    const base = new THREE.Color(0xe8beac);
    base.lerp(new THREE.Color(colors.primary), 0.08);
    return base;
  }, [colors.primary]);

  const skinDark = useMemo(() => skinTone.clone().multiplyScalar(0.85), [skinTone]);
  const skinDeep = useMemo(() => skinTone.clone().multiplyScalar(0.7), [skinTone]);
  const lipColor = useMemo(() => {
    const c = new THREE.Color(0xc47060);
    c.lerp(new THREE.Color(colors.primary), 0.08);
    return c;
  }, [colors.primary]);
  const lipDark = useMemo(() => lipColor.clone().multiplyScalar(0.85), [lipColor]);

  const mouthOpen = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.3 + offset) * (isActive ? 0.15 : 0.05);
      headGroupRef.current.rotation.x = Math.sin(t * 0.2 + offset) * 0.04;
      const curScale = headGroupRef.current.scale.x;
      const tgtScale = isActive ? 1.0 : 0.88;
      headGroupRef.current.scale.setScalar(THREE.MathUtils.lerp(curScale, tgtScale, 0.04));
    }

    if (leftEyeRef.current && rightEyeRef.current && leftLidRef.current && rightLidRef.current) {
      const blink = Math.sin(t * 0.5 + offset);
      const blinkScale = blink > 0.94 ? Math.max(0.1, 1 - (blink - 0.94) * 16) : 1;
      leftEyeRef.current.scale.y = blinkScale;
      rightEyeRef.current.scale.y = blinkScale;
      leftLidRef.current.scale.y = blinkScale < 0.5 ? 1.5 : 0.6;
      rightLidRef.current.scale.y = blinkScale < 0.5 ? 1.5 : 0.6;
    }

    if (leftIrisRef.current && rightIrisRef.current && leftPupilRef.current && rightPupilRef.current) {
      const lookX = Math.sin(t * 0.4 + offset) * 0.025;
      const lookY = Math.sin(t * 0.3 + offset + 1) * 0.015;
      leftIrisRef.current.position.x = -0.28 + lookX;
      leftIrisRef.current.position.y = 0.28 + lookY;
      rightIrisRef.current.position.x = 0.28 + lookX;
      rightIrisRef.current.position.y = 0.28 + lookY;
      leftPupilRef.current.position.x = -0.28 + lookX;
      leftPupilRef.current.position.y = 0.28 + lookY;
      rightPupilRef.current.position.x = 0.28 + lookX;
      rightPupilRef.current.position.y = 0.28 + lookY;
    }

    if (leftBrowRef.current && rightBrowRef.current) {
      const browY = emotion === "stern" ? -0.04 : emotion === "curious" ? 0.06 : 0;
      const browTilt = emotion === "stern" ? 0.15 : emotion === "curious" ? -0.08 : 0;
      leftBrowRef.current.position.y = THREE.MathUtils.lerp(leftBrowRef.current.position.y, 0.52 + browY, 0.05);
      rightBrowRef.current.position.y = THREE.MathUtils.lerp(rightBrowRef.current.position.y, 0.52 + browY, 0.05);
      leftBrowRef.current.rotation.z = THREE.MathUtils.lerp(leftBrowRef.current.rotation.z, browTilt, 0.05);
      rightBrowRef.current.rotation.z = THREE.MathUtils.lerp(rightBrowRef.current.rotation.z, -browTilt, 0.05);
    }

    const targetMouth = isSpeaking ? (mouthOpenness ?? (0.3 + Math.abs(Math.sin(t * 12)) * 0.7)) : 0;
    mouthOpen.current = THREE.MathUtils.lerp(mouthOpen.current, targetMouth, 0.25);

    if (upperLipRef.current && lowerLipRef.current && jawRef.current) {
      const open = mouthOpen.current;
      upperLipRef.current.position.y = -0.18 + open * 0.015;
      lowerLipRef.current.position.y = -0.25 - open * 0.1;
      jawRef.current.position.y = -0.35 - open * 0.05;
      jawRef.current.scale.y = 1 + open * 0.06;
    }

    if (coreRef.current) {
      const bpmHz = bpm / 60;
      const pulse = Math.abs(Math.sin(t * bpmHz * Math.PI));
      (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        THREE.MathUtils.lerp(0.03, 0.12, pulse) * (isActive ? 1 : 0.5);
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
    emissiveIntensity: 0.06,
    roughness: 0.55,
    metalness: 0.02,
  }), [skinTone, colors.emissive]);

  const holoOverlay = useMemo(() => ({
    color: colors.primary,
    emissive: colors.primary,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.04,
    roughness: 0,
    metalness: 1,
  }), [colors.primary]);

  return (
    <group>
      <ActiveSpeakerGlow color={colors.primary} isActive={!!(isActive && isSpeaking)} />
      <group ref={headGroupRef}>

        {/* ── Cranium (main head shape — slightly elongated vertically) ── */}
        <mesh ref={coreRef} position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.88, 64, 64]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        {/* ── Forehead prominence ── */}
        <mesh position={[0, 0.55, 0.45]} scale={[0.7, 0.28, 0.3]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        {/* ── Temple indents (slightly darker) ── */}
        <mesh position={[-0.65, 0.3, 0.35]} scale={[0.18, 0.25, 0.15]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
        </mesh>
        <mesh position={[0.65, 0.3, 0.35]} scale={[0.18, 0.25, 0.15]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
        </mesh>

        {/* ── Cheekbones ── */}
        <mesh position={[-0.52, 0.08, 0.62]} scale={[0.22, 0.14, 0.18]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>
        <mesh position={[0.52, 0.08, 0.62]} scale={[0.22, 0.14, 0.18]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        {/* ── Mid-face / maxilla ── */}
        <mesh position={[0, 0.0, 0.72]} scale={[0.38, 0.3, 0.2]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        {/* ── Eye socket depressions ── */}
        <mesh position={[-0.28, 0.28, 0.72]} scale={[0.17, 0.1, 0.08]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={skinDeep} roughness={0.7} metalness={0.01} />
        </mesh>
        <mesh position={[0.28, 0.28, 0.72]} scale={[0.17, 0.1, 0.08]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={skinDeep} roughness={0.7} metalness={0.01} />
        </mesh>

        {/* ── Brow ridge ── */}
        <mesh position={[0, 0.4, 0.7]} scale={[0.55, 0.06, 0.12]}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        {/* ── Nose bridge ── */}
        <mesh position={[0, 0.15, 0.82]} scale={[0.06, 0.18, 0.1]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={skinTone} roughness={0.5} metalness={0.02} />
        </mesh>

        {/* ── Nose tip (bulbous) ── */}
        <mesh position={[0, -0.02, 0.92]} scale={[0.1, 0.08, 0.1]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.45} metalness={0.02} />
        </mesh>

        {/* ── Nose wings / nostrils ── */}
        <mesh position={[-0.06, -0.06, 0.88]} scale={[0.05, 0.04, 0.05]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.01} />
        </mesh>
        <mesh position={[0.06, -0.06, 0.88]} scale={[0.05, 0.04, 0.05]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.01} />
        </mesh>

        {/* ── Nostril holes (dark) ── */}
        <mesh position={[-0.04, -0.07, 0.92]} scale={[0.025, 0.015, 0.01]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={0x3d2b1f} roughness={0.9} />
        </mesh>
        <mesh position={[0.04, -0.07, 0.92]} scale={[0.025, 0.015, 0.01]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={0x3d2b1f} roughness={0.9} />
        </mesh>

        {/* ── Nasolabial folds (subtle creases from nose to mouth) ── */}
        <mesh position={[-0.18, -0.08, 0.82]} scale={[0.03, 0.12, 0.02]} rotation={[0, 0, 0.15]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={skinDeep} roughness={0.7} metalness={0.01} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0.18, -0.08, 0.82]} scale={[0.03, 0.12, 0.02]} rotation={[0, 0, -0.15]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={skinDeep} roughness={0.7} metalness={0.01} transparent opacity={0.5} />
        </mesh>

        {/* ── Eyes (eyeballs) ── */}
        <group>
          <mesh ref={leftEyeRef} position={[-0.28, 0.28, 0.82]} scale={[0.12, 0.08, 0.06]}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial color={0xf5f5f0} roughness={0.05} metalness={0} />
          </mesh>
          <mesh ref={rightEyeRef} position={[0.28, 0.28, 0.82]} scale={[0.12, 0.08, 0.06]}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial color={0xf5f5f0} roughness={0.05} metalness={0} />
          </mesh>

          {/* ── Irises ── */}
          <mesh ref={leftIrisRef} position={[-0.28, 0.28, 0.875]} scale={[0.05, 0.05, 0.02]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color={0x3d6b4f} emissive={colors.primary} emissiveIntensity={0.2} roughness={0.15} />
          </mesh>
          <mesh ref={rightIrisRef} position={[0.28, 0.28, 0.875]} scale={[0.05, 0.05, 0.02]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color={0x3d6b4f} emissive={colors.primary} emissiveIntensity={0.2} roughness={0.15} />
          </mesh>

          {/* ── Pupils ── */}
          <mesh ref={leftPupilRef} position={[-0.28, 0.28, 0.89]} scale={[0.022, 0.022, 0.01]}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color={0x0a0a0a} roughness={0.1} />
          </mesh>
          <mesh ref={rightPupilRef} position={[0.28, 0.28, 0.89]} scale={[0.022, 0.022, 0.01]}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color={0x0a0a0a} roughness={0.1} />
          </mesh>

          {/* ── Eye highlights (specular catch lights) ── */}
          <mesh position={[-0.265, 0.295, 0.895]} scale={[0.008, 0.008, 0.005]}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color={0xffffff} emissive={0xffffff} emissiveIntensity={3} />
          </mesh>
          <mesh position={[0.295, 0.295, 0.895]} scale={[0.008, 0.008, 0.005]}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color={0xffffff} emissive={0xffffff} emissiveIntensity={3} />
          </mesh>

          {/* ── Upper eyelids ── */}
          <mesh ref={leftLidRef} position={[-0.28, 0.34, 0.83]} scale={[0.14, 0.03, 0.07]} rotation={[0.2, 0, 0]}>
            <sphereGeometry args={[1, 16, 8]} />
            <meshStandardMaterial color={skinTone} roughness={0.5} metalness={0.02} />
          </mesh>
          <mesh ref={rightLidRef} position={[0.28, 0.34, 0.83]} scale={[0.14, 0.03, 0.07]} rotation={[0.2, 0, 0]}>
            <sphereGeometry args={[1, 16, 8]} />
            <meshStandardMaterial color={skinTone} roughness={0.5} metalness={0.02} />
          </mesh>

          {/* ── Lower eyelids ── */}
          <mesh position={[-0.28, 0.22, 0.83]} scale={[0.13, 0.015, 0.06]} rotation={[-0.1, 0, 0]}>
            <sphereGeometry args={[1, 16, 8]} />
            <meshStandardMaterial color={skinDark} roughness={0.55} metalness={0.02} />
          </mesh>
          <mesh position={[0.28, 0.22, 0.83]} scale={[0.13, 0.015, 0.06]} rotation={[-0.1, 0, 0]}>
            <sphereGeometry args={[1, 16, 8]} />
            <meshStandardMaterial color={skinDark} roughness={0.55} metalness={0.02} />
          </mesh>

          {/* ── Subtle eye glow rings (holographic touch) ── */}
          <mesh position={[-0.28, 0.28, 0.78]}>
            <circleGeometry args={[0.14, 24]} />
            <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={0.25} transparent opacity={0.06} />
          </mesh>
          <mesh position={[0.28, 0.28, 0.78]}>
            <circleGeometry args={[0.14, 24]} />
            <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={0.25} transparent opacity={0.06} />
          </mesh>
        </group>

        {/* ── Eyebrows (curved, thicker) ── */}
        <group>
          <mesh ref={leftBrowRef} position={[-0.28, 0.52, 0.78]} scale={[0.16, 0.022, 0.03]} rotation={[0.1, 0, 0.08]}>
            <capsuleGeometry args={[1, 0.4, 4, 12]} />
            <meshStandardMaterial color={skinTone.clone().multiplyScalar(0.35)} roughness={0.9} />
          </mesh>
          <mesh ref={rightBrowRef} position={[0.28, 0.52, 0.78]} scale={[0.16, 0.022, 0.03]} rotation={[0.1, 0, -0.08]}>
            <capsuleGeometry args={[1, 0.4, 4, 12]} />
            <meshStandardMaterial color={skinTone.clone().multiplyScalar(0.35)} roughness={0.9} />
          </mesh>
        </group>

        {/* ── Upper lip (cupid's bow shape) ── */}
        <mesh ref={upperLipRef} position={[0, -0.18, 0.85]} scale={[0.16, 0.025, 0.06]}>
          <sphereGeometry args={[1, 24, 12]} />
          <meshStandardMaterial color={lipColor} roughness={0.4} metalness={0} />
        </mesh>
        {/* ── Philtrum (groove above upper lip) ── */}
        <mesh position={[0, -0.12, 0.88]} scale={[0.03, 0.05, 0.02]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={skinDark} roughness={0.65} metalness={0.01} transparent opacity={0.4} />
        </mesh>
        {/* ── Lower lip (fuller) ── */}
        <mesh ref={lowerLipRef} position={[0, -0.25, 0.83]} scale={[0.14, 0.032, 0.055]}>
          <sphereGeometry args={[1, 24, 12]} />
          <meshStandardMaterial color={lipDark} roughness={0.35} metalness={0} />
        </mesh>
        {/* ── Mouth interior (dark cavity) ── */}
        <mesh position={[0, -0.21, 0.82]} scale={[0.1, 0.01, 0.03]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={0x2a1015} roughness={0.9} />
        </mesh>

        {/* ── Chin ── */}
        <mesh position={[0, -0.48, 0.6]} scale={[0.2, 0.15, 0.18]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>
        {/* ── Chin dimple (subtle) ── */}
        <mesh position={[0, -0.48, 0.72]} scale={[0.04, 0.03, 0.02]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={skinDeep} roughness={0.7} transparent opacity={0.3} />
        </mesh>

        {/* ── Jaw / lower face ── */}
        <mesh ref={jawRef} position={[0, -0.35, 0.25]} scale={[0.7, 0.5, 0.6]}>
          <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        {/* ── Jawline definition ── */}
        <mesh position={[-0.48, -0.28, 0.35]} scale={[0.12, 0.08, 0.15]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>
        <mesh position={[0.48, -0.28, 0.35]} scale={[0.12, 0.08, 0.15]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial {...skinMat} />
        </mesh>

        {/* ── Ears ── */}
        <mesh position={[-0.85, 0.15, 0]} scale={[0.08, 0.16, 0.1]} rotation={[0, -0.3, 0.1]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
        </mesh>
        <mesh position={[0.85, 0.15, 0]} scale={[0.08, 0.16, 0.1]} rotation={[0, 0.3, -0.1]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
        </mesh>
        {/* ── Inner ear detail ── */}
        <mesh position={[-0.83, 0.15, 0.02]} scale={[0.04, 0.1, 0.06]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={skinDeep} roughness={0.7} />
        </mesh>
        <mesh position={[0.83, 0.15, 0.02]} scale={[0.04, 0.1, 0.06]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={skinDeep} roughness={0.7} />
        </mesh>

        {/* ── Neck ── */}
        <mesh ref={neckRef} position={[0, -0.72, -0.05]} scale={[0.28, 0.3, 0.22]}>
          <cylinderGeometry args={[1, 0.9, 1, 24]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
        </mesh>

        {/* ── Holographic overlay (translucent shell) ── */}
        <mesh position={[0, 0.08, 0]} scale={[1, 1.08, 1]}>
          <sphereGeometry args={[0.9, 48, 48]} />
          <meshStandardMaterial {...holoOverlay} />
        </mesh>

        {/* ── Scan line ── */}
        <mesh ref={scanRef} position={[0, 0, 0.9]}>
          <planeGeometry args={[1.8, 0.015]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={2} transparent opacity={0.15} />
        </mesh>

        {/* ── Facial tech lines (holographic accent) ── */}
        {[[-0.55, 0.08, 0.7], [0.55, 0.08, 0.7]].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh>
              <boxGeometry args={[0.1, 0.008, 0.005]} />
              <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={2} />
            </mesh>
            <mesh position={[0, -0.025, 0]}>
              <boxGeometry args={[0.05, 0.004, 0.005]} />
              <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={1.2} transparent opacity={0.4} />
            </mesh>
          </group>
        ))}

        {/* ── Forehead data line ── */}
        <mesh position={[0, 0.62, 0.65]}>
          <boxGeometry args={[0.15, 0.005, 0.005]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={1.8} transparent opacity={0.5} />
        </mesh>
        <mesh position={[-0.05, 0.56, 0.7]}>
          <boxGeometry args={[0.06, 0.004, 0.005]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={1.2} transparent opacity={0.3} />
        </mesh>
        <mesh position={[0.05, 0.56, 0.7]}>
          <boxGeometry args={[0.06, 0.004, 0.005]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={1.2} transparent opacity={0.3} />
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
          <ambientLight intensity={0.3} />
          <pointLight position={[0, 5, 8]} intensity={3} color={0x00d4ff} />
          <pointLight position={[-6, 3, 5]} intensity={2} color={0x7700ff} />
          <pointLight position={[6, 3, 5]} intensity={2} color={0xff0044} />
          <pointLight position={[0, -2, 6]} intensity={1.5} color={0xffeedd} />
          <pointLight position={[0, 2, 10]} intensity={1} color={0xffffff} />
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
        <ambientLight intensity={0.25} />
        <pointLight position={[4, 4, 6]} intensity={3} color={colors.primary} />
        <pointLight position={[-4, 2, 4]} intensity={2} color={0x7700ff} />
        <pointLight position={[0, -2, 5]} intensity={1.5} color={0xffeedd} />
        <pointLight position={[0, 3, 8]} intensity={1} color={0xffffff} />
        <Stars radius={50} depth={50} count={2000} factor={2} fade speed={0.4} />
        <Float speed={0.6} rotationIntensity={0.04} floatIntensity={0.08}>
          <HumanHead
            emotion={emotion}
            isSpeaking={isSpeaking}
            bpm={bpm}
            isActive={true}
            mouthOpenness={mouthOpenness}
          />
        </Float>
        <NeuralNetwork bpm={bpm} color={colors.secondary} />
        <DNAHelix color={colors.secondary} />
        <HoloGrid color={colors.secondary} />
        <Nebula color={colors.secondary} />
      </Canvas>

      {isSpeaking && spokenText && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[90%] z-20">
          <div className="bg-black/85 border border-cyan-500/40 rounded-xl px-5 py-3 backdrop-blur-md"
            style={{ boxShadow: "0 0 25px rgba(0,212,255,0.15)" }}>
            <p className="text-sm font-mono text-cyan-100 leading-relaxed">{spokenText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
