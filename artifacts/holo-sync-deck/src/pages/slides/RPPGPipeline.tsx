export default function RPPGPipeline() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(0,212,255,0.05) 0%, transparent 60%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "6vh 6vw" }}>
        <div className="font-body text-primary tracking-widest uppercase" style={{ fontSize: "1.3vw", marginBottom: "1vh" }}>
          Core Innovation
        </div>
        <h2 className="font-display font-bold text-text tracking-tight" style={{ fontSize: "3.8vw" }}>
          rPPG Heart Rate Pipeline
        </h2>

        <div className="flex-1 flex" style={{ marginTop: "4vh", gap: "3vw" }}>

          <div className="flex flex-col" style={{ flex: 1, gap: "2vh" }}>
            <div className="rounded-xl border border-primary/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.8vw" }}>1. Multi-ROI Capture</div>
              <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1vh" }}>
                7 facial regions sampled simultaneously: forehead, both cheeks, nose bridge, chin, left and right temples, jawline
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.8vw" }}>2. CHROM Algorithm</div>
              <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1vh" }}>
                De Haan chrominance method: X = 3R - 2G, Y = 1.5R + G - 1.5B, then S = X - alpha * Y for motion robustness
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-primary" style={{ fontSize: "1.8vw" }}>3. Butterworth Filter</div>
              <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1vh" }}>
                2nd-order zero-phase bandpass (0.75-3Hz) isolates cardiac frequency, rejects motion artifacts
              </div>
            </div>
          </div>

          <div className="flex flex-col" style={{ flex: 1, gap: "2vh" }}>
            <div className="rounded-xl border border-cyan/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.8vw" }}>4. FFT Analysis</div>
              <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1vh" }}>
                Cooley-Tukey radix-2 FFT with Hamming window and quadratic interpolation for sub-bin frequency precision
              </div>
            </div>
            <div className="rounded-xl border border-cyan/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.8vw" }}>5. IQR Rejection</div>
              <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1vh" }}>
                Rolling 20-sample BPM history with IQR-based outlier filtering (Q1 - 1.5*IQR to Q3 + 1.5*IQR)
              </div>
            </div>
            <div className="rounded-xl border border-cyan/30 p-[1.5vw]" style={{ background: "rgba(0,212,255,0.04)" }}>
              <div className="font-display font-bold text-cyan" style={{ fontSize: "1.8vw" }}>6. SQI + EMA</div>
              <div className="font-body text-muted" style={{ fontSize: "1.3vw", marginTop: "1vh" }}>
                Signal Quality Index from spectral concentration, EMA smoothing (alpha=0.35) with jump-adaptive gain
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
