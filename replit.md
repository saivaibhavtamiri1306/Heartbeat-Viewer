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
- **rPPG Heartbeat Detection (v4)**: Simplified proven approach based on habom2310, giladoved, erdewit/heartwave, prouast/heartbeat-js repos. Green channel average from forehead+cheek ROI → 256-sample buffer → linear detrend → Hamming window → zero-padded FFT → peak in 0.75–3.0 Hz (45–180 BPM) → parabolic interpolation → EMA smoothing (α=0.3). Uses actual webcam FPS from timestamps. Calibrates in ~3s (90 frames). No POS/ACF/consensus — just the proven green+FFT pipeline that all working repos use.
- **3D Holographic Avatar**: TalkingHead.js (met4citizen/TalkingHead) integration with GLB avatar models (brunette.glb, avaturn.glb, avatarsdk.glb). Real 3D rendered characters via Three.js with idle animations (blinking, breathing, head movement), emotion-adaptive moods, and amplitude-driven lip sync via morph target blend shapes.
- **5 Interview Domains**: UPSC, SWE, NDA, Medical, Investment Banking — each with domain-specific educational backgrounds, topic selection, and Easy/Medium/Hard difficulty levels.
- **Interview Configuration**: After domain selection, users choose their educational background (B.Tech, BA, MBBS, etc.), difficulty level, and specific topics. Questions are filtered and weighted by difficulty.
- **Cross-Fire Panel Mode**: UPSC and NDA have 3-avatar panels. Active speaker is highlighted with glow + scale. Other avatars are dimmed.
- **AI TTS Voices**: OpenAI-powered text-to-speech via `/api/tts` endpoint. Each interviewer persona has a distinct voice (onyx for chairman, echo for technical, nova for default). Falls back to browser SpeechSynthesis if API fails.
- **Lip Sync**: Proper phoneme-based lip sync via TalkingHead's `speakAudio()`. TTS audio blob is decoded to AudioBuffer, text is split into words with proportional timings, then passed to `head.speakAudio({audio, words, wtimes, wdurations})` which converts each word to viseme sequences (aa, oh, ee, PP, FF, etc.) timed to the audio. TalkingHead's audio output is muted (`mixerGainSpeech: 0.001`) since useTTS handles playback separately. Speech run ID tokens prevent concurrency bugs.
- **Subtitles**: Spoken text displayed as overlay on the 3D scene.
- **Heart Rate Reactive Interviewer**: Monitors BPM history and detects spikes (>12 BPM increase), drops (>10 BPM decrease), and sustained elevation (>100 BPM for 20+ readings). Interviewer dynamically comments on heart rate changes with contextual responses and states your current BPM. 30-second cooldown between comments.
- **Adaptive Biometric Difficulty**: Dynamically adjusts question difficulty based on real-time heart rate. When stressed (HR > baseline+15 or >95 BPM for 2+ consecutive questions), injects easier "cooling" questions with empathetic transitions. When calm (HR < baseline+5 or <80 BPM for 3+ questions), escalates to harder questions with stern transitions. 45-second cooldown between adaptations. UI shows ⬇ Cooling / ⬆ Escalating indicators.
- **Bullshit Detector**: Bluff detection with stress analysis from rPPG data.
- **Speech Recognition**: Mic-based input via Web Speech API.
- **AI Follow-Up Questions**: After each answer, ~40% chance AI generates a contextual follow-up based on your actual response. Up to 2 consecutive follow-ups. Uses GPT-4o-mini via `/api/followup`.
- **AI Answer Evaluation**: Each answer is scored 1-10 by AI with strengths, weaknesses, and suggestions via `/api/evaluate`. Scores feed into live scoring.
- **Answer Timer**: Per-question countdown timer (easy=120s, medium=90s, hard=60s). Visual urgency indicators — yellow at 15s, red pulsing at 5s. Auto-advances on timeout with penalty score.
- **Eye Contact Detection**: Tracks face position relative to camera center. Shows live "ENGAGED"/"AWAY" status with percentage bar. Properly accounts for no-face intervals.
- **Post-Interview Report**: Comprehensive analytics dashboard showing: overall grade (A+ to F), core score bars, BPM timeline chart, answer-by-answer breakdown with AI scores, speech stats (WPM, filler words), eye contact %, adaptive/bluff trigger counts, and personalized recommendations.

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
- Design: bg #000408, cyan #00d4ff, purple #7700ff, red #ff4444, font Orbitron
