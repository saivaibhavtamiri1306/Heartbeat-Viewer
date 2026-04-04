import { useRef, useMemo, Suspense, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Stars, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

const EMOTION_COLORS: Record<string, { primary: string; glow: string }> = {
  neutral:    { primary: "#00d4ff", glow: "#003366" },
  empathetic: { primary: "#00ff88", glow: "#003322" },
  stern:      { primary: "#ff3333", glow: "#330000" },
  curious:    { primary: "#ffaa00", glow: "#332200" },
  stressed:   { primary: "#ff00ff", glow: "#330033" },
};

useGLTF.preload("/head.glb");

function HolographicRing({ color, radius, speed }: { color: string; radius: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = Math.PI / 2;
      ref.current.rotation.z = state.clock.elapsedTime * speed;
      ref.current.material instanceof THREE.MeshBasicMaterial &&
        (ref.current.material.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.1);
    }
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.008, 16, 100]} />
      <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FloatingParticles({ color, count = 200 }: { color: string; count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.5 + Math.random() * 2.5;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} sizeAttenuation transparent color={color} opacity={0.5} />
    </points>
  );
}

function ScanLine({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 1.2;
      ref.current.material instanceof THREE.MeshBasicMaterial &&
        (ref.current.material.opacity = 0.08 + Math.sin(state.clock.elapsedTime * 3) * 0.04);
    }
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[3, 0.02]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function HeadScene({ emotion, isSpeaking }: { emotion: string; isSpeaking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const { scene } = useGLTF("/head.glb");
  const colorTex = useTexture("/head-color.jpg");
  const normalTex = useTexture("/head-normal.jpg");
  const emotionConfig = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;

  colorTex.colorSpace = THREE.SRGBColorSpace;

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          map: colorTex,
          normalMap: normalTex,
          normalScale: new THREE.Vector2(1.0, 1.0),
          roughness: 0.45,
          metalness: 0.15,
          clearcoat: 0.08,
          clearcoatRoughness: 0.3,
          sheen: 0.3,
          sheenColor: new THREE.Color(emotionConfig.primary),
          emissive: new THREE.Color(emotionConfig.glow),
          emissiveIntensity: 0.3,
          envMapIntensity: 1.0,
        });
      }
    });
    return clone;
  }, [scene, colorTex, normalTex, emotionConfig.primary, emotionConfig.glow]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }

    if (glowRef.current) {
      if (isSpeaking) {
        glowRef.current.intensity = 2 + Math.sin(state.clock.elapsedTime * 5) * 1.5;
      } else {
        glowRef.current.intensity = 0.8 + Math.sin(state.clock.elapsedTime * 1.5) * 0.3;
      }
    }

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
        const mat = child.material;
        const targetColor = new THREE.Color(emotionConfig.primary);
        mat.sheenColor.lerp(targetColor, 0.05);
        mat.emissive.lerp(new THREE.Color(emotionConfig.glow), 0.05);
        if (isSpeaking) {
          mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
        } else {
          mat.emissiveIntensity = 0.2 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={1.3} position={[0, -0.2, 0]} />
      <pointLight ref={glowRef} position={[0, 0, 1.5]} color={emotionConfig.primary} intensity={1} distance={8} decay={1.5} />
    </group>
  );
}

function HolographicScene({ emotion, isSpeaking }: { emotion: string; isSpeaking: boolean }) {
  const emotionConfig = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;

  return (
    <>
      <color attach="background" args={["#000408"]} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 3, 3]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-3, 2, 2]} intensity={0.6} color={emotionConfig.primary} />
      <pointLight position={[3, -1, 1]} intensity={0.4} color={emotionConfig.primary} />
      <pointLight position={[0, -2, 2]} intensity={0.3} color="#4400ff" />

      <Float speed={0.6} rotationIntensity={0.15} floatIntensity={0.25}>
        <HeadScene emotion={emotion} isSpeaking={isSpeaking} />
      </Float>

      <HolographicRing color={emotionConfig.primary} radius={1.6} speed={0.3} />
      <HolographicRing color={emotionConfig.primary} radius={1.9} speed={-0.2} />
      <HolographicRing color={emotionConfig.primary} radius={2.2} speed={0.15} />

      <ScanLine color={emotionConfig.primary} />

      <FloatingParticles color={emotionConfig.primary} count={250} />

      <Stars radius={40} depth={50} count={800} factor={3} saturation={0} fade speed={0.3} />
    </>
  );
}

function PanelScene({ isSpeaking, activeSpeakerIndex }: { isSpeaking: boolean; activeSpeakerIndex: number }) {
  const { scene } = useGLTF("/head.glb");
  const colorTex = useTexture("/head-color.jpg");
  const normalTex = useTexture("/head-normal.jpg");
  colorTex.colorSpace = THREE.SRGBColorSpace;

  const heads = useMemo(() => {
    const colors = ["#00d4ff", "#ff3333", "#ffaa00"];
    return colors.map((color) => {
      const clone = scene.clone(true);
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            map: colorTex,
            normalMap: normalTex,
            normalScale: new THREE.Vector2(1, 1),
            roughness: 0.45,
            metalness: 0.15,
            sheen: 0.3,
            sheenColor: new THREE.Color(color),
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.2,
          });
        }
      });
      return { clone, color };
    });
  }, [scene, colorTex, normalTex]);

  return (
    <>
      <color attach="background" args={["#000408"]} />
      <ambientLight intensity={0.5} />
      {heads.map((h, i) => (
        <group key={i} position={[(i - 1) * 2, 0, 0]} scale={activeSpeakerIndex === i && isSpeaking ? 0.75 : 0.6}>
          <Float speed={0.4} rotationIntensity={0.1} floatIntensity={0.15}>
            <primitive object={h.clone} scale={1} />
          </Float>
          <pointLight position={[0, 0, 1.5]} color={h.color} intensity={activeSpeakerIndex === i ? 1.5 : 0.3} distance={5} />
          <HolographicRing color={h.color} radius={1.2} speed={0.2 * (i + 1)} />
        </group>
      ))}
      <FloatingParticles color="#00d4ff" count={150} />
      <Stars radius={40} depth={50} count={500} factor={3} saturation={0} fade speed={0.3} />
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="w-full h-full bg-[#000408] flex flex-col items-center justify-center gap-4">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping" />
        <div className="absolute inset-2 border-2 border-cyan-400/50 rounded-full animate-spin" />
        <div className="absolute inset-4 border-2 border-cyan-300/70 rounded-full animate-pulse" />
      </div>
      <p className="text-cyan-400 text-xs font-mono tracking-widest animate-pulse">
        INITIALIZING HOLOGRAM...
      </p>
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
}

export default function Avatar3D({
  emotion,
  isSpeaking,
  bpm,
  panelMode,
  activeSpeakerIndex = 0,
}: Avatar3DProps) {
  const emotionConfig = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;

  return (
    <div className="w-full h-full relative">
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0, 3], fov: 45 }}
          style={{ width: "100%", height: "100%" }}
          gl={{ antialias: true, alpha: true, toneMappingExposure: 1.2, toneMapping: THREE.ACESFilmicToneMapping }}
          dpr={[1, 2]}
        >
          {panelMode ? (
            <PanelScene isSpeaking={isSpeaking} activeSpeakerIndex={activeSpeakerIndex} />
          ) : (
            <HolographicScene emotion={emotion} isSpeaking={isSpeaking} />
          )}
        </Canvas>
      </Suspense>

      {!panelMode && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
          <div
            className="text-[10px] font-mono uppercase tracking-[0.3em] px-4 py-1.5 rounded-full backdrop-blur-sm"
            style={{
              background: `${emotionConfig.primary}15`,
              border: `1px solid ${emotionConfig.primary}60`,
              color: emotionConfig.primary,
              boxShadow: `0 0 20px ${emotionConfig.primary}30, inset 0 0 10px ${emotionConfig.primary}10`,
            }}
          >
            {emotion.toUpperCase()}
          </div>

          <div
            className="text-xs font-mono tracking-widest flex items-center gap-2"
            style={{ color: emotionConfig.primary }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: emotionConfig.primary }} />
            {bpm} BPM
          </div>
        </div>
      )}
    </div>
  );
}
