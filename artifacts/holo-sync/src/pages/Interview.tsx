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
  PRESSURE_RESPONSES,
  BLUFF_RESPONSES,
  HR_SPIKE_RESPONSES,
  HR_DROP_RESPONSES,
  HR_ELEVATED_RESPONSES,
  STRESS_ESCALATION_RESPONSES,
  CALM_ESCALATION_RESPONSES,
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
  const [pressureMode, setPressureMode] = useState(false);
  const stressMarkersRef = useRef<{questionIndex: number; bpm: number; type: string; timestamp: number}[]>([]);
  const [lastStressCheck, setLastStressCheck] = useState(0);
  const [score, setScore] = useState({ communication: 0, technical: 0, stress: 100 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [answerCount, setAnswerCount] = useState(0);
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState(0);
  const [spokenText, setSpokenText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const speechRunIdRef = useRef(0);
  const bpmHistoryRef = useRef<number[]>([]);
  const lastHrCommentRef = useRef(0);
  const baselineBpmRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const usedQuestionIdsRef = useRef<Set<string>>(new Set());
  const adaptiveCooldownRef = useRef(0);
  const [adaptiveMode, setAdaptiveMode] = useState<"normal" | "escalating">("normal");
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
    } else if (speech.interimText) {
      setUserInput(speech.interimText);
    }
  }, [speech.finalText, speech.interimText, micOn]);

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


  const speakMessage = useCallback(async (text: string, avatarName?: string, flagged?: boolean, avatarIndex?: number): Promise<void> => {
    const runId = ++speechRunIdRef.current;

    setIsTyping(true);
    const delay = Math.min(600, text.length * 8);
    await new Promise(r => setTimeout(r, delay));

    if (runId !== speechRunIdRef.current) return;

    setIsTyping(false);
    setIsSpeaking(true);
    setSpokenText(text);
    if (avatarIndex !== undefined) setActiveSpeakerIndex(avatarIndex);
    addMessage({ role: "avatar", text, avatarName, flagged });

    if (micOn) stopListening();

    const voiceMap: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
      "CHAIRMAN SINGH": "shimmer",
      "MEMBER DR. SHARMA": "nova",
      "MEMBER ADV. KRISHNA": "fable",
      "BRIG. MEHTA": "shimmer",
      "COL. VERMA": "nova",
      "WING CDR. NAIR": "fable",
      "EXAMINER": "nova",
      "MD RAJIV KAPOOR": "onyx",
      "HOLO-AI": "nova",
      "CHAIRMAN": "shimmer",
    };
    const selectedVoice = voiceMap[avatarName || ""] || "nova";

    await tts.speak(text, {
      voice: selectedVoice,
      onStart: () => {
        if (runId !== speechRunIdRef.current) return;
        setAudioBlob(tts.getLastBlob());
      },
      onEnd: () => {
        if (runId !== speechRunIdRef.current) return;
        setIsSpeaking(false);
        setSpokenText("");
        setAudioBlob(null);
        if (micOn) { clearCurrentAnswer(); startListening(); }
      },
      onError: () => {
        if (runId !== speechRunIdRef.current) return;
        setIsSpeaking(false);
        setSpokenText("");
        setAudioBlob(null);
        if (micOn) { clearCurrentAnswer(); startListening(); }
      },
    });

    if (runId === speechRunIdRef.current) {
      setIsSpeaking(false);
      setSpokenText("");
      setAudioBlob(null);
    }
  }, [addMessage, micOn, startListening, stopListening, clearCurrentAnswer, tts]);

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
    if (heartData.stress === "high" && Date.now() - lastStressCheck > 25000) {
      setLastStressCheck(Date.now());
      triggerPressure();
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
      systemMsg = "📈 HEART RATE SPIKE — PRESSURE POINT DETECTED";
      emotion = "stern";
      stressMarkersRef.current.push({ questionIndex: currentQuestionIndex, bpm: heartData.bpm ?? 0, type: "hr_spike", timestamp: Date.now() });
    } else if (type === "drop") {
      responses = HR_DROP_RESPONSES;
      systemMsg = "📉 HEART RATE DROP — COMPOSURE RESTORED";
      emotion = "neutral";
    } else {
      responses = HR_ELEVATED_RESPONSES;
      systemMsg = "⚠ SUSTAINED ELEVATED HEART RATE — ENDURANCE TEST";
      emotion = "stern";
      stressMarkersRef.current.push({ questionIndex: currentQuestionIndex, bpm: heartData.bpm ?? 0, type: "sustained_stress", timestamp: Date.now() });
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
          adaptiveQ = getAdaptiveQuestion(domain.id, "hard", usedQuestionIdsRef.current, config.topics);
          if (adaptiveQ) {
            transitionMsg = STRESS_ESCALATION_RESPONSES[Math.floor(Math.random() * STRESS_ESCALATION_RESPONSES.length)];
            setAdaptiveMode("escalating");
            adaptiveCooldownRef.current = now;
            consecutiveStressRef.current = 0;
            didAdapt = true;
          }
          stressMarkersRef.current.push({ questionIndex: index, bpm: Math.round(recentBpm), type: "composure_break", timestamp: now });
        }
      } else if (recentBpm < calmThreshold) {
        consecutiveCalmRef.current++;
        consecutiveStressRef.current = 0;
        if (consecutiveCalmRef.current >= 3) {
          adaptiveQ = getAdaptiveQuestion(domain.id, "hard", usedQuestionIdsRef.current, config.topics);
          if (adaptiveQ) {
            transitionMsg = CALM_ESCALATION_RESPONSES[Math.floor(Math.random() * CALM_ESCALATION_RESPONSES.length)];
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
      addMessage({ role: "system", text: `🧬 ⬆ PRESSURE ESCALATION — BIOMETRIC DIFFICULTY INCREASE` });
      setAvatarEmotion("stern");
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

  const triggerPressure = useCallback(async () => {
    setPressureMode(true);
    setAvatarEmotion("stern");
    const response = PRESSURE_RESPONSES[Math.floor(Math.random() * PRESSURE_RESPONSES.length)];
    addMessage({ role: "system", text: "⚠ STRESS DETECTED — PRESSURE MAINTAINED (REAL INTERVIEW SIMULATION)" });
    stressMarkersRef.current.push({ questionIndex: currentQuestionIndex, bpm: heartData.bpm ?? 0, type: "stress_detected", timestamp: Date.now() });
    await speakMessage(response, domain.panelMode ? "CHAIRMAN" : "HOLO-AI");
    setTimeout(() => { setPressureMode(false); setAvatarEmotion("neutral"); }, 5000);
  }, [addMessage, speakMessage, currentQuestionIndex, heartData.bpm, domain.panelMode]);

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
        const evalScore = Math.max(0, Math.min(10, ev.score ?? 5));
        const feedbackParts: string[] = [];
        if (ev.strengths) feedbackParts.push(`✦ ${ev.strengths}`);
        if (ev.weaknesses) feedbackParts.push(`△ ${ev.weaknesses}`);
        if (ev.suggestion) feedbackParts.push(`→ ${ev.suggestion}`);
        const feedbackText = feedbackParts.join("  ");
        addMessage({
          role: "evaluation",
          text: feedbackText || "Answer evaluated.",
          evalScore,
        });
        setEvaluations(prev => [...prev, {
          question: currentQ?.text || "",
          answer: text,
          score: evalScore,
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
    } else if (followUpCount < 3 && text.length > 20 && Math.random() < 0.7) {
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
      `Interview complete. Your final score is ${finalScore} out of 100. ${finalScore > 70 ? "Solid performance under pressure." : "You broke composure multiple times. This is exactly what you need to train."} ${
        speech.analytics.fillerCount > 5
          ? "Too many filler words. Eliminate those."
          : "Speech delivery was acceptable."
      } ${heartData.stress === "high" ? "Your stress levels remained elevated — that's a weakness to address." : "You maintained reasonable composure."} Review your pressure timeline to see exactly where you cracked.`,
      "HOLO-AI"
    );
    setTimeout(() => setShowReport(true), 2000);
  }, [score, heartData.stress, speech.analytics, stopWebcam, stopHeartbeat, stopListening, addMessage, speakMessage]);

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const overallScore = Math.round((score.communication + score.technical + (heartData.stress === "high" ? 50 : heartData.stress === "medium" ? 75 : 100)) / 3);
  const isInputEmpty = !userInput.trim() && !speech.interimText.trim();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: "linear-gradient(180deg, #060e1a 0%, #081420 50%, #0a1828 100%)" }}>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="status-bar flex items-center justify-between px-4 py-2.5 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-sm font-black font-mono gradient-text">
            HOLO-SYNC
          </div>
          <div className="h-4 w-px" style={{ background: "rgba(78, 205, 196, 0.12)" }} />
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] font-bold" style={{ color: domain.color }}>
            {domain.icon} {domain.label}
          </span>
          <span className={`text-[10px] font-mono uppercase tracking-[0.1em] rounded-full px-2.5 py-0.5 ${
            config.difficulty === "easy" ? "text-green-400" :
            config.difficulty === "hard" ? "text-red-400" :
            "text-yellow-400"
          }`} style={{
            background: config.difficulty === "easy" ? "rgba(0,255,136,0.08)" :
              config.difficulty === "hard" ? "rgba(255,68,68,0.08)" : "rgba(255,170,0,0.08)",
            border: `1px solid ${config.difficulty === "easy" ? "rgba(0,255,136,0.2)" :
              config.difficulty === "hard" ? "rgba(255,68,68,0.2)" : "rgba(255,170,0,0.2)"}`,
          }}>
            {config.difficulty}
          </span>
          {domain.panelMode && (
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-amber-400 rounded-full px-2.5 py-0.5"
              style={{ background: "rgba(255,170,0,0.06)", border: "1px solid rgba(255,170,0,0.15)" }}>
              Panel
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "rgba(0, 212, 255, 0.5)" }}>
          <AnswerTimer
            isActive={waitingForAnswer && phase === "active"}
            maxTime={answerTimeLimit}
            onTimeUp={handleTimeUp}
            difficulty={config.difficulty}
          />
          <span className="tabular-nums">{formatTime(elapsedSeconds)}</span>
          <span className="tabular-nums">Q {Math.min(currentQuestionIndex + 1, questions.length)}/{questions.length}</span>
          {bluffDetected && (
            <span className="text-red-400 animate-pulse rounded-full px-2.5 py-0.5 uppercase tracking-[0.1em] text-[10px]"
              style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)" }}>
              🔍 Bluff
            </span>
          )}
          {adaptiveMode === "escalating" && (
            <span className="text-red-400 animate-pulse rounded-full px-2.5 py-0.5 uppercase tracking-[0.1em] text-[10px]"
              style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)" }}>
              ⬆ Pressure Up
            </span>
          )}
          {pressureMode && (
            <span className="text-orange-400 animate-pulse rounded-full px-2.5 py-0.5 uppercase tracking-[0.1em] text-[10px]"
              style={{ background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.2)" }}>
              ⚠ Under Pressure
            </span>
          )}
          <button onClick={onEnd}
            className="text-red-400/70 hover:text-red-400 rounded-full px-3 py-1 hover:bg-red-400/10 uppercase tracking-[0.1em] text-[10px] transition-all duration-300 cursor-pointer"
            style={{ border: "1px solid rgba(255,68,68,0.15)" }}>
            End
          </button>
        </div>
      </div>

      {/* ── Main Layout ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left Sidebar */}
        <div className="sidebar-panel w-64 shrink-0 flex flex-col gap-2.5 p-2.5 overflow-y-auto" style={{ borderRight: "1px solid rgba(78,205,196,0.08)" }}>
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
          <div className="glass-panel flex flex-col gap-2 p-3 rounded-2xl">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(120, 180, 200, 0.4)" }}>Live Scores</div>
            {[
              { label: "Communication", value: score.communication, color: "#4ecdc4" },
              { label: "Technical", value: score.technical, color: "#a78bfa" },
              { label: "Composure", value: heartData.stress === "high" ? 30 : heartData.stress === "medium" ? 65 : 100, color: heartData.stress === "high" ? "#ff6b6b" : "#4ecdc4" },
            ].map(s => (
              <div key={s.label} className="flex flex-col gap-1">
                <div className="flex justify-between font-mono">
                  <span className="text-[10px]" style={{ color: "rgba(140, 170, 200, 0.5)" }}>{s.label}</span>
                  <span className="text-[10px] tabular-nums" style={{ color: s.color }}>{s.value}%</span>
                </div>
                <div className="h-1 rounded-full" style={{ background: "rgba(20, 35, 50, 0.5)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${s.value}%`, background: `linear-gradient(90deg, ${s.color}88, ${s.color})`, boxShadow: `0 0 6px ${s.color}44` }} />
                </div>
              </div>
            ))}
            <div className="mt-1.5 pt-2" style={{ borderTop: "1px solid rgba(78, 205, 196, 0.06)" }}>
              <div className="flex justify-between font-mono font-bold">
                <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "rgba(120, 180, 200, 0.5)" }}>Overall</span>
                <span className="text-[10px] tabular-nums" style={{ color: "#4ecdc4" }}>{overallScore}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center — Avatar */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(78,205,196,0.03) 0%, rgba(167,139,250,0.015) 40%, transparent 70%)" }} />
          <div className="flex-1 relative overflow-hidden">
            <Avatar3D
              emotion={avatarEmotion}
              isSpeaking={isSpeaking}
              bpm={heartData.bpm ?? 72}
              panelMode={domain.panelMode}
              panelAvatars={panelAvatars}
              activeSpeakerIndex={activeSpeakerIndex}
              getAmplitude={tts.getAmplitude}
              spokenText={spokenText}
              audioBlob={audioBlob}
            />

            <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(120, 180, 200, 0.25)" }}>3D Avatar Interface</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(120, 180, 200, 0.18)" }}>Emotion: {avatarEmotion.toUpperCase()}</div>
            </div>

            {isTyping && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 rounded-full px-4 py-2"
                style={{ background: "rgba(8, 16, 28, 0.85)", border: "1px solid rgba(78, 205, 196, 0.15)", backdropFilter: "blur(12px)" }}>
                <div className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: "#4ecdc4" }} />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(78, 205, 196, 0.65)" }}>Composing response...</span>
              </div>
            )}

            {isSpeaking && !isTyping && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 rounded-full px-4 py-2"
                style={{ background: "rgba(8, 16, 28, 0.85)", border: "1px solid rgba(167, 139, 250, 0.15)", backdropFilter: "blur(12px)" }}>
                <div className="flex gap-0.5">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="w-0.5 rounded-full animate-bounce"
                      style={{ background: "#a78bfa", height: `${8 + Math.random() * 8}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(167, 139, 250, 0.65)" }}>Interviewer Speaking...</span>
              </div>
            )}

            {pressureMode && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="text-6xl animate-pulse opacity-15" style={{ color: "#ff4444", filter: "blur(1px)" }}>⚠</div>
              </div>
            )}
          </div>

          {/* ── Input Bar ─────────────────────────────────────────── */}
          <div className="input-bar shrink-0 p-3">
            {/* Mic live indicator */}
            {micOn && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
                  Listening
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
                {speech.interimText && (
                  <span className="text-[10px] font-mono text-cyan-400/60 italic truncate ml-1 max-w-[200px]">
                    {speech.interimText.slice(0, 50)}{speech.interimText.length > 50 ? "…" : ""}
                  </span>
                )}
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
                    ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_15px_rgba(255,107,107,0.3)]"
                    : "border hover:bg-teal-500/10"
                }`}
              >
                {micOn && (
                  <div className="absolute inset-0 rounded-xl border-2 border-red-500 animate-ping opacity-40" />
                )}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="12" rx="3"
                    fill={micOn ? "#ff6b6b" : "#4ecdc4"} />
                  <path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7"
                    stroke={micOn ? "#ff6b6b" : "#4ecdc4"} strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="17" x2="12" y2="22"
                    stroke={micOn ? "#ff6b6b" : "#4ecdc4"} strokeWidth="2" strokeLinecap="round" />
                  <line x1="9" y1="22" x2="15" y2="22"
                    stroke={micOn ? "#ff6b6b" : "#4ecdc4"} strokeWidth="2" strokeLinecap="round" />
                  {!micOn && (
                    <line x1="4" y1="4" x2="20" y2="20" stroke="#4ecdc4" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
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
                  className="w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none disabled:opacity-40 transition-all duration-300"
                  style={{
                    background: "rgba(10, 20, 32, 0.7)",
                    border: micOn ? "1px solid rgba(255,107,107,0.2)" : "1px solid rgba(78, 205, 196, 0.1)",
                    color: "rgba(180, 210, 240, 0.85)",
                    boxShadow: micOn ? "0 0 0 1px rgba(255,107,107,0.1) inset" : undefined,
                  }}
                />
                
              </div>

              {/* Send button */}
              <button
                onClick={handleSubmitAnswer}
                disabled={phase === "ended" || phase === "starting" || isSpeaking || isInputEmpty}
                className="shrink-0 px-5 py-3 rounded-xl font-bold text-sm uppercase tracking-[0.15em] transition-all duration-300 disabled:opacity-30 active:scale-95 cursor-pointer"
                style={{
                  background: !isInputEmpty ? "rgba(78,205,196,0.08)" : "rgba(30,40,60,0.25)",
                  border: `1px solid ${!isInputEmpty ? "rgba(78,205,196,0.25)" : "rgba(60,70,90,0.25)"}`,
                  color: !isInputEmpty ? "#4ecdc4" : "rgba(100,120,140,0.5)",
                  boxShadow: !isInputEmpty ? "0 0 15px rgba(78,205,196,0.08)" : undefined,
                }}
              >
                Send
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
        <div className="sidebar-panel w-80 shrink-0 flex flex-col" style={{ borderLeft: "1px solid rgba(78,205,196,0.08)" }}>
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(78,205,196,0.06)" }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ecdc4" }} />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(120, 180, 200, 0.4)" }}>Session Transcript</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <InterviewChat messages={messages} isTyping={isTyping} />
          </div>

          <div className="shrink-0 p-2.5" style={{ borderTop: "1px solid rgba(78,205,196,0.06)" }}>
            <StudentAnalytics
              analytics={speech.analytics}
              isListening={speech.isListening}
              answerCount={answerCount}
              sessionTime={elapsedSeconds}
            />
          </div>

          {phase === "ended" && (
            <div className="shrink-0 p-3 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(78,205,196,0.06)" }}>
              <button onClick={() => setShowReport(true)}
                className="w-full py-2.5 rounded-xl font-bold text-sm uppercase tracking-[0.15em] transition-all duration-300 cursor-pointer"
                style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa" }}>
                View Full Report
              </button>
              <button onClick={onEnd}
                className="w-full py-2.5 rounded-xl font-bold text-sm uppercase tracking-[0.15em] transition-all duration-300 cursor-pointer"
                style={{ background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)", color: "#4ecdc4" }}>
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
          stressMarkers={stressMarkersRef.current}
          onClose={onEnd}
        />
      )}
    </div>
  );
}
