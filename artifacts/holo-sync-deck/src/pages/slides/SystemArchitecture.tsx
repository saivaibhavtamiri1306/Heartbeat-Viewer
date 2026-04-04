export default function SystemArchitecture() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(0,212,255,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(119,0,255,0.04) 0%, transparent 50%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "5vh 5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
          Technical Overview
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
          System Architecture
        </h2>
        <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "0.5vh" }}>
          End-to-end pipeline: Webcam capture → biometric extraction → AI evaluation → avatar response
        </div>

        <div className="flex-1 flex items-center justify-center" style={{ marginTop: "2vh" }}>
          <div className="relative" style={{ width: "86vw", height: "58vh" }}>

            <div className="absolute font-body text-primary/50 tracking-widest uppercase" style={{ left: "0vw", top: "-2vh", fontSize: "0.9vw" }}>BIOMETRIC LAYER</div>

            <div className="absolute rounded-lg border border-primary/40" style={{ left: "0vw", top: "0vh", width: "13vw", height: "13vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.3vw" }}>Webcam</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>getUserMedia</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>30fps video</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/50" style={{ left: "13.5vw", top: "5.5vh", fontSize: "1.5vw" }}>→</div>

            <div className="absolute rounded-lg border border-primary/40" style={{ left: "16vw", top: "0vh", width: "13vw", height: "13vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.3vw" }}>Face Mesh</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>MediaPipe 468pt</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>Landmark detect</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/50" style={{ left: "29.5vw", top: "5.5vh", fontSize: "1.5vw" }}>→</div>

            <div className="absolute rounded-lg border border-cyan/60" style={{ left: "32vw", top: "0vh", width: "14vw", height: "13vh", background: "rgba(0,212,255,0.10)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.3vw" }}>ROI Extractor</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>7 facial regions</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>FH CK NS CN LT RT JL</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/50" style={{ left: "46.5vw", top: "5.5vh", fontSize: "1.5vw" }}>→</div>

            <div className="absolute rounded-lg border border-cyan/60" style={{ left: "49vw", top: "0vh", width: "14vw", height: "13vh", background: "rgba(0,212,255,0.10)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.3vw" }}>rPPG Engine</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>CHROM + FFT</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>BPM 45-180 range</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/50" style={{ left: "63.5vw", top: "5.5vh", fontSize: "1.5vw" }}>→</div>

            <div className="absolute rounded-lg border border-primary/40" style={{ left: "66vw", top: "0vh", width: "14vw", height: "13vh", background: "rgba(0,212,255,0.04)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-text" style={{ fontSize: "1.3vw" }}>Stress Index</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>SQI + EMA alpha</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>Confidence score</div>
              </div>
            </div>

            <div className="absolute font-body text-muted/40 tracking-widest uppercase" style={{ left: "0vw", top: "16vh", fontSize: "0.9vw" }}>INTERVIEW LAYER</div>

            <div className="absolute rounded-lg border border-primary/30" style={{ left: "0vw", top: "18vh", width: "13vw", height: "13vh", background: "rgba(119,0,255,0.05)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold" style={{ fontSize: "1.3vw", color: "#a855f7" }}>Speech-to-Text</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>webkitSpeechRecog</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>Continuous + interim</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/50" style={{ left: "13.5vw", top: "23.5vh", fontSize: "1.5vw" }}>→</div>

            <div className="absolute rounded-lg border border-primary/30" style={{ left: "16vw", top: "18vh", width: "13vw", height: "13vh", background: "rgba(119,0,255,0.05)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold" style={{ fontSize: "1.3vw", color: "#a855f7" }}>AI Evaluator</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>GPT-4o API</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>Score 1-10 + feedback</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/50" style={{ left: "29.5vw", top: "23.5vh", fontSize: "1.5vw" }}>→</div>

            <div className="absolute rounded-lg border border-primary/30" style={{ left: "32vw", top: "18vh", width: "14vw", height: "13vh", background: "rgba(119,0,255,0.05)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold" style={{ fontSize: "1.3vw", color: "#a855f7" }}>Bluff Detector</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>Fact-check engine</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>Vague/wrong detect</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/50" style={{ left: "46.5vw", top: "23.5vh", fontSize: "1.5vw" }}>→</div>

            <div className="absolute rounded-lg border border-cyan/50" style={{ left: "49vw", top: "18vh", width: "14vw", height: "13vh", background: "rgba(0,212,255,0.08)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.3vw" }}>3D Avatar</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>R3F + LeePerrySmith</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>Emotion-reactive</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/50" style={{ left: "63.5vw", top: "23.5vh", fontSize: "1.5vw" }}>→</div>

            <div className="absolute rounded-lg border border-primary/30" style={{ left: "66vw", top: "18vh", width: "14vw", height: "13vh", background: "rgba(0,212,255,0.04)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-text" style={{ fontSize: "1.3vw" }}>TTS Engine</div>
                <div className="font-body text-muted" style={{ fontSize: "0.95vw" }}>OpenAI / browser</div>
                <div className="font-body text-muted/60" style={{ fontSize: "0.85vw" }}>onyx echo fable nova</div>
              </div>
            </div>

            <div className="absolute rounded-lg border border-primary/15" style={{ left: "0vw", top: "36vh", width: "80vw", height: "12vh", background: "rgba(0,212,255,0.02)" }}>
              <div className="flex items-center justify-between h-full px-[2vw]">
                <div className="text-center">
                  <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>CHROM Signal</div>
                  <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>X=3R-2G, Y=1.5R+G-1.5B</div>
                </div>
                <div className="w-px h-[6vh]" style={{ background: "rgba(0,212,255,0.15)" }} />
                <div className="text-center">
                  <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>Butterworth BPF</div>
                  <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>2nd-order 0.75-3.0Hz</div>
                </div>
                <div className="w-px h-[6vh]" style={{ background: "rgba(0,212,255,0.15)" }} />
                <div className="text-center">
                  <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>FFT + Hamming</div>
                  <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>Radix-2 + sub-bin interp</div>
                </div>
                <div className="w-px h-[6vh]" style={{ background: "rgba(0,212,255,0.15)" }} />
                <div className="text-center">
                  <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>IQR Rejection</div>
                  <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>20-sample outlier filter</div>
                </div>
                <div className="w-px h-[6vh]" style={{ background: "rgba(0,212,255,0.15)" }} />
                <div className="text-center">
                  <div className="font-display font-bold text-text" style={{ fontSize: "1.2vw" }}>EMA Smooth</div>
                  <div className="font-body text-muted" style={{ fontSize: "0.9vw" }}>alpha=0.35 adaptive</div>
                </div>
              </div>
            </div>

            <div className="absolute font-body text-muted/30 tracking-widest uppercase" style={{ left: "0vw", top: "50vh", fontSize: "0.8vw" }}>SIGNAL PROCESSING PIPELINE</div>

          </div>
        </div>
      </div>
    </div>
  );
}
