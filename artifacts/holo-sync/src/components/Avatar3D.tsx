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
}

const EMOTION_COLORS = {
  neutral:    { primary: 0x00d4ff, secondary: 0x0077ff, emissive: 0x001133, label: "#00d4ff" },
  empathetic: { primary: 0x00ff88, secondary: 0x00cc66, emissive: 0x001122, label: "#00ff88" },
  stern:      { primary: 0xff3333, secondary: 0xcc1111, emissive: 0x220000, label: "#ff3333" },
  curious:    { primary: 0xffaa00, secondary: 0xff6600, emissive: 0x221100, label: "#ffaa00" },
  stressed:   { primary: 0xff00ff, secondary: 0xcc00cc, emissive: 0x220022, label: "#ff00ff" },
};

// ─── Neural Particle Network ──────────────────────────────────────────────────
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

    // Connect nearby particles
    const linePos: number[] = [];
    const threshold = 1.8;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = positions[i*3] - positions[j*3];
        const dy = positions[i*3+1] - positions[j*3+1];
        const dz = positions[i*3+2] - positions[j*3+2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist < threshold && linePos.length < 600) {
          linePos.push(
            positions[i*3], positions[i*3+1], positions[i*3+2],
            positions[j*3], positions[j*3+1], positions[j*3+2],
          );
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

// ─── DNA Helix ────────────────────────────────────────────────────────────────
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
      s1[i*3]   = Math.cos(t) * r;
      s1[i*3+1] = y;
      s1[i*3+2] = Math.sin(t) * r;
      s2[i*3]   = Math.cos(t + Math.PI) * r;
      s2[i*3+1] = y;
      s2[i*3+2] = Math.sin(t + Math.PI) * r;
      if (i % 4 === 0) {
        b.push(s1[i*3], s1[i*3+1], s1[i*3+2], s2[i*3], s2[i*3+1], s2[i*3+2]);
      }
    }
    return { strand1: s1, strand2: s2, bridges: new Float32Array(b) };
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
  });

  const c = new THREE.Color(color);
  const c2 = new THREE.Color(color).multiplyScalar(0.6);
  return (
    <group ref={groupRef}>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[strand1, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={c} transparent opacity={0.5} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[strand2, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={c2} transparent opacity={0.4} />
      </line>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bridges, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={c} transparent opacity={0.25} />
      </lineSegments>
    </group>
  );
}

// ─── Energy Pulse Ring (emits on speak) ───────────────────────────────────────
function PulseRings({ isSpeaking, bpm, color }: { isSpeaking: boolean; bpm: number; color: number }) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = isSpeaking ? 1 : 0.3;
    const bpmBoost = bpm > 100 ? 1.4 : 1;
    if (ring1Ref.current) {
      const s1 = 1 + (Math.sin(t * 2) * 0.08 + 0.08) * pulse * bpmBoost;
      ring1Ref.current.scale.setScalar(s1);
      (ring1Ref.current.material as THREE.MeshStandardMaterial).opacity =
        (0.4 + Math.sin(t * 2) * 0.2) * pulse;
    }
    if (ring2Ref.current) {
      const s2 = 1 + (Math.sin(t * 2 + 1) * 0.06 + 0.06) * pulse * bpmBoost;
      ring2Ref.current.scale.setScalar(s2);
      (ring2Ref.current.material as THREE.MeshStandardMaterial).opacity =
        (0.25 + Math.sin(t * 2 + 1) * 0.15) * pulse;
    }
    if (ring3Ref.current) {
      const s3 = 1 + (Math.sin(t * 3 + 2) * 0.04 + 0.04) * pulse * bpmBoost;
      ring3Ref.current.scale.setScalar(s3);
      (ring3Ref.current.material as THREE.MeshStandardMaterial).opacity =
        (0.15 + Math.sin(t * 3 + 2) * 0.1) * pulse;
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

// ─── Main Holographic Head ────────────────────────────────────────────────────
function HolographicHead({ emotion, isSpeaking, bpm, index = 0, name }: AvatarProps) {
  const headGroupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const scanRef = useRef<THREE.Mesh>(null);

  const colors = EMOTION_COLORS[emotion];
  const offset = index * (Math.PI * 2 / 3);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.3 + offset) * 0.18;
      headGroupRef.current.rotation.x = Math.sin(t * 0.2 + offset) * 0.06;
    }

    // Eye blink
    if (leftEyeRef.current && rightEyeRef.current) {
      const blink = Math.sin(t * 0.5 + offset);
      const blinkScale = blink > 0.94 ? Math.max(0.1, 1 - (blink - 0.94) * 16) : 1;
      leftEyeRef.current.scale.y = blinkScale;
      rightEyeRef.current.scale.y = blinkScale;
      const glow = 0.6 + Math.sin(t * 2.5) * 0.4;
      (leftEyeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
      (rightEyeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
    }

    // Mouth speaking animation
    if (mouthRef.current) {
      if (isSpeaking) {
        mouthRef.current.scale.y = 0.15 + Math.abs(Math.sin(t * 14)) * 0.25;
        mouthRef.current.scale.x = 1 + Math.abs(Math.sin(t * 9)) * 0.2;
      } else {
        mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, 0.15, 0.1);
        mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, 1, 0.1);
      }
    }

    // Core pulse tied to BPM
    if (coreRef.current) {
      const bpmHz = bpm / 60;
      const pulse = Math.abs(Math.sin(t * bpmHz * Math.PI));
      const scale = 1 + pulse * 0.04 * (bpm > 100 ? 1.5 : 1);
      coreRef.current.scale.setScalar(scale);
      (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + pulse * 0.4;
    }

    // Holographic scan line
    if (scanRef.current) {
      scanRef.current.position.y = Math.sin(t * 0.8) * 1.0;
      (scanRef.current.material as THREE.MeshStandardMaterial).opacity = 0.15 + Math.abs(Math.sin(t * 0.8)) * 0.15;
    }
  });

  return (
    <group>
      {/* Main head */}
      <group ref={headGroupRef}>
        {/* Head core — layered spheres for depth */}
        <mesh ref={coreRef}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial
            color={colors.primary}
            emissive={colors.emissive}
            emissiveIntensity={0.4}
            transparent
            opacity={0.82}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>

        {/* Outer glass layer */}
        <mesh>
          <sphereGeometry args={[1.03, 32, 32]} />
          <meshStandardMaterial
            color={colors.primary}
            transparent
            opacity={0.06}
            roughness={0}
            metalness={1}
          />
        </mesh>

        {/* Scan line sweeping across face */}
        <mesh ref={scanRef} position={[0, 0, 0.98]}>
          <planeGeometry args={[1.8, 0.025]} />
          <meshStandardMaterial
            color={colors.primary}
            emissive={colors.primary}
            emissiveIntensity={2}
            transparent
            opacity={0.2}
          />
        </mesh>

        {/* Left Eye */}
        <mesh ref={leftEyeRef} position={[-0.3, 0.16, 0.93]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color={0xffffff} emissive={colors.primary} emissiveIntensity={1.2} />
        </mesh>

        {/* Right Eye */}
        <mesh ref={rightEyeRef} position={[0.3, 0.16, 0.93]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color={0xffffff} emissive={colors.primary} emissiveIntensity={1.2} />
        </mesh>

        {/* Eye glow halos */}
        <mesh position={[-0.3, 0.16, 0.91]}>
          <circleGeometry args={[0.18, 16]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={0.5} transparent opacity={0.15} />
        </mesh>
        <mesh position={[0.3, 0.16, 0.91]}>
          <circleGeometry args={[0.18, 16]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={0.5} transparent opacity={0.15} />
        </mesh>

        {/* Nose bridge */}
        <mesh position={[0, -0.04, 0.96]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={0.4} />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouthRef} position={[0, -0.28, 0.94]}>
          <boxGeometry args={[0.32, 0.075, 0.04]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={1.2} />
        </mesh>

        {/* Cheek tech marks */}
        {[[-0.58, 0.0, 0.78], [0.58, 0.0, 0.78]].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh>
              <boxGeometry args={[0.16, 0.015, 0.01]} />
              <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={2.5} />
            </mesh>
            <mesh position={[0, -0.04, 0]}>
              <boxGeometry args={[0.08, 0.008, 0.01]} />
              <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={1.5} transparent opacity={0.6} />
            </mesh>
          </group>
        ))}

        {/* Forehead tech lines */}
        <mesh position={[0, 0.6, 0.78]}>
          <boxGeometry args={[0.25, 0.01, 0.01]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={2} transparent opacity={0.7} />
        </mesh>
        <mesh position={[-0.08, 0.52, 0.82]}>
          <boxGeometry args={[0.1, 0.008, 0.01]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={1.5} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0.08, 0.52, 0.82]}>
          <boxGeometry args={[0.1, 0.008, 0.01]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={1.5} transparent opacity={0.5} />
        </mesh>
      </group>

      {/* Orbital rings */}
      <PulseRings isSpeaking={isSpeaking} bpm={bpm} color={colors.primary} />

      {/* Name label */}
      {name && (
        <Text
          position={[0, -1.6, 0]}
          fontSize={0.22}
          color={colors.label}
          font={undefined}
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.9}
        >
          {name}
        </Text>
      )}
    </group>
  );
}

// ─── Holographic Ground Grid ──────────────────────────────────────────────────
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
  return (
    <gridHelper
      ref={gridRef}
      args={[20, 20, color, color]}
      position={[0, -2.5, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

// ─── Nebula Background ────────────────────────────────────────────────────────
function Nebula({ color }: { color: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.02;
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.04 + Math.sin(state.clock.elapsedTime * 0.3) * 0.02;
    }
  });
  return (
    <mesh ref={meshRef} position={[0, 0, -8]}>
      <torusGeometry args={[6, 4, 16, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.05} />
    </mesh>
  );
}

// ─── Avatar3D Export ──────────────────────────────────────────────────────────
interface Avatar3DProps {
  emotion: "neutral" | "empathetic" | "stern" | "curious" | "stressed";
  isSpeaking: boolean;
  bpm: number;
  panelMode?: boolean;
  panelAvatars?: Array<{ name: string; emotion: AvatarProps["emotion"] }>;
}

export default function Avatar3D({ emotion, isSpeaking, bpm, panelMode, panelAvatars }: Avatar3DProps) {
  const colors = EMOTION_COLORS[emotion];

  if (panelMode && panelAvatars) {
    return (
      <div className="w-full h-full">
        <Canvas
          camera={{ position: [0, 0, 9], fov: 52 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#000408"]} />
          <fog attach="fog" args={["#000408", 12, 40]} />
          <ambientLight intensity={0.15} />
          <pointLight position={[0, 5, 8]} intensity={3} color={0x00d4ff} />
          <pointLight position={[-6, 3, 5]} intensity={2} color={0x7700ff} />
          <pointLight position={[6, 3, 5]} intensity={2} color={0xff0044} />
          <Stars radius={60} depth={60} count={3000} factor={2.5} fade speed={0.5} />
          <NeuralNetwork bpm={bpm} color={0x003366} />

          {panelAvatars.map((avatar, i) => {
            const positions: [number, number, number][] = [[-3.8, 0, 0], [0, 0, 0], [3.8, 0, 0]];
            return (
              <group key={i} position={positions[i]}>
                <HolographicHead
                  emotion={avatar.emotion}
                  isSpeaking={isSpeaking && i === 0}
                  bpm={bpm}
                  name={avatar.name}
                  index={i}
                />
              </group>
            );
          })}
          <HoloGrid color={0x003366} />
          <Nebula color={0x0044aa} />
        </Canvas>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#000408"]} />
        <fog attach="fog" args={["#000408", 10, 35]} />
        <ambientLight intensity={0.12} />
        <pointLight position={[4, 4, 6]} intensity={3} color={colors.primary} />
        <pointLight position={[-4, 4, 6]} intensity={2} color={0x7700ff} />
        <pointLight position={[0, -4, 4]} intensity={1.5} color={0xff0044} />
        <pointLight position={[0, 0, 8]} intensity={0.5} color={0xffffff} />

        <Stars radius={60} depth={60} count={4000} factor={3} fade speed={0.4} />
        <NeuralNetwork bpm={bpm} color={colors.primary} />
        <DNAHelix color={colors.primary} />

        <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.25}>
          <HolographicHead emotion={emotion} isSpeaking={isSpeaking} bpm={bpm} />
        </Float>

        <HoloGrid color={colors.primary} />
        <Nebula color={colors.primary} />
      </Canvas>
    </div>
  );
}
