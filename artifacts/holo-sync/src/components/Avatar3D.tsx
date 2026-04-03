import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float, Stars, Ring, Torus } from "@react-three/drei";
import * as THREE from "three";

interface AvatarProps {
  emotion: "neutral" | "empathetic" | "stern" | "curious" | "stressed";
  isSpeaking: boolean;
  bpm: number;
  name?: string;
  index?: number;
}

function HolographicFace({ emotion, isSpeaking, bpm, index = 0 }: AvatarProps) {
  const headRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const emotionColors = useMemo(() => ({
    neutral: { primary: 0x00d4ff, secondary: 0x0077ff, emissive: 0x003366 },
    empathetic: { primary: 0x00ff88, secondary: 0x00aa55, emissive: 0x003322 },
    stern: { primary: 0xff4444, secondary: 0xaa0000, emissive: 0x330000 },
    curious: { primary: 0xffaa00, secondary: 0xff6600, emissive: 0x332200 },
    stressed: { primary: 0xff00ff, secondary: 0xaa00aa, emissive: 0x330033 },
  }), []);

  const colors = emotionColors[emotion];
  const offset = index * (Math.PI * 2 / 3);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
    const t = timeRef.current;

    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.3 + offset) * 0.15;
      headRef.current.rotation.x = Math.sin(t * 0.2 + offset) * 0.05;
    }

    if (leftEyeRef.current && rightEyeRef.current) {
      const blinkCycle = Math.sin(t * 0.5 + offset);
      const blinkScale = blinkCycle > 0.95 ? 1 - (blinkCycle - 0.95) * 20 : 1;
      leftEyeRef.current.scale.y = Math.max(0.1, blinkScale);
      rightEyeRef.current.scale.y = Math.max(0.1, blinkScale);

      const eyeGlow = 0.5 + Math.sin(t * 2) * 0.3;
      (leftEyeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eyeGlow;
      (rightEyeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eyeGlow;
    }

    if (mouthRef.current && isSpeaking) {
      const speakY = 0.2 + Math.abs(Math.sin(t * 12)) * 0.15;
      mouthRef.current.scale.y = speakY;
    } else if (mouthRef.current) {
      mouthRef.current.scale.y = 0.2;
    }

    if (auraRef.current) {
      const stressMultiplier = bpm > 100 ? 1.5 : 1;
      auraRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.05 * stressMultiplier);
      (auraRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.15 + Math.sin(t * 2) * 0.05;
    }
  });

  return (
    <group>
      {/* Outer aura */}
      <mesh ref={auraRef}>
        <sphereGeometry args={[1.6, 16, 16]} />
        <meshStandardMaterial
          color={colors.primary}
          transparent
          opacity={0.1}
          wireframe
        />
      </mesh>

      {/* Head */}
      <mesh ref={headRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={colors.primary}
          emissive={colors.emissive}
          emissiveIntensity={0.5}
          wireframe={false}
          transparent
          opacity={0.85}
          roughness={0.2}
          metalness={0.8}
        />

        {/* Left Eye */}
        <mesh ref={leftEyeRef} position={[-0.3, 0.15, 0.9]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial
            color={0xffffff}
            emissive={colors.primary}
            emissiveIntensity={1}
          />
        </mesh>

        {/* Right Eye */}
        <mesh ref={rightEyeRef} position={[0.3, 0.15, 0.9]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial
            color={0xffffff}
            emissive={colors.primary}
            emissiveIntensity={1}
          />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.05, 0.95]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={0.3} />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouthRef} position={[0, -0.25, 0.93]}>
          <boxGeometry args={[0.3, 0.08, 0.05]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={0.8} />
        </mesh>

        {/* Cheek marks */}
        <mesh position={[-0.55, 0.0, 0.8]}>
          <boxGeometry args={[0.15, 0.02, 0.02]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={2} />
        </mesh>
        <mesh position={[0.55, 0.0, 0.8]}>
          <boxGeometry args={[0.15, 0.02, 0.02]} />
          <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={2} />
        </mesh>
      </mesh>

      {/* Orbital rings */}
      <Torus args={[1.3, 0.01, 4, 64]} rotation={[Math.PI / 2 + 0.3, 0.3, 0]}>
        <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={1} transparent opacity={0.6} />
      </Torus>
      <Torus args={[1.5, 0.008, 4, 64]} rotation={[-Math.PI / 4, 0.5, 0]}>
        <meshStandardMaterial color={colors.secondary} emissive={colors.secondary} emissiveIntensity={1} transparent opacity={0.4} />
      </Torus>
    </group>
  );
}

function DataParticles({ bpm }: { bpm: number }) {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 200;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      particlesRef.current.rotation.x = state.clock.elapsedTime * 0.03;
      const speed = bpm > 100 ? 0.12 : 0.08;
      particlesRef.current.rotation.z = state.clock.elapsedTime * speed;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={bpm > 100 ? 0xff4444 : 0x00d4ff}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

interface Avatar3DProps {
  emotion: "neutral" | "empathetic" | "stern" | "curious" | "stressed";
  isSpeaking: boolean;
  bpm: number;
  panelMode?: boolean;
  panelAvatars?: Array<{ name: string; emotion: AvatarProps["emotion"] }>;
}

export default function Avatar3D({ emotion, isSpeaking, bpm, panelMode, panelAvatars }: Avatar3DProps) {
  if (panelMode && panelAvatars) {
    return (
      <div className="w-full h-full">
        <Canvas camera={{ position: [0, 0, 8], fov: 50 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.2} />
          <pointLight position={[5, 5, 5]} intensity={1.5} color={0x00d4ff} />
          <pointLight position={[-5, 5, 5]} intensity={1} color={0x7700ff} />
          <pointLight position={[0, -5, 5]} intensity={0.8} color={0xff0044} />
          <Stars radius={50} depth={50} count={2000} factor={2} fade />
          <DataParticles bpm={bpm} />

          {panelAvatars.map((avatar, i) => {
            const positions: [number, number, number][] = [[-3.5, 0, 0], [0, 0, 0], [3.5, 0, 0]];
            return (
              <group key={i} position={positions[i]}>
                <HolographicFace
                  emotion={avatar.emotion}
                  isSpeaking={isSpeaking && i === 0}
                  bpm={bpm}
                  name={avatar.name}
                  index={i}
                />
              </group>
            );
          })}
        </Canvas>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[5, 5, 5]} intensity={2} color={0x00d4ff} />
        <pointLight position={[-5, 5, 5]} intensity={1} color={0x7700ff} />
        <pointLight position={[0, -5, 5]} intensity={0.8} color={0xff0044} />
        <Stars radius={50} depth={50} count={3000} factor={2} fade />
        <DataParticles bpm={bpm} />
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
          <HolographicFace emotion={emotion} isSpeaking={isSpeaking} bpm={bpm} />
        </Float>
      </Canvas>
    </div>
  );
}
