const base = import.meta.env.BASE_URL;

export default function TitleSlide() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <img
        src={`${base}hero.png`}
        crossOrigin="anonymous"
        alt="Holographic interface"
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(6,11,24,0.88) 0%, rgba(0,212,255,0.06) 50%, rgba(119,0,255,0.10) 100%)" }} />

      <div className="absolute top-0 left-0 w-full h-full" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.015) 3px, rgba(0,212,255,0.015) 4px)" }} />

      <div className="relative z-10 flex flex-col justify-center items-start h-full" style={{ padding: "8vh 8vw" }}>
        <div className="font-body text-primary/70 tracking-widest uppercase" style={{ fontSize: "1.3vw", marginBottom: "1.5vh", letterSpacing: "0.35em" }}>
          Next-Generation Biometric Intelligence Platform
        </div>
        <h1 className="font-display font-bold tracking-tight text-text" style={{ fontSize: "7.5vw", lineHeight: "1.02" }}>
          HOLO-SYNC
        </h1>
        <div className="font-display font-semibold text-primary" style={{ fontSize: "2.6vw", marginTop: "1vh" }}>
          Universal Biometric Interviewer
        </div>
        <div className="font-body text-muted" style={{ fontSize: "1.5vw", marginTop: "2.5vh", maxWidth: "52vw", lineHeight: "1.6" }}>
          Real-time webcam rPPG heart rate detection with 7-ROI facial sampling, photorealistic 3D AI avatar powered by LeePerrySmith head scan, 5 specialized interview domains with Cross-Fire panel mode, and AI-driven evaluation with bluff detection
        </div>

        <div className="flex gap-[1.2vw]" style={{ marginTop: "4vh" }}>
          <div className="rounded-md border border-primary/40 px-[1.3vw] py-[0.8vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
            <span className="font-body text-primary" style={{ fontSize: "1.2vw" }}>5 Domains</span>
          </div>
          <div className="rounded-md border border-primary/40 px-[1.3vw] py-[0.8vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
            <span className="font-body text-primary" style={{ fontSize: "1.2vw" }}>7-ROI rPPG</span>
          </div>
          <div className="rounded-md border border-primary/40 px-[1.3vw] py-[0.8vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
            <span className="font-body text-primary" style={{ fontSize: "1.2vw" }}>3D Avatar</span>
          </div>
          <div className="rounded-md border border-primary/40 px-[1.3vw] py-[0.8vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
            <span className="font-body text-primary" style={{ fontSize: "1.2vw" }}>AI Evaluation</span>
          </div>
          <div className="rounded-md border border-primary/40 px-[1.3vw] py-[0.8vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
            <span className="font-body text-primary" style={{ fontSize: "1.2vw" }}>Bluff Detect</span>
          </div>
          <div className="rounded-md border border-primary/40 px-[1.3vw] py-[0.8vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
            <span className="font-body text-primary" style={{ fontSize: "1.2vw" }}>Eye Contact</span>
          </div>
        </div>

        <div className="flex items-center gap-[2vw]" style={{ marginTop: "4vh" }}>
          <div className="flex items-center gap-[0.5vw]">
            <div className="rounded-full" style={{ width: "0.6vw", height: "0.6vw", background: "#00d4ff" }} />
            <span className="font-body text-muted/70" style={{ fontSize: "1.1vw" }}>React + Three.js</span>
          </div>
          <div className="flex items-center gap-[0.5vw]">
            <div className="rounded-full" style={{ width: "0.6vw", height: "0.6vw", background: "#7700ff" }} />
            <span className="font-body text-muted/70" style={{ fontSize: "1.1vw" }}>MediaPipe + WebRTC</span>
          </div>
          <div className="flex items-center gap-[0.5vw]">
            <div className="rounded-full" style={{ width: "0.6vw", height: "0.6vw", background: "#a855f7" }} />
            <span className="font-body text-muted/70" style={{ fontSize: "1.1vw" }}>OpenAI GPT + TTS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
