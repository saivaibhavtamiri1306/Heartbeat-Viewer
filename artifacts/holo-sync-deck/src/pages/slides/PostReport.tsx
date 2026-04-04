const base = import.meta.env.BASE_URL;

export default function PostReport() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <img
        src={`${base}report-dashboard.png`}
        crossOrigin="anonymous"
        alt="Report dashboard"
        className="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(6,11,24,0.93) 0%, rgba(6,11,24,0.8) 60%, rgba(6,11,24,0.93) 100%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "5vh 5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
          Performance Analysis
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
          Post-Interview Report
        </h2>
        <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "0.5vh" }}>
          Comprehensive analysis generated after each interview session
        </div>

        <div className="flex-1 flex" style={{ marginTop: "3vh", gap: "2vw" }}>

          <div className="flex flex-col" style={{ flex: 1, gap: "1.5vh" }}>
            <div className="font-display font-bold text-primary" style={{ fontSize: "1.5vw", marginBottom: "0.5vh" }}>
              Content Metrics
            </div>

            <div className="rounded-lg border border-primary/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.2vw" }}>Overall Score</div>
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.6vw" }}>1-10</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.3vh" }}>GPT-evaluated accuracy, depth, clarity per answer</div>
            </div>

            <div className="rounded-lg border border-primary/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.2vw" }}>Bluff Count</div>
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.6vw" }}>0-N</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.3vh" }}>Number of vague, incorrect, or contradictory answers</div>
            </div>

            <div className="rounded-lg border border-primary/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.2vw" }}>Answer Quality</div>
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.6vw" }}>A-F</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.3vh" }}>Specific feedback and ideal answer comparison</div>
            </div>
          </div>

          <div className="flex flex-col" style={{ flex: 1, gap: "1.5vh" }}>
            <div className="font-display font-bold text-cyan" style={{ fontSize: "1.5vw", marginBottom: "0.5vh" }}>
              Biometric Metrics
            </div>

            <div className="rounded-lg border border-cyan/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.2vw" }}>Avg Heart Rate</div>
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.6vw" }}>BPM</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.3vh" }}>Baseline vs peak stress delta tracked per question</div>
            </div>

            <div className="rounded-lg border border-cyan/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.2vw" }}>Eye Contact %</div>
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.6vw" }}>0-100</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.3vh" }}>Percentage of time user maintained camera eye contact</div>
            </div>

            <div className="rounded-lg border border-cyan/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="flex justify-between items-center">
                <div className="font-body text-text" style={{ fontSize: "1.2vw" }}>Stress Timeline</div>
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.6vw" }}>Graph</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1vw", marginTop: "0.3vh" }}>Heart rate overlay on question timeline with SQI confidence</div>
            </div>
          </div>

        </div>

        <div className="rounded-lg border border-muted/15 p-[1vw] flex justify-between items-center" style={{ marginTop: "1.5vh", background: "rgba(100,120,150,0.03)" }}>
          <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>
            Report includes per-question breakdown, strengths, weaknesses, and improvement areas
          </div>
          <div className="font-body text-muted/60" style={{ fontSize: "1vw" }}>
            Exportable summary format
          </div>
        </div>
      </div>
    </div>
  );
}
