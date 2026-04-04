export default function RPPGPipeline() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(0,212,255,0.05) 0%, transparent 60%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "5vh 5vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.2vw", marginBottom: "0.8vh" }}>
          Core Innovation
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.5vw" }}>
          rPPG Heart Rate Pipeline
        </h2>
        <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "0.5vh" }}>
          Remote photoplethysmography — detecting pulse from facial skin color variations via webcam
        </div>

        <div className="flex-1 flex" style={{ marginTop: "3vh", gap: "2vw" }}>

          <div className="flex flex-col" style={{ flex: 1, gap: "1.5vh" }}>
            <div className="rounded-xl border border-primary/30 p-[1.3vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-baseline gap-[0.8vw]">
                <div className="font-display font-bold text-primary/40" style={{ fontSize: "2vw" }}>01</div>
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.6vw" }}>Multi-ROI Capture</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "0.8vh", lineHeight: "1.5" }}>
                7 facial regions sampled per frame: forehead (FH), left/right cheeks (CK), nose bridge (NS), chin (CN), left/right temples (LT/RT), jawline (LJ/RJ). Canvas 2D pixel extraction with fallback to full-face strip if face area is less than 50px.
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 p-[1.3vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-baseline gap-[0.8vw]">
                <div className="font-display font-bold text-primary/40" style={{ fontSize: "2vw" }}>02</div>
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.6vw" }}>CHROM Algorithm</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "0.8vh", lineHeight: "1.5" }}>
                De Haan chrominance method separates pulse signal from motion noise. Computes X = 3R - 2G, Y = 1.5R + G - 1.5B, then S = X - alpha * Y where alpha = std(X)/std(Y). Buffer size of 300 frames.
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 p-[1.3vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-baseline gap-[0.8vw]">
                <div className="font-display font-bold text-primary/40" style={{ fontSize: "2vw" }}>03</div>
                <div className="font-display font-bold text-primary" style={{ fontSize: "1.6vw" }}>Butterworth BPF</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "0.8vh", lineHeight: "1.5" }}>
                2nd-order zero-phase bandpass filter (0.75-3.0Hz) isolates cardiac frequency band, rejecting respiration artifacts below 0.75Hz and motion noise above 3Hz.
              </div>
            </div>
          </div>

          <div className="flex flex-col" style={{ flex: 1, gap: "1.5vh" }}>
            <div className="rounded-xl border border-cyan/30 p-[1.3vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-baseline gap-[0.8vw]">
                <div className="font-display font-bold text-cyan/40" style={{ fontSize: "2vw" }}>04</div>
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.6vw" }}>FFT Spectral Analysis</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "0.8vh", lineHeight: "1.5" }}>
                Cooley-Tukey radix-2 FFT with Hamming window applied to reduce spectral leakage. Quadratic interpolation on power spectrum peak gives sub-bin frequency precision. BPM range locked to 45-180.
              </div>
            </div>
            <div className="rounded-xl border border-cyan/30 p-[1.3vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-baseline gap-[0.8vw]">
                <div className="font-display font-bold text-cyan/40" style={{ fontSize: "2vw" }}>05</div>
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.6vw" }}>IQR Outlier Rejection</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "0.8vh", lineHeight: "1.5" }}>
                Rolling 20-sample BPM history buffer. Computes Q1/Q3 interquartile range, rejects values outside Q1 - 1.5*IQR to Q3 + 1.5*IQR bounds. Prevents spike-through from motion artifacts.
              </div>
            </div>
            <div className="rounded-xl border border-cyan/30 p-[1.3vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="flex items-baseline gap-[0.8vw]">
                <div className="font-display font-bold text-cyan/40" style={{ fontSize: "2vw" }}>06</div>
                <div className="font-display font-bold text-cyan" style={{ fontSize: "1.6vw" }}>SQI + EMA Smoothing</div>
              </div>
              <div className="font-body text-muted" style={{ fontSize: "1.15vw", marginTop: "0.8vh", lineHeight: "1.5" }}>
                Signal Quality Index from spectral peak concentration ratio. EMA smoothing with base alpha=0.35 and jump-adaptive gain — alpha increases when BPM delta exceeds 8 to track rapid changes.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
