export default function SystemArchitecture() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(0,212,255,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(119,0,255,0.04) 0%, transparent 50%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "6vh 6vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.3vw", marginBottom: "1vh" }}>
          Technical Overview
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "4vw" }}>
          System Architecture
        </h2>

        <div className="flex-1 flex items-center justify-center" style={{ marginTop: "3vh" }}>
          <div className="relative" style={{ width: "80vw", height: "55vh" }}>

            <div className="absolute rounded-xl border border-primary/40" style={{ left: "0vw", top: "0vh", width: "15vw", height: "12vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.5vw" }}>Webcam</div>
                <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>getUserMedia</div>
              </div>
            </div>

            <div className="absolute rounded-xl border border-primary/40" style={{ left: "22vw", top: "0vh", width: "15vw", height: "12vh", background: "rgba(0,212,255,0.06)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.5vw" }}>Face Detection</div>
                <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>MediaPipe</div>
              </div>
            </div>

            <div className="absolute rounded-xl border border-cyan/60" style={{ left: "44vw", top: "0vh", width: "16vw", height: "12vh", background: "rgba(0,212,255,0.10)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.5vw" }}>rPPG Engine</div>
                <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>CHROM + FFT</div>
              </div>
            </div>

            <div className="absolute rounded-xl border border-primary/40" style={{ left: "0vw", top: "18vh", width: "15vw", height: "12vh", background: "rgba(119,0,255,0.06)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold" style={{ fontSize: "1.5vw", color: "#a855f7" }}>Speech-to-Text</div>
                <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>Web Speech API</div>
              </div>
            </div>

            <div className="absolute rounded-xl border border-primary/40" style={{ left: "22vw", top: "18vh", width: "15vw", height: "12vh", background: "rgba(119,0,255,0.06)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold" style={{ fontSize: "1.5vw", color: "#a855f7" }}>AI Evaluator</div>
                <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>GPT-4 API</div>
              </div>
            </div>

            <div className="absolute rounded-xl border border-cyan/60" style={{ left: "44vw", top: "18vh", width: "16vw", height: "12vh", background: "rgba(0,212,255,0.10)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.5vw" }}>3D Avatar</div>
                <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>Three.js R3F</div>
              </div>
            </div>

            <div className="absolute rounded-xl border border-primary/40" style={{ left: "66vw", top: "9vh", width: "14vw", height: "12vh", background: "rgba(0,212,255,0.04)" }}>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="font-display font-bold text-text" style={{ fontSize: "1.5vw" }}>TTS Engine</div>
                <div className="font-body text-muted" style={{ fontSize: "1.1vw" }}>OpenAI / Fallback</div>
              </div>
            </div>

            <div className="absolute font-body text-primary/60" style={{ left: "16vw", top: "4.5vh", fontSize: "1.8vw" }}>→</div>
            <div className="absolute font-body text-primary/60" style={{ left: "38vw", top: "4.5vh", fontSize: "1.8vw" }}>→</div>
            <div className="absolute font-body text-primary/60" style={{ left: "16vw", top: "22.5vh", fontSize: "1.8vw" }}>→</div>
            <div className="absolute font-body text-primary/60" style={{ left: "38vw", top: "22.5vh", fontSize: "1.8vw" }}>→</div>
            <div className="absolute font-body text-primary/60" style={{ left: "61vw", top: "13vh", fontSize: "1.8vw" }}>→</div>

            <div className="absolute rounded-xl border-2 border-primary/20" style={{ left: "10vw", top: "36vh", width: "60vw", height: "15vh", background: "rgba(0,212,255,0.03)" }}>
              <div className="flex items-center justify-between h-full px-[3vw]">
                <div className="text-center">
                  <div className="font-display font-bold text-text" style={{ fontSize: "1.4vw" }}>Multi-ROI Sampling</div>
                  <div className="font-body text-muted" style={{ fontSize: "1vw" }}>Forehead + Cheeks + Nose + Chin + Temples + Jawline</div>
                </div>
                <div className="text-center">
                  <div className="font-display font-bold text-text" style={{ fontSize: "1.4vw" }}>Butterworth Filter</div>
                  <div className="font-body text-muted" style={{ fontSize: "1vw" }}>Zero-phase bandpass 0.75-3Hz</div>
                </div>
                <div className="text-center">
                  <div className="font-display font-bold text-text" style={{ fontSize: "1.4vw" }}>IQR Rejection</div>
                  <div className="font-body text-muted" style={{ fontSize: "1vw" }}>Outlier-resistant BPM smoothing</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
