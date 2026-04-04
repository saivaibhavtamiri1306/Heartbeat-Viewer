import { useEffect, useRef } from "react";
import avatarChairman from "@assets/8c9509071f0cc8c00e1d0d40ddb37f56_1775290103056.jpg";
import avatarMember1 from "@assets/3bdea5f546bb0eae992501ddbbb71394_1775290075982.jpg";
import avatarMember2 from "@assets/539a7c4c33978728de8528842fa08a59_1775290062146.jpg";

const PANEL_AVATARS_IMG = [
  { src: avatarChairman, label: "Chairman" },
  { src: avatarMember1, label: "Member 1" },
  { src: avatarMember2, label: "Member 2" },
];

const EMOTION_COLORS: Record<string, string> = {
  neutral: "#00d4ff",
  empathetic: "#00ff88",
  stern: "#ff3333",
  curious: "#ffaa00",
  stressed: "#ff00ff",
};

const VERT_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_amplitude;
  uniform float u_speaking;
  uniform float u_headRotY;
  uniform float u_headRotX;
  uniform float u_breathe;
  varying vec2 v_texCoord;

  float depthMap(vec2 uv) {
    vec2 center = vec2(0.5, 0.42);
    float d = length((uv - center) * vec2(1.0, 1.3));
    float face = smoothstep(0.55, 0.0, d);
    float nose = smoothstep(0.15, 0.0, length((uv - vec2(0.5, 0.48)) * vec2(1.5, 1.0)));
    return face * 0.8 + nose * 0.2;
  }

  void main() {
    vec2 uv = a_texCoord;
    float depth = depthMap(uv);

    vec2 displaced = a_position;

    float parallaxX = u_headRotY * depth * 25.0;
    float parallaxY = u_headRotX * depth * 15.0;
    displaced.x += parallaxX;
    displaced.y += parallaxY;

    float perspScale = 1.0 + depth * u_headRotY * 0.04;
    displaced.x = u_resolution.x * 0.5 + (displaced.x - u_resolution.x * 0.5) * perspScale;

    vec2 mouthCenter = vec2(u_resolution.x * 0.5 + parallaxX * 0.5, u_resolution.y * 0.7 + parallaxY * 0.3);
    float mouthDist = length((displaced - mouthCenter) / vec2(u_resolution.x * 0.12, u_resolution.y * 0.08));
    float mouthMask = smoothstep(1.0, 0.0, mouthDist) * u_speaking;
    float jawDist = length((displaced - vec2(mouthCenter.x, mouthCenter.y + u_resolution.y * 0.05)) / vec2(u_resolution.x * 0.18, u_resolution.y * 0.12));
    float jawMask = smoothstep(1.0, 0.3, jawDist) * u_speaking;

    displaced.y += mouthMask * u_amplitude * u_resolution.y * 0.04;
    displaced.y += jawMask * u_amplitude * u_resolution.y * 0.015;

    displaced.y += u_breathe * depth * 3.0;

    displaced.y += u_speaking * u_amplitude * sin(u_time * 5.0) * depth * 2.0;

    vec2 clipSpace = (displaced / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_texCoord = a_texCoord;
  }
`;

const FRAG_SHADER = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float u_amplitude;
  uniform float u_speaking;
  uniform float u_time;
  uniform float u_headRotY;
  uniform float u_active;

  void main() {
    vec2 uv = v_texCoord;

    vec2 mouthUV = vec2(0.5, 0.72);
    float mouthDist = length((uv - mouthUV) / vec2(0.10, 0.06));
    float mouthMask = smoothstep(1.0, 0.0, mouthDist) * u_speaking;
    uv.y += mouthMask * u_amplitude * 0.03;

    vec4 color = texture2D(u_image, uv);

    float mouthOpen = smoothstep(0.6, 0.0, mouthDist) * u_speaking * u_amplitude;
    if (mouthOpen > 0.1) {
      vec3 mouthColor = vec3(0.12, 0.04, 0.04);
      vec3 teethColor = vec3(0.9, 0.88, 0.85);
      float teethMask = smoothstep(0.3, 0.0, length((uv - vec2(0.5, 0.705)) / vec2(0.06, 0.012)));
      vec3 insideMouth = mix(mouthColor, teethColor, teethMask * step(0.3, u_amplitude));
      color.rgb = mix(color.rgb, insideMouth, mouthOpen * 0.85);
    }

    float highlight = smoothstep(0.4, 0.0, length((uv - vec2(0.38, 0.28)) * vec2(1.0, 1.5)));
    color.rgb += highlight * 0.06;

    float shadow = smoothstep(0.3, 0.0, length((uv - vec2(0.5 + u_headRotY * 0.15, 0.85)) * vec2(0.8, 2.0)));
    color.rgb -= shadow * 0.08;

    float rimSide = u_headRotY > 0.0
      ? smoothstep(0.15, 0.0, uv.x)
      : smoothstep(0.85, 1.0, uv.x);
    color.rgb += rimSide * 0.05;

    color.rgb *= mix(0.5, 1.0, u_active);

    gl_FragColor = color;
  }
`;

const GRID = 40;

function createMeshGrid(w: number, h: number, grid: number) {
  const positions: number[] = [];
  const texCoords: number[] = [];
  const indices: number[] = [];
  const cols = grid;
  const rows = grid;

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const v = r / rows;
      positions.push(u * w, v * h);
      texCoords.push(u, v);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tl = r * (cols + 1) + c;
      const tr = tl + 1;
      const bl = tl + (cols + 1);
      const br = bl + 1;
      indices.push(tl, tr, bl, tr, br, bl);
    }
  }

  return {
    positions: new Float32Array(positions),
    texCoords: new Float32Array(texCoords),
    indices: new Uint16Array(indices),
  };
}

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true });
  if (!gl) return null;

  function compileShader(src: string, type: number) {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return s;
  }

  const vs = compileShader(VERT_SHADER, gl.VERTEX_SHADER);
  const fs = compileShader(FRAG_SHADER, gl.FRAGMENT_SHADER);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  return { gl, prog };
}

function TalkingHead3D({
  src,
  isSpeaking,
  getAmplitude,
  color,
  size,
  isActive = true,
  label,
}: {
  src: string;
  isSpeaking: boolean;
  getAmplitude?: () => number;
  color: string;
  size: number;
  isActive?: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const glRef = useRef<{ gl: WebGLRenderingContext; prog: WebGLProgram } | null>(null);
  const texRef = useRef<WebGLTexture | null>(null);
  const meshRef = useRef<{ posBuffer: WebGLBuffer; texBuffer: WebGLBuffer; idxBuffer: WebGLBuffer; count: number } | null>(null);
  const smoothAmpRef = useRef(0);
  const timeRef = useRef(0);
  const readyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const res = initGL(canvas);
    if (!res) return;

    const { gl, prog } = res;
    glRef.current = res;

    const px = size * 2;
    const mesh = createMeshGrid(px, px, GRID);

    const posBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

    const texBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.texCoords, gl.STATIC_DRAW);

    const idxBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    meshRef.current = { posBuffer, texBuffer, idxBuffer, count: mesh.indices.length };

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    texRef.current = tex;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      readyRef.current = true;
    };
    img.src = src;

    return () => {
      gl.deleteBuffer(posBuffer);
      gl.deleteBuffer(texBuffer);
      gl.deleteBuffer(idxBuffer);
      gl.deleteTexture(tex);
      gl.deleteProgram(prog);
    };
  }, [src, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let active = true;

    const render = () => {
      if (!active) return;
      frameRef.current = requestAnimationFrame(render);

      if (!glRef.current || !meshRef.current || !readyRef.current) return;
      const { gl, prog } = glRef.current;
      const { posBuffer, texBuffer, idxBuffer, count } = meshRef.current;

      timeRef.current += 0.016;
      const t = timeRef.current;

      const rawAmp = (isSpeaking && isActive && getAmplitude) ? getAmplitude() : 0;
      smoothAmpRef.current += (rawAmp - smoothAmpRef.current) * 0.35;
      const amp = smoothAmpRef.current;

      const px = size * 2;
      gl.viewport(0, 0, px, px);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);

      const headRotY = Math.sin(t * 0.5) * 0.12 + (isSpeaking && isActive ? Math.sin(t * 1.8) * amp * 0.05 : 0);
      const headRotX = Math.sin(t * 0.35) * 0.06 + (isSpeaking && isActive ? Math.sin(t * 2.2) * amp * 0.03 : 0);
      const breathe = Math.sin(t * 0.8) * 1.5;

      gl.uniform2f(gl.getUniformLocation(prog, "u_resolution"), px, px);
      gl.uniform1f(gl.getUniformLocation(prog, "u_time"), t);
      gl.uniform1f(gl.getUniformLocation(prog, "u_amplitude"), amp);
      gl.uniform1f(gl.getUniformLocation(prog, "u_speaking"), isSpeaking && isActive ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_headRotY"), headRotY);
      gl.uniform1f(gl.getUniformLocation(prog, "u_headRotX"), headRotX);
      gl.uniform1f(gl.getUniformLocation(prog, "u_breathe"), breathe);
      gl.uniform1f(gl.getUniformLocation(prog, "u_active"), isActive ? 1.0 : 0.0);

      const posLoc = gl.getAttribLocation(prog, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      const texLoc = gl.getAttribLocation(prog, "a_texCoord");
      gl.enableVertexAttribArray(texLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
      gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindTexture(gl.TEXTURE_2D, texRef.current);
      gl.uniform1i(gl.getUniformLocation(prog, "u_image"), 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    };

    frameRef.current = requestAnimationFrame(render);
    return () => { active = false; cancelAnimationFrame(frameRef.current); };
  }, [isSpeaking, getAmplitude, isActive, size]);

  const glowIntensity = isActive ? 0.6 : 0.2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          border: `3px solid ${isActive ? color : color + "40"}`,
          boxShadow: isActive
            ? `0 0 30px ${color}80, 0 0 60px ${color}30, 0 10px 40px rgba(0,0,0,0.5)`
            : `0 4px 20px rgba(0,0,0,0.3)`,
          opacity: isActive ? 1 : 0.45,
          transition: "border-color 0.3s, box-shadow 0.3s, opacity 0.3s",
          position: "relative",
        }}
      >
        <canvas
          ref={canvasRef}
          width={size * 2}
          height={size * 2}
          style={{
            width: size,
            height: size,
            display: "block",
          }}
        />
      </div>
      {label && (
        <span
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{
            color,
            border: `1px solid ${color}${isActive ? "90" : "30"}`,
            background: isActive ? `${color}15` : "transparent",
          }}
        >
          {label}
        </span>
      )}
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
  const ec = EMOTION_COLORS[emotion] || "#00d4ff";

  if (panelMode) {
    const panelColors = ["#ff3333", "#ffaa00", "#00d4ff"];

    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-end gap-8">
          {PANEL_AVATARS_IMG.map((avatar, i) => {
            const active = activeSpeakerIndex === i;
            return (
              <TalkingHead3D
                key={i}
                src={avatar.src}
                isSpeaking={isSpeaking}
                getAmplitude={active ? getAmplitude : undefined}
                color={panelColors[i]}
                size={active ? 170 : 120}
                isActive={active}
                label={avatar.label}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <div
        className="text-[10px] font-mono uppercase tracking-[0.3em] px-4 py-1.5 rounded-full"
        style={{
          background: `${ec}15`,
          border: `1px solid ${ec}60`,
          color: ec,
          boxShadow: `0 0 20px ${ec}30`,
        }}
      >
        {emotion.toUpperCase()}
      </div>

      <TalkingHead3D
        src={avatarMember1}
        isSpeaking={isSpeaking}
        getAmplitude={getAmplitude}
        color={ec}
        size={180}
      />

      <div
        className="text-xs font-mono tracking-widest flex items-center gap-2"
        style={{ color: ec }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ec }} />
        {bpm} BPM
      </div>
    </div>
  );
}
