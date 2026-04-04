import { useRef, useMemo, Suspense, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

const EMOTION_COLORS: Record<string, { primary: string; glow: string }> = {
  neutral:    { primary: "#00d4ff", glow: "#003366" },
  empathetic: { primary: "#00ff88", glow: "#003322" },
  stern:      { primary: "#ff3333", glow: "#330000" },
  curious:    { primary: "#ffaa00", glow: "#332200" },
  stressed:   { primary: "#ff00ff", glow: "#330033" },
};

const PANEL_TINTS = [
  { skin: "#e8c4a0", sheen: "#ffaa00", label: "Chairman" },
  { skin: "#d4a574", sheen: "#ff4444", label: "Member 1" },
  { skin: "#c49070", sheen: "#00d4ff", label: "Member 2" },
];

useGLTF.preload("/head.glb");

function HolographicRing({ color, radius, speed }: { color: string; radius: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = Math.PI / 2;
      ref.current.rotation.z = state.clock.elapsedTime * speed;
      if (ref.current.material instanceof THREE.MeshBasicMaterial) {
        ref.current.material.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      }
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
      if (ref.current.material instanceof THREE.MeshBasicMaterial) {
        ref.current.material.opacity = 0.08 + Math.sin(state.clock.elapsedTime * 3) * 0.04;
      }
    }
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[3, 0.02]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function LipSyncJaw({ amplitude, color }: { amplitude: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const smoothAmp = useRef(0);

  useFrame(() => {
    smoothAmp.current += (amplitude - smoothAmp.current) * 0.3;
    if (ref.current) {
      const open = smoothAmp.current * 0.12;
      ref.current.position.y = -0.55 - open;
      ref.current.scale.y = 0.03 + smoothAmp.current * 0.06;
      ref.current.scale.x = 0.15 + smoothAmp.current * 0.05;
    }
  });

  return (
    <mesh ref={ref} position={[0, -0.55, 0.65]}>
      <sphereGeometry args={[0.12, 16, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.5 + amplitude * 0.4} />
    </mesh>
  );
}

function HeadScene({
  emotion,
  isSpeaking,
  getAmplitude,
  tintColor,
  sheenColor,
}: {
  emotion: string;
  isSpeaking: boolean;
  getAmplitude?: () => number;
  tintColor?: string;
  sheenColor?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const jawRef = useRef<THREE.Mesh>(null);
  const smoothAmp = useRef(0);
  const { scene } = useGLTF("/head.glb");
  const colorTex = useTexture("/head-color.jpg");
  const normalTex = useTexture("/head-normal.jpg");
  const emotionConfig = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;

  colorTex.colorSpace = THREE.SRGBColorSpace;

  const finalSheen = sheenColor || emotionConfig.primary;
  const finalGlow = emotionConfig.glow;

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
          sheenColor: new THREE.Color(finalSheen),
          emissive: new THREE.Color(finalGlow),
          emissiveIntensity: 0.3,
          envMapIntensity: 1.0,
        });
        if (tintColor) {
          (child.material as THREE.MeshPhysicalMaterial).color = new THREE.Color(tintColor);
        }
      }
    });
    return clone;
  }, [scene, colorTex, normalTex, finalSheen, finalGlow, tintColor]);

  useFrame((state) => {
    const amp = getAmplitude ? getAmplitude() : 0;
    smoothAmp.current += (amp - smoothAmp.current) * 0.25;

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;

      if (isSpeaking && smoothAmp.current > 0.05) {
        groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.01 * smoothAmp.current;
      }
    }

    if (glowRef.current) {
      if (isSpeaking) {
        glowRef.current.intensity = 1.5 + smoothAmp.current * 3;
      } else {
        glowRef.current.intensity = 0.8 + Math.sin(state.clock.elapsedTime * 1.5) * 0.3;
      }
    }

    if (jawRef.current) {
      const open = isSpeaking ? smoothAmp.current * 0.15 : 0;
      jawRef.current.position.y = -0.55 - open;
      jawRef.current.scale.set(
        0.13 + smoothAmp.current * 0.04,
        0.02 + smoothAmp.current * 0.06,
        0.08
      );
      if (jawRef.current.material instanceof THREE.MeshBasicMaterial) {
        jawRef.current.material.opacity = isSpeaking ? 0.3 + smoothAmp.current * 0.5 : 0;
      }
    }

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
        const mat = child.material;
        mat.sheenColor.lerp(new THREE.Color(finalSheen), 0.05);
        mat.emissive.lerp(new THREE.Color(finalGlow), 0.05);
        if (isSpeaking) {
          mat.emissiveIntensity = 0.3 + smoothAmp.current * 0.6;
        } else {
          mat.emissiveIntensity = 0.2 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={1.3} position={[0, -0.2, 0]} />
      <mesh ref={jawRef} position={[0, -0.55, 0.65]}>
        <sphereGeometry args={[0.12, 16, 8]} />
        <meshBasicMaterial color={finalSheen} transparent opacity={0} />
      </mesh>
      <pointLight ref={glowRef} position={[0, 0, 1.5]} color={finalSheen} intensity={1} distance={8} decay={1.5} />
    </group>
  );
}

function SingleScene({ emotion, isSpeaking, getAmplitude }: { emotion: string; isSpeaking: boolean; getAmplitude?: () => number }) {
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
        <HeadScene emotion={emotion} isSpeaking={isSpeaking} getAmplitude={getAmplitude} />
      </Float>

      <HolographicRing color={emotionConfig.primary} radius={1.4} speed={0.3} />
      <HolographicRing color={emotionConfig.primary} radius={1.7} speed={-0.2} />
      <ScanLine color={emotionConfig.primary} />
      <FloatingParticles color={emotionConfig.primary} count={200} />
      <Stars radius={40} depth={50} count={600} factor={3} saturation={0} fade speed={0.3} />
    </>
  );
}

function PanelHeadGroup({
  index,
  isActive,
  isSpeaking,
  getAmplitude,
  tintColor,
  sheenColor,
  xPos,
}: {
  index: number;
  isActive: boolean;
  isSpeaking: boolean;
  getAmplitude?: () => number;
  tintColor: string;
  sheenColor: string;
  xPos: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetScale = isActive && isSpeaking ? 0.65 : 0.5;
  const currentScale = useRef(0.5);

  useFrame(() => {
    currentScale.current += (targetScale - currentScale.current) * 0.08;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(currentScale.current);
    }
  });

  return (
    <group ref={groupRef} position={[xPos, 0, 0]}>
      <Float speed={0.4} rotationIntensity={0.08} floatIntensity={0.12}>
        <HeadScene
          emotion={isActive ? "stern" : "neutral"}
          isSpeaking={isActive && isSpeaking}
          getAmplitude={isActive ? getAmplitude : undefined}
          tintColor={tintColor}
          sheenColor={sheenColor}
        />
      </Float>
      <HolographicRing color={sheenColor} radius={1.3} speed={0.15 * (index + 1)} />
      <pointLight position={[0, 0, 2]} color={sheenColor} intensity={isActive && isSpeaking ? 2 : 0.3} distance={5} />
    </group>
  );
}

function PanelScene({ isSpeaking, activeSpeakerIndex, getAmplitude }: { isSpeaking: boolean; activeSpeakerIndex: number; getAmplitude?: () => number }) {
  return (
    <>
      <color attach="background" args={["#000408"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 3, 3]} intensity={0.6} />

      <PanelHeadGroup index={0} isActive={activeSpeakerIndex === 0} isSpeaking={isSpeaking} getAmplitude={getAmplitude}
        tintColor={PANEL_TINTS[0].skin} sheenColor={PANEL_TINTS[0].sheen} xPos={-2.2} />
      <PanelHeadGroup index={1} isActive={activeSpeakerIndex === 1} isSpeaking={isSpeaking} getAmplitude={getAmplitude}
        tintColor={PANEL_TINTS[1].skin} sheenColor={PANEL_TINTS[1].sheen} xPos={0} />
      <PanelHeadGroup index={2} isActive={activeSpeakerIndex === 2} isSpeaking={isSpeaking} getAmplitude={getAmplitude}
        tintColor={PANEL_TINTS[2].skin} sheenColor={PANEL_TINTS[2].sheen} xPos={2.2} />

      <FloatingParticles color="#00d4ff" count={120} />
      <Stars radius={40} depth={50} count={400} factor={3} saturation={0} fade speed={0.3} />
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="w-full h-full bg-[#000408] flex flex-col items-center justify-center gap-4">
      <div className="relative w-16 h-16">
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
  const emotionConfig = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="relative"
        style={{
          width: panelMode ? "100%" : "min(400px, 100%)",
          height: panelMode ? "100%" : "min(400px, 100%)",
          maxWidth: panelMode ? "100%" : "400px",
          maxHeight: panelMode ? "100%" : "400px",
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            camera={{ position: [0, 0, panelMode ? 4.5 : 3], fov: 45 }}
            style={{ width: "100%", height: "100%" }}
            gl={{ antialias: true, alpha: true, toneMappingExposure: 1.2, toneMapping: THREE.ACESFilmicToneMapping }}
            dpr={[1, 2]}
          >
            {panelMode ? (
              <PanelScene isSpeaking={isSpeaking} activeSpeakerIndex={activeSpeakerIndex} getAmplitude={getAmplitude} />
            ) : (
              <SingleScene emotion={emotion} isSpeaking={isSpeaking} getAmplitude={getAmplitude} />
            )}
          </Canvas>
        </Suspense>

        {!panelMode && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
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

        {panelMode && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-around pointer-events-none px-4">
            {PANEL_TINTS.map((t, i) => (
              <div
                key={i}
                className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded-full"
                style={{
                  color: t.sheen,
                  border: `1px solid ${t.sheen}${activeSpeakerIndex === i ? "90" : "30"}`,
                  background: activeSpeakerIndex === i ? `${t.sheen}20` : "transparent",
                  boxShadow: activeSpeakerIndex === i ? `0 0 10px ${t.sheen}40` : "none",
                }}
              >
                {t.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
