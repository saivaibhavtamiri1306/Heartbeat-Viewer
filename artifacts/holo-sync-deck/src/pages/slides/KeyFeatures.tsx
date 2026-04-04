export default function KeyFeatures() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 60%, rgba(0,212,255,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 30%, rgba(119,0,255,0.04) 0%, transparent 50%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "6vh 6vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.3vw", marginBottom: "1vh" }}>
          Intelligent Features
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.8vw" }}>
          What Makes It Unique
        </h2>

        <div className="flex-1 grid grid-cols-2" style={{ marginTop: "4vh", gap: "2.5vw" }}>

          <div className="rounded-xl border border-primary/30 p-[2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-primary" style={{ fontSize: "2vw" }}>Bluff Detector</div>
            <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1.5vh" }}>
              AI cross-references answers with domain knowledge to detect inconsistencies, vague statements, and factual errors in real-time
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 p-[2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-primary" style={{ fontSize: "2vw" }}>Cross-Fire Panel</div>
            <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1.5vh" }}>
              3 distinct AI panelists with unique personalities (stern, empathetic, curious) take turns questioning the candidate
            </div>
          </div>

          <div className="rounded-xl border border-cyan/30 p-[2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-cyan" style={{ fontSize: "2vw" }}>Eye Contact Detection</div>
            <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1.5vh" }}>
              MediaPipe face mesh tracks gaze direction; the avatar reacts when the user looks away during their answer
            </div>
          </div>

          <div className="rounded-xl border border-cyan/30 p-[2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-cyan" style={{ fontSize: "2vw" }}>Stress-Adaptive Avatar</div>
            <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1.5vh" }}>
              3D holographic avatar changes color, emotion, and behavior based on detected heart rate and stress levels
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
