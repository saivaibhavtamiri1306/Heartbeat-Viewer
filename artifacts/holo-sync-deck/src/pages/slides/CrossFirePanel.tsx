const base = import.meta.env.BASE_URL;

export default function CrossFirePanel() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <img
        src={`${base}crossfire-panel.png`}
        crossOrigin="anonymous"
        alt="Panel interview avatars"
        className="absolute inset-0 w-full h-full object-cover opacity-25"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,11,24,0.92) 0%, rgba(6,11,24,0.75) 50%, rgba(6,11,24,0.95) 100%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "5vh 5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
          Multi-Panelist Simulation
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
          Cross-Fire Panel Mode
        </h2>
        <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "0.5vh" }}>
          Three distinct AI interviewers with unique personalities interrogate the candidate in rotation
        </div>

        <div className="flex-1 flex items-center" style={{ marginTop: "2vh" }}>
          <div className="grid grid-cols-3 w-full" style={{ gap: "2vw" }}>

            <div className="rounded-xl border border-primary/35 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-center gap-[0.8vw]" style={{ marginBottom: "1.5vh" }}>
                <div className="rounded-full" style={{ width: "1vw", height: "1vw", background: "#00d4ff" }} />
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.8vw" }}>The Stern</div>
              </div>
              <div className="font-body text-text" style={{ fontSize: "1.2vw", marginBottom: "1vh" }}>
                Chairman persona. Direct, no-nonsense questioning. Probes for weak points in answers.
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", lineHeight: "1.6" }}>
                Challenges factual accuracy, demands specific examples, tests under pressure. Uses shorter follow-up questions.
              </div>
              <div className="rounded-md border border-primary/15 mt-[1.5vh] p-[0.8vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
                <div className="font-body text-primary/60" style={{ fontSize: "0.95vw" }}>Voice: onyx (deep, authoritative)</div>
              </div>
            </div>

            <div className="rounded-xl border border-cyan/35 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-center gap-[0.8vw]" style={{ marginBottom: "1.5vh" }}>
                <div className="rounded-full" style={{ width: "1vw", height: "1vw", background: "#a855f7" }} />
                <div className="font-display font-bold" style={{ fontSize: "1.8vw", color: "#a855f7" }}>The Empathetic</div>
              </div>
              <div className="font-body text-text" style={{ fontSize: "1.2vw", marginBottom: "1vh" }}>
                Supportive persona. Encourages elaboration and personal reflection.
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", lineHeight: "1.6" }}>
                Asks about motivation, values, and thought process. Creates comfortable space, then pivots to deeper probing.
              </div>
              <div className="rounded-md border border-cyan/15 mt-[1.5vh] p-[0.8vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
                <div className="font-body text-cyan/60" style={{ fontSize: "0.95vw" }}>Voice: nova (warm, conversational)</div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/35 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-center gap-[0.8vw]" style={{ marginBottom: "1.5vh" }}>
                <div className="rounded-full" style={{ width: "1vw", height: "1vw", background: "#22c55e" }} />
                <div className="font-display font-bold" style={{ fontSize: "1.8vw", color: "#22c55e" }}>The Curious</div>
              </div>
              <div className="font-body text-text" style={{ fontSize: "1.2vw", marginBottom: "1vh" }}>
                Technical expert persona. Digs into details and edge cases.
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", lineHeight: "1.6" }}>
                Asks hypothetical scenarios, what-if questions, and requests justification for every claim. Tests depth of knowledge.
              </div>
              <div className="rounded-md border border-primary/15 mt-[1.5vh] p-[0.8vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
                <div className="font-body text-muted/60" style={{ fontSize: "0.95vw" }}>Voice: fable (inquisitive, measured)</div>
              </div>
            </div>

          </div>
        </div>

        <div className="rounded-lg border border-muted/15 p-[1.2vw] flex justify-between items-center" style={{ background: "rgba(100,120,150,0.03)" }}>
          <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>
            Active in UPSC and NDA/SSB domains with automatic turn rotation
          </div>
          <div className="font-body text-muted/60" style={{ fontSize: "1vw" }}>
            activeSpeakerIndex cycles per question round
          </div>
        </div>
      </div>
    </div>
  );
}
