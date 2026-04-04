import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, useGLTF } from "@react-three/drei";
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

const HEAD_MODEL_URL = "/head.glb";

function AmbientParticles({ color, count = 400 }: { color: number; count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.5 + Math.random() * 3;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi) + (Math.random() - 0.5) * 2;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);

  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = s.clock.elapsedTime * 0.012;
      (ref.current.material as THREE.PointsMaterial).opacity =
        0.2 + Math.sin(s.clock.elapsedTime * 0.7) * 0.08;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.01}
        color={color}
        transparent
        opacity={0.2}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SubtleRings({ color }: { color: number }) {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (r1.current) r1.current.rotation.z = t * 0.1;
    if (r2.current) r2.current.rotation.z = -t * 0.07;
  });

  return (
    <group position={[0, -1.6, 0]}>
      <mesh ref={r1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.004, 4, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI / 2.05, 0.06, 0]}>
        <torusGeometry args={[1.12, 0.003, 4, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function RealHeadAvatar({ emotion, isSpeaking, bpm, index = 0, name, isActive = true, mouthOpenness = 0 }: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);
  const mouthGlowRef = useRef<THREE.Mesh>(null);
  const { scene } = useGLTF(HEAD_MODEL_URL);
  const colors = EMOTION_COLORS[emotion];
  const offset = index * (Math.PI * 2 / 3);
  const mouthVal = useRef(0);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xd4a574),
            roughness: 0.55,
            metalness: 0.02,
            emissive: new THREE.Color(colors.emissive),
            emissiveIntensity: 0.08,
          });

          if ((mesh.material as THREE.MeshStandardMaterial).map) {
            mat.map = (mesh.material as THREE.MeshStandardMaterial).map;
            mat.roughness = 0.5;
          }
          if ((mesh.material as THREE.MeshStandardMaterial).normalMap) {
            mat.normalMap = (mesh.material as THREE.MeshStandardMaterial).normalMap;
          }

          mesh.material = mat;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      }
    });
    return clone;
  }, [scene, colors.emissive]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!groupRef.current) return;

    groupRef.current.rotation.y = Math.sin(t * 0.22 + offset) * (isActive ? 0.12 : 0.04);
    groupRef.current.rotation.x = Math.sin(t * 0.15 + offset) * 0.025 - 0.05;

    const cs = groupRef.current.scale.x;
    const ts = isActive ? 1.0 : 0.85;
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(cs, ts, 0.04));

    const targetMouth = isSpeaking
      ? (mouthOpenness ?? (0.2 + Math.abs(Math.sin(t * 7)) * 0.8))
      : 0;
    mouthVal.current = THREE.MathUtils.lerp(mouthVal.current, targetMouth, 0.2);

    if (mouthGlowRef.current) {
      const mat = mouthGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = mouthVal.current * 0.4;
      mouthGlowRef.current.scale.y = 0.3 + mouthVal.current * 0.8;
    }

    const blink = Math.sin(t * 0.4 + offset);
    const blinkScale = blink > 0.94 ? Math.max(0.05, 1.0 - (blink - 0.94) * 16) : 1.0;
    if (eyeLeftRef.current) eyeLeftRef.current.scale.y = blinkScale;
    if (eyeRightRef.current) eyeRightRef.current.scale.y = blinkScale;
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={0.12} position={[0, -0.15, 0]} />

      <group position={[0, 0.75, 0.95]}>
        <group ref={eyeLeftRef} position={[-0.32, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.08, 20, 20]} />
            <meshStandardMaterial color={0xf5f5f0} roughness={0.08} metalness={0} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial
              color={0x3d5c4a}
              roughness={0.15}
              emissive={new THREE.Color(colors.primary)}
              emissiveIntensity={0.06}
            />
          </mesh>
          <mesh position={[0, 0, 0.075]}>
            <sphereGeometry args={[0.02, 12, 12]} />
            <meshStandardMaterial color={0x050505} roughness={0.05} />
          </mesh>
          <mesh position={[-0.01, 0.01, 0.08]}>
            <sphereGeometry args={[0.006, 6, 6]} />
            <meshBasicMaterial color={0xffffff} />
          </mesh>
        </group>

        <group ref={eyeRightRef} position={[0.32, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.08, 20, 20]} />
            <meshStandardMaterial color={0xf5f5f0} roughness={0.08} metalness={0} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial
              color={0x3d5c4a}
              roughness={0.15}
              emissive={new THREE.Color(colors.primary)}
              emissiveIntensity={0.06}
            />
          </mesh>
          <mesh position={[0, 0, 0.075]}>
            <sphereGeometry args={[0.02, 12, 12]} />
            <meshStandardMaterial color={0x050505} roughness={0.05} />
          </mesh>
          <mesh position={[0.01, 0.01, 0.08]}>
            <sphereGeometry args={[0.006, 6, 6]} />
            <meshBasicMaterial color={0xffffff} />
          </mesh>
        </group>
      </group>

      <mesh ref={mouthGlowRef} position={[0, 0.22, 1.05]}>
        <sphereGeometry args={[0.08, 16, 8]} />
        <meshBasicMaterial
          color={colors.primary}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <group position={[0, -0.9, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.15, 0.18, 0.3, 16]} />
          <meshStandardMaterial color={0xb88f65} roughness={0.6} metalness={0.02} />
        </mesh>
      </group>

      <group position={[0, -1.4, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.35, 0.55, 0.7, 20, 4, false]} />
          <meshStandardMaterial
            color={0x1a1a2e}
            roughness={0.65}
            metalness={0.12}
            emissive={new THREE.Color(colors.primary)}
            emissiveIntensity={0.02}
          />
        </mesh>
        <mesh position={[0, 0.32, 0.26]} scale={[0.5, 0.08, 0.18]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={0x222240} roughness={0.6} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.31, 0.28]} scale={[0.3, 0.05, 0.1]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={0x3a3a4a} roughness={0.7} />
        </mesh>
        <mesh position={[-0.42, 0.12, 0]} scale={[0.2, 0.22, 0.18]} rotation={[0, 0, 0.25]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={0x1a1a2e} roughness={0.65} metalness={0.12} />
        </mesh>
        <mesh position={[0.42, 0.12, 0]} scale={[0.2, 0.22, 0.18]} rotation={[0, 0, -0.25]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={0x1a1a2e} roughness={0.65} metalness={0.12} />
        </mesh>
      </group>

      {isActive && isSpeaking && (
        <mesh position={[0, 0, -0.3]}>
          <sphereGeometry args={[1.5, 20, 20]} />
          <meshBasicMaterial
            color={colors.primary}
            transparent
            opacity={0.02}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

function LoadingAvatar({ color }: { color: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = s.clock.elapsedTime * 0.5;
      (ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + Math.sin(s.clock.elapsedTime * 2) * 0.2;
    }
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.5, 1]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.4} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

interface Avatar3DProps {
  emotion: "neutral" | "empathetic" | "stern" | "curious" | "stressed";
  isSpeaking: boolean;
  bpm: number;
  panelMode?: boolean;
  panelAvatars?: { name: string; emotion: AvatarProps["emotion"] }[];
  activeSpeakerIndex?: number;
  mouthOpenness?: number;
  spokenText?: string;
}

export default function Avatar3D({
  emotion,
  isSpeaking,
  bpm,
  panelMode = false,
  panelAvatars,
  activeSpeakerIndex = 0,
  mouthOpenness = 0,
}: Avatar3DProps) {
  const speakingStates = useMemo(() => {
    if (!panelMode || !panelAvatars) return [isSpeaking];
    return panelAvatars.map((_, i) => i === activeSpeakerIndex && isSpeaking);
  }, [panelMode, panelAvatars, activeSpeakerIndex, isSpeaking]);

  return (
    <div className="w-full h-full relative" style={{ background: "radial-gradient(ellipse at center, #0a1628 0%, #000408 70%)" }}>
      <Canvas
        camera={{ position: [0, 0.2, 3.2], fov: 35 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        <color attach="background" args={["#000408"]} />
        <fog attach="fog" args={["#000408", 5, 12]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 3, 4]} intensity={1.5} color={0xfff0e0} castShadow />
        <directionalLight position={[-3, 1, -2]} intensity={0.3} color={EMOTION_COLORS[emotion].primary} />
        <pointLight position={[0, 2, 3]} intensity={0.7} color={0xfff5e6} />
        <pointLight position={[0, -1, 2]} intensity={0.2} color={EMOTION_COLORS[emotion].primary} />
        <pointLight position={[-2, 0.5, 1]} intensity={0.15} color={0x88aaff} />

        <Stars radius={8} depth={25} count={600} factor={1.5} saturation={0.1} fade speed={0.3} />
        <AmbientParticles color={EMOTION_COLORS[emotion].primary} count={400} />
        <SubtleRings color={EMOTION_COLORS[emotion].primary} />

        <Suspense fallback={<LoadingAvatar color={EMOTION_COLORS[emotion].primary} />}>
          {panelMode && panelAvatars ? (
            <group>
              {panelAvatars.map((member, i) => {
                const count = panelAvatars.length;
                const spacing = Math.min(3.0, 6 / count);
                const x = (i - (count - 1) / 2) * spacing;
                const isActive = i === activeSpeakerIndex;
                return (
                  <group key={i} position={[x, 0.2, 0]} scale={count > 2 ? 0.52 : 0.65}>
                    <Float speed={1.0} rotationIntensity={0.03} floatIntensity={0.06}>
                      <RealHeadAvatar
                        emotion={member.emotion}
                        isSpeaking={speakingStates[i]}
                        bpm={bpm}
                        name={member.name}
                        index={i}
                        isActive={isActive}
                        mouthOpenness={speakingStates[i] ? mouthOpenness : 0}
                      />
                    </Float>
                  </group>
                );
              })}
            </group>
          ) : (
            <Float speed={1.2} rotationIntensity={0.03} floatIntensity={0.08}>
              <RealHeadAvatar
                emotion={emotion}
                isSpeaking={isSpeaking}
                bpm={bpm}
                isActive
                mouthOpenness={mouthOpenness}
              />
            </Float>
          )}
        </Suspense>
      </Canvas>

      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,212,255,0.005) 3px,rgba(0,212,255,0.005) 4px)`,
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

useGLTF.preload(HEAD_MODEL_URL);
