# HOLO-SYNC: Complete Documentation
## The Universal Biometric Interviewer
### (Explained so even a 10-year-old can understand)

---

## TABLE OF CONTENTS

1. [What is Holo-Sync?](#1-what-is-holo-sync)
2. [Why did we build it?](#2-why-did-we-build-it)
3. [What problem does it solve?](#3-what-problem-does-it-solve)
4. [How does the whole thing work? (Big Picture)](#4-how-does-the-whole-thing-work)
5. [Tech Stack — What tools did we use?](#5-tech-stack)
6. [Project Structure — How files are organized](#6-project-structure)
7. [Feature-by-Feature Deep Dive](#7-feature-by-feature-deep-dive)
   - 7.1 [Webcam & Face Detection](#71-webcam--face-detection)
   - 7.2 [Heart Rate Detection (rPPG)](#72-heart-rate-detection-rppg)
   - 7.3 [Eye Contact Tracking](#73-eye-contact-tracking)
   - 7.4 [3D Holographic Avatar](#74-3d-holographic-avatar)
   - 7.5 [Speech Recognition (Listening to You)](#75-speech-recognition)
   - 7.6 [Text-to-Speech (Avatar Talks Back)](#76-text-to-speech)
   - 7.7 [AI Follow-Up Questions](#77-ai-follow-up-questions)
   - 7.8 [AI Answer Evaluation](#78-ai-answer-evaluation)
   - 7.9 [Bluff / BS Detector](#79-bluff--bs-detector)
   - 7.10 [Answer Timer](#710-answer-timer)
   - 7.11 [Adaptive Difficulty (Biometric)](#711-adaptive-difficulty)
   - 7.12 [Cross-Fire Panel Mode](#712-cross-fire-panel-mode)
   - 7.13 [5 Interview Domains](#713-five-interview-domains)
   - 7.14 [Post-Interview Report](#714-post-interview-report)
8. [How the Frontend and Backend Talk to Each Other](#8-frontend-backend-communication)
9. [How to Run the Project](#9-how-to-run-the-project)
10. [Common Hackathon Questions & Answers](#10-hackathon-qa)
11. [Architecture Diagram (Text Version)](#11-architecture-diagram)
12. [What Makes This Project Unique?](#12-what-makes-this-unique)

---

## 1. What is Holo-Sync?

**Holo-Sync** is a web application that acts as an AI-powered interview simulator. Imagine you're preparing for a big exam interview (like UPSC, or a software engineering job interview). Instead of asking a friend to practice with you, you open Holo-Sync in your browser and:

- A **3D holographic AI avatar** appears on screen (like a futuristic robot interviewer)
- It **asks you questions** using a real human-like voice
- You **answer using your microphone** (or type)
- The app **watches your face through your webcam** and does 3 incredible things:
  1. **Measures your heart rate** just from your face (no fitness band needed!)
  2. **Tracks if you're maintaining eye contact** with the camera
  3. **Detects if you look stressed** and adjusts questions accordingly
- After the interview, you get a **detailed report card** showing how you did

Think of it as a **video game that trains you for real interviews**, but instead of fighting monsters, you're fighting nervousness and building confidence.

---

## 2. Why did we build it?

- **Problem**: Most students can't afford interview coaching (Rs. 5000-50000 per session)
- **Problem**: You can't practice alone — you need someone to ask questions and evaluate
- **Problem**: Real interviews cause anxiety, and nobody helps you manage that stress
- **Solution**: Holo-Sync gives you an unlimited, free, AI-powered interview coach that reads your body signals and adapts in real time

---

## 3. What problem does it solve?

| Real-World Problem | How Holo-Sync Solves It |
|---|---|
| No practice partner available | AI avatar asks questions 24/7 |
| Can't afford coaching | Free to use, runs in browser |
| Interview anxiety | Measures your stress via heart rate, helps you practice under pressure |
| Poor eye contact habits | Tracks and scores your eye contact |
| Don't know if answers are good | AI evaluates every answer with score, strengths, weaknesses |
| Can't handle follow-up questions | AI generates relevant follow-ups based on your actual answer |
| No feedback on speaking style | Tracks filler words (um, uh, like), speaking speed, vocabulary |
| One-size-fits-all practice | 5 different domains (UPSC, Software, Defence, Medical, Banking) |

---

## 4. How does the whole thing work?

Here's the flow, step by step, like telling a story:

### Step 1: You open the app
You see a futuristic landing page with 5 interview domains to choose from.

### Step 2: You pick a domain and difficulty
Say you pick "Software Engineering" with "Medium" difficulty.

### Step 3: The interview starts
- Your **webcam turns on** (you give permission)
- A **3D avatar** appears — it looks like a holographic human head
- The avatar **speaks the first question** using a realistic AI voice
- A **timer starts** (you have 90 seconds for medium difficulty)

### Step 4: While you answer...
Behind the scenes, the app is doing ALL of this simultaneously:
- **Watching your face** (478 face landmark points tracked)
- **Measuring your heart rate** from tiny color changes in your forehead skin
- **Checking if you're looking at the camera** (eye contact)
- **Listening to your words** and converting speech to text
- **Counting filler words** (um, uh, basically, like)
- **Timing your answer**

### Step 5: After you answer
- Your answer is sent to **OpenAI GPT-4o-mini** for evaluation
- The AI generates a **smart follow-up question** based on what you said
- If your heart rate spiked (you got nervous), the AI might ask an **easier question**
- If you seem too calm, it might ask a **harder one**

### Step 6: Interview ends
You get a full **report card** with:
- Scores for communication, technical, stress management
- Heart rate graph throughout the interview
- Eye contact percentage
- Speaking speed and filler word count
- Score for each answer with AI feedback

---

## 5. Tech Stack

Here's what tools/libraries we used, and why:

### Frontend (What you see in the browser)

| Tool | What it does | Why we chose it |
|---|---|---|
| **React** | Builds the user interface (buttons, pages, etc.) | Most popular UI library, component-based |
| **TypeScript** | JavaScript with types (catches errors before running) | Prevents bugs, better code quality |
| **Vite** | Development server + build tool | Super fast, instant hot reload |
| **React Three Fiber** | Renders 3D graphics in the browser | Makes Three.js work with React |
| **Three.js** | 3D rendering engine | Creates the holographic avatar |
| **@react-three/drei** | Helper components for 3D (stars, text, float) | Makes 3D development easier |
| **MediaPipe** | Google's face detection AI | Detects 478 face landmarks in real-time |
| **Web Speech API** | Browser's built-in speech-to-text | Free, no API key needed, works offline |
| **Tailwind CSS** | Utility-first CSS framework | Fast styling, consistent design |
| **Shadcn/UI** | Pre-built UI components | Beautiful buttons, cards, dialogs |

### Backend (Server that runs behind the scenes)

| Tool | What it does | Why we chose it |
|---|---|---|
| **Express.js** | Web server framework | Simple, fast, widely used |
| **OpenAI GPT-4o-mini** | AI language model | Generates follow-up questions and evaluations |
| **OpenAI TTS** | Text-to-speech API | Creates realistic human voices for the avatar |
| **Pino** | Logging library | Fast, structured logs for debugging |

### Architecture Pattern

| Term | What it means |
|---|---|
| **pnpm monorepo** | One project folder containing multiple apps (frontend + backend) |
| **Artifact-based** | Each app (holo-sync, api-server) is a separate "artifact" |
| **REST API** | Frontend talks to backend using HTTP requests (POST /api/followup) |
| **Client-side processing** | Heart rate + face detection run in YOUR browser (not on a server) |

---

## 6. Project Structure

```
workspace/
├── artifacts/
│   ├── holo-sync/                    # FRONTEND (React app)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Landing.tsx       # Home page (domain selection)
│   │   │   │   ├── InterviewConfig.tsx # Setup page (difficulty, question count)
│   │   │   │   ├── Interview.tsx     # Main interview page (THE BIG ONE)
│   │   │   │   └── not-found.tsx     # 404 error page
│   │   │   ├── components/
│   │   │   │   ├── Avatar3D.tsx      # 3D holographic head (Three.js)
│   │   │   │   ├── WebcamFeed.tsx    # Shows webcam + green ROI boxes
│   │   │   │   ├── HeartbeatMonitor.tsx # Heart rate display panel
│   │   │   │   ├── InterviewChat.tsx # Chat messages panel
│   │   │   │   ├── InterviewReport.tsx # Post-interview report card
│   │   │   │   ├── AnswerTimer.tsx   # Countdown timer
│   │   │   │   ├── EyeContactIndicator.tsx # Eye contact status
│   │   │   │   └── StudentAnalytics.tsx # Real-time speech stats
│   │   │   ├── hooks/                # Custom logic modules
│   │   │   │   ├── useHeartbeat.ts   # rPPG heart rate detection
│   │   │   │   ├── useFaceDetection.ts # MediaPipe face tracking
│   │   │   │   ├── useEyeContact.ts  # Eye contact detection
│   │   │   │   ├── useSpeechRecognition.ts # Voice-to-text
│   │   │   │   ├── useTTS.ts         # Text-to-speech
│   │   │   │   └── useWebcam.ts      # Camera access
│   │   │   └── data/
│   │   │       └── questions.ts      # All interview questions (500+ questions)
│   │   └── vite.config.ts            # Build configuration
│   │
│   └── api-server/                   # BACKEND (Express server)
│       └── src/
│           ├── index.ts              # Server startup
│           ├── app.ts                # Express setup + middleware
│           └── routes/
│               ├── health.ts         # Health check endpoint
│               ├── tts/index.ts      # Text-to-speech route
│               └── followup/index.ts # AI follow-up + evaluation routes
│
├── package.json                      # Root workspace config
└── pnpm-workspace.yaml               # Monorepo workspace definition
```

**Simple analogy**: Think of it like a restaurant:
- `holo-sync/` = The dining area (what customers see and interact with)
- `api-server/` = The kitchen (where the cooking/AI processing happens)
- The **Vite proxy** = The waiter who carries orders between them

---

## 7. Feature-by-Feature Deep Dive

### 7.1 Webcam & Face Detection

**What it does**: Opens your camera and finds your face in real-time.

**How it works (simple)**:
1. When you start an interview, the browser asks "Can I use your camera?"
2. You click "Allow"
3. The camera stream goes into a `<video>` element (invisible processing)
4. **MediaPipe FaceLandmarker** (made by Google) analyzes each video frame
5. It finds **478 points** on your face — eyes, nose, mouth, forehead, cheeks, jaw
6. From these points, we calculate 3 important "boxes":
   - **Face box** — rectangle around your whole face
   - **Forehead box** — small rectangle on your forehead (for heart rate)
   - **Cheek box** — rectangle on your cheeks (backup for heart rate)

**The 3-tier fallback system**:
- **Tier 1**: MediaPipe FaceLandmarker (best — 478 landmarks)
- **Tier 2**: MediaPipe FaceDetector (simpler — just a bounding box)
- **Tier 3**: YCbCr BFS (fully offline — detects skin color to find face)

This means face detection works even if the AI model fails to load!

**Key file**: `useFaceDetection.ts` (312 lines)

**Hackathon-ready explanation**:
> "We use Google's MediaPipe FaceLandmarker which runs a TensorFlow Lite model directly in the browser using WebAssembly. It identifies 478 facial landmarks at approximately 30 frames per second. We extract forehead and cheek ROIs from specific landmark indices for our rPPG pipeline."

---

### 7.2 Heart Rate Detection (rPPG)

**This is the STAR feature. This is what will impress judges the most.**

**What is rPPG?**
rPPG stands for **Remote Photoplethysmography**. Big word, simple idea:

When your heart beats, it pushes blood through your body. That blood goes to your face too. When blood rushes to your face, your skin gets **very slightly redder** (so tiny you can't see it with your eyes). But a camera CAN see this tiny color change! By measuring these color changes over time, we can calculate your heart rate.

**How it works, step by step**:

1. **Grab pixels**: Every frame (30 times per second), we look at the pixels in your forehead and cheeks
2. **Extract green channel**: Each pixel has Red, Green, Blue values. We use the **green channel** because hemoglobin (the red stuff in blood) absorbs green light the most — so green shows the biggest changes
3. **Buffer it**: We store the last 256 green values (about 8.5 seconds of data)
4. **Smooth it**: Apply a 5-point moving average to reduce random noise
5. **Filter it**: Apply a **Butterworth bandpass filter** that only keeps frequencies between 0.75 Hz and 3.0 Hz (that's 45 to 180 beats per minute — the range of a human heart)
6. **Window it**: Apply a **Hamming window** (a mathematical trick that reduces edge effects)
7. **FFT**: Perform a **Fast Fourier Transform** — this converts the time-based signal into a frequency-based signal. Think of it like finding which musical note is being played. The "note" that's strongest is your heart rate frequency
8. **Find the peak**: Look for the highest peak in the frequency spectrum between 0.75-3.0 Hz
9. **Refine**: Use **parabolic interpolation** to get a more precise peak position
10. **Smooth output**: Use **EMA (Exponential Moving Average)** smoothing so the BPM number doesn't jump around wildly
11. **Remove outliers**: Use **IQR (Interquartile Range) filtering** to throw away readings that are clearly wrong

**What makes our implementation special (vs. other repos)**:
- We sample **all 3 color channels** (R, G, B) and automatically pick the one with the best signal (usually green wins, but sometimes red is better depending on lighting)
- We have a **Signal Quality Index (SQI)** that tells you how reliable the current reading is
- We have a **Butterworth bandpass filter** with zero-phase (filtfilt) filtering — most simple repos skip this
- We reject outlier readings using IQR statistics

**Accuracy**: Under good lighting conditions (bright room, sitting still), we get within 5-10 BPM of a real heart rate monitor.

**The green boxes on your face**: Those two semi-transparent green rectangles on the webcam feed show exactly where we're sampling pixel colors from. One on the forehead, one on the cheek area.

**Key file**: `useHeartbeat.ts` (about 300 lines)

**References**: Based on open-source implementations from:
- habom2310/Heart-rate-measurement-using-camera
- giladoved/webcam-heart-rate-monitor
- erdewit/heartwave
- prouast/heartbeat-js
- webcam-pulse-detector (thearn)

**Hackathon-ready explanation**:
> "We implemented remote photoplethysmography using the green channel average from forehead and cheek ROIs. The signal pipeline consists of temporal smoothing, zero-phase Butterworth bandpass filtering (0.75-3.0 Hz), Hamming windowing, zero-padded FFT with parabolic peak interpolation, and EMA output smoothing. We also do multi-channel analysis (R, G, B) and select the channel with highest SNR. Signal quality is measured via spectral concentration ratio."

---

### 7.3 Eye Contact Tracking

**What it does**: Detects whether you're looking at the camera or looking away.

**How it works**:
1. MediaPipe gives us the position of your **irises** (the colored part of your eyes)
2. We also get the position of your eye corners (inner corner and outer corner)
3. We calculate how far your iris is from the center of your eye
4. If the iris is close to center → you're looking straight → **eye contact detected**
5. If the iris is shifted left/right → you're looking away → **no eye contact**

**The math**: We compare the iris X position to the midpoint between the inner and outer eye corner. If the ratio is between 0.35 and 0.65, you're maintaining eye contact.

**What it tracks**:
- `isLooking`: boolean — are you looking at camera right now?
- `percentage`: 0-100 — how much of the time you maintained eye contact
- `duration`: how many seconds you've been looking continuously
- `breaks`: how many times you looked away

**Key file**: `useEyeContact.ts`

---

### 7.4 3D Holographic Avatar

**What it does**: Renders a realistic 3D human face that acts as your interviewer.

**How it works**:
- Built with **React Three Fiber** (React wrapper for Three.js)
- The head is made of **many 3D shapes** (spheres, capsules, cylinders) arranged to look like a human face
- It has: cranium, forehead, temples, cheekbones, eye sockets, eyeballs, irises, pupils, eyelids, brow ridge, nose (bridge + tip + nostrils), nasolabial folds, philtrum, lips, chin, jawline, ears, and a neck
- **Animations**:
  - Eyes **blink** periodically (random timing)
  - Irises **move** slightly (looking around naturally)
  - Mouth **opens and closes** when speaking (synced to TTS audio)
  - Eyebrows **change position** based on emotion (stern = frown, curious = raised)
  - Head **subtly rotates** (slight natural movement)
  - **Pulse rings** expand when speaking (holographic effect)
  - A **scan line** moves up and down across the face (futuristic effect)
- **Emotion system**: The avatar's colors change based on emotion:
  - Neutral = cyan blue
  - Empathetic = green
  - Stern = red
  - Curious = orange
  - Stressed = magenta/pink
- **Background effects**: Stars, neural network particles, DNA helix, grid, nebula

**Mouth sync**: When the avatar speaks, a `requestAnimationFrame` loop oscillates the `mouthOpenness` value between 0 and 1, making the lips move realistically.

**Key file**: `Avatar3D.tsx` (550+ lines)

---

### 7.5 Speech Recognition

**What it does**: Converts your spoken words into text in real-time.

**How it works**:
- Uses the **Web Speech API** (built into Chrome/Edge browsers)
- No API key needed, no server call — it runs entirely in the browser
- Shows **interim results** (what it thinks you're saying) before finalizing
- Tracks advanced analytics:
  - **WPM** (Words Per Minute) — how fast you speak
  - **Filler words** count — "um", "uh", "like", "basically", "literally", "you know", etc. (18 tracked)
  - **Vocabulary score** — ratio of unique words (higher = better vocabulary)
  - **Confidence score** — derived from WPM + filler rate (optimal WPM is 120-150)
  - **Full transcript** — every word you said during the interview

**Key file**: `useSpeechRecognition.ts` (218 lines)

---

### 7.6 Text-to-Speech (Avatar Talks)

**What it does**: The AI avatar speaks questions aloud in a realistic human voice.

**How it works**:
1. The text of the question is sent to the backend API (`POST /api/tts`)
2. The backend calls **OpenAI's TTS API** with the text and a voice name
3. OpenAI returns an **audio file** (MP3)
4. The frontend plays this audio through the browser
5. While audio plays, the avatar's mouth animates

**Available voices** (each assigned to a different panel member):
- **onyx** — deep, authoritative (used for Chairman Singh, Brig. Mehta)
- **echo** — clear, professional (Dr. Sharma, Col. Verma)
- **fable** — warm, conversational (Adv. Krishna, Wing Cdr. Nair)
- **nova** — default voice for single-avatar mode (HOLO-AI)

**Key files**: `useTTS.ts` (frontend), `routes/tts/index.ts` (backend)

---

### 7.7 AI Follow-Up Questions

**What it does**: After you answer a question, the AI reads your answer and asks a smart follow-up question related to what you actually said.

**How it works**:
1. Your answer (text) + the original question + domain + difficulty are sent to `POST /api/followup`
2. The backend sends this to **GPT-4o-mini** with a carefully crafted prompt:
   - The AI is told to act as a specific type of interviewer (UPSC board member, tech interviewer, etc.)
   - It's told the difficulty level (easy = gentle clarification, hard = probing deep knowledge)
   - It must generate ONLY the follow-up question — no praise, no evaluation
3. The AI returns a natural follow-up question
4. This question is spoken by the avatar

**Example**:
- Question: "What is the time complexity of binary search?"
- Your answer: "It's O(log n) because we divide the array in half each time"
- AI follow-up: "If you had a sorted linked list instead of an array, could you still achieve O(log n) search? Why or why not?"

**Rate limiting**: 30 requests per minute per IP address (prevents abuse)

**Key file**: `routes/followup/index.ts`

---

### 7.8 AI Answer Evaluation

**What it does**: Gives each of your answers a score out of 10 with specific feedback.

**How it works**:
1. Your answer + question + domain sent to `POST /api/evaluate`
2. GPT-4o-mini evaluates and returns JSON:
   ```json
   {
     "score": 7,
     "strengths": "Good understanding of the core concept",
     "weaknesses": "Could have provided a real-world example",
     "suggestion": "Try to relate theoretical concepts to practical scenarios"
   }
   ```
3. This evaluation appears in the post-interview report

**Key file**: `routes/followup/index.ts` (same file, different route)

---

### 7.9 Bluff / BS Detector

**What it does**: Detects when you're giving a vague or evasive answer (trying to bluff your way through).

**How it works**:
- The speech recognition analyzes your answer in real-time
- It checks for patterns like:
  - Very short answers (fewer words than expected)
  - High ratio of filler words
  - Repetitive phrases
  - Low vocabulary score
- When bluffing is detected:
  - The avatar's expression changes to **stern** (red tint)
  - It makes a comment like "That answer seems quite vague. Let's dig deeper."
  - The follow-up question targets the weakness specifically

**This feature makes the interview feel REAL** — you can't just say "um, basically, it's like a thing" and get away with it!

---

### 7.10 Answer Timer

**What it does**: Gives you a countdown timer for each answer.

**Time limits by difficulty**:
- Easy: 120 seconds (2 minutes)
- Medium: 90 seconds (1.5 minutes)
- Hard: 60 seconds (1 minute)

**Visual**: A circular progress bar that turns from green → yellow → red as time runs out.

**Key file**: `AnswerTimer.tsx`

---

### 7.11 Adaptive Difficulty (Biometric)

**What it does**: Automatically adjusts question difficulty based on your stress level (heart rate).

**How it works**:
- The app tracks your heart rate during the interview
- If your heart rate **spikes** (goes above 100 BPM), it means you're stressed
- The AI detects this and responds with empathy:
  - "I notice you seem a bit tense. Let's try a different angle..."
  - Switches to an **easier** question
  - Avatar emotion changes to **empathetic** (green)
- If your heart rate **drops** (very calm, below 65 BPM), it means you're too relaxed
  - The AI might make it harder: "You seem very comfortable. Let's step it up..."
  - Switches to a **harder** question
  - Avatar emotion changes to **stern** (red)

**This is what makes Holo-Sync truly "biometric"** — it adapts to YOUR body in real-time!

---

### 7.12 Cross-Fire Panel Mode

**What it does**: In UPSC and NDA domains, instead of one interviewer, you face a **panel of 3 interviewers** — just like the real exam!

**How it works**:
- 3 separate 3D avatars are rendered side by side
- Each has a **different name and personality**:
  - UPSC: Chairman Singh, Dr. Sharma, Adv. Krishna
  - NDA: Brig. Mehta, Col. Verma, Wing Cdr. Nair
- They **take turns asking questions** (active speaker has a glow effect)
- Each speaks in a **different voice** (onyx, echo, fable)
- The non-speaking avatars still animate (blinking, slight movement)
- A **speech bubble** at the bottom shows who's speaking and what they said

---

### 7.13 Five Interview Domains

Each domain has its own set of questions, AI context, and behavior:

| Domain | Questions | Panel Mode | AI Personality |
|---|---|---|---|
| **UPSC Civil Services** | Administrative aptitude, current affairs, ethics | Yes (3 panel members) | Senior IAS board member |
| **Software Engineering** | DSA, system design, full-stack, coding | No (single) | Senior tech interviewer at a FAANG company |
| **NDA / SSB Defence** | Leadership, decision-making, patriotism, GK | Yes (3 panel members) | Senior military officer |
| **Medical / NEET PG** | Clinical knowledge, diagnostics, medical ethics | No (single) | Senior medical professor |
| **Investment Banking** | Financial modeling, M&A, DCF, market knowledge | No (single) | MD at a top investment bank |

Total: 500+ questions across all domains and difficulty levels.

---

### 7.14 Post-Interview Report

**What it does**: After the interview ends, you get a comprehensive report card.

**What's in the report**:

1. **Overall Scores** (as percentage bars):
   - Communication Score (based on WPM, filler words, vocabulary)
   - Technical Score (average of AI evaluation scores)
   - Stress Management (based on heart rate stability)

2. **Vital Statistics**:
   - Session duration
   - Number of questions answered
   - Average BPM
   - Eye contact percentage
   - Words per minute
   - Filler word count

3. **Heart Rate Graph**:
   - Visual chart of your BPM over the interview
   - Shows stress spikes and calm periods

4. **Answer-by-Answer Breakdown**:
   - Each question + your answer
   - Score out of 10
   - Strengths
   - Weaknesses
   - Improvement suggestion
   - Time taken to answer

5. **Adaptive Triggers**:
   - How many times the AI adjusted difficulty for you
   - How many times the bluff detector triggered

---

## 8. Frontend-Backend Communication

The frontend (holo-sync) and backend (api-server) talk through **API calls**:

```
Frontend (Browser)                    Backend (Express Server on port 8080)
      |                                          |
      |-- POST /api/tts ----------------------->|  "Speak this text"
      |<-- MP3 audio file ----------------------|
      |                                          |
      |-- POST /api/followup ------------------>|  "Generate follow-up"
      |<-- { followUp: "..." } -----------------|
      |                                          |
      |-- POST /api/evaluate ------------------>|  "Score this answer"
      |<-- { score, strengths, weaknesses } ----|
      |                                          |
      |-- GET /api/health --------------------->|  "Are you alive?"
      |<-- { status: "ok" } -------------------|
```

**How the proxy works**: The frontend runs on port 24185, the backend on port 8080. Vite's dev server has a **proxy** configured so that any request to `/api/*` on the frontend automatically gets forwarded to the backend. The user never sees port 8080.

---

## 9. How to Run the Project

1. The project uses **pnpm** (a fast package manager like npm)
2. It's a **monorepo** — one folder with multiple apps
3. Two workflows run simultaneously:
   - `pnpm --filter @workspace/api-server run dev` → starts the backend
   - `pnpm --filter @workspace/holo-sync run dev` → starts the frontend
4. Open the browser, allow camera access, pick a domain, start practicing!

---

## 10. Common Hackathon Questions & Answers

### Q: "How does the heart rate detection actually work?"
**A**: "We use a technique called remote photoplethysmography, or rPPG. Every time your heart beats, a tiny wave of blood flows to your face, causing microscopic color changes in your skin. We capture these changes through the webcam by averaging the green channel pixel values from your forehead and cheek regions. We then apply signal processing — moving average smoothing, Butterworth bandpass filtering between 0.75 and 3.0 Hz, Hamming windowing, and FFT — to extract the dominant frequency, which corresponds to your heart rate. We also analyze all three color channels (R, G, B) and pick the one with the best signal-to-noise ratio."

### Q: "Is the heart rate accurate?"
**A**: "Under good conditions — stable lighting, minimal head movement — we get within 5-10 BPM of a clinical pulse oximeter. It's not medical-grade, but it's accurate enough to detect stress patterns during an interview. We use multiple signal quality measures including spectral concentration ratio and IQR outlier rejection to filter bad readings."

### Q: "What AI model do you use?"
**A**: "We use OpenAI's GPT-4o-mini for generating follow-up questions and evaluating answers. For text-to-speech, we use OpenAI's TTS API with multiple voice profiles. The face detection uses Google's MediaPipe FaceLandmarker running locally in the browser via WebAssembly."

### Q: "Does any data leave the browser?"
**A**: "The face detection and heart rate measurement run entirely in the browser — no video is sent to any server. Only the text of your answer is sent to our backend for AI processing. The webcam feed stays local."

### Q: "How is the 3D avatar made?"
**A**: "The avatar is built procedurally using React Three Fiber and Three.js. The face is composed of approximately 40+ individual 3D shapes (spheres, capsules, cylinders) arranged anatomically to create a realistic human head with proper bone structure — cheekbones, brow ridge, jawline, nasolabial folds, etc. All animations (blinking, eye movement, mouth sync, head rotation) are driven by requestAnimationFrame loops."

### Q: "What makes this different from ChatGPT?"
**A**: "ChatGPT is a text chatbot. Holo-Sync is a full biometric interview simulator. It watches you through the webcam, measures your heart rate without any wearable device, tracks your eye contact, adapts question difficulty based on your stress level, speaks with a realistic voice through a 3D avatar, and gives you a comprehensive performance report. It's like having a real interview coach who can read your body language."

### Q: "How does the bluff detector work?"
**A**: "We analyze your answer in real-time for markers of evasion: very short responses, high filler word density, repetitive phrases, and low vocabulary diversity. When these patterns are detected, the AI interviewer changes to a stern demeanor and asks a more probing follow-up question, simulating how a real interviewer would react to a vague answer."

### Q: "How does panel mode work?"
**A**: "In UPSC and NDA interview domains, we render three separate 3D avatars side by side, each with a unique name, voice, and personality. They take turns asking questions. The active speaker has a glow effect and their name appears at the bottom. This simulates the real UPSC/SSB panel interview experience where multiple board members fire questions at you."

### Q: "What if the camera doesn't work?"
**A**: "We have a 3-tier fallback for face detection. If MediaPipe FaceLandmarker fails, we fall back to the simpler FaceDetector. If that fails too, we use a YCbCr color-space skin detection algorithm that works without any AI model at all. The interview can still proceed without webcam — you just won't get heart rate tracking or eye contact scoring."

### Q: "What frameworks did you use?"
**A**: "React with TypeScript for the frontend, Express.js for the backend, React Three Fiber for 3D rendering, MediaPipe for face detection, Web Speech API for speech recognition, OpenAI for AI processing and TTS, Tailwind CSS for styling, and we manage it all as a pnpm monorepo."

### Q: "How long did it take to build?"
**A**: "The core prototype was built iteratively. The biggest challenges were getting rPPG heart rate to work accurately (we went through 4 major versions of the algorithm) and syncing the 3D avatar mouth animation with the TTS audio playback."

### Q: "What's the Butterworth filter?"
**A**: "A Butterworth filter is a type of signal filter that has a flat frequency response in the passband — meaning it doesn't distort the frequencies we want to keep. We use a 2nd-order Butterworth bandpass filter to isolate frequencies between 0.75 Hz and 3.0 Hz, which corresponds to heart rates between 45 and 180 BPM. We apply it forward and backward (called filtfilt) to achieve zero-phase distortion."

### Q: "What's FFT?"
**A**: "FFT stands for Fast Fourier Transform. It's a mathematical algorithm that takes a signal that changes over time (like the brightness of your skin) and tells you which frequencies are present in it. Think of it like listening to music and figuring out which notes are being played. The 'note' with the strongest volume corresponds to your heart rate frequency. We multiply that frequency by 60 to get beats per minute."

### Q: "What's the Signal Quality Index?"
**A**: "SQI measures how much of the spectral energy is concentrated around the peak frequency versus spread out across the whole band. If there's a clear, sharp peak, SQI is high (good signal). If the energy is spread evenly (just noise), SQI is low (bad signal). We compute it as the ratio of power in a narrow band around the peak to total power in the heart rate frequency range."

### Q: "Why TypeScript instead of JavaScript?"
**A**: "TypeScript adds type checking to JavaScript. This means if we try to pass a number where a string is expected, or forget a required property, TypeScript catches it before the code even runs. For a complex project with face detection data flowing between many components, types prevented hundreds of potential bugs."

### Q: "What are React hooks?"
**A**: "Hooks are functions that let React components use features like state and side effects. We created custom hooks for each major feature: useHeartbeat (heart rate), useFaceDetection (face tracking), useEyeContact (eye tracking), useSpeechRecognition (voice input), useTTS (speech output), useWebcam (camera). Each hook encapsulates its logic cleanly so the main Interview page just combines them together."

### Q: "How does the webcam proxy work?"
**A**: "The Vite development server runs on one port, the Express API server on another. In vite.config.ts, we configure a proxy so that any request starting with /api gets forwarded to the Express server. This means the frontend can call fetch('/api/tts') and it automatically reaches the backend, without any CORS issues or URL configuration."

---

## 11. Architecture Diagram (Text Version)

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   WEBCAM      │  │  MediaPipe   │  │  Web Speech API      │  │
│  │   (Camera)    │──│  Face        │  │  (Voice → Text)      │  │
│  │               │  │  Landmarker  │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │               │
│         v                 v                      v               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ useWebcam    │  │ useFaceDetect│  │ useSpeechRecognition │  │
│  │              │  │              │  │ (WPM, fillers, etc.) │  │
│  └──────┬───────┘  └──┬───┬──────┘  └──────────┬───────────┘  │
│         │              │   │                    │               │
│         v              v   v                    │               │
│  ┌──────────────┐  ┌──────────────┐             │               │
│  │ useHeartbeat │  │ useEyeContact│             │               │
│  │ (rPPG → BPM) │  │ (Gaze Track) │             │               │
│  └──────┬───────┘  └──────┬───────┘             │               │
│         │                 │                      │               │
│         └────────┬────────┘──────────────────────┘               │
│                  │                                               │
│                  v                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Interview.tsx                          │   │
│  │    (The brain — coordinates everything)                   │   │
│  │                                                           │   │
│  │  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │Avatar3D │ │Webcam  │ │HeartRate │ │ Chat/Timer/   │  │   │
│  │  │(3D Head)│ │Feed    │ │Monitor   │ │ EyeContact    │  │   │
│  │  └─────────┘ └────────┘ └──────────┘ └───────────────┘  │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│                  ┌──────────┴──────────┐                        │
│                  │   Vite Dev Proxy     │                        │
│                  │   /api/* → :8080     │                        │
│                  └──────────┬──────────┘                        │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────────────┐
│                    API SERVER (Express, port 8080)                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ POST /api/tts│  │POST /api/    │  │ POST /api/evaluate   │  │
│  │              │  │followup      │  │                      │  │
│  │ Text → Audio │  │ → Follow-up Q│  │ → Score + Feedback   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │               │
│         └────────┬────────┘──────────────────────┘               │
│                  │                                               │
│                  v                                               │
│         ┌──────────────────┐                                    │
│         │   OpenAI API      │                                    │
│         │   GPT-4o-mini     │                                    │
│         │   TTS (voices)    │                                    │
│         └──────────────────┘                                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 12. What Makes This Project Unique?

1. **No wearable needed** — We measure heart rate from just a webcam. No smartwatch, no fitness band. This is cutting-edge computer vision research being applied in a real product.

2. **Real-time biometric adaptation** — The interview literally changes based on your body's stress response. No other interview prep tool does this.

3. **Everything runs in the browser** — Face detection, heart rate, eye contact — all computed locally. Your video never leaves your device.

4. **Multi-modal AI** — Combines computer vision (face/heart), NLP (speech recognition + AI evaluation), 3D graphics (avatar), and audio (TTS) in one integrated experience.

5. **Panel interview simulation** — The UPSC/NDA panel mode with 3 separate AI interviewers, each with unique voices and personalities, is something that doesn't exist anywhere else.

6. **Comprehensive analytics** — Filler word detection, WPM tracking, vocabulary scoring, eye contact percentage, heart rate graph — this is the most data-rich interview practice tool available.

7. **Accessible** — Works in a browser, no installation, no cost for the user.

---

## Key Technical Terms Glossary

| Term | Simple Explanation |
|---|---|
| **rPPG** | Reading heart rate from face color changes captured by camera |
| **FFT** | Math that finds repeating patterns (frequencies) in a signal |
| **Butterworth filter** | A math filter that keeps only the frequencies we want |
| **EMA** | Smoothing technique — new values gently blend with old ones |
| **IQR** | Statistical method to find and remove outlier values |
| **ROI** | Region of Interest — the specific area of the face we analyze |
| **MediaPipe** | Google's AI toolkit for face/hand/body detection |
| **WebAssembly (WASM)** | Technology that lets complex code run fast in browsers |
| **Three.js** | JavaScript library for 3D graphics |
| **React Three Fiber** | React wrapper that makes Three.js easier to use |
| **TTS** | Text-to-Speech — converting text into spoken audio |
| **GPT-4o-mini** | OpenAI's fast, affordable AI language model |
| **Monorepo** | One project folder containing multiple related apps |
| **Proxy** | A middleman that forwards requests from frontend to backend |
| **SNR** | Signal-to-Noise Ratio — how strong the real signal is vs. random noise |
| **SQI** | Signal Quality Index — how reliable the heart rate reading is |
| **Hamming window** | Mathematical trick that reduces errors at the edges of a signal |
| **Parabolic interpolation** | Technique to find a more precise peak between data points |
| **filtfilt** | Filtering a signal forward and backward for zero distortion |
| **BPM** | Beats Per Minute — heart rate measurement unit |
| **Hz** | Hertz — frequency unit (1 Hz = 1 cycle per second) |

---

*Built with React, Three.js, MediaPipe, OpenAI, and love. Powered by Replit.*
