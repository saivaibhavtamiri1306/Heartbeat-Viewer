const base = import.meta.env.BASE_URL;

export default function DataFlow() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <img
        src={`${base}architecture.png`}
        crossOrigin="anonymous"
        alt="Architecture visualization"
        className="absolute inset-0 w-full h-full object-cover opacity-25"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,11,24,0.9) 0%, rgba(6,11,24,0.7) 50%, rgba(6,11,24,0.95) 100%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "6vh 6vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.3vw", marginBottom: "1vh" }}>
          Real-Time Processing
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.8vw" }}>
          Interview Flow
        </h2>

        <div className="flex-1 flex items-center justify-center" style={{ marginTop: "2vh" }}>
          <div className="flex items-center" style={{ gap: "1.5vw" }}>

            <div className="rounded-xl border border-primary/40 flex flex-col items-center justify-center" style={{ width: "13vw", height: "14vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.4vw" }}>User Webcam</div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.5vh" }}>Video stream</div>
            </div>

            <div className="font-display text-primary/50" style={{ fontSize: "2vw" }}>→</div>

            <div className="rounded-xl border border-primary/40 flex flex-col items-center justify-center" style={{ width: "13vw", height: "14vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.4vw" }}>Face + ROI</div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.5vh" }}>7 facial zones</div>
            </div>

            <div className="font-display text-primary/50" style={{ fontSize: "2vw" }}>→</div>

            <div className="rounded-xl border border-cyan/50 flex flex-col items-center justify-center" style={{ width: "13vw", height: "14vh", background: "rgba(0,212,255,0.10)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.4vw" }}>rPPG + BPM</div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.5vh" }}>CHROM algorithm</div>
            </div>

            <div className="font-display text-primary/50" style={{ fontSize: "2vw" }}>→</div>

            <div className="rounded-xl border border-cyan/50 flex flex-col items-center justify-center" style={{ width: "13vw", height: "14vh", background: "rgba(0,212,255,0.10)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.4vw" }}>AI Avatar</div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.5vh" }}>Emotion adapt</div>
            </div>

          </div>
        </div>

        <div className="flex items-center justify-center" style={{ marginTop: "1vh" }}>
          <div className="flex items-center" style={{ gap: "1.5vw" }}>

            <div className="rounded-xl border border-muted/30 flex flex-col items-center justify-center" style={{ width: "13vw", height: "14vh", background: "rgba(100,120,150,0.04)" }}>
              <div className="font-display font-bold text-text" style={{ fontSize: "1.4vw" }}>User Speaks</div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.5vh" }}>Web Speech API</div>
            </div>

            <div className="font-display text-muted/50" style={{ fontSize: "2vw" }}>→</div>

            <div className="rounded-xl border border-muted/30 flex flex-col items-center justify-center" style={{ width: "13vw", height: "14vh", background: "rgba(100,120,150,0.04)" }}>
              <div className="font-display font-bold text-text" style={{ fontSize: "1.4vw" }}>AI Evaluates</div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.5vh" }}>Score + followup</div>
            </div>

            <div className="font-display text-muted/50" style={{ fontSize: "2vw" }}>→</div>

            <div className="rounded-xl border border-muted/30 flex flex-col items-center justify-center" style={{ width: "13vw", height: "14vh", background: "rgba(100,120,150,0.04)" }}>
              <div className="font-display font-bold text-text" style={{ fontSize: "1.4vw" }}>TTS Response</div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.5vh" }}>OpenAI voices</div>
            </div>

            <div className="font-display text-muted/50" style={{ fontSize: "2vw" }}>→</div>

            <div className="rounded-xl border border-muted/30 flex flex-col items-center justify-center" style={{ width: "13vw", height: "14vh", background: "rgba(100,120,150,0.04)" }}>
              <div className="font-display font-bold text-text" style={{ fontSize: "1.4vw" }}>Post Report</div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.5vh" }}>Score summary</div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
