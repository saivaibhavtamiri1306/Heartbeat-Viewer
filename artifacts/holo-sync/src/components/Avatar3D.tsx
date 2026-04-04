import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
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

function createHumanHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    const nx = v.x, ny = v.y, nz = v.z;

    v.x *= 0.82;
    v.z *= 0.9;

    if (ny > 0.3) {
      v.y *= 1.08;
      v.x *= 1.0 + (ny - 0.3) * 0.15;
    }

    if (ny < -0.2) {
      const chinFactor = Math.max(0, (-ny - 0.2) * 1.5);
      v.x *= 1.0 - chinFactor * 0.4;
      v.z *= 1.0 - chinFactor * 0.2;
      v.y *= 1.0 + chinFactor * 0.1;
    }

    if (nz > 0.3 && Math.abs(ny - 0.15) < 0.35) {
      const cheekFactor = Math.abs(nx) * 0.8;
      v.z += 0.08 * (1.0 - cheekFactor);
    }

    if (nz > 0.5 && Math.abs(nx) < 0.3 && ny > -0.1 && ny < 0.4) {
      const noseDist = 1.0 - Math.abs(nx) / 0.3;
      const noseY = 1.0 - Math.abs(ny - 0.1) / 0.3;
      v.z += 0.15 * noseDist * noseY;
    }

    const eyeY = 0.25;
    const eyeSpacing = 0.35;
    for (const side of [-1, 1]) {
      const eyeX = side * eyeSpacing;
      const dx = nx - eyeX;
      const dy = ny - eyeY;
      const eyeDist = Math.sqrt(dx * dx + dy * dy);
      if (eyeDist < 0.2 && nz > 0.4) {
        v.z -= 0.06 * (1.0 - eyeDist / 0.2);
      }
    }

    if (ny > 0.35 && nz > 0.3) {
      v.z += 0.05 * (ny - 0.35);
    }

    const earY = 0.1;
    if (Math.abs(nx) > 0.7 && Math.abs(ny - earY) < 0.25 && nz < 0.3) {
      const earFactor = (Math.abs(nx) - 0.7) * 3.0;
      v.x += Math.sign(nx) * earFactor * 0.08;
      v.z -= earFactor * 0.03;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createBustGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.35, 0.9, 1.2, 24, 8, true);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    const t = (v.y + 0.6) / 1.2;
    v.x *= 0.7 + t * 0.5;
    v.z *= 0.5 + t * 0.3;

    if (t < 0.3) {
      const shoulderT = t / 0.3;
      v.x *= 1.0 + (1.0 - shoulderT) * 0.6;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

function HologramParticles({ color, count = 2000 }: { color: number; count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, opacities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const opacities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.85 + Math.random() * 0.5;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 0.82;
      positions[i * 3 + 1] = r * Math.cos(phi) * 1.1 + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.9;
      opacities[i] = Math.random();
    }
    return { positions, opacities };
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    pointsRef.current.rotation.y = t * 0.05;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.4 + Math.sin(t * 1.5) * 0.15;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.012}
        color={color}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function ScanLine({ color }: { color: number }) {
  const lineRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!lineRef.current) return;
    const t = state.clock.elapsedTime;
    lineRef.current.position.y = Math.sin(t * 0.6) * 1.5;
    const mat = lineRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.15 + Math.abs(Math.sin(t * 0.6)) * 0.1;
  });

  return (
    <mesh ref={lineRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0, 1.5, 64, 1]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function HologramRings({ color, isSpeaking }: { color: number; isSpeaking: boolean }) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speakMul = isSpeaking ? 1.3 : 1.0;

    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.3;
      ring1Ref.current.scale.setScalar(1.0 + Math.sin(t * 2) * 0.05 * speakMul);
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.2;
      ring2Ref.current.scale.setScalar(1.0 + Math.sin(t * 2.5 + 1) * 0.04 * speakMul);
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = t * 0.15;
      ring3Ref.current.scale.setScalar(1.0 + Math.sin(t * 3 + 2) * 0.03 * speakMul);
    }
  });

  return (
    <group position={[0, -0.5, 0]}>
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.2, 0.008, 4, 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[1.35, 0.006, 4, 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring3Ref} rotation={[Math.PI / 1.9, -0.15, 0]}>
        <torusGeometry args={[1.5, 0.005, 4, 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function BaseGlow({ color }: { color: number }) {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!glowRef.current) return;
    const t = state.clock.elapsedTime;
    const mat = glowRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.08 + Math.sin(t * 1.5) * 0.03;
  });

  return (
    <group position={[0, -2.0, 0]}>
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.8, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.9, 1.0, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function VerticalBeams({ color }: { color: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const beamCount = 24;

  const positions = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < beamCount; i++) {
      const angle = (i / beamCount) * Math.PI * 2;
      const r = 0.95 + Math.random() * 0.3;
      arr.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.03;
  });

  return (
    <group ref={groupRef}>
      {positions.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.5, z]}>
          <cylinderGeometry args={[0.002, 0.002, 3.5, 4]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.06 + (i % 3) * 0.02}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function HumanHead({ emotion, isSpeaking, bpm, index = 0, name, isActive = true, mouthOpenness = 0 }: AvatarProps) {
  const headGroupRef = useRef<THREE.Group>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const solidRef = useRef<THREE.Mesh>(null);
  const bustWireRef = useRef<THREE.LineSegments>(null);
  const bustSolidRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  const colors = EMOTION_COLORS[emotion];
  const offset = index * (Math.PI * 2 / 3);
  const primaryColor = new THREE.Color(colors.primary);
  const secondaryColor = new THREE.Color(colors.secondary);

  const headGeo = useMemo(() => createHumanHeadGeometry(), []);
  const headEdges = useMemo(() => new THREE.EdgesGeometry(headGeo, 15), [headGeo]);

  const bustGeo = useMemo(() => createBustGeometry(), []);
  const bustEdges = useMemo(() => new THREE.EdgesGeometry(bustGeo, 12), [bustGeo]);

  const mouthOpen = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.3 + offset) * (isActive ? 0.2 : 0.08);
      headGroupRef.current.rotation.x = Math.sin(t * 0.2 + offset) * 0.06;
      const curScale = headGroupRef.current.scale.x;
      const tgtScale = isActive ? 1.0 : 0.88;
      headGroupRef.current.scale.setScalar(THREE.MathUtils.lerp(curScale, tgtScale, 0.04));
    }

    if (wireframeRef.current) {
      const mat = wireframeRef.current.material as THREE.LineBasicMaterial;
      const pulse = Math.sin(t * 2 + offset) * 0.15;
      mat.opacity = (isActive ? 0.7 : 0.4) + pulse;
    }

    if (solidRef.current) {
      const mat = solidRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (isActive ? 0.06 : 0.03) + Math.sin(t * 1.5) * 0.02;
    }

    if (bustWireRef.current) {
      const mat = bustWireRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = (isActive ? 0.35 : 0.2) + Math.sin(t * 1.8) * 0.1;
    }

    if (bustSolidRef.current) {
      const mat = bustSolidRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (isActive ? 0.03 : 0.015);
    }

    const targetMouth = isSpeaking ? (mouthOpenness ?? (0.3 + Math.abs(Math.sin(t * 12)) * 0.7)) : 0;
    mouthOpen.current = THREE.MathUtils.lerp(mouthOpen.current, targetMouth, 0.25);

    if (mouthRef.current) {
      const open = mouthOpen.current;
      mouthRef.current.scale.y = 0.02 + open * 0.08;
      const mat = mouthRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + open * 0.5;
    }
  });

  return (
    <group>
      <HologramRings color={colors.primary} isSpeaking={isSpeaking} />
      <BaseGlow color={colors.primary} />
      <VerticalBeams color={colors.primary} />
      <ScanLine color={colors.primary} />
      <HologramParticles color={colors.primary} count={1500} />

      <group ref={headGroupRef}>
        <lineSegments ref={wireframeRef} geometry={headEdges}>
          <lineBasicMaterial
            color={primaryColor}
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>

        <mesh ref={solidRef} geometry={headGeo}>
          <meshBasicMaterial
            color={primaryColor}
            transparent
            opacity={0.06}
            side={THREE.FrontSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        <group position={[0, 0.25, 0.72]}>
          <mesh position={[-0.28, 0, 0.1]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial
              color={primaryColor}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0.28, 0, 0.1]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial
              color={primaryColor}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[-0.28, 0, 0.12]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshBasicMaterial
              color={0xffffff}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0.28, 0, 0.12]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshBasicMaterial
              color={0xffffff}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        <mesh ref={mouthRef} position={[0, -0.22, 0.85]}>
          <boxGeometry args={[0.2, 0.02, 0.04]} />
          <meshBasicMaterial
            color={primaryColor}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <group position={[0, -1.1, 0]}>
          <lineSegments ref={bustWireRef} geometry={bustEdges}>
            <lineBasicMaterial
              color={secondaryColor}
              transparent
              opacity={0.35}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineSegments>
          <mesh ref={bustSolidRef} geometry={bustGeo}>
            <meshBasicMaterial
              color={secondaryColor}
              transparent
              opacity={0.03}
              side={THREE.FrontSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>

        {isActive && isSpeaking && (
          <mesh position={[0, 0, -0.3]}>
            <sphereGeometry args={[1.3, 24, 24]} />
            <meshBasicMaterial
              color={primaryColor}
              transparent
              opacity={0.04}
              side={THREE.BackSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )}
      </group>

      {name && (
        <group position={[0, -2.1, 0]}>
          <mesh>
            <planeGeometry args={[1.6, 0.22]} />
            <meshBasicMaterial color={0x000000} transparent opacity={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}

interface Avatar3DProps {
  emotion: "neutral" | "empathetic" | "stern" | "curious" | "stressed";
  isSpeaking: boolean;
  bpm: number;
  panelMode?: boolean;
  panelMembers?: { name: string; emotion: AvatarProps["emotion"]; isActive: boolean }[];
  activeIndex?: number;
  mouthOpenness?: number;
}

export default function Avatar3D({
  emotion,
  isSpeaking,
  bpm,
  panelMode = false,
  panelMembers,
  activeIndex = 0,
  mouthOpenness = 0,
}: Avatar3DProps) {
  const speakingStates = useMemo(() => {
    if (!panelMode || !panelMembers) return [isSpeaking];
    return panelMembers.map((_, i) => i === activeIndex && isSpeaking);
  }, [panelMode, panelMembers, activeIndex, isSpeaking]);

  return (
    <div className="w-full h-full relative" style={{ background: "radial-gradient(ellipse at center, #030a18 0%, #000408 70%)" }}>
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
      >
        <color attach="background" args={["#000408"]} />
        <fog attach="fog" args={["#000408", 6, 14]} />

        <ambientLight intensity={0.08} />
        <pointLight position={[0, 3, 3]} intensity={0.3} color={EMOTION_COLORS[emotion].primary} />

        <Stars radius={8} depth={30} count={1500} factor={2} saturation={0.1} fade speed={0.5} />

        {panelMode && panelMembers ? (
          <group>
            {panelMembers.map((member, i) => {
              const count = panelMembers.length;
              const spacing = Math.min(3.5, 7 / count);
              const x = (i - (count - 1) / 2) * spacing;
              return (
                <group key={i} position={[x, 0.3, 0]} scale={count > 2 ? 0.55 : 0.7}>
                  <Float speed={1.5} rotationIntensity={0.08} floatIntensity={0.15}>
                    <HumanHead
                      emotion={member.emotion}
                      isSpeaking={speakingStates[i]}
                      bpm={bpm}
                      name={member.name}
                      index={i}
                      isActive={member.isActive}
                      mouthOpenness={speakingStates[i] ? mouthOpenness : 0}
                    />
                  </Float>
                </group>
              );
            })}
          </group>
        ) : (
          <Float speed={1.8} rotationIntensity={0.1} floatIntensity={0.2}>
            <HumanHead
              emotion={emotion}
              isSpeaking={isSpeaking}
              bpm={bpm}
              isActive
              mouthOpenness={mouthOpenness}
            />
          </Float>
        )}
      </Canvas>

      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,212,255,0.015) 2px,
              rgba(0,212,255,0.015) 4px
            )
          `,
          mixBlendMode: "screen",
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 h-1/4 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(0,4,8,0.8), transparent)`,
        }}
      />
    </div>
  );
}
