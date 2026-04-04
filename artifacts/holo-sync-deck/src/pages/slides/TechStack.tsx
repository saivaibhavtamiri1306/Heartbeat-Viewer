export default function TechStack() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 40% 50%, rgba(119,0,255,0.05) 0%, transparent 50%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "5vh 5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
          Built With
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
          Technology Stack
        </h2>

        <div className="flex-1 grid grid-cols-3" style={{ marginTop: "3vh", gap: "1.5vw" }}>

          <div className="rounded-xl border border-primary/25 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-primary" style={{ fontSize: "1.5vw", marginBottom: "1.5vh" }}>Frontend</div>
            <div className="flex flex-col" style={{ gap: "0.8vh" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>React 18</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>TypeScript</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>Three.js</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>R3F + Drei</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>Tailwind CSS</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>Orbitron font</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>Vite</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>Dev + HMR</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>Wouter</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>SPA routing</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan/25 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-cyan" style={{ fontSize: "1.5vw", marginBottom: "1.5vh" }}>Computer Vision</div>
            <div className="flex flex-col" style={{ gap: "0.8vh" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>MediaPipe</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>Face mesh</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>WebRTC</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>getUserMedia</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>Canvas 2D</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>Pixel sampling</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>CHROM rPPG</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>De Haan method</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>FFT</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>Radix-2 Cooley-Tukey</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/25 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold" style={{ fontSize: "1.5vw", marginBottom: "1.5vh", color: "#a855f7" }}>AI + Backend</div>
            <div className="flex flex-col" style={{ gap: "0.8vh" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>OpenAI GPT-4o</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>Evaluation</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>OpenAI TTS</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>4 voices</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>Web Speech</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>STT continuous</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>Express.js</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>API proxy</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.15vw" }}>pnpm</div>
                <div className="font-body text-muted/50" style={{ fontSize: "0.95vw" }}>Monorepo mgmt</div>
              </div>
            </div>
          </div>

        </div>

        <div className="rounded-lg border border-muted/15 p-[1.2vw] grid grid-cols-4" style={{ marginTop: "1.5vh", gap: "1.5vw", background: "rgba(100,120,150,0.03)" }}>
          <div className="text-center">
            <div className="font-display font-bold text-text" style={{ fontSize: "1.3vw" }}>head.glb</div>
            <div className="font-body text-muted/60" style={{ fontSize: "0.9vw" }}>LeePerrySmith scan</div>
          </div>
          <div className="text-center">
            <div className="font-display font-bold text-text" style={{ fontSize: "1.3vw" }}>300 frames</div>
            <div className="font-body text-muted/60" style={{ fontSize: "0.9vw" }}>rPPG buffer depth</div>
          </div>
          <div className="text-center">
            <div className="font-display font-bold text-text" style={{ fontSize: "1.3vw" }}>7 ROIs</div>
            <div className="font-body text-muted/60" style={{ fontSize: "0.9vw" }}>Facial sample zones</div>
          </div>
          <div className="text-center">
            <div className="font-display font-bold text-text" style={{ fontSize: "1.3vw" }}>45-180 BPM</div>
            <div className="font-body text-muted/60" style={{ fontSize: "0.9vw" }}>Detection range</div>
          </div>
        </div>
      </div>
    </div>
  );
}
