export default function InterviewDomains() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 50%, rgba(119,0,255,0.06) 0%, transparent 50%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "6vh 5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.3vw", marginBottom: "1vh" }}>
          Five Specialized Tracks
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.8vw" }}>
          Interview Domains
        </h2>

        <div className="flex-1 flex items-center" style={{ marginTop: "2vh" }}>
          <div className="grid grid-cols-5 w-full" style={{ gap: "1.5vw" }}>

            <div className="rounded-xl border border-primary/30 flex flex-col items-center" style={{ padding: "2.5vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary text-center" style={{ fontSize: "1.6vw" }}>UPSC</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1.1vw", marginTop: "1.5vh" }}>
                Civil Services panel interview with 3 AI panelists
              </div>
              <div className="font-body text-primary/60 text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                Cross-Fire Mode
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 flex flex-col items-center" style={{ padding: "2.5vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary text-center" style={{ fontSize: "1.6vw" }}>SWE</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1.1vw", marginTop: "1.5vh" }}>
                Full-stack, backend, system design, and DSA rounds
              </div>
              <div className="font-body text-primary/60 text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                Follow-ups
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 flex flex-col items-center" style={{ padding: "2.5vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary text-center" style={{ fontSize: "1.6vw" }}>NDA/SSB</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1.1vw", marginTop: "1.5vh" }}>
                Defence panel with 3 officers, rapid-fire situational
              </div>
              <div className="font-body text-primary/60 text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                Cross-Fire Mode
              </div>
            </div>

            <div className="rounded-xl border border-cyan/30 flex flex-col items-center" style={{ padding: "2.5vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-cyan text-center" style={{ fontSize: "1.6vw" }}>Medical</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1.1vw", marginTop: "1.5vh" }}>
                NEET PG entrance and clinical case discussions
              </div>
              <div className="font-body text-primary/60 text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                Case Study
              </div>
            </div>

            <div className="rounded-xl border border-cyan/30 flex flex-col items-center" style={{ padding: "2.5vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-cyan text-center" style={{ fontSize: "1.6vw" }}>IB</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1.1vw", marginTop: "1.5vh" }}>
                M and A, financial modeling, and valuation questions
              </div>
              <div className="font-body text-primary/60 text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                Technical
              </div>
            </div>

          </div>
        </div>

        <div className="flex justify-between items-center" style={{ marginTop: "2vh" }}>
          <div className="font-body text-muted" style={{ fontSize: "1.3vw" }}>
            Each domain includes difficulty levels (Easy / Medium / Hard) with adaptive answer time limits
          </div>
          <div className="flex gap-[1vw]">
            <div className="rounded-md border border-muted/30 px-[1vw] py-[0.5vh]">
              <span className="font-body text-muted" style={{ fontSize: "1.1vw" }}>120s / 90s / 60s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
