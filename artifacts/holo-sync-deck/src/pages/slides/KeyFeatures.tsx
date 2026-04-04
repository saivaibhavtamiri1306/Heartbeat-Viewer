export default function KeyFeatures() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 60%, rgba(0,212,255,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 30%, rgba(119,0,255,0.04) 0%, transparent 50%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "5vh 5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
          Differentiators
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
          Intelligent Features
        </h2>

        <div className="flex-1 grid grid-cols-2" style={{ marginTop: "3vh", gap: "1.5vw" }}>

          <div className="rounded-xl border border-primary/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-primary" style={{ fontSize: "1.8vw" }}>Stress-Adaptive Avatar</div>
            <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "1vh", lineHeight: "1.5" }}>
              The 3D holographic avatar changes glow color from cyan (calm) to orange (stressed) based on real-time rPPG heart rate data. Avatar emotion shifts between neutral, concerned, and encouraging states.
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-primary" style={{ fontSize: "1.8vw" }}>AI Follow-Up Engine</div>
            <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "1vh", lineHeight: "1.5" }}>
              GPT-4o generates contextual follow-up questions based on the candidate's previous answer. Probes deeper when answers are surface-level or incomplete. Each follow-up adapts difficulty.
            </div>
          </div>

          <div className="rounded-xl border border-cyan/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-cyan" style={{ fontSize: "1.8vw" }}>Answer Timer System</div>
            <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "1vh", lineHeight: "1.5" }}>
              Visual countdown timer with color transitions: green (ample time) → yellow (halfway) → red (last 15s). Auto-submits when time expires. Time limits adapt per difficulty: Easy 120s, Medium 90s, Hard 60s.
            </div>
          </div>

          <div className="rounded-xl border border-cyan/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
            <div className="font-display font-bold text-cyan" style={{ fontSize: "1.8vw" }}>Multi-Voice TTS</div>
            <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "1vh", lineHeight: "1.5" }}>
              OpenAI Text-to-Speech with 4 distinct voices (onyx, echo, fable, nova) assigned to different panelists. Falls back to browser SpeechSynthesis when API is unavailable. Avatar mouth sync.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
