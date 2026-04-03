import { useState, useEffect, useRef, useCallback } from "react";
import Avatar3D from "../components/Avatar3D";
import HeartbeatMonitor from "../components/HeartbeatMonitor";
import WebcamFeed from "../components/WebcamFeed";
import InterviewChat, { ChatMessage } from "../components/InterviewChat";
import { useWebcam } from "../hooks/useWebcam";
import { useHeartbeat } from "../hooks/useHeartbeat";
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
  const { data: heartData, start: startHeartbeat, stop: stopHeartbeat, panic, calm } = useHeartbeat(videoRef);

  const [phase, setPhase] = useState<Phase>("starting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [avatarEmotion, setAvatarEmotion] = useState<AvatarEmotion>("neutral");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [bluffDetected, setBluffDetected] = useState(false);
  const [empathyMode, setEmpathyMode] = useState(false);
  const [lastStressCheck, setLastStressCheck] = useState(0);
  const [score, setScore] = useState({ communication: 0, technical: 0, stress: 100, overall: 0 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [userInput, setUserInput] = useState("");

  const questions = QUESTIONS[domain.id] || QUESTIONS.swe;
  const panelAvatars =
    domain.panelMode
      ? PANEL_AVATARS[domain.id as keyof typeof PANEL_AVATARS] || PANEL_AVATARS.upsc
      : undefined;

  const addMessage = useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages(prev => [...prev, {
      ...msg,
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    }]);
  }, []);

  const speakMessage = useCallback(async (text: string, avatarName?: string, flagged?: boolean) => {
    setIsTyping(true);
    const delay = Math.min(1500, text.length * 25);
    await new Promise(r => setTimeout(r, delay));
    setIsTyping(false);
    setIsSpeaking(true);
    addMessage({ role: "avatar", text, avatarName, flagged });
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.9;
      utter.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) || voices[0];
      if (englishVoice) utter.voice = englishVoice;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(() => setIsSpeaking(false), 3000);
    }
  }, [addMessage]);

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
      addMessage({ role: "system", text: `DOMAIN: ${domain.label.toUpperCase()} | ${domain.panelMode ? "PANEL MODE — 3 INTERVIEWERS" : "SINGLE INTERVIEWER MODE"}` });
      await new Promise(r => setTimeout(r, 1000));

      setPhase("active");
      await askNextQuestion(0);
    };
    init();
    return () => {
      stopWebcam();
      stopHeartbeat();
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
    if (index >= questions.length) {
      endInterview();
      return;
    }
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
    setTimeout(() => {
      setEmpathyMode(false);
      setAvatarEmotion("neutral");
    }, 5000);
  }, [addMessage, speakMessage]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!userInput.trim() || phase !== "active") return;
    const text = userInput.trim();
    setUserInput("");

    addMessage({ role: "candidate", text });

    setScore(prev => ({
      ...prev,
      communication: Math.min(100, prev.communication + 8 + Math.floor(Math.random() * 5)),
      technical: Math.min(100, prev.technical + 5 + Math.floor(Math.random() * 8)),
    }));

    const currentQ = questions[currentQuestionIndex];
    await new Promise(r => setTimeout(r, 800));

    if (currentQ?.isBullshitTrigger && text.length > 20) {
      setBluffDetected(true);
      setAvatarEmotion("curious");
      addMessage({ role: "system", text: "🔍 BULLSHIT DETECTOR TRIGGERED — DEEP DIVE INITIATED" });
      const drillDown = BLUFF_RESPONSES[Math.floor(Math.random() * BLUFF_RESPONSES.length)];
      await speakMessage(drillDown, currentQ.avatarName, true);
      setTimeout(() => setBluffDetected(false), 8000);
    } else {
      await askNextQuestion(currentQuestionIndex + 1);
    }
  }, [userInput, phase, questions, currentQuestionIndex, addMessage, speakMessage, askNextQuestion]);

  const endInterview = useCallback(async () => {
    setPhase("ended");
    stopWebcam();
    stopHeartbeat();
    window.speechSynthesis?.cancel();

    const finalScore = Math.round(
      (score.communication + score.technical + score.stress) / 3
    );
    addMessage({ role: "system", text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" });
    addMessage({ role: "system", text: `INTERVIEW COMPLETE — FINAL SCORE: ${finalScore}/100` });

    setAvatarEmotion("neutral");
    await speakMessage(
      `Interview complete. Thank you for your time. Overall, you demonstrated ${finalScore > 70 ? "strong" : "developing"} capability. Your biometric data showed ${heartData.stress === "high" ? "elevated stress levels" : "good composure"}. Review your session and focus on the areas flagged during the interview.`,
      "HOLO-AI"
    );
  }, [score, heartData.stress, stopWebcam, stopHeartbeat, addMessage, speakMessage]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const overallScore = Math.round((score.communication + score.technical + (heartData.stress === "high" ? 50 : heartData.stress === "medium" ? 75 : 100)) / 3);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-black">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div
            className="text-sm font-black font-mono text-glow-cyan"
            style={{
              background: "linear-gradient(135deg, #00d4ff, #7700ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            HOLO-SYNC
          </div>
          <div className="h-4 w-px bg-cyan-500/30" />
          <span
            className="text-xs font-mono uppercase tracking-widest font-bold"
            style={{ color: domain.color }}
          >
            {domain.icon} {domain.label}
          </span>
          {domain.panelMode && (
            <span className="text-xs font-mono uppercase tracking-widest text-yellow-400 border border-yellow-400/30 rounded px-1.5 py-0.5">
              Panel Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-cyan-500/70">
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
          <button
            onClick={onEnd}
            className="text-red-400 border border-red-400/30 rounded px-2 py-0.5 hover:bg-red-400/10 uppercase tracking-widest transition-colors"
          >
            End
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 flex flex-col gap-3 p-3 border-r border-cyan-500/20 overflow-y-auto">
          <WebcamFeed videoRef={videoRef} isActive={camActive} compact />

          {camError && (
            <div className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/30 rounded p-2">
              ⚠ {camError}
            </div>
          )}

          <HeartbeatMonitor
            data={heartData}
            onPanic={panic}
            onCalm={calm}
          />

          <div className="flex flex-col gap-2 p-3 rounded-lg border border-cyan-500/20 bg-black/30">
            <div className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest mb-1">Live Scores</div>
            {[
              { label: "Communication", value: score.communication, color: "#00d4ff" },
              { label: "Technical", value: score.technical, color: "#7700ff" },
              { label: "Composure", value: heartData.stress === "high" ? 30 : heartData.stress === "medium" ? 65 : 100, color: heartData.stress === "high" ? "#ff4444" : "#00ff88" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">{s.label}</span>
                  <span style={{ color: s.color }}>{s.value}%</span>
                </div>
                <div className="h-1 rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${s.value}%`, background: s.color, boxShadow: `0 0 6px ${s.color}66` }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-cyan-500/20">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-cyan-400">Overall</span>
                <span className="text-glow-cyan text-cyan-300">{overallScore}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center — Avatar */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <Avatar3D
              emotion={avatarEmotion}
              isSpeaking={isSpeaking}
              bpm={heartData.bpm}
              panelMode={domain.panelMode}
              panelAvatars={panelAvatars}
            />

            <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
              <div className="text-xs font-mono text-cyan-400/50 uppercase tracking-widest">
                3D Holographic Interface
              </div>
              <div className="text-xs font-mono text-cyan-500/40">
                Emotion: {avatarEmotion.toUpperCase()}
              </div>
            </div>

            {isTyping && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 border border-cyan-500/30 rounded-full px-4 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Composing response...</span>
              </div>
            )}

            {empathyMode && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="text-6xl animate-heartbeat opacity-30" style={{ color: "#00ff88" }}>♥</div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-cyan-500/20 bg-black/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmitAnswer()}
                placeholder={phase === "ended" ? "Interview complete" : "Type your answer and press Enter..."}
                disabled={phase === "ended" || phase === "starting" || isTyping}
                className="flex-1 bg-black/60 border border-cyan-500/30 rounded-lg px-4 py-2.5 text-sm text-cyan-100 font-mono placeholder-cyan-600/50 focus:outline-none focus:border-cyan-400 disabled:opacity-40 transition-colors"
              />
              <button
                onClick={handleSubmitAnswer}
                disabled={phase === "ended" || phase === "starting" || isTyping || !userInput.trim()}
                className="px-4 py-2.5 rounded-lg font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-40"
                style={{
                  background: "rgba(0,212,255,0.15)",
                  border: "1px solid rgba(0,212,255,0.4)",
                  color: "#00d4ff",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right — Chat */}
        <div className="w-80 flex flex-col border-l border-cyan-500/20">
          <div className="px-3 py-2 border-b border-cyan-500/20 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest">Session Transcript</span>
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            <InterviewChat messages={messages} isTyping={isTyping} />
          </div>

          {phase === "ended" && (
            <div className="p-3 border-t border-cyan-500/20">
              <button
                onClick={onEnd}
                className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-widest transition-all"
                style={{
                  background: "rgba(0,212,255,0.15)",
                  border: "1px solid rgba(0,212,255,0.4)",
                  color: "#00d4ff",
                }}
              >
                Return to Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
