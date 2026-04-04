export default function InterviewDomains() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 50%, rgba(119,0,255,0.06) 0%, transparent 50%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "5vh 4.5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
          Five Specialized Tracks
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
          Interview Domains
        </h2>

        <div className="flex-1 flex items-center" style={{ marginTop: "1.5vh" }}>
          <div className="grid grid-cols-5 w-full" style={{ gap: "1.2vw" }}>

            <div className="rounded-xl border border-primary/30 flex flex-col" style={{ padding: "2vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary text-center" style={{ fontSize: "1.5vw" }}>UPSC</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                Civil Services panel interview with 3 AI panelists in Cross-Fire mode
              </div>
              <div className="mt-auto" style={{ paddingTop: "1.5vh" }}>
                <div className="rounded-md border border-primary/20 text-center py-[0.4vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
                  <span className="font-body text-primary/70" style={{ fontSize: "0.9vw" }}>Cross-Fire Panel</span>
                </div>
              </div>
              <div className="font-body text-muted/50 text-center" style={{ fontSize: "0.85vw", marginTop: "0.8vh" }}>
                GS, Ethics, Polity, Economy
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 flex flex-col" style={{ padding: "2vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary text-center" style={{ fontSize: "1.5vw" }}>SWE</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                Full-stack, backend, system design, and DSA coding rounds
              </div>
              <div className="mt-auto" style={{ paddingTop: "1.5vh" }}>
                <div className="rounded-md border border-primary/20 text-center py-[0.4vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
                  <span className="font-body text-primary/70" style={{ fontSize: "0.9vw" }}>AI Follow-ups</span>
                </div>
              </div>
              <div className="font-body text-muted/50 text-center" style={{ fontSize: "0.85vw", marginTop: "0.8vh" }}>
                React, Node, SQL, Algo
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 flex flex-col" style={{ padding: "2vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary text-center" style={{ fontSize: "1.5vw" }}>NDA/SSB</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                Defence panel with 3 officers, rapid-fire situational questions
              </div>
              <div className="mt-auto" style={{ paddingTop: "1.5vh" }}>
                <div className="rounded-md border border-primary/20 text-center py-[0.4vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
                  <span className="font-body text-primary/70" style={{ fontSize: "0.9vw" }}>Cross-Fire Panel</span>
                </div>
              </div>
              <div className="font-body text-muted/50 text-center" style={{ fontSize: "0.85vw", marginTop: "0.8vh" }}>
                OLQ, TAT, WAT, SRT
              </div>
            </div>

            <div className="rounded-xl border border-cyan/30 flex flex-col" style={{ padding: "2vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-cyan text-center" style={{ fontSize: "1.5vw" }}>Medical</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                NEET PG entrance and clinical case study discussion format
              </div>
              <div className="mt-auto" style={{ paddingTop: "1.5vh" }}>
                <div className="rounded-md border border-cyan/20 text-center py-[0.4vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
                  <span className="font-body text-cyan/70" style={{ fontSize: "0.9vw" }}>Case Study</span>
                </div>
              </div>
              <div className="font-body text-muted/50 text-center" style={{ fontSize: "0.85vw", marginTop: "0.8vh" }}>
                Anatomy, Pharma, Path
              </div>
            </div>

            <div className="rounded-xl border border-cyan/30 flex flex-col" style={{ padding: "2vh 1vw", background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-cyan text-center" style={{ fontSize: "1.5vw" }}>IB</div>
              <div className="font-body text-muted text-center" style={{ fontSize: "1vw", marginTop: "1vh" }}>
                M and A, financial modeling, valuation, and market sizing
              </div>
              <div className="mt-auto" style={{ paddingTop: "1.5vh" }}>
                <div className="rounded-md border border-cyan/20 text-center py-[0.4vh]" style={{ background: "rgba(0,212,255,0.06)" }}>
                  <span className="font-body text-cyan/70" style={{ fontSize: "0.9vw" }}>Technical Deep</span>
                </div>
              </div>
              <div className="font-body text-muted/50 text-center" style={{ fontSize: "0.85vw", marginTop: "0.8vh" }}>
                DCF, LBO, Comps
              </div>
            </div>

          </div>
        </div>

        <div className="flex justify-between items-center rounded-lg border border-muted/15 p-[1.2vw]" style={{ marginTop: "1.5vh", background: "rgba(100,120,150,0.03)" }}>
          <div className="font-body text-muted" style={{ fontSize: "1.2vw" }}>
            Difficulty-adaptive answer time limits per domain
          </div>
          <div className="flex gap-[1.5vw]">
            <div className="text-center">
              <div className="font-display font-bold text-text" style={{ fontSize: "1.4vw" }}>120s</div>
              <div className="font-body text-muted/60" style={{ fontSize: "0.9vw" }}>Easy</div>
            </div>
            <div className="text-center">
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.4vw" }}>90s</div>
              <div className="font-body text-muted/60" style={{ fontSize: "0.9vw" }}>Medium</div>
            </div>
            <div className="text-center">
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.4vw" }}>60s</div>
              <div className="font-body text-muted/60" style={{ fontSize: "0.9vw" }}>Hard</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
