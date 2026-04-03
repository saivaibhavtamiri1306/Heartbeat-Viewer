import { useState, useEffect, useRef, useCallback } from "react";
import Avatar3D from "../components/Avatar3D";
import HeartbeatMonitor from "../components/HeartbeatMonitor";
import WebcamFeed from "../components/WebcamFeed";
import InterviewChat, { ChatMessage } from "../components/InterviewChat";
import StudentAnalytics from "../components/StudentAnalytics";
import AnswerTimer from "../components/AnswerTimer";
import EyeContactIndicator from "../components/EyeContactIndicator";
import InterviewReport, { type AnswerEvaluation } from "../components/InterviewReport";
import { useWebcam } from "../hooks/useWebcam";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useTTS } from "../hooks/useTTS";
import { useEyeContact } from "../hooks/useEyeContact";
import type { FaceBox } from "../hooks/useFaceDetection";
import {
  EMPATHY_RESPONSES,
  BLUFF_RESPONSES,
  HR_SPIKE_RESPONSES,
  HR_DROP_RESPONSES,
  HR_ELEVATED_RESPONSES,
  STRESS_COOLDOWN_TRANSITIONS,
  CALM_ESCALATION_TRANSITIONS,
  PANEL_AVATARS,
  getFilteredQuestions,
  getAdaptiveQuestion,
  type Domain,
  type InterviewConfig,
} from "../data/questions";

interface InterviewProps {
  domain: Domain;
  config: InterviewConfig;
  onEnd: () => void;
}

type Phase = "starting" | "active" | "paused" | "ended";
type AvatarEmotion = "neutral" | "empathetic" | "stern" | "curious" | "stressed";

export default function Interview({ domain, config, onEnd }: InterviewProps) {
  const { videoRef, isActive: camActive, error: camError, startWebcam, stopWebcam } = useWebcam();
  const faceBoxRef     = useRef<FaceBox | null>(null);
  const foreheadBoxRef = useRef<FaceBox | null>(null);
  const cheekBoxRef    = useRef<FaceBox | null>(null);
  const { data: heartData, start: startHeartbeat, stop: stopHeartbeat, panic, calm } = useHeartbeat(videoRef, faceBoxRef, foreheadBoxRef, cheekBoxRef);
  const face = useFaceDetection(videoRef);
  const { data: speech, startListening, stopListening, clearCurrentAnswer } = useSpeechRecognition();
  const tts = useTTS();
  const eyeContact = useEyeContact(face);

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
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState(0);
  const [mouthOpenness, setMouthOpenness] = useState(0);
  const [spokenText, setSpokenText] = useState("");
  const mouthAnimRef = useRef<number>(0);
  const mouthAnimActiveRef = useRef(false);
  const speechRunIdRef = useRef(0);
  const bpmHistoryRef = useRef<number[]>([]);
  const lastHrCommentRef = useRef(0);
  const baselineBpmRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const usedQuestionIdsRef = useRef<Set<string>>(new Set());
  const adaptiveCooldownRef = useRef(0);
  const [adaptiveMode, setAdaptiveMode] = useState<"normal" | "cooling" | "escalating">("normal");
  const consecutiveCalmRef = useRef(0);
  const consecutiveStressRef = useRef(0);
  const activeQuestionRef = useRef<ReturnType<typeof getAdaptiveQuestion>>(null);
  const wasAdaptiveRef = useRef(false);
  const [showReport, setShowReport] = useState(false);
  const [evaluations, setEvaluations] = useState<AnswerEvaluation[]>([]);
  const [adaptiveTriggerCount, setAdaptiveTriggerCount] = useState(0);
  const [bluffTriggerCount, setBluffTriggerCount] = useState(0);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  const questionStartRef = useRef(Date.now());
  const fullBpmHistoryRef = useRef<number[]>([]);

  const answerTimeLimit = config.difficulty === "hard" ? 60 : config.difficulty === "easy" ? 120 : 90;

  const [questions] = useState(() =>
    getFilteredQuestions(domain.id, config.topics, config.difficulty)
  );
  const panelAvatars =
    domain.panelMode
      ? PANEL_AVATARS[domain.id as keyof typeof PANEL_AVATARS] || PANEL_AVATARS.upsc
      : undefined;

  useEffect(() => {
    if (micOn && speech.error) {
      setMicOn(false);
    }
  }, [speech.error, micOn]);

  useEffect(() => {
    if (!micOn) return;
    if (speech.finalText) {
      setUserInput(speech.finalText);
    }
  }, [speech.finalText, micOn]);

  const toggleMic = useCallback(async () => {
    if (micOn) {
      stopListening();
      setMicOn(false);
    } else {
      clearCurrentAnswer();
      setUserInput("");
      await startListening();
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

  const startMouthAnimation = useCallback(() => {
    if (mouthAnimActiveRef.current) {
      cancelAnimationFrame(mouthAnimRef.current);
    }
    mouthAnimActiveRef.current = true;
    let frame = 0;
    const animate = () => {
      if (!mouthAnimActiveRef.current) return;
      frame++;
      const t = frame * 0.033;
      const open = 0.2 + Math.abs(Math.sin(t * 8)) * 0.5 + Math.abs(Math.sin(t * 13)) * 0.3;
      setMouthOpenness(open);
      mouthAnimRef.current = requestAnimationFrame(animate);
    };
    mouthAnimRef.current = requestAnimationFrame(animate);
  }, []);

  const stopMouthAnimation = useCallback(() => {
    mouthAnimActiveRef.current = false;
    cancelAnimationFrame(mouthAnimRef.current);
    setMouthOpenness(0);
  }, []);

  const speakMessage = useCallback(async (text: string, avatarName?: string, flagged?: boolean, avatarIndex?: number): Promise<void> => {
    const runId = ++speechRunIdRef.current;

    setIsTyping(true);
    const delay = Math.min(1200, text.length * 18);
    await new Promise(r => setTimeout(r, delay));

    if (runId !== speechRunIdRef.current) return;

    setIsTyping(false);
    setIsSpeaking(true);
    setSpokenText(text);
    if (avatarIndex !== undefined) setActiveSpeakerIndex(avatarIndex);
    addMessage({ role: "avatar", text, avatarName, flagged });

    startMouthAnimation();

    if (micOn) stopListening();

    const voiceMap: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
      "CHAIRMAN SINGH": "onyx",
      "MEMBER DR. SHARMA": "echo",
      "MEMBER ADV. KRISHNA": "fable",
      "BRIG. MEHTA": "onyx",
      "COL. VERMA": "echo",
      "WING CDR. NAIR": "fable",
      "EXAMINER": "nova",
      "MD RAJIV KAPOOR": "onyx",
      "HOLO-AI": "nova",
      "CHAIRMAN": "onyx",
    };
    const selectedVoice = voiceMap[avatarName || ""] || "nova";

    await tts.speak(text, {
      voice: selectedVoice,
      onStart: () => {
        if (runId !== speechRunIdRef.current) return;
      },
      onEnd: () => {
        if (runId !== speechRunIdRef.current) return;
        setIsSpeaking(false);
        setSpokenText("");
        stopMouthAnimation();
        if (micOn) { clearCurrentAnswer(); startListening(); }
      },
      onError: () => {
        if (runId !== speechRunIdRef.current) return;
        setIsSpeaking(false);
        setSpokenText("");
        stopMouthAnimation();
        if (micOn) { clearCurrentAnswer(); startListening(); }
      },
    });

    if (runId === speechRunIdRef.current) {
      setIsSpeaking(false);
      setSpokenText("");
      stopMouthAnimation();
    }
  }, [addMessage, micOn, startListening, stopListening, clearCurrentAnswer, startMouthAnimation, stopMouthAnimation, tts]);

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
      addMessage({
        role: "system",
        text: `📋 ${config.background} | ${config.difficulty.toUpperCase()} difficulty | ${config.topics.length} topic${config.topics.length !== 1 ? "s" : ""} | ${questions.length} questions`,
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
      stopMouthAnimation();
      tts.stop();
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

  const triggerHrComment = useCallback(async (type: "spike" | "drop" | "elevated") => {
    if (isSpeaking || isTyping) return;
    lastHrCommentRef.current = Date.now();

    let responses: string[];
    let systemMsg: string;
    let emotion: AvatarEmotion;

    if (type === "spike") {
      responses = HR_SPIKE_RESPONSES;
      systemMsg = "📈 HEART RATE INCREASE DETECTED — INTERVIEWER RESPONDS";
      emotion = "curious";
    } else if (type === "drop") {
      responses = HR_DROP_RESPONSES;
      systemMsg = "📉 HEART RATE DECREASE DETECTED — INTERVIEWER RESPONDS";
      emotion = "empathetic";
    } else {
      responses = HR_ELEVATED_RESPONSES;
      systemMsg = "⚠ SUSTAINED ELEVATED HEART RATE — INTERVIEWER CHECK-IN";
      emotion = "empathetic";
    }

    const bpm = heartData.bpm ?? 0;
    const response = responses[Math.floor(Math.random() * responses.length)];
    const bpmNote = bpm > 0 ? ` Your current heart rate is ${bpm} BPM.` : "";

    setAvatarEmotion(emotion);
    addMessage({ role: "system", text: systemMsg });
    await speakMessage(response + bpmNote, domain.panelMode ? "CHAIRMAN" : "HOLO-AI");
    setTimeout(() => setAvatarEmotion("neutral"), 4000);
  }, [isSpeaking, isTyping, heartData.bpm, addMessage, speakMessage, domain.panelMode]);

  useEffect(() => {
    if (phase !== "active") return;
    const bpm = heartData.bpm;
    if (!bpm || bpm <= 0 || heartData.calibrating) return;

    if (baselineBpmRef.current === null) {
      baselineBpmRef.current = bpm;
    }

    fullBpmHistoryRef.current.push(bpm);

    const history = bpmHistoryRef.current;
    history.push(bpm);
    if (history.length > 30) history.shift();

    const now = Date.now();
    const cooldown = 30000;
    if (now - lastHrCommentRef.current < cooldown) return;
    if (history.length < 5) return;

    const recent = history.slice(-5);
    const older = history.slice(-15, -5);
    if (older.length < 3) return;

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const baseline = baselineBpmRef.current;
    const diff = recentAvg - olderAvg;

    if (diff > 12 || (recentAvg > baseline + 20 && diff > 5)) {
      triggerHrComment("spike");
    } else if (diff < -10 || (recentAvg < baseline - 10 && diff < -5)) {
      triggerHrComment("drop");
    } else if (recentAvg > 100 && history.length >= 20) {
      const allHigh = history.slice(-20).every(b => b > 95);
      if (allHigh) triggerHrComment("elevated");
    }
  }, [heartData.bpm, heartData.calibrating, phase, triggerHrComment]);

  const askNextQuestion = useCallback(async (index: number) => {
    if (index >= questions.length) { endInterview(); return; }

    const now = Date.now();
    const adaptiveCooldown = 45000;
    const canAdapt = now - adaptiveCooldownRef.current > adaptiveCooldown;

    const bpmHist = bpmHistoryRef.current;
    const recentBpm = bpmHist.length >= 5 ? bpmHist.slice(-5).reduce((a, b) => a + b, 0) / 5 : 0;
    const baseline = baselineBpmRef.current ?? 75;

    let adaptiveQ = null as ReturnType<typeof getAdaptiveQuestion>;
    let transitionMsg = "";
    let didAdapt = false;

    if (canAdapt && recentBpm > 0 && bpmHist.length >= 8) {
      const stressThreshold = Math.max(baseline + 15, 95);
      const calmThreshold = Math.min(baseline + 5, 80);

      if (recentBpm > stressThreshold) {
        consecutiveStressRef.current++;
        consecutiveCalmRef.current = 0;
        if (consecutiveStressRef.current >= 2) {
          adaptiveQ = getAdaptiveQuestion(domain.id, "easy", usedQuestionIdsRef.current, config.topics);
          if (adaptiveQ) {
            transitionMsg = STRESS_COOLDOWN_TRANSITIONS[Math.floor(Math.random() * STRESS_COOLDOWN_TRANSITIONS.length)];
            setAdaptiveMode("cooling");
            adaptiveCooldownRef.current = now;
            consecutiveStressRef.current = 0;
            didAdapt = true;
          }
        }
      } else if (recentBpm < calmThreshold) {
        consecutiveCalmRef.current++;
        consecutiveStressRef.current = 0;
        if (consecutiveCalmRef.current >= 3) {
          adaptiveQ = getAdaptiveQuestion(domain.id, "hard", usedQuestionIdsRef.current, config.topics);
          if (adaptiveQ) {
            transitionMsg = CALM_ESCALATION_TRANSITIONS[Math.floor(Math.random() * CALM_ESCALATION_TRANSITIONS.length)];
            setAdaptiveMode("escalating");
            adaptiveCooldownRef.current = now;
            consecutiveCalmRef.current = 0;
            didAdapt = true;
          }
        }
      } else {
        consecutiveStressRef.current = Math.max(0, consecutiveStressRef.current - 1);
        consecutiveCalmRef.current = Math.max(0, consecutiveCalmRef.current - 1);
        setAdaptiveMode("normal");
      }
    }

    const q = adaptiveQ || questions[index];
    usedQuestionIdsRef.current.add(q.id);
    activeQuestionRef.current = q;
    wasAdaptiveRef.current = didAdapt;
    setCurrentQuestionIndex(index);

    if (q.avatarIndex !== undefined) setActiveSpeakerIndex(q.avatarIndex);

    if (transitionMsg) {
      const bpmNote = recentBpm > 0 ? ` Your current heart rate is ${Math.round(recentBpm)} BPM.` : "";
      const modeLabel = adaptiveQ?.difficulty === "easy" ? "⬇ ADAPTIVE COOLDOWN" : "⬆ ADAPTIVE ESCALATION";
      addMessage({ role: "system", text: `🧬 ${modeLabel} — BIOMETRIC DIFFICULTY ADJUSTMENT` });
      setAvatarEmotion(adaptiveQ?.difficulty === "easy" ? "empathetic" : "stern");
      await speakMessage(transitionMsg + bpmNote, domain.panelMode ? "CHAIRMAN" : "HOLO-AI", false, 0);
      await new Promise(r => setTimeout(r, 600));
    }

    if (q.isInterrupt && domain.panelMode) {
      setAvatarEmotion("stern");
      addMessage({ role: "system", text: `⚡ INTERRUPT — ${q.avatarName} INTERVENES` });
      await new Promise(r => setTimeout(r, 500));
    } else if (!transitionMsg) {
      setAvatarEmotion("neutral");
    }

    if (didAdapt) {
      setAdaptiveTriggerCount(c => c + 1);
    }

    await speakMessage(q.text, q.avatarName, false, q.avatarIndex ?? 0);
    questionStartRef.current = Date.now();
    setWaitingForAnswer(true);
    if (didAdapt) {
      setTimeout(() => setAdaptiveMode("normal"), 5000);
    }
  }, [questions, domain.id, domain.panelMode, config.topics, speakMessage, addMessage]);

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

    if (micOn) { stopListening(); setMicOn(false); }
    clearCurrentAnswer();
    setUserInput("");
    setWaitingForAnswer(false);

    addMessage({ role: "candidate", text });
    setAnswerCount(c => c + 1);

    const timeTaken = Math.round((Date.now() - questionStartRef.current) / 1000);

    const vocabBonus = Math.round(speech.analytics.vocabularyScore * 0.04);
    const confBonus = Math.round(speech.analytics.confidenceScore * 0.04);
    setScore(prev => ({
      ...prev,
      communication: Math.min(100, prev.communication + 7 + vocabBonus + Math.floor(Math.random() * 4)),
      technical: Math.min(100, prev.technical + 5 + confBonus + Math.floor(Math.random() * 7)),
    }));

    const currentQ = activeQuestionRef.current || questions[currentQuestionIndex];
    const wasAdaptive = wasAdaptiveRef.current;
    await new Promise(r => setTimeout(r, 700));

    fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: currentQ?.text || "", answer: text, domain: domain.id }),
    })
      .then(r => r.json())
      .then(ev => {
        setEvaluations(prev => [...prev, {
          question: currentQ?.text || "",
          answer: text,
          score: ev.score || 5,
          strengths: ev.strengths || "",
          weaknesses: ev.weaknesses || "",
          suggestion: ev.suggestion || "",
          timeTaken,
          avatarName: currentQ?.avatarName,
        }]);
        if (ev.score) {
          setScore(prev => ({
            ...prev,
            technical: Math.min(100, prev.technical + Math.max(0, ev.score - 5)),
            communication: Math.min(100, prev.communication + Math.max(0, ev.score - 6)),
          }));
        }
      })
      .catch(() => {
        setEvaluations(prev => [...prev, {
          question: currentQ?.text || "", answer: text, score: 5,
          strengths: "Answer provided", weaknesses: "", suggestion: "",
          timeTaken, avatarName: currentQ?.avatarName,
        }]);
      });

    if (currentQ?.isBullshitTrigger && text.length > 20) {
      setBluffDetected(true);
      setBluffTriggerCount(c => c + 1);
      setAvatarEmotion("curious");
      addMessage({ role: "system", text: "🔍 BULLSHIT DETECTOR TRIGGERED — DRILLING DEEPER" });
      const drillDown = BLUFF_RESPONSES[Math.floor(Math.random() * BLUFF_RESPONSES.length)];
      await speakMessage(drillDown, currentQ.avatarName, true);
      setTimeout(() => setBluffDetected(false), 8000);
    } else if (followUpCount < 2 && text.length > 30 && Math.random() < 0.4) {
      try {
        addMessage({ role: "system", text: "🔄 AI FOLLOW-UP INCOMING..." });
        const resp = await fetch("/api/followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: currentQ?.text || "",
            answer: text,
            domain: domain.id,
            difficulty: config.difficulty,
            avatarName: currentQ?.avatarName,
          }),
        });
        if (resp.ok) {
          const { followUp, avatarName } = await resp.json();
          if (followUp) {
            setFollowUpCount(c => c + 1);
            activeQuestionRef.current = { ...currentQ!, text: followUp, id: `followup-${Date.now()}` };
            wasAdaptiveRef.current = true;
            await speakMessage(followUp, avatarName || currentQ?.avatarName, false, currentQ?.avatarIndex ?? 0);
            questionStartRef.current = Date.now();
            setWaitingForAnswer(true);
            return;
          }
        }
      } catch {
      }
      const nextIndex = wasAdaptive ? currentQuestionIndex : currentQuestionIndex + 1;
      wasAdaptiveRef.current = false;
      setFollowUpCount(0);
      await askNextQuestion(nextIndex);
    } else {
      const nextIndex = wasAdaptive ? currentQuestionIndex : currentQuestionIndex + 1;
      wasAdaptiveRef.current = false;
      setFollowUpCount(0);
      await askNextQuestion(nextIndex);
    }
  }, [userInput, speech, phase, micOn, questions, currentQuestionIndex, domain.id, config.difficulty,
      followUpCount, addMessage, speakMessage, askNextQuestion, stopListening, clearCurrentAnswer]);

  const handleTimeUp = useCallback(() => {
    if (phase !== "active" || !waitingForAnswer) return;
    setWaitingForAnswer(false);
    addMessage({ role: "system", text: "⏰ TIME'S UP — Moving to next question" });
    const wasAdaptive = wasAdaptiveRef.current;
    const nextIndex = wasAdaptive ? currentQuestionIndex : currentQuestionIndex + 1;
    wasAdaptiveRef.current = false;
    setFollowUpCount(0);
    setEvaluations(prev => [...prev, {
      question: activeQuestionRef.current?.text || "",
      answer: "(Time expired — no answer)",
      score: 1, strengths: "", weaknesses: "No answer provided within time limit",
      suggestion: "Practice answering within the allotted time",
      timeTaken: answerTimeLimit, avatarName: activeQuestionRef.current?.avatarName,
    }]);
    askNextQuestion(nextIndex);
  }, [phase, waitingForAnswer, currentQuestionIndex, answerTimeLimit, addMessage, askNextQuestion]);

  const endInterview = useCallback(async () => {
    setPhase("ended");
    setWaitingForAnswer(false);
    stopWebcam(); stopHeartbeat(); stopListening(); setMicOn(false);
    tts.stop();
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
    setTimeout(() => setShowReport(true), 2000);
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
          <span className={`text-xs font-mono uppercase tracking-widest border rounded px-1.5 py-0.5 ${
            config.difficulty === "easy" ? "text-green-400 border-green-400/30" :
            config.difficulty === "hard" ? "text-red-400 border-red-400/30" :
            "text-yellow-400 border-yellow-400/30"
          }`}>
            {config.difficulty}
          </span>
          {domain.panelMode && (
            <span className="text-xs font-mono uppercase tracking-widest text-yellow-400 border border-yellow-400/30 rounded px-1.5 py-0.5">
              Panel Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-cyan-500/70">
          <AnswerTimer
            isActive={waitingForAnswer && phase === "active"}
            maxTime={answerTimeLimit}
            onTimeUp={handleTimeUp}
            difficulty={config.difficulty}
          />
          <span>{formatTime(elapsedSeconds)}</span>
          <span>Q {Math.min(currentQuestionIndex + 1, questions.length)}/{questions.length}</span>
          {bluffDetected && (
            <span className="text-red-400 animate-pulse border border-red-400/30 rounded px-2 py-0.5 uppercase tracking-widest">
              🔍 Bluff Detected
            </span>
          )}
          {adaptiveMode === "cooling" && (
            <span className="text-green-400 animate-pulse border border-green-400/30 rounded px-2 py-0.5 uppercase tracking-widest">
              ⬇ Cooling
            </span>
          )}
          {adaptiveMode === "escalating" && (
            <span className="text-orange-400 animate-pulse border border-orange-400/30 rounded px-2 py-0.5 uppercase tracking-widest">
              ⬆ Escalating
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
            foreheadBox={face.foreheadBox}
            cheekBox={face.cheekBox}
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
          <EyeContactIndicator data={eyeContact} />

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
              activeSpeakerIndex={activeSpeakerIndex}
              mouthOpenness={mouthOpenness}
              spokenText={spokenText}
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
            {/* Mic live indicator with level meter */}
            {micOn && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
                  Recording
                </span>
                <div className="flex items-center gap-1 ml-1">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full transition-all duration-100"
                      style={{
                        height: `${6 + i * 1.5}px`,
                        backgroundColor: i < Math.floor(speech.audioLevel / 10)
                          ? (i < 6 ? "#00d4ff" : i < 8 ? "#ffaa00" : "#ff4444")
                          : "rgba(0,212,255,0.15)",
                      }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-cyan-500/50 ml-1">
                  {speech.audioLevel > 5 ? "Hearing you" : "No audio detected"}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              {/* Mic toggle button */}
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

            {speech.error && (
              <div className="mt-1.5 text-xs font-mono text-red-400/80 text-center animate-pulse">
                ⚠ {speech.error}
              </div>
            )}
            {!speech.supported && !speech.error && (
              <div className="mt-1.5 text-xs font-mono text-yellow-500/60 text-center">
                ⚠ Speech recognition not supported — use Chrome or Edge, or type your answers
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
            <div className="shrink-0 p-3 border-t border-cyan-500/20 flex flex-col gap-2">
              <button onClick={() => setShowReport(true)}
                className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-widest transition-all"
                style={{ background: "rgba(119,0,255,0.15)", border: "1px solid rgba(119,0,255,0.4)", color: "#7700ff" }}>
                View Full Report
              </button>
              <button onClick={onEnd}
                className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-widest transition-all"
                style={{ background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.4)", color: "#00d4ff" }}>
                Return to Home
              </button>
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <InterviewReport
          domain={domain}
          difficulty={config.difficulty}
          score={score}
          analytics={speech.analytics}
          eyeContact={eyeContact}
          bpmHistory={fullBpmHistoryRef.current}
          sessionTime={elapsedSeconds}
          answerCount={answerCount}
          evaluations={evaluations}
          adaptiveTriggers={adaptiveTriggerCount}
          bluffTriggers={bluffTriggerCount}
          onClose={onEnd}
        />
      )}
    </div>
  );
}
