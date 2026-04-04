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

function createHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ox = v.x, oy = v.y, oz = v.z;

    v.x *= 0.76;
    v.z *= 0.86;

    if (oy > 0.15) {
      v.y *= 1.05;
      v.x *= 1.0 + (oy - 0.15) * 0.1;
    }

    if (oy > 0.5) {
      v.y *= 1.0 + (oy - 0.5) * 0.08;
    }

    if (oy < -0.1) {
      const cf = Math.max(0, (-oy - 0.1) * 1.2);
      v.x *= 1.0 - cf * 0.42;
      v.z *= 1.0 - cf * 0.22;
      v.y *= 1.0 + cf * 0.1;
    }

    if (oz > 0.25 && Math.abs(oy - 0.1) < 0.45) {
      const ck = Math.max(0, 1.0 - Math.abs(ox) * 0.9);
      v.z += 0.09 * ck;
    }

    if (oz > 0.35 && Math.abs(ox) < 0.22 && oy > -0.15 && oy < 0.3) {
      const nd = 1.0 - Math.abs(ox) / 0.22;
      const ny2 = 1.0 - Math.abs(oy - 0.03) / 0.3;
      v.z += 0.16 * nd * Math.max(0, ny2);
    }

    if (oz > 0.4 && Math.abs(ox) < 0.1 && oy < 0.0 && oy > -0.12) {
      v.z += 0.08;
    }

    for (const side of [-1, 1]) {
      const ex = side * 0.3;
      const ey = 0.2;
      const dx = ox - ex;
      const dy = oy - ey;
      const ed = Math.sqrt(dx * dx + dy * dy);
      if (ed < 0.16 && oz > 0.3) {
        v.z -= 0.06 * (1.0 - ed / 0.16);
      }
    }

    if (oy > 0.3 && oz > 0.2) {
      v.z += 0.05 * (oy - 0.3);
    }

    if (Math.abs(ox) > 0.7 && Math.abs(oy - 0.06) < 0.2 && oz < 0.2) {
      const ef = (Math.abs(ox) - 0.7) * 2.5;
      v.x += Math.sign(ox) * ef * 0.1;
    }

    if (oz > 0.2 && oy < -0.22 && oy > -0.5 && Math.abs(ox) < 0.2) {
      v.z += 0.04;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

function AmbientParticles({ color, count = 600 }: { color: number; count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.0 + Math.random() * 3;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi) + (Math.random() - 0.5) * 2;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);

  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = s.clock.elapsedTime * 0.015;
      (ref.current.material as THREE.PointsMaterial).opacity =
        0.2 + Math.sin(s.clock.elapsedTime * 0.8) * 0.08;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.012}
        color={color}
        transparent
        opacity={0.25}
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
    if (r1.current) {
      r1.current.rotation.z = t * 0.12;
      r1.current.scale.setScalar(1.0 + Math.sin(t * 1.2) * 0.02);
    }
    if (r2.current) {
      r2.current.rotation.z = -t * 0.08;
    }
  });

  return (
    <group position={[0, -1.5, 0]}>
      <mesh ref={r1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.005, 4, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI / 2.05, 0.08, 0]}>
        <torusGeometry args={[1.15, 0.004, 4, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function HumanAvatar({ emotion, isSpeaking, bpm, index = 0, name, isActive = true, mouthOpenness = 0 }: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const lowerLipRef = useRef<THREE.Mesh>(null);
  const jawRef = useRef<THREE.Mesh>(null);
  const leftEyeGrpRef = useRef<THREE.Group>(null);
  const rightEyeGrpRef = useRef<THREE.Group>(null);
  const leftIrisRef = useRef<THREE.Mesh>(null);
  const rightIrisRef = useRef<THREE.Mesh>(null);
  const leftBrowRef = useRef<THREE.Mesh>(null);
  const rightBrowRef = useRef<THREE.Mesh>(null);

  const colors = EMOTION_COLORS[emotion];
  const offset = index * (Math.PI * 2 / 3);
  const mouthVal = useRef(0);

  const headGeo = useMemo(() => createHeadGeometry(), []);

  const skinBase = useMemo(() => new THREE.Color(0xd4a574), []);
  const skinDark = useMemo(() => new THREE.Color(0xb88f65), []);
  const lipCol = useMemo(() => new THREE.Color(0xc46858), []);
  const hairCol = useMemo(() => new THREE.Color(0x1a1209), []);
  const browCol = useMemo(() => new THREE.Color(0x1a1209), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!groupRef.current) return;

    groupRef.current.rotation.y = Math.sin(t * 0.25 + offset) * (isActive ? 0.12 : 0.04);
    groupRef.current.rotation.x = Math.sin(t * 0.18 + offset) * 0.03;
    const cs = groupRef.current.scale.x;
    const ts = isActive ? 1.0 : 0.88;
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(cs, ts, 0.04));

    const tm = isSpeaking ? (mouthOpenness ?? (0.25 + Math.abs(Math.sin(t * 8)) * 0.75)) : 0;
    mouthVal.current = THREE.MathUtils.lerp(mouthVal.current, tm, 0.2);

    if (mouthRef.current) {
      mouthRef.current.scale.y = 0.4 + mouthVal.current * 1.5;
      mouthRef.current.position.y = -0.21 - mouthVal.current * 0.03;
    }
    if (lowerLipRef.current) {
      lowerLipRef.current.position.y = -0.26 - mouthVal.current * 0.06;
    }
    if (jawRef.current) {
      jawRef.current.position.y = -0.42 - mouthVal.current * 0.04;
      jawRef.current.scale.y = 1 + mouthVal.current * 0.05;
    }

    const blink = Math.sin(t * 0.45 + offset);
    const blinkAmt = blink > 0.94 ? Math.max(0.08, 1.0 - (blink - 0.94) * 16) : 1.0;
    if (leftEyeGrpRef.current) leftEyeGrpRef.current.scale.y = blinkAmt;
    if (rightEyeGrpRef.current) rightEyeGrpRef.current.scale.y = blinkAmt;

    const lookX = Math.sin(t * 0.35 + offset) * 0.02;
    const lookY = Math.sin(t * 0.25 + offset + 1) * 0.01;
    if (leftIrisRef.current) {
      leftIrisRef.current.position.x = lookX;
      leftIrisRef.current.position.y = lookY;
    }
    if (rightIrisRef.current) {
      rightIrisRef.current.position.x = lookX;
      rightIrisRef.current.position.y = lookY;
    }

    const browY = emotion === "stern" ? -0.03 : emotion === "curious" ? 0.04 : 0;
    const browTilt = emotion === "stern" ? 0.12 : emotion === "curious" ? -0.06 : 0;
    if (leftBrowRef.current) {
      leftBrowRef.current.position.y = THREE.MathUtils.lerp(leftBrowRef.current.position.y, 0.45 + browY, 0.05);
      leftBrowRef.current.rotation.z = THREE.MathUtils.lerp(leftBrowRef.current.rotation.z, browTilt, 0.05);
    }
    if (rightBrowRef.current) {
      rightBrowRef.current.position.y = THREE.MathUtils.lerp(rightBrowRef.current.position.y, 0.45 + browY, 0.05);
      rightBrowRef.current.rotation.z = THREE.MathUtils.lerp(rightBrowRef.current.rotation.z, -browTilt, 0.05);
    }
  });

  return (
    <group ref={groupRef}>
      {/* ── Head ── */}
      <mesh geometry={headGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color={skinBase}
          roughness={0.55}
          metalness={0.02}
          emissive={new THREE.Color(colors.emissive)}
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* ── Forehead sculpt ── */}
      <mesh position={[0, 0.5, 0.35]} scale={[0.6, 0.2, 0.25]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial color={skinBase} roughness={0.55} metalness={0.02} />
      </mesh>

      {/* ── Cheekbones ── */}
      <mesh position={[-0.45, 0.08, 0.58]} scale={[0.18, 0.12, 0.15]}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color={skinBase} roughness={0.55} metalness={0.02} />
      </mesh>
      <mesh position={[0.45, 0.08, 0.58]} scale={[0.18, 0.12, 0.15]}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color={skinBase} roughness={0.55} metalness={0.02} />
      </mesh>

      {/* ── Hair ── */}
      <mesh position={[0, 0.58, -0.02]} scale={[0.8, 0.5, 0.82]}>
        <sphereGeometry args={[1, 36, 28]} />
        <meshStandardMaterial color={hairCol} roughness={0.82} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.32, -0.15]} scale={[0.82, 0.42, 0.72]}>
        <sphereGeometry args={[1, 28, 22]} />
        <meshStandardMaterial color={hairCol} roughness={0.82} metalness={0.06} />
      </mesh>
      {/* Hair sides */}
      <mesh position={[-0.58, 0.18, 0.12]} scale={[0.18, 0.3, 0.42]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={hairCol} roughness={0.82} metalness={0.06} />
      </mesh>
      <mesh position={[0.58, 0.18, 0.12]} scale={[0.18, 0.3, 0.42]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={hairCol} roughness={0.82} metalness={0.06} />
      </mesh>
      {/* Hair top detail */}
      <mesh position={[0.1, 0.78, 0.1]} scale={[0.35, 0.18, 0.4]} rotation={[0.1, 0.2, 0.15]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={hairCol} roughness={0.82} metalness={0.06} />
      </mesh>
      <mesh position={[-0.15, 0.76, 0.15]} scale={[0.3, 0.15, 0.35]} rotation={[-0.05, -0.1, -0.1]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={hairCol} roughness={0.82} metalness={0.06} />
      </mesh>

      {/* ── Eyes ── */}
      <group position={[0, 0.2, 0.65]}>
        {/* Left eye */}
        <group ref={leftEyeGrpRef} position={[-0.25, 0, 0.12]}>
          <mesh>
            <sphereGeometry args={[0.1, 28, 28]} />
            <meshStandardMaterial color={0xf8f4f0} roughness={0.08} metalness={0} />
          </mesh>
          <group ref={leftIrisRef}>
            <mesh position={[0, 0, 0.075]}>
              <sphereGeometry args={[0.055, 24, 24]} />
              <meshStandardMaterial
                color={0x3d5c4a}
                roughness={0.15}
                metalness={0.1}
                emissive={new THREE.Color(colors.primary)}
                emissiveIntensity={0.08}
              />
            </mesh>
            <mesh position={[0, 0, 0.09]}>
              <sphereGeometry args={[0.028, 20, 20]} />
              <meshStandardMaterial color={0x050505} roughness={0.05} metalness={0} />
            </mesh>
            <mesh position={[-0.015, 0.015, 0.1]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshBasicMaterial color={0xffffff} />
            </mesh>
          </group>
        </group>
        {/* Right eye */}
        <group ref={rightEyeGrpRef} position={[0.25, 0, 0.12]}>
          <mesh>
            <sphereGeometry args={[0.1, 28, 28]} />
            <meshStandardMaterial color={0xf8f4f0} roughness={0.08} metalness={0} />
          </mesh>
          <group ref={rightIrisRef}>
            <mesh position={[0, 0, 0.075]}>
              <sphereGeometry args={[0.055, 24, 24]} />
              <meshStandardMaterial
                color={0x3d5c4a}
                roughness={0.15}
                metalness={0.1}
                emissive={new THREE.Color(colors.primary)}
                emissiveIntensity={0.08}
              />
            </mesh>
            <mesh position={[0, 0, 0.09]}>
              <sphereGeometry args={[0.028, 20, 20]} />
              <meshStandardMaterial color={0x050505} roughness={0.05} metalness={0} />
            </mesh>
            <mesh position={[0.015, 0.015, 0.1]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshBasicMaterial color={0xffffff} />
            </mesh>
          </group>
        </group>

        {/* Upper eyelids */}
        <mesh position={[-0.25, 0.06, 0.12]} scale={[0.12, 0.025, 0.06]} rotation={[0.15, 0, 0]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshStandardMaterial color={skinBase} roughness={0.55} metalness={0.02} />
        </mesh>
        <mesh position={[0.25, 0.06, 0.12]} scale={[0.12, 0.025, 0.06]} rotation={[0.15, 0, 0]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshStandardMaterial color={skinBase} roughness={0.55} metalness={0.02} />
        </mesh>
        {/* Lower eyelids */}
        <mesh position={[-0.25, -0.06, 0.11]} scale={[0.11, 0.012, 0.05]} rotation={[-0.08, 0, 0]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
        </mesh>
        <mesh position={[0.25, -0.06, 0.11]} scale={[0.11, 0.012, 0.05]} rotation={[-0.08, 0, 0]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
        </mesh>
      </group>

      {/* ── Eyebrows ── */}
      <mesh ref={leftBrowRef} position={[-0.25, 0.45, 0.72]} scale={[0.13, 0.018, 0.028]} rotation={[0.08, 0, 0.05]}>
        <capsuleGeometry args={[1, 0.5, 4, 14]} />
        <meshStandardMaterial color={browCol} roughness={0.85} />
      </mesh>
      <mesh ref={rightBrowRef} position={[0.25, 0.45, 0.72]} scale={[0.13, 0.018, 0.028]} rotation={[0.08, 0, -0.05]}>
        <capsuleGeometry args={[1, 0.5, 4, 14]} />
        <meshStandardMaterial color={browCol} roughness={0.85} />
      </mesh>

      {/* ── Nose ── */}
      <mesh position={[0, 0.06, 0.82]} scale={[0.055, 0.16, 0.08]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial color={skinBase} roughness={0.5} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.06, 0.92]} scale={[0.075, 0.055, 0.06]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color={skinBase} roughness={0.45} metalness={0.02} />
      </mesh>
      {/* Nostrils */}
      <mesh position={[-0.04, -0.08, 0.9]} scale={[0.035, 0.025, 0.03]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color={skinDark} roughness={0.6} />
      </mesh>
      <mesh position={[0.04, -0.08, 0.9]} scale={[0.035, 0.025, 0.03]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color={skinDark} roughness={0.6} />
      </mesh>

      {/* ── Mouth ── */}
      {/* Upper lip */}
      <mesh position={[0, -0.18, 0.84]} scale={[0.13, 0.022, 0.05]}>
        <sphereGeometry args={[1, 22, 12]} />
        <meshStandardMaterial color={lipCol} roughness={0.35} metalness={0} />
      </mesh>
      {/* Philtrum */}
      <mesh position={[0, -0.12, 0.88]} scale={[0.025, 0.04, 0.015]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color={skinDark} roughness={0.6} transparent opacity={0.4} />
      </mesh>
      {/* Lower lip */}
      <mesh ref={lowerLipRef} position={[0, -0.26, 0.82]} scale={[0.11, 0.028, 0.045]}>
        <sphereGeometry args={[1, 22, 12]} />
        <meshStandardMaterial color={lipCol.clone().multiplyScalar(0.9)} roughness={0.3} metalness={0} />
      </mesh>
      {/* Mouth opening */}
      <mesh ref={mouthRef} position={[0, -0.21, 0.82]} scale={[0.09, 0.4, 0.03]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={0x1a0808} roughness={0.9} />
      </mesh>

      {/* ── Chin ── */}
      <mesh ref={jawRef} position={[0, -0.42, 0.52]} scale={[0.17, 0.12, 0.15]}>
        <sphereGeometry args={[1, 22, 22]} />
        <meshStandardMaterial color={skinBase} roughness={0.55} metalness={0.02} />
      </mesh>

      {/* Slight stubble / jaw definition */}
      <mesh position={[0, -0.35, 0.45]} scale={[0.35, 0.15, 0.32]}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshStandardMaterial color={skinDark} roughness={0.65} metalness={0.02} />
      </mesh>

      {/* ── Ears ── */}
      <mesh position={[-0.68, 0.08, 0.08]} scale={[0.08, 0.12, 0.06]} rotation={[0, 0.3, 0]}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
      </mesh>
      <mesh position={[0.68, 0.08, 0.08]} scale={[0.08, 0.12, 0.06]} rotation={[0, -0.3, 0]}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
      </mesh>

      {/* ── Neck ── */}
      <mesh position={[0, -0.7, 0.05]}>
        <cylinderGeometry args={[0.16, 0.2, 0.35, 18]} />
        <meshStandardMaterial color={skinDark} roughness={0.6} metalness={0.02} />
      </mesh>

      {/* ── Blazer / Jacket ── */}
      <group position={[0, -1.25, 0]}>
        {/* Main torso */}
        <mesh castShadow>
          <cylinderGeometry args={[0.35, 0.55, 0.7, 22, 4, false]} />
          <meshStandardMaterial
            color={0x1a1a2e}
            roughness={0.65}
            metalness={0.12}
            emissive={new THREE.Color(colors.primary)}
            emissiveIntensity={0.02}
          />
        </mesh>
        {/* Collar / lapels */}
        <mesh position={[0, 0.33, 0.28]} scale={[0.5, 0.08, 0.2]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={0x222240} roughness={0.6} metalness={0.1} />
        </mesh>
        {/* Inner shirt/t-shirt visible at collar */}
        <mesh position={[0, 0.32, 0.3]} scale={[0.3, 0.06, 0.12]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={0x3a3a4a} roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Shoulders */}
        <mesh position={[-0.42, 0.15, 0]} scale={[0.22, 0.25, 0.2]} rotation={[0, 0, 0.25]}>
          <sphereGeometry args={[1, 14, 12]} />
          <meshStandardMaterial color={0x1a1a2e} roughness={0.65} metalness={0.12} />
        </mesh>
        <mesh position={[0.42, 0.15, 0]} scale={[0.22, 0.25, 0.2]} rotation={[0, 0, -0.25]}>
          <sphereGeometry args={[1, 14, 12]} />
          <meshStandardMaterial color={0x1a1a2e} roughness={0.65} metalness={0.12} />
        </mesh>
      </group>

      {/* ── Subtle glow when speaking ── */}
      {isActive && isSpeaking && (
        <mesh position={[0, 0, -0.2]}>
          <sphereGeometry args={[1.2, 20, 20]} />
          <meshBasicMaterial
            color={colors.primary}
            transparent
            opacity={0.03}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
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
    <div className="w-full h-full relative" style={{ background: "radial-gradient(ellipse at center, #0a1628 0%, #000408 70%)" }}>
      <Canvas
        camera={{ position: [0, 0.15, 3.5], fov: 36 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        <color attach="background" args={["#000408"]} />
        <fog attach="fog" args={["#000408", 5, 12]} />

        <ambientLight intensity={0.35} />
        <directionalLight position={[2, 3, 4]} intensity={1.4} color={0xfff0e0} castShadow />
        <directionalLight position={[-3, 1, -2]} intensity={0.25} color={EMOTION_COLORS[emotion].primary} />
        <pointLight position={[0, 2, 3]} intensity={0.6} color={0xfff5e6} />
        <pointLight position={[0, -1, 2]} intensity={0.2} color={EMOTION_COLORS[emotion].primary} />
        <pointLight position={[-2, 0, 1]} intensity={0.15} color={0x88aaff} />

        <Stars radius={8} depth={25} count={700} factor={1.8} saturation={0.1} fade speed={0.3} />
        <AmbientParticles color={EMOTION_COLORS[emotion].primary} count={500} />
        <SubtleRings color={EMOTION_COLORS[emotion].primary} />

        {panelMode && panelMembers ? (
          <group>
            {panelMembers.map((member, i) => {
              const count = panelMembers.length;
              const spacing = Math.min(3.2, 6.5 / count);
              const x = (i - (count - 1) / 2) * spacing;
              return (
                <group key={i} position={[x, 0.2, 0]} scale={count > 2 ? 0.55 : 0.7}>
                  <Float speed={1.2} rotationIntensity={0.04} floatIntensity={0.08}>
                    <HumanAvatar
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
          <Float speed={1.3} rotationIntensity={0.04} floatIntensity={0.1}>
            <HumanAvatar
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
              transparent 3px,
              rgba(0,212,255,0.006) 3px,
              rgba(0,212,255,0.006) 4px
            )
          `,
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}
