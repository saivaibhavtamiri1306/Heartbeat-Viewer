export default function ClosingSlide() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(0,212,255,0.08) 0%, rgba(119,0,255,0.04) 30%, transparent 60%)" }} />

      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.01) 3px, rgba(0,212,255,0.01) 4px)" }} />

      <div className="relative z-10 flex flex-col justify-center items-center h-full text-center">
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.4vw", marginBottom: "3vh" }}>
          Universal Biometric Interviewer
        </div>

        <h1 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "6.5vw", lineHeight: "1.1" }}>
          HOLO-SYNC
        </h1>

        <div className="font-body text-muted" style={{ fontSize: "1.8vw", marginTop: "3vh", maxWidth: "55vw" }}>
          Where biometrics meet artificial intelligence to create the most realistic interview simulation platform
        </div>

        <div className="flex gap-[2vw]" style={{ marginTop: "6vh" }}>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-primary" style={{ fontSize: "3.5vw" }}>7</div>
            <div className="font-body text-muted" style={{ fontSize: "1.2vw" }}>ROI Regions</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-cyan" style={{ fontSize: "3.5vw" }}>5</div>
            <div className="font-body text-muted" style={{ fontSize: "1.2vw" }}>Domains</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-primary" style={{ fontSize: "3.5vw" }}>3</div>
            <div className="font-body text-muted" style={{ fontSize: "1.2vw" }}>Panel Avatars</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-cyan" style={{ fontSize: "3.5vw" }}>60fps</div>
            <div className="font-body text-muted" style={{ fontSize: "1.2vw" }}>Real-time</div>
          </div>
        </div>

        <div className="font-body text-muted/40" style={{ fontSize: "1.2vw", marginTop: "8vh" }}>
          React + Three.js + MediaPipe + OpenAI
        </div>
      </div>
    </div>
  );
}
