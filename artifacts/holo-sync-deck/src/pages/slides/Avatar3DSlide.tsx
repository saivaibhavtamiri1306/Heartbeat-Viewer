const base = import.meta.env.BASE_URL;

export default function Avatar3DSlide() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <img
        src={`${base}avatar-detail.png`}
        crossOrigin="anonymous"
        alt="3D avatar head scan"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(6,11,24,0.95) 0%, rgba(6,11,24,0.7) 40%, rgba(6,11,24,0.5) 100%)" }} />

      <div className="relative z-10 flex h-full">

        <div className="flex flex-col justify-center" style={{ width: "55vw", padding: "6vh 5vw" }}>
          <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
            Photorealistic Rendering
          </div>
          <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
            3D AI Avatar
          </h2>
          <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1vh", lineHeight: "1.5" }}>
            LeePerrySmith photogrammetry head scan rendered in real-time with React Three Fiber
          </div>

          <div className="flex flex-col" style={{ marginTop: "3vh", gap: "1.5vh" }}>
            <div className="rounded-lg border border-primary/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.4vw" }}>MeshPhysicalMaterial</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Sheen intensity 0.25, clearcoat 0.04, roughness 0.65, metalness 0.05, ACES filmic tone mapping
              </div>
            </div>
            <div className="rounded-lg border border-primary/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.4vw" }}>Texture Maps</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Diffuse color map (head-color.jpg) + tangent-space normal map (head-normal.jpg) from Three.js examples repository
              </div>
            </div>
            <div className="rounded-lg border border-cyan/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.4vw" }}>Emotion-Reactive Glow</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Cyan aura sphere scales with speaking state; color shifts from cyan to orange based on detected stress levels from rPPG data
              </div>
            </div>
            <div className="rounded-lg border border-cyan/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.4vw" }}>Studio Environment</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Environment preset lighting with directional + point lights for cinematic headshot rendering at 60fps
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
