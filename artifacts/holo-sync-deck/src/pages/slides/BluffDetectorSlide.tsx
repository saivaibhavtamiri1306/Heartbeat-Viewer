const base = import.meta.env.BASE_URL;

export default function BluffDetectorSlide() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <img
        src={`${base}eye-tracking.png`}
        crossOrigin="anonymous"
        alt="Eye tracking biometric scan"
        className="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(6,11,24,0.93) 0%, rgba(6,11,24,0.8) 50%, rgba(6,11,24,0.93) 100%)" }} />

      <div className="relative z-10 flex h-full">

        <div className="flex flex-col justify-center" style={{ width: "50vw", padding: "5vh 5vw" }}>
          <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
            Integrity Analysis
          </div>
          <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
            Bluff Detector
          </h2>
          <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1vh", lineHeight: "1.5" }}>
            AI cross-references answers against domain knowledge base to detect inconsistencies in real-time
          </div>

          <div className="flex flex-col" style={{ marginTop: "3vh", gap: "1.5vh" }}>
            <div className="rounded-lg border border-primary/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.4vw" }}>Factual Verification</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Cross-checks dates, names, formulas, and technical claims against GPT knowledge base
              </div>
            </div>
            <div className="rounded-lg border border-primary/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.4vw" }}>Vagueness Detection</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Flags overly generic answers lacking specifics — triggers probing follow-up questions
              </div>
            </div>
            <div className="rounded-lg border border-primary/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.4vw" }}>Contradiction Tracking</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Compares current answer against previous responses to detect internal inconsistencies
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center" style={{ width: "45vw", padding: "5vh 4vw 5vh 0" }}>
          <div className="font-body text-cyan tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "2vh" }}>
            Behavioral Monitoring
          </div>
          <h3 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "2.5vw" }}>
            Eye Contact Detection
          </h3>
          <div className="font-body text-muted" style={{ fontSize: "1.2vw", marginTop: "1vh", lineHeight: "1.5" }}>
            MediaPipe face mesh tracks 468 landmarks to determine gaze direction and eye contact with the camera
          </div>

          <div className="flex flex-col" style={{ marginTop: "2.5vh", gap: "1.5vh" }}>
            <div className="rounded-lg border border-cyan/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.4vw" }}>Gaze Vector</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Iris landmark positions compute horizontal and vertical gaze deviation from center
              </div>
            </div>
            <div className="rounded-lg border border-cyan/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.4vw" }}>Avatar Response</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                3D avatar reacts when user looks away — verbal nudge to maintain eye contact during answers
              </div>
            </div>
            <div className="rounded-lg border border-cyan/25 p-[1.2vw]" style={{ background: "rgba(0,212,255,0.03)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.4vw" }}>Report Scoring</div>
              <div className="font-body text-muted" style={{ fontSize: "1.1vw", marginTop: "0.5vh" }}>
                Eye contact percentage tracked per question for the post-interview behavioral report
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
