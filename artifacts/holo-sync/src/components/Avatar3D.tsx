import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, useGLTF, Environment, useTexture } from "@react-three/drei";
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

const EMOTION_COLORS: Record<string, { primary: number; secondary: number; emissive: number; label: string }> = {
  neutral:    { primary: 0x00d4ff, secondary: 0x0077ff, emissive: 0x001133, label: "#00d4ff" },
  empathetic: { primary: 0x00ff88, secondary: 0x00cc66, emissive: 0x001122, label: "#00ff88" },
  stern:      { primary: 0xff3333, secondary: 0xcc1111, emissive: 0x220000, label: "#ff3333" },
  curious:    { primary: 0xffaa00, secondary: 0xff6600, emissive: 0x221100, label: "#ffaa00" },
  stressed:   { primary: 0xff00ff, secondary: 0xcc00cc, emissive: 0x220022, label: "#ff00ff" },
};

const HEAD_MODEL_URL = "/head.glb";

function AmbientParticles({ color, count = 300 }: { color: number; count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.5 + Math.random() * 3;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);

  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = s.clock.elapsedTime * 0.015;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} sizeAttenuation transparent color={color} opacity={0.6} />
    </points>
  );
}

function HeadModel({ emotion, isSpeaking, mouthOpenness = 0 }: { emotion: string; isSpeaking: boolean; mouthOpenness?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const emotionConfig = EMOTION_COLORS[emotion as keyof typeof EMOTION_COLORS] || EMOTION_COLORS.neutral;

  try {
    const { scene } = useGLTF(HEAD_MODEL_URL);
    const colorTexture = useTexture("/head-color.jpg");
    const normalTexture = useTexture("/head-normal.jpg");

    colorTexture.colorSpace = THREE.SRGBColorSpace;

    useFrame((s) => {
      if (groupRef.current) {
        const headMesh = groupRef.current.children[0] as THREE.Mesh;
        if (headMesh && headMesh.material) {
          const material = headMesh.material as THREE.MeshPhysicalMaterial;
          const targetPrimary = emotionConfig.primary;
          const currentColor = new THREE.Color(material.color);
          currentColor.lerp(new THREE.Color(targetPrimary), 0.05);
          material.color.copy(currentColor);
          material.emissive.copy(new THREE.Color(emotionConfig.emissive));

          if (isSpeaking) {
            material.emissiveIntensity = 0.5 + Math.sin(s.clock.elapsedTime * 4) * 0.3;
          } else {
            material.emissiveIntensity = 0.2;
          }
        }
      }
    });

    const clonedScene = scene.clone();
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          map: colorTexture,
          normalMap: normalTexture,
          normalScale: new THREE.Vector2(0.8, 0.8),
          roughness: 0.5,
          metalness: 0.1,
          clearcoat: 0.04,
          sheenColor: new THREE.Color(emotionConfig.primary),
          sheen: 0.25,
          emissive: new THREE.Color(emotionConfig.emissive),
          emissiveIntensity: 0.2,
          toneMapped: true,
        });
      }
    });

    return (
      <group ref={groupRef}>
        <primitive object={clonedScene} scale={1.2} />
      </group>
    );
  } catch {
    return null;
  }
}

function PanelAvatar({ avatar, isActive, isSpeaking }: { avatar: any; isActive: boolean; isSpeaking: boolean }) {
  const emotionConfig = EMOTION_COLORS.neutral;

  return (
    <group position={[0, 0, 0]} scale={isActive && isSpeaking ? 1.1 : 1}>
      <HeadModel emotion="neutral" isSpeaking={isActive && isSpeaking} />
      <AmbientParticles color={emotionConfig.primary} count={100} />
    </group>
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
}

export default function Avatar3D({
  emotion,
  isSpeaking,
  bpm,
  panelMode,
  panelAvatars,
  activeSpeakerIndex = 0,
  mouthOpenness = 0,
}: Avatar3DProps) {
  const emotionConfig = EMOTION_COLORS[emotion as keyof typeof EMOTION_COLORS] || EMOTION_COLORS.neutral;

  return (
    <div className="w-full h-full relative">
      <Suspense fallback={<div className="w-full h-full bg-black flex items-center justify-center text-cyan-400">Loading avatar...</div>}>
        <Canvas
          camera={{ position: [0, 0, 2.5], fov: 50 }}
          style={{ width: "100%", height: "100%" }}
          gl={{ antialias: true, alpha: true, toneMappingExposure: 1.2 }}
        >
          <color attach="background" args={["#000408"]} />

          {panelMode ? (
            <>
              <group position={[-1.5, 0, 0]} scale={0.6}>
                <PanelAvatar avatar={panelAvatars?.[0]} isActive={activeSpeakerIndex === 0} isSpeaking={isSpeaking} />
              </group>
              <group position={[0, 0, 0]} scale={0.6}>
                <PanelAvatar avatar={panelAvatars?.[1]} isActive={activeSpeakerIndex === 1} isSpeaking={isSpeaking} />
              </group>
              <group position={[1.5, 0, 0]} scale={0.6}>
                <PanelAvatar avatar={panelAvatars?.[2]} isActive={activeSpeakerIndex === 2} isSpeaking={isSpeaking} />
              </group>
            </>
          ) : (
            <group>
              <Float speed={0.5} rotationIntensity={0.3} floatIntensity={0.2}>
                <HeadModel emotion={emotion} isSpeaking={isSpeaking} mouthOpenness={mouthOpenness} />
              </Float>
              <AmbientParticles color={emotionConfig.primary} count={300} />
            </group>
          )}

          <ambientLight intensity={0.6} />
          <pointLight position={[2, 2, 2]} intensity={1} color={emotionConfig.primary} />
          <pointLight position={[-2, -1, 1]} intensity={0.5} color={emotionConfig.secondary} />

          {isSpeaking && <pointLight position={[0, 0, 3]} intensity={0.8} color={emotionConfig.primary} distance={10} decay={1.5} />}

          <Stars radius={50} depth={50} count={1000} factor={4} saturation={0} fade speed={0.5} />
        </Canvas>
      </Suspense>

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8">
        {/* Top: Emotion label */}
        {!panelMode && (
          <div
            className="text-xs font-mono uppercase tracking-widest px-3 py-1.5 rounded-full"
            style={{
              background: `rgb(${(emotionConfig.primary >> 16) & 255}, ${(emotionConfig.primary >> 8) & 255}, ${emotionConfig.primary & 255})20`,
              border: `1px solid rgb(${(emotionConfig.primary >> 16) & 255}, ${(emotionConfig.primary >> 8) & 255}, ${emotionConfig.primary & 255})`,
              color: emotionConfig.label,
              boxShadow: `0 0 10px ${emotionConfig.label}`,
            }}
          >
            {emotion.toUpperCase()}
          </div>
        )}

        {/* Bottom: BPM */}
        {!panelMode && (
          <div className="text-xs font-mono" style={{ color: emotionConfig.label }}>
            {bpm} BPM
          </div>
        )}
      </div>
    </div>
  );
}
