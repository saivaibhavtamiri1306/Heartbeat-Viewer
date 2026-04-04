export default function TechStack() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 40% 50%, rgba(119,0,255,0.05) 0%, transparent 50%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "6vh 6vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.3vw", marginBottom: "1vh" }}>
          Built With
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.8vw" }}>
          Technology Stack
        </h2>

        <div className="flex-1 grid grid-cols-3" style={{ marginTop: "4vh", gap: "2vw" }}>

          <div className="rounded-xl border border-primary/25 p-[1.8vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-primary" style={{ fontSize: "1.6vw", marginBottom: "1.5vh" }}>Frontend</div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              React 18 + TypeScript
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              Three.js + React Three Fiber
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              Tailwind CSS + Orbitron font
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              Vite dev server
            </div>
          </div>

          <div className="rounded-xl border border-cyan/25 p-[1.8vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-cyan" style={{ fontSize: "1.6vw", marginBottom: "1.5vh" }}>Computer Vision</div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              MediaPipe Face Detection
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              WebRTC getUserMedia
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              Canvas 2D pixel sampling
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              CHROM rPPG algorithm
            </div>
          </div>

          <div className="rounded-xl border border-primary/25 p-[1.8vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold" style={{ fontSize: "1.6vw", marginBottom: "1.5vh", color: "#a855f7" }}>AI + Backend</div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              OpenAI GPT for evaluation
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              OpenAI TTS (onyx/nova)
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              Web Speech API (STT)
            </div>
            <div className="font-body text-text" style={{ fontSize: "1.3vw", lineHeight: "2.2" }}>
              Express.js API server
            </div>
          </div>

        </div>

        <div className="rounded-lg border border-muted/20 p-[1.5vw] flex justify-between items-center" style={{ marginTop: "2vh", background: "rgba(100,120,150,0.03)" }}>
          <div className="font-body text-muted" style={{ fontSize: "1.2vw" }}>Monorepo managed by pnpm</div>
          <div className="font-body text-muted" style={{ fontSize: "1.2vw" }}>FFT: Cooley-Tukey radix-2</div>
          <div className="font-body text-muted" style={{ fontSize: "1.2vw" }}>3D Model: Lee Perry Smith scan</div>
        </div>
      </div>
    </div>
  );
}
