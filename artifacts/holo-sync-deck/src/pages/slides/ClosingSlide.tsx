export default function ClosingSlide() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(0,212,255,0.08) 0%, rgba(119,0,255,0.04) 30%, transparent 60%)" }} />
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.01) 3px, rgba(0,212,255,0.01) 4px)" }} />

      <div className="relative z-10 flex flex-col justify-center items-center h-full text-center">
        <div className="font-body text-primary/70 tracking-widest uppercase" style={{ fontSize: "1.3vw", marginBottom: "2.5vh", letterSpacing: "0.35em" }}>
          Universal Biometric Interviewer
        </div>

        <h1 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "6.5vw", lineHeight: "1.1" }}>
          HOLO-SYNC
        </h1>

        <div className="font-body text-muted" style={{ fontSize: "1.6vw", marginTop: "2.5vh", maxWidth: "55vw", lineHeight: "1.5" }}>
          Where biometrics meet artificial intelligence — real-time heart rate detection, photorealistic 3D avatar, and AI-powered evaluation converge to create the most realistic interview simulation platform
        </div>

        <div className="flex gap-[2.5vw]" style={{ marginTop: "5vh" }}>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-primary" style={{ fontSize: "3.2vw" }}>7</div>
            <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>ROI Regions</div>
            <div className="font-body text-muted/40" style={{ fontSize: "0.85vw" }}>FH CK NS CN LT RT JL</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-cyan" style={{ fontSize: "3.2vw" }}>5</div>
            <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>Domains</div>
            <div className="font-body text-muted/40" style={{ fontSize: "0.85vw" }}>UPSC SWE NDA Med IB</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-primary" style={{ fontSize: "3.2vw" }}>3</div>
            <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>Panel Avatars</div>
            <div className="font-body text-muted/40" style={{ fontSize: "0.85vw" }}>Stern Empath Curious</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-cyan" style={{ fontSize: "3.2vw" }}>300</div>
            <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>Frame Buffer</div>
            <div className="font-body text-muted/40" style={{ fontSize: "0.85vw" }}>CHROM + Butterworth</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-display font-bold text-primary" style={{ fontSize: "3.2vw" }}>60fps</div>
            <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>Real-time</div>
            <div className="font-body text-muted/40" style={{ fontSize: "0.85vw" }}>3D render + rPPG</div>
          </div>
        </div>

        <div className="flex items-center gap-[2vw]" style={{ marginTop: "5vh" }}>
          <div className="font-body text-muted/30" style={{ fontSize: "1.1vw" }}>React</div>
          <div className="text-muted/20">|</div>
          <div className="font-body text-muted/30" style={{ fontSize: "1.1vw" }}>Three.js</div>
          <div className="text-muted/20">|</div>
          <div className="font-body text-muted/30" style={{ fontSize: "1.1vw" }}>MediaPipe</div>
          <div className="text-muted/20">|</div>
          <div className="font-body text-muted/30" style={{ fontSize: "1.1vw" }}>OpenAI</div>
          <div className="text-muted/20">|</div>
          <div className="font-body text-muted/30" style={{ fontSize: "1.1vw" }}>WebRTC</div>
          <div className="text-muted/20">|</div>
          <div className="font-body text-muted/30" style={{ fontSize: "1.1vw" }}>Express</div>
        </div>
      </div>
    </div>
  );
}
