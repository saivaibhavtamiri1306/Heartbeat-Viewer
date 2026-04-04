const base = import.meta.env.BASE_URL;

export default function DataFlow() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <img
        src={`${base}architecture.png`}
        crossOrigin="anonymous"
        alt="Architecture visualization"
        className="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,11,24,0.92) 0%, rgba(6,11,24,0.75) 50%, rgba(6,11,24,0.95) 100%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "5vh 4.5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
          Real-Time Processing
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
          Interview Session Flow
        </h2>
        <div className="font-body text-muted" style={{ fontSize: "1.2vw", marginTop: "0.5vh" }}>
          Parallel biometric and conversational pipelines converge at the AI evaluation layer
        </div>

        <div className="flex-1 flex flex-col justify-center" style={{ gap: "3vh", marginTop: "1vh" }}>

          <div className="flex items-center justify-center" style={{ gap: "0.8vw" }}>
            <div className="font-body text-primary/40 tracking-widest uppercase" style={{ fontSize: "0.85vw", width: "8vw" }}>BIOMETRIC</div>
            <div className="rounded-lg border border-primary/40 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.2vw" }}>Webcam</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>30fps stream</div>
            </div>
            <div className="font-display text-primary/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-primary/40 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.2vw" }}>Face + 7 ROI</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>MediaPipe mesh</div>
            </div>
            <div className="font-display text-primary/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-cyan/50 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(0,212,255,0.10)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.2vw" }}>CHROM rPPG</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>BPM + SQI</div>
            </div>
            <div className="font-display text-primary/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-cyan/50 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(0,212,255,0.10)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.2vw" }}>Stress Index</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>Avatar emotion</div>
            </div>
          </div>

          <div className="flex items-center justify-center" style={{ gap: "0.8vw" }}>
            <div className="font-body text-muted/40 tracking-widest uppercase" style={{ fontSize: "0.85vw", width: "8vw" }}>INTERVIEW</div>
            <div className="rounded-lg border border-muted/30 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(100,120,150,0.04)" }}>
              <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>User Speaks</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>Web Speech API</div>
            </div>
            <div className="font-display text-muted/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-muted/30 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(100,120,150,0.04)" }}>
              <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>AI Evaluates</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>GPT-4o score</div>
            </div>
            <div className="font-display text-muted/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-muted/30 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(100,120,150,0.04)" }}>
              <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>TTS Response</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>4 voice presets</div>
            </div>
            <div className="font-display text-muted/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-muted/30 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(100,120,150,0.04)" }}>
              <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>Follow-Up</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>Adaptive probe</div>
            </div>
          </div>

          <div className="flex items-center justify-center" style={{ gap: "0.8vw" }}>
            <div className="font-body text-cyan/40 tracking-widest uppercase" style={{ fontSize: "0.85vw", width: "8vw" }}>OUTPUT</div>
            <div className="rounded-lg border border-cyan/40 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.2vw" }}>3D Avatar</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>Lip sync + glow</div>
            </div>
            <div className="font-display text-cyan/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-cyan/40 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.2vw" }}>Bluff Alert</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>Contradiction flag</div>
            </div>
            <div className="font-display text-cyan/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-cyan/40 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.2vw" }}>Score Card</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>Per-question 1-10</div>
            </div>
            <div className="font-display text-cyan/40" style={{ fontSize: "1.5vw" }}>→</div>
            <div className="rounded-lg border border-cyan/40 flex flex-col items-center justify-center" style={{ width: "12.5vw", height: "11vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.2vw" }}>Final Report</div>
              <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>Full analysis PDF</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
