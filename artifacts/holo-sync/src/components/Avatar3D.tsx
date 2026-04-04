import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import avatarImage from "@assets/studio-shot-photo-professional-headshot-260nw-2752558817_1775288452602.webp";

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

const EMOTION_COLORS: Record<string, string> = {
  neutral: "#00d4ff",
  empathetic: "#00ff88",
  stern: "#ff3333",
  curious: "#ffaa00",
  stressed: "#ff00ff",
};

function HeadModel({ emotion, isSpeaking }: { emotion: string; isSpeaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);
  const emotionColor = EMOTION_COLORS[emotion] || "#00d4ff";

  const texture = useMemo(() => {
    const tex = textureLoader.load(avatarImage);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [textureLoader]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.08;

      if (meshRef.current.material instanceof THREE.MeshPhysicalMaterial) {
        const material = meshRef.current.material;
        if (isSpeaking) {
          material.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
        } else {
          material.emissiveIntensity = 0.1;
        }
      }
    }
  });

  return (
    <mesh ref={meshRef} scale={[1.8, 2.2, 0.15]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        map={texture}
        emissive={new THREE.Color(emotionColor)}
        emissiveIntensity={0.1}
        roughness={0.4}
        metalness={0.2}
        clearcoat={0.05}
        toneMapped
      />
    </mesh>
  );
}

function PanelAvatarMesh({ isActive, isSpeaking }: { isActive: boolean; isSpeaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

  const texture = useMemo(() => {
    const tex = textureLoader.load(avatarImage);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [textureLoader]);

  useFrame((state) => {
    if (meshRef.current) {
      if (isActive && isSpeaking) {
        meshRef.current.scale.set(1.1, 1.1, 1.1);
      } else {
        meshRef.current.scale.set(1, 1, 1);
      }
    }
  });

  return (
    <mesh ref={meshRef} scale={[0.8, 1, 0.08]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        map={texture}
        emissive={new THREE.Color("#00d4ff")}
        emissiveIntensity={isActive && isSpeaking ? 0.5 : 0.1}
        roughness={0.4}
        metalness={0.2}
      />
    </mesh>
  );
}

export default function Avatar3D({
  emotion,
  isSpeaking,
  bpm,
  panelMode,
  panelAvatars,
  activeSpeakerIndex = 0,
}: Avatar3DProps) {
  const emotionColor = EMOTION_COLORS[emotion] || "#00d4ff";
  const emotionColorNum = parseInt(emotionColor.slice(1), 16);

  return (
    <div className="w-full h-full relative">
      <Suspense fallback={<div className="w-full h-full bg-black" />}>
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          style={{ width: "100%", height: "100%" }}
          gl={{ antialias: true, alpha: true, toneMappingExposure: 1.0 }}
        >
          <color attach="background" args={["#000408"]} />

          {panelMode ? (
            <>
              <group position={[-1.5, 0, 0]}>
                <PanelAvatarMesh isActive={activeSpeakerIndex === 0} isSpeaking={isSpeaking} />
              </group>
              <group position={[0, 0, 0]}>
                <PanelAvatarMesh isActive={activeSpeakerIndex === 1} isSpeaking={isSpeaking} />
              </group>
              <group position={[1.5, 0, 0]}>
                <PanelAvatarMesh isActive={activeSpeakerIndex === 2} isSpeaking={isSpeaking} />
              </group>
            </>
          ) : (
            <HeadModel emotion={emotion} isSpeaking={isSpeaking} />
          )}

          <ambientLight intensity={0.7} />
          <pointLight position={[2, 2, 2]} intensity={1.2} color={emotionColorNum} />
          <pointLight position={[-2, -1, 1]} intensity={0.6} color={emotionColorNum} />
          {isSpeaking && <pointLight position={[0, 0, 4]} intensity={0.9} color={emotionColorNum} distance={12} />}
        </Canvas>
      </Suspense>

      {/* Overlay UI */}
      {!panelMode && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8">
          <div
            className="text-xs font-mono uppercase tracking-widest px-3 py-1.5 rounded-full"
            style={{
              background: `${emotionColor}20`,
              border: `1px solid ${emotionColor}`,
              color: emotionColor,
              boxShadow: `0 0 10px ${emotionColor}`,
            }}
          >
            {emotion.toUpperCase()}
          </div>
          <div className="text-xs font-mono" style={{ color: emotionColor }}>
            {bpm} BPM
          </div>
        </div>
      )}
    </div>
  );
}
