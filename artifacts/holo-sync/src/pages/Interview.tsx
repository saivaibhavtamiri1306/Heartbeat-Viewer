import { useState, useEffect, useRef, useCallback } from "react";
import Avatar3D from "../components/Avatar3D";
import HeartbeatMonitor from "../components/HeartbeatMonitor";
import WebcamFeed from "../components/WebcamFeed";
import InterviewChat, { ChatMessage } from "../components/InterviewChat";
import StudentAnalytics from "../components/StudentAnalytics";
import { useWebcam } from "../hooks/useWebcam";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import type { FaceBox } from "../hooks/useFaceDetection";
import {
  QUESTIONS,
  EMPATHY_RESPONSES,
  BLUFF_RESPONSES,
  PANEL_AVATARS,
  type Domain,
} from "../data/questions";

interface InterviewProps {
  domain: Domain;
  onEnd: () => void;
}

type Phase = "starting" | "active" | "paused" | "ended";
type AvatarEmotion = "neutral" | "empathetic" | "stern" | "curious" | "stressed";

export default function Interview({ domain, onEnd }: InterviewProps) {
  const { videoRef, isActive: camActive, error: camError, startWebcam, stopWebcam } = useWebcam();
  const faceBoxRef     = useRef<FaceBox | null>(null);
  const foreheadBoxRef = useRef<FaceBox | null>(null);
  const cheekBoxRef    = useRef<FaceBox | null>(null);
  const { data: heartData, start: startHeartbeat, stop: stopHeartbeat, panic, calm } = useHeartbeat(videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef);
  const face = useFaceDetection(videoRef);
  const { data: speech, startListening, stopListening, clearCurrentAnswer } = useSpeechRecognition();

  useEffect(() => { faceBoxRef.current     = face.box         ?? null; }, [face.box]);
  useEffect(() => { foreheadBoxRef.current = face.foreheadBox ?? null; }, [face.foreheadBox]);
  useEffect(() => { cheekBoxRef.current    = face.cheekBox    ?? null; }, [face.cheekBox]);

  const [phase, setPhase] = useState<Phase>("starting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [avatarEmotion, setAvatarEmotion] = useState<AvatarEmotion>("neutral");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [bluffDetected, setBluffDetected] = useState(false);
  const [empathyMode, setEmpathyMode] = useState(false);
  const [lastStressCheck, setLastStressCheck] = useState(0);
  const [score, setScore] = useState({ communication: 0, technical: 0, stress: 100 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [answerCount, setAnswerCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const questions = QUESTIONS[domain.id] || QUESTIONS.swe;
  const panelAvatars =
    domain.panelMode
      ? PANEL_AVATARS[domain.id as keyof typeof PANEL_AVATARS] || PANEL_AVATARS.upsc
      : undefined;

  // Sync mic interim speech → input field
  useEffect(() => {
    if (!micOn) return;
    // Show interim as live preview while still speaking
    if (speech.interimText) {
      setUserInput(speech.finalText + " " + speech.interimText);
    } else if (speech.finalText) {
      setUserInput(speech.finalText);
    }
  }, [speech.interimText, speech.finalText, micOn]);

  const toggleMic = useCallback(() => {
    if (micOn) {
      stopListening();
      setMicOn(false);
    } else {
      clearCurrentAnswer();
      setUserInput("");
      startListening();
      setMicOn(true);
      inputRef.current?.focus();
    }
  }, [micOn, startListening, stopListening, clearCurrentAnswer]);

  const addMessage = useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages(prev => [...prev, {
      ...msg,
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    }]);
  }, []);

  const speakMessage = useCallback(async (text: string, avatarName?: string, flagged?: boolean) => {
    setIsTyping(true);
    const delay = Math.min(1800, text.length * 22);
    await new Promise(r => setTimeout(r, delay));
    setIsTyping(false);
    setIsSpeaking(true);
    addMessage({ role: "avatar", text, avatarName, flagged });

    // Pause mic while avatar speaks
    if (micOn) stopListening();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.88;
      utter.pitch = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const pick = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google"))
        || voices.find(v => v.lang.startsWith("en"))
        || voices[0];
      if (pick) utter.voice = pick;
      utter.onend = () => {
        setIsSpeaking(false);
        // Resume mic after avatar finishes speaking
        if (micOn) { clearCurrentAnswer(); startListening(); }
      };
      utter.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(() => {
        setIsSpeaking(false);
        if (micOn) { clearCurrentAnswer(); startListening(); }
      }, 3200);
    }
  }, [addMessage, micOn, startListening, stopListening, clearCurrentAnswer]);

  useEffect(() => {
    const init = async () => {
      addMessage({ role: "system", text: "⚡ HOLO-SYNC INITIALIZING — BIOMETRIC CALIBRATION IN PROGRESS" });
      await new Promise(r => setTimeout(r, 1500));
      try {
        await startWebcam();
        await new Promise(r => setTimeout(r, 800));
        startHeartbeat();
        addMessage({ role: "system", text: "✓ CAMERA ACTIVE — rPPG HEARTBEAT TRACKING ONLINE" });
      } catch {
        addMessage({ role: "system", text: "⚠ CAMERA UNAVAILABLE — SIMULATION MODE ACTIVE" });
      }
      await new Promise(r => setTimeout(r, 1000));
      addMessage({
        role: "system",
        text: `DOMAIN: ${domain.label.toUpperCase()} | ${domain.panelMode ? "PANEL MODE — 3 INTERVIEWERS" : "SINGLE INTERVIEWER MODE"}`,
      });
      addMessage({ role: "system", text: "🎤 MIC AVAILABLE — Click the mic button to speak your answers" });
      await new Promise(r => setTimeout(r, 1000));
      setPhase("active");
      await askNextQuestion(0);
    };
    init();
    return () => {
      stopWebcam(); stopHeartbeat();
      stopListening();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "active") return;
    if (heartData.stress === "high" && Date.now() - lastStressCheck > 20000) {
      setLastStressCheck(Date.now());
      triggerEmpathy();
    }
  }, [heartData.stress, phase]);

  const askNextQuestion = useCallback(async (index: number) => {
    if (index >= questions.length) { endInterview(); return; }
    const q = questions[index];
    setCurrentQuestionIndex(index);
    if (q.isInterrupt && domain.panelMode) {
      setAvatarEmotion("stern");
      addMessage({ role: "system", text: `⚡ INTERRUPT — ${q.avatarName} INTERVENES` });
      await new Promise(r => setTimeout(r, 500));
    } else {
      setAvatarEmotion("neutral");
    }
    await speakMessage(q.text, q.avatarName);
  }, [questions, domain.panelMode, speakMessage, addMessage]);

  const triggerEmpathy = useCallback(async () => {
    setEmpathyMode(true);
    setAvatarEmotion("empathetic");
    const response = EMPATHY_RESPONSES[Math.floor(Math.random() * EMPATHY_RESPONSES.length)];
    addMessage({ role: "system", text: "♥ HIGH HEART RATE DETECTED — EMPATHY MODE ACTIVATED" });
    await speakMessage(response, "HOLO-AI");
    setTimeout(() => { setEmpathyMode(false); setAvatarEmotion("neutral"); }, 5000);
  }, [addMessage, speakMessage]);

  const handleSubmitAnswer = useCallback(async () => {
    const text = (userInput || speech.finalText).trim();
    if (!text || phase !== "active") return;

    // Stop mic on submit
    if (micOn) { stopListening(); setMicOn(false); }
    clearCurrentAnswer();
    setUserInput("");

    addMessage({ role: "candidate", text });
    setAnswerCount(c => c + 1);

    // Score update: also weight by vocabulary & confidence from speech analytics
    const vocabBonus = Math.round(speech.analytics.vocabularyScore * 0.04);
    const confBonus = Math.round(speech.analytics.confidenceScore * 0.04);
    setScore(prev => ({
      ...prev,
      communication: Math.min(100, prev.communication + 7 + vocabBonus + Math.floor(Math.random() * 4)),
      technical: Math.min(100, prev.technical + 5 + confBonus + Math.floor(Math.random() * 7)),
    }));

    const currentQ = questions[currentQuestionIndex];
    await new Promise(r => setTimeout(r, 700));

    if (currentQ?.isBullshitTrigger && text.length > 20) {
      setBluffDetected(true);
      setAvatarEmotion("curious");
      addMessage({ role: "system", text: "🔍 BULLSHIT DETECTOR TRIGGERED — DRILLING DEEPER" });
      const drillDown = BLUFF_RESPONSES[Math.floor(Math.random() * BLUFF_RESPONSES.length)];
      await speakMessage(drillDown, currentQ.avatarName, true);
      setTimeout(() => setBluffDetected(false), 8000);
    } else {
      await askNextQuestion(currentQuestionIndex + 1);
    }
  }, [userInput, speech, phase, micOn, questions, currentQuestionIndex,
      addMessage, speakMessage, askNextQuestion, stopListening, clearCurrentAnswer]);

  const endInterview = useCallback(async () => {
    setPhase("ended");
    stopWebcam(); stopHeartbeat(); stopListening(); setMicOn(false);
    window.speechSynthesis?.cancel();
    const finalScore = Math.round((score.communication + score.technical + score.stress) / 3);
    addMessage({ role: "system", text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" });
    addMessage({ role: "system", text: `INTERVIEW COMPLETE — FINAL SCORE: ${finalScore}/100` });
    setAvatarEmotion("neutral");
    await speakMessage(
      `Interview complete. Thank you for your time. You demonstrated ${finalScore > 70 ? "strong" : "developing"} capability. ${
        speech.analytics.fillerCount > 5
          ? "Work on reducing filler words like um and uh."
          : "Your speech delivery was clear."
      } ${heartData.stress === "high" ? "Biometrics showed elevated stress — practise deep breathing." : "Good composure throughout."}`,
      "HOLO-AI"
    );
  }, [score, heartData.stress, speech.analytics, stopWebcam, stopHeartbeat, stopListening, addMessage, speakMessage]);

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const overallScore = Math.round((score.communication + score.technical + (heartData.stress === "high" ? 50 : heartData.stress === "medium" ? 75 : 100)) / 3);
  const isInputEmpty = !userInput.trim() && !speech.interimText.trim();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#000408]">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-sm font-black font-mono"
            style={{ background: "linear-gradient(135deg,#00d4ff,#7700ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            HOLO-SYNC
          </div>
          <div className="h-4 w-px bg-cyan-500/30" />
          <span className="text-xs font-mono uppercase tracking-widest font-bold" style={{ color: domain.color }}>
            {domain.icon} {domain.label}
          </span>
          {domain.panelMode && (
            <span className="text-xs font-mono uppercase tracking-widest text-yellow-400 border border-yellow-400/30 rounded px-1.5 py-0.5">
              Panel Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-cyan-500/70">
          <span>{formatTime(elapsedSeconds)}</span>
          <span>Q {Math.min(currentQuestionIndex + 1, questions.length)}/{questions.length}</span>
          {bluffDetected && (
            <span className="text-red-400 animate-pulse border border-red-400/30 rounded px-2 py-0.5 uppercase tracking-widest">
              🔍 Bluff Detected
            </span>
          )}
          {empathyMode && (
            <span className="text-green-400 animate-pulse border border-green-400/30 rounded px-2 py-0.5 uppercase tracking-widest">
              ♥ Empathy Mode
            </span>
          )}
          <button onClick={onEnd}
            className="text-red-400 border border-red-400/30 rounded px-2 py-0.5 hover:bg-red-400/10 uppercase tracking-widest transition-colors">
            End
          </button>
        </div>
      </div>

      {/* ── Main Layout ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2 p-2 border-r border-cyan-500/20 overflow-y-auto">
          <WebcamFeed
            videoRef={videoRef}
            isActive={camActive}
            compact
            faceDetected={face.detected}
            faceBox={face.box}
            keypoints={face.keypoints}
            videoW={face.videoW}
            videoH={face.videoH}
            bpm={heartData.bpm}
            calibrating={heartData.calibrating}
            faceLoading={face.loading}
          />

          {camError && (
            <div className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/30 rounded p-2">
              ⚠ {camError}
            </div>
          )}

          <HeartbeatMonitor data={heartData} onPanic={panic} onCalm={calm} />

          {/* Live Scores */}
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-cyan-500/20 bg-black/30">
            <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-1">Live Scores</div>
            {[
              { label: "Communication", value: score.communication, color: "#00d4ff" },
              { label: "Technical", value: score.technical, color: "#7700ff" },
              { label: "Composure", value: heartData.stress === "high" ? 30 : heartData.stress === "medium" ? 65 : 100, color: heartData.stress === "high" ? "#ff4444" : "#00ff88" },
            ].map(s => (
              <div key={s.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">{s.label}</span>
                  <span style={{ color: s.color }}>{s.value}%</span>
                </div>
                <div className="h-1 rounded-full bg-gray-800">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${s.value}%`, background: s.color, boxShadow: `0 0 6px ${s.color}66` }} />
                </div>
              </div>
            ))}
            <div className="mt-1 pt-2 border-t border-cyan-500/20">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-cyan-400">Overall</span>
                <span className="text-cyan-300">{overallScore}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center — Avatar */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative overflow-hidden">
            <Avatar3D
              emotion={avatarEmotion}
              isSpeaking={isSpeaking}
              bpm={heartData.bpm ?? 72}
              panelMode={domain.panelMode}
              panelAvatars={panelAvatars}
            />

            <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
              <div className="text-xs font-mono text-cyan-400/50 uppercase tracking-widest">3D Holographic Interface</div>
              <div className="text-xs font-mono text-cyan-500/40">Emotion: {avatarEmotion.toUpperCase()}</div>
            </div>

            {isTyping && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 border border-cyan-500/30 rounded-full px-4 py-2 z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Composing response...</span>
              </div>
            )}

            {isSpeaking && !isTyping && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 border border-purple-500/30 rounded-full px-4 py-2 z-10">
                <div className="flex gap-0.5">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="w-0.5 bg-purple-400 rounded-full animate-bounce"
                      style={{ height: `${8 + Math.random() * 8}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <span className="text-xs font-mono text-purple-400 uppercase tracking-widest">Interviewer Speaking...</span>
              </div>
            )}

            {empathyMode && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="text-6xl animate-heartbeat opacity-25" style={{ color: "#00ff88" }}>♥</div>
              </div>
            )}
          </div>

          {/* ── Input Bar ─────────────────────────────────────────── */}
          <div className="shrink-0 p-3 border-t border-cyan-500/20 bg-black/60">
            {/* Mic live indicator */}
            {micOn && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
                  Mic Active — Speak your answer
                </span>
                {speech.interimText && (
                  <span className="text-xs font-mono text-cyan-400/60 italic truncate ml-1">
                    "{speech.interimText.slice(0, 40)}{speech.interimText.length > 40 ? "…" : ""}"
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {/* Mic toggle button */}
              {speech.supported && (
                <button
                  onClick={toggleMic}
                  disabled={phase === "ended" || phase === "starting" || isSpeaking}
                  title={micOn ? "Stop microphone" : "Start microphone"}
                  className={`relative shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40 ${
                    micOn
                      ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_20px_rgba(255,68,68,0.4)]"
                      : "bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20"
                  }`}
                >
                  {micOn && (
                    <div className="absolute inset-0 rounded-xl border-2 border-red-500 animate-ping opacity-40" />
                  )}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="2" width="6" height="12" rx="3"
                      fill={micOn ? "#ff4444" : "#00d4ff"} />
                    <path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7"
                      stroke={micOn ? "#ff4444" : "#00d4ff"} strokeWidth="2" strokeLinecap="round" />
                    <line x1="12" y1="17" x2="12" y2="22"
                      stroke={micOn ? "#ff4444" : "#00d4ff"} strokeWidth="2" strokeLinecap="round" />
                    <line x1="9" y1="22" x2="15" y2="22"
                      stroke={micOn ? "#ff4444" : "#00d4ff"} strokeWidth="2" strokeLinecap="round" />
                    {!micOn && (
                      <line x1="4" y1="4" x2="20" y2="20" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                    )}
                  </svg>
                </button>
              )}

              {/* Text input */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={e => { setUserInput(e.target.value); }}
                  onKeyDown={e => e.key === "Enter" && handleSubmitAnswer()}
                  placeholder={
                    isSpeaking ? "Interviewer is speaking..."
                    : phase === "ended" ? "Interview complete"
                    : phase === "starting" ? "Initializing..."
                    : micOn ? "Speaking… (or type here)"
                    : "Type your answer, or click mic to speak"
                  }
                  disabled={phase === "ended" || phase === "starting" || isSpeaking}
                  className="w-full bg-black/60 border border-cyan-500/30 rounded-xl px-4 py-3 text-sm text-cyan-100 font-mono placeholder-cyan-600/40 focus:outline-none focus:border-cyan-400 disabled:opacity-40 transition-colors"
                  style={{
                    boxShadow: micOn ? "0 0 0 1px rgba(255,68,68,0.3) inset" : undefined,
                  }}
                />
                {/* Interim speech ghost text overlay */}
                {micOn && speech.interimText && !userInput && (
                  <div className="absolute inset-0 px-4 py-3 text-sm font-mono text-cyan-400/40 pointer-events-none flex items-center">
                    <span className="italic truncate">{speech.interimText}</span>
                  </div>
                )}
              </div>

              {/* Send button */}
              <button
                onClick={handleSubmitAnswer}
                disabled={phase === "ended" || phase === "starting" || isSpeaking || isInputEmpty}
                className="shrink-0 px-5 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-40 active:scale-95"
                style={{
                  background: "rgba(0,212,255,0.15)",
                  border: "1px solid rgba(0,212,255,0.4)",
                  color: "#00d4ff",
                  boxShadow: !isInputEmpty ? "0 0 12px rgba(0,212,255,0.2)" : undefined,
                }}
              >
                Send ↵
              </button>
            </div>

            {!speech.supported && (
              <div className="mt-1.5 text-xs font-mono text-yellow-500/60 text-center">
                ⚠ Speech recognition not supported in this browser — please use Chrome or Edge
              </div>
            )}
          </div>
        </div>

        {/* Right — Chat + Analytics */}
        <div className="w-80 shrink-0 flex flex-col border-l border-cyan-500/20">
          <div className="px-3 py-2 border-b border-cyan-500/20 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest">Session Transcript</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <InterviewChat messages={messages} isTyping={isTyping} />
          </div>

          {/* Student Analytics */}
          <div className="shrink-0 p-2 border-t border-cyan-500/20">
            <StudentAnalytics
              analytics={speech.analytics}
              isListening={speech.isListening}
              answerCount={answerCount}
              sessionTime={elapsedSeconds}
            />
          </div>

          {phase === "ended" && (
            <div className="shrink-0 p-3 border-t border-cyan-500/20">
              <button onClick={onEnd}
                className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-widest transition-all"
                style={{ background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.4)", color: "#00d4ff" }}>
                Return to Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
