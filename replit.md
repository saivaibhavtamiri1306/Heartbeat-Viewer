# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Holo-Sync — Biometric Interviewer App

**Artifact**: `artifacts/holo-sync` (React + Vite + Three.js)

### Features
- **rPPG Heartbeat Detection (v7)**: Research-grade multi-algorithm pipeline. Three methods run in parallel: POS (Wang et al. 2017), CHROM (De Haan & Jeanne 2013), and GREEN channel FFT — best selected by spectral SNR. Pipeline: skin-filtered ROI sampling (YCbCr per-pixel validation) → illumination normalization (bounded gain, per-channel clamping) → motion artifact detection with gradual decay (12-frame cooldown, 6-frame threshold for full rejection) → signal detrending (moving-mean removal) → adaptive smoothing (window scales with noise level, ADAPTIVE_SMOOTH_MIN/MAX bounded) → Butterworth bandpass (0.75–3.0 Hz) → Welch's method PSD (power-averaged segmented periodogram with 50% overlap, Hamming windowed, tail-segment coverage) for buffers ≥90 frames OR 4x zero-padded FFT for shorter buffers → parabolic peak interpolation → harmonic/sub-harmonic rejection → autocorrelation cross-validation → SQI with spectral flatness (concentration 60% + inverse flatness 40%) → consensus voting (SNR-weighted average when 2+ algorithms agree, +15 confidence bonus) → skin-quality-weighted confidence → temporal confidence averaging (10-frame window) → IQR + MAD outlier rejection on 30-sample history → 4-tier quality-adaptive EMA smoothing (jump ≤4/≤8/≤15/>15 BPM) → stability tracking (BPM std over last 5 readings). Weighted ROI sampling (forehead 3x, cheeks 2x, nose 1.5x). BUFFER_SIZE=450, MIN_FRAMES_FAST=48, MIN_FRAMES_FULL=72, POS/CHROM window=2.0s, processes every 2nd frame. ROI debug shows skin ratio + stability percentage.
- **3D Holographic Avatar**: TalkingHead.js (met4citizen/TalkingHead) integration with GLB avatar models (brunette.glb, avaturn.glb, avatarsdk.glb). Real 3D rendered characters via Three.js with idle animations (blinking, breathing, head movement), emotion-adaptive moods, and amplitude-driven lip sync via morph target blend shapes.
- **5 Interview Domains**: UPSC, SWE, NDA, Medical, Investment Banking — each with domain-specific educational backgrounds, topic selection, and Easy/Medium/Hard difficulty levels.
- **Interview Configuration**: After domain selection, users choose their educational background (B.Tech, BA, MBBS, etc.), difficulty level, and specific topics. Questions are filtered and weighted by difficulty.
- **Cross-Fire Panel Mode**: UPSC and NDA have 3-avatar panels. Active speaker is highlighted with glow + scale. Other avatars are dimmed.
- **AI TTS Voices**: OpenAI-powered text-to-speech via `/api/tts` endpoint. Each interviewer persona has a distinct voice (onyx for chairman, echo for technical, nova for default). Falls back to browser SpeechSynthesis if API fails.
- **Lip Sync**: Proper phoneme-based lip sync via TalkingHead's `speakAudio()`. TTS audio blob is decoded to AudioBuffer, text is split into words with proportional timings, then passed to `head.speakAudio({audio, words, wtimes, wdurations})` which converts each word to viseme sequences (aa, oh, ee, PP, FF, etc.) timed to the audio. TalkingHead's audio output is muted (`mixerGainSpeech: 0.001`) since useTTS handles playback separately. Speech run ID tokens prevent concurrency bugs.
- **Subtitles**: Spoken text displayed as overlay on the 3D scene.
- **Heart Rate Reactive Interviewer**: Monitors BPM history and detects spikes (>12 BPM increase), drops (>10 BPM decrease), and sustained elevation (>100 BPM for 20+ readings). Interviewer responds with stern pressure comments (no comfort/empathy). States your current BPM. 30-second cooldown between comments. Stress markers are logged for post-interview analysis.
- **Pressure Training System**: No adaptive cooling — difficulty ONLY escalates, never reduces. When stressed (HR > baseline+15 or >95 BPM for 2+ consecutive questions), system escalates to harder questions with pressure phrases. When calm, also escalates. System logs "composure break" points. Replaces old empathy/comfort approach with realistic interview pressure simulation. UI shows ⬆ Pressure Up / ⚠ Under Pressure indicators.
- **Stress Endurance Score**: Post-interview metric measuring stability under pressure (stress ratio), recovery speed (how quickly composure returns), and composure endurance (longest calm streak). Displayed as a dedicated ring chart alongside overall grade.
- **Pressure Timeline**: SVG visualization in report showing BPM over time with stress threshold line, highlighted spike zones (red regions), and annotated composure break points. Shows exactly where candidate cracked under pressure.
- **Bullshit Detector**: Bluff detection with stress analysis from rPPG data.
- **Speech Recognition**: Mic-based input via Web Speech API.
- **AI Follow-Up Questions**: After each answer, ~70% chance AI generates a contextual follow-up based on your actual response. Up to 3 consecutive follow-ups. Uses GPT-4o-mini via `/api/followup`.
- **AI Answer Evaluation**: Each answer is scored 1-10 by AI with strengths, weaknesses, and suggestions via `/api/evaluate`. Inline evaluation bubbles appear in chat with color-coded badges (green ≥7, yellow ≥5, red <5) showing score, strengths (✦), weaknesses (△), and suggestions (→). Scores feed into live scoring.
- **Collapsible HeartbeatMonitor**: Click header to toggle open/close; smooth slide animation. BPM shown inline when collapsed.
- **Answer Timer**: Per-question countdown timer (easy=120s, medium=90s, hard=60s). Visual urgency indicators — yellow at 15s, red pulsing at 5s. Auto-advances on timeout with penalty score.
- **Eye Contact Detection**: Tracks face position relative to camera center. Shows live "ENGAGED"/"AWAY" status with percentage bar. Properly accounts for no-face intervals.
- **Confidence-Scored Detections**: All biometric events (stress, HR spikes, composure breaks) display computed confidence percentages. Confidence derived from signal quality, stability, and multi-indicator agreement. System messages show "Stress Detected (Confidence: 82%)" format.
- **Multi-Session Progress Tracking**: localStorage-based session history (last 20 sessions). After 2+ sessions in same domain, report shows progress deltas: eye contact improvement %, stress endurance change, composure break reduction, filler word reduction, overall score trend. Compares against rolling average of last 3 sessions.
- **Weighted Grading System**: Overall grade uses weighted formula: AI Eval Score (40%), Answer Rate (15%), Communication (15%), Technical (15%), Stress Management (15%). Scores penalized for: poor answers (eval < 4), timeouts (-3 comm, -4 tech), composure breaks (-12 stress), stress detections (-5 stress). Short/trivial answers (< 15 words) earn minimal points. Only strong eval scores (7+) give significant bonuses. Grade scale: A+ (≥90), A (≥80), B+ (≥70), B (≥60), C (≥50), D (≥40), F (<40).
- **Post-Interview Report**: Comprehensive pressure debrief showing: overall grade (A+ to F), Stress Endurance Score ring, Pressure Timeline with break points, session progress tracking (after 2+ sessions), core score bars (Answer Quality, Answer Rate, Communication, Technical, Stress Mgmt, Eye Contact), composure break point log with confidence scores, stress events with confidence, answer-by-answer breakdown with AI scores, speech stats (WPM, filler words), pressure escalation/bluff trigger counts, and stern training feedback (no comfort language).

### Key Files
- `src/hooks/useHeartbeat.ts` — rPPG algorithm (POS, Butterworth, consensus BPM)
- `src/hooks/useTTS.ts` — AI TTS hook with OpenAI voice playback + browser fallback
- `src/hooks/useEyeContact.ts` — Eye contact detection from face position
- `src/components/Avatar3D.tsx` — 3D avatar using TalkingHead.js GLB renderer, panel mode, amplitude-driven lip sync
- `src/vendor/talkinghead.mjs` — TalkingHead library (met4citizen/TalkingHead v1.7) with Three.js 3D avatar renderer
- `src/vendor/lipsync-en.mjs` — English lip-sync module for TalkingHead
- `src/vendor/dynamicbones.mjs` — Dynamic bone physics for TalkingHead avatars
- `src/vendor/playback-worklet.js` — Audio worklet for TalkingHead streaming
- `src/components/InterviewReport.tsx` — Full post-interview analytics report
- `src/components/AnswerTimer.tsx` — Per-question countdown timer
- `src/components/EyeContactIndicator.tsx` — Live eye contact status indicator
- `src/pages/InterviewConfig.tsx` — Pre-interview config (background, difficulty, topics)
- `src/pages/Interview.tsx` — Main interview page (speech, questions, avatar wiring)
- `src/hooks/useFaceDetection.ts` — MediaPipe face landmark detection
- `src/components/WebcamFeed.tsx` — Webcam component with ROI extraction
- `src/data/questions.ts` — Question bank for all 5 domains
- `src/hooks/useSpeechRecognition.ts` — Speech-to-text hook

### API Server (`artifacts/api-server`)
- `/api/tts` — POST `{text, voice}` → audio/mpeg. Lazy-loads OpenAI module. Max 2000 chars.
- `/api/followup` — POST `{question, answer, domain, difficulty, avatarName}` → `{followUp, avatarName}`. AI-generated follow-up question. Rate-limited (30 req/min).
- `/api/evaluate` — POST `{question, answer, domain}` → `{score, strengths, weaknesses, suggestion}`. AI answer evaluation. Rate-limited (30 req/min).
- Vite proxy in holo-sync forwards `/api` → `http://localhost:8080`
- Uses `@workspace/integrations-openai-ai-server` lib for OpenAI (TTS + chat completions)

### Architecture Notes
- Avatar3D props: `activeSpeakerIndex`, `mouthOpenness`, `spokenText` for speaker tracking/lip sync
- Speech concurrency: `speechRunIdRef` token prevents stale callbacks from cancelled utterances
- Mouth animation: Single RAF loop with `mouthAnimActiveRef` guard prevents duplicate loops
- TTS voice mapping: onyx (chairman), echo (technical), fable (third panelist), nova (default/female)
- MediaPipe WASM at `/mediapipe-wasm/`, model at `/mediapipe-models/face_landmarker.task`
- Design: Pressure training palette — bg gradient #060e1a→#081420→#0a1828, teal #4ecdc4, lavender #a78bfa, warm amber #ffc078, red #ff4444 (pressure accents). Borders rgba(78,205,196,0.06-0.12). Font Orbitron. maxQuestions=15. Landing tagline: "Biometric Pressure Training System". No empathy/comfort responses — all interviewer responses are stern/neutral.
