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
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(6,11,24,0.85) 0%, rgba(0,212,255,0.08) 50%, rgba(119,0,255,0.12) 100%)" }} />

      <div className="relative z-10 flex flex-col justify-center items-start h-full" style={{ padding: "8vh 8vw" }}>
        <div className="font-body text-muted tracking-widest uppercase" style={{ fontSize: "1.4vw", marginBottom: "2vh" }}>
          Next-Generation Biometric Intelligence
        </div>
        <h1 className="font-display font-bold tracking-tight text-text" style={{ fontSize: "7vw", lineHeight: "1.05" }}>
          HOLO-SYNC
        </h1>
        <div className="font-display font-semibold text-primary" style={{ fontSize: "2.4vw", marginTop: "1.5vh" }}>
          Universal Biometric Interviewer
        </div>
        <p className="font-body text-muted" style={{ fontSize: "1.6vw", marginTop: "3vh", maxWidth: "50vw" }}>
          Real-time webcam rPPG heart rate detection, 3D AI avatar, multi-domain interview intelligence, and AI-powered evaluation
        </p>

        <div className="flex gap-[1.5vw]" style={{ marginTop: "5vh" }}>
          <div className="rounded-lg border border-primary/30 px-[1.5vw] py-[1vh]">
            <span className="font-body text-primary" style={{ fontSize: "1.3vw" }}>5 Domains</span>
          </div>
          <div className="rounded-lg border border-primary/30 px-[1.5vw] py-[1vh]">
            <span className="font-body text-primary" style={{ fontSize: "1.3vw" }}>rPPG Detection</span>
          </div>
          <div className="rounded-lg border border-primary/30 px-[1.5vw] py-[1vh]">
            <span className="font-body text-primary" style={{ fontSize: "1.3vw" }}>3D Avatar</span>
          </div>
          <div className="rounded-lg border border-primary/30 px-[1.5vw] py-[1vh]">
            <span className="font-body text-primary" style={{ fontSize: "1.3vw" }}>AI Evaluation</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[3vh] right-[4vw] font-body text-muted/50" style={{ fontSize: "1.2vw" }}>
        Built with React + Three.js + WebRTC
      </div>
    </div>
  );
}
