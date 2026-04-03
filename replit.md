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
- **rPPG Heartbeat Detection**: Webcam-based heart rate via POS algorithm with triple-method consensus (peak counting + FFT + autocorrelation). Uses 1st-order Butterworth bandpass 0.75–3.0 Hz with filtfilt, smoothness-prior detrending, EMA smoothing.
- **3D Holographic Avatar**: React Three Fiber scene with realistic human-like faces (skin tone, lips, jaw, irises, eyebrows, ears). Emotion-adaptive (neutral, stern, empathetic, amused, thinking).
- **5 Interview Domains**: UPSC, SWE, NDA, Medical, Investment Banking.
- **Cross-Fire Panel Mode**: UPSC and NDA have 3-avatar panels. Active speaker is highlighted with glow + scale. Other avatars are dimmed.
- **Lip Sync**: Mouth animation driven by `requestAnimationFrame` loop synced to SpeechSynthesis `onboundary` events. Uses speech run ID tokens to prevent concurrency bugs.
- **Subtitles**: Spoken text displayed as overlay on the 3D scene, progressively updated word-by-word.
- **Bullshit Detector**: Bluff detection with stress analysis from rPPG data.
- **Speech Recognition**: Mic-based input via Web Speech API.

### Key Files
- `src/hooks/useHeartbeat.ts` — rPPG algorithm (POS, Butterworth, consensus BPM)
- `src/components/Avatar3D.tsx` — 3D avatar with HumanHead, panel mode, lip sync, subtitles
- `src/pages/Interview.tsx` — Main interview page (speech, questions, avatar wiring)
- `src/hooks/useFaceDetection.ts` — MediaPipe face landmark detection
- `src/components/WebcamFeed.tsx` — Webcam component with ROI extraction
- `src/data/questions.ts` — Question bank for all 5 domains
- `src/hooks/useSpeechRecognition.ts` — Speech-to-text hook

### Architecture Notes
- Avatar3D props: `activeSpeakerIndex`, `mouthOpenness`, `spokenText` for speaker tracking/lip sync
- Speech concurrency: `speechRunIdRef` token prevents stale callbacks from cancelled utterances
- Mouth animation: Single RAF loop with `mouthAnimActiveRef` guard prevents duplicate loops
- MediaPipe WASM at `/mediapipe-wasm/`, model at `/mediapipe-models/face_landmarker.task`
- Design: bg #000408, cyan #00d4ff, purple #7700ff, red #ff4444, font Orbitron
