<p align="center">
  <img src="https://img.shields.io/badge/Holo--Sync-Biometric%20Interviewer-blueviolet?style=for-the-badge&logoColor=white" alt="Holo-Sync" />
</p>

<h1 align="center">HOLO-SYNC</h1>
<h3 align="center">Biometric Pressure Training System</h3>

<p align="center">
  <b>AI-powered mock interview platform that reads your heartbeat through the webcam, detects eye contact, and escalates pressure — no mercy, no comfort.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai" />
  <img src="https://img.shields.io/badge/Three.js-3D%20Avatars-000000?style=flat-square&logo=threedotjs" />
  <img src="https://img.shields.io/badge/MediaPipe-Face%20Mesh-4285F4?style=flat-square&logo=google" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss" />
</p>

<hr>

<h2>What is Holo-Sync?</h2>

<p>Holo-Sync is a <b>biometric interview training system</b> that simulates real high-pressure interviews using AI. It uses your webcam to detect your <b>heart rate in real-time</b> (no wearable devices needed), monitors your <b>eye contact</b>, times your answers, and evaluates your performance — all while 3D AI avatars fire questions at you.</p>

<p>Unlike other mock interview apps, Holo-Sync <b>never goes easy on you</b>. If your heart rate spikes (you're stressed), the questions get harder. If your heart rate stays calm (you're comfortable), the questions get harder. <b>Difficulty only escalates.</b></p>

<p>The goal: train you to perform under pressure so the real interview feels easy.</p>

<hr>

<h2>Key Features</h2>

<h3>Webcam Heart Rate Detection (rPPG)</h3>
<ul>
  <li>Detects your pulse through the webcam using <b>remote photoplethysmography (rPPG)</b></li>
  <li>No wearable sensors, no hardware — just your face and a camera</li>
  <li>Uses 6 parallel signal processing algorithms: <b>POS, CHROM, GREEN FFT, Temporal-Normalized GREEN, Autocorrelation, and Peak Counting</b></li>
  <li>Locks onto your heart rate in ~1-2 seconds</li>
  <li>Based on research from UW Ubicomp Lab, Wang et al. 2017, De Haan & Jeanne 2013</li>
</ul>

<h3>5 Interview Domains</h3>

<table>
  <thead>
    <tr>
      <th>Domain</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>UPSC Civil Services</b></td>
      <td>Indian Administrative Service & Civil Services exam preparation</td>
    </tr>
    <tr>
      <td><b>Software Engineering</b></td>
      <td>Full-stack, backend, system design & DSA interviews</td>
    </tr>
    <tr>
      <td><b>NDA / SSB Defence</b></td>
      <td>National Defence Academy & Services Selection Board</td>
    </tr>
    <tr>
      <td><b>Medical / NEET PG</b></td>
      <td>MBBS, PG Medical entrance & clinical case discussions</td>
    </tr>
    <tr>
      <td><b>Investment Banking</b></td>
      <td>IB, M&A, financial modeling & technical finance</td>
    </tr>
  </tbody>
</table>

<h3>Cross-Fire Panel Mode</h3>
<ul>
  <li><b>3 AI interviewers</b> question you simultaneously with different personalities</li>
  <li>Chairman, Member 1, Member 2 — each with a unique 3D avatar and voice</li>
  <li>They challenge your answers from different angles</li>
  <li>Available for UPSC and NDA domains</li>
</ul>

<h3>3D Talking Avatars</h3>
<ul>
  <li>Realistic 3D avatar panel using <b>Three.js</b> and <b>GLB models</b></li>
  <li>Lip-sync animation synchronized with AI-generated speech</li>
  <li>Each panel member has a distinct appearance and voice</li>
</ul>

<h3>AI-Powered Evaluation</h3>
<ul>
  <li><b>GPT-4o-mini</b> evaluates every answer with strict scoring (0-10)</li>
  <li>AI generates natural follow-up questions based on your responses</li>
  <li>Identifies strengths, weaknesses, and gives improvement suggestions</li>
  <li>No participation points — wrong answers get a 0</li>
</ul>

<h3>Bluff Detector</h3>
<ul>
  <li>Detects when your biometric signals indicate you're not being genuine</li>
  <li>Heart rate spikes + vague answers = caught bluffing</li>
  <li>Counts composure breaks in the final report</li>
</ul>

<h3>Eye Contact Detection</h3>
<ul>
  <li><b>MediaPipe Face Mesh</b> tracks your gaze in real-time</li>
  <li>Detects if you're looking at the camera or looking away</li>
  <li>Eye contact score included in the final performance report</li>
</ul>

<h3>Answer Timer</h3>
<ul>
  <li>Visual countdown timer for each question</li>
  <li>Timed-out answers are marked as unanswered</li>
  <li>Time management is part of the evaluation</li>
</ul>

<h3>Post-Interview Performance Debrief</h3>
<ul>
  <li>Comprehensive report card with overall grade (A+ to F)</li>
  <li>Heart rate graph showing stress patterns throughout the interview</li>
  <li>Per-question breakdown with scores, feedback, and time taken</li>
  <li>Grading formula: Evaluation (40%) + Answer Rate (15%) + Communication (15%) + Technical (15%) + Stress Management (15%)</li>
  <li>Multi-session progress tracking — compares your performance across interviews</li>
</ul>

<h3>Text-to-Speech</h3>
<ul>
  <li>AI-generated voice for each interviewer using <b>OpenAI TTS</b></li>
  <li>Different voices for different panel members (shimmer, nova, fable, onyx)</li>
  <li>Questions are spoken aloud for a realistic experience</li>
</ul>

<hr>

<h2>How It Works</h2>

<pre>
Webcam ──> Face Mesh (MediaPipe) ──> rPPG Engine (6 algorithms)
│
Heart Rate / Stress
│
v
Question Bank <── Difficulty Escalation <── Pressure Calculator
│
v
3D Avatar (lip-sync) <── OpenAI TTS <── Question Text
│
v
User Answer ──> Speech-to-Text ──> GPT-4o-mini Evaluation
│
v
Performance Report Card
</pre>

<hr>

<h2>rPPG Heart Rate Detection</h2>

<p>Remote Photoplethysmography (rPPG) extracts your pulse from subtle color changes in your face caused by blood flow. Every heartbeat pushes blood through facial blood vessels, causing tiny changes in skin color invisible to the naked eye but detectable by a camera.</p>

<p><b>6 parallel BPM estimators:</b></p>
<ol>
  <li><b>POS (Plane-Orthogonal-to-Skin)</b> — Wang et al. 2017, IEEE TBME</li>
  <li><b>CHROM (Chrominance)</b> — De Haan & Jeanne 2013, IEEE TBME</li>
  <li><b>GREEN FFT</b> — Classic green-channel frequency analysis</li>
  <li><b>Temporal-Normalized GREEN</b> — Frame differencing from UW Ubicomp Lab</li>
  <li><b>Autocorrelation</b> — Time-domain periodicity detection</li>
  <li><b>Peak Counting</b> — Direct peak detection in filtered signal</li>
</ol>

<p><b>Research References:</b></p>
<ul>
  <li><a href="https://github.com/ubicomplab/rppg-web">UW Ubicomp Lab rPPG-web</a></li>
  <li><a href="https://ieeexplore.ieee.org/document/7565547">Wang et al. 2017 — POS Algorithm</a></li>
  <li><a href="https://ieeexplore.ieee.org/document/9983619">De Haan & Jeanne 2013 — CHROM</a></li>
  <li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11362249/">PMC rPPG Review 2024</a></li>
</ul>

<hr>

<h2>Tech Stack</h2>

<table>
  <thead>
    <tr>
      <th>Layer</th>
      <th>Technology</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Frontend</b></td>
      <td>React 18, TypeScript, Vite 7</td>
    </tr>
    <tr>
      <td><b>Styling</b></td>
      <td>Tailwind CSS, custom dark theme</td>
    </tr>
    <tr>
      <td><b>3D Rendering</b></td>
      <td>Three.js, React Three Fiber, GLB avatar models</td>
    </tr>
    <tr>
      <td><b>Face Detection</b></td>
      <td>MediaPipe Face Mesh (468 landmarks)</td>
    </tr>
    <tr>
      <td><b>Heart Rate</b></td>
      <td>Custom rPPG engine — POS, CHROM, FFT, autocorrelation, peak counting</td>
    </tr>
    <tr>
      <td><b>AI Models</b></td>
      <td>OpenAI GPT-4o-mini (evaluation), GPT-audio (TTS), GPT-4o-mini-transcribe (STT)</td>
    </tr>
    <tr>
      <td><b>Backend</b></td>
      <td>Express.js (dev), Netlify Functions (production)</td>
    </tr>
    <tr>
      <td><b>Deployment</b></td>
      <td>Netlify (static + serverless)</td>
    </tr>
  </tbody>
</table>

<hr>

<h2>Grading System</h2>

<table>
  <thead>
    <tr>
      <th>Grade</th>
      <th>Score</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>A+</td>
      <td>90 and above</td>
    </tr>
    <tr>
      <td>A</td>
      <td>80 - 89</td>
    </tr>
    <tr>
      <td>B+</td>
      <td>70 - 79</td>
    </tr>
    <tr>
      <td>B</td>
      <td>60 - 69</td>
    </tr>
    <tr>
      <td>C</td>
      <td>50 - 59</td>
    </tr>
    <tr>
      <td>D</td>
      <td>40 - 49</td>
    </tr>
    <tr>
      <td>F</td>
      <td>Below 40</td>
    </tr>
  </tbody>
</table>

<hr>

<h2>Deployment</h2>

<h3>Netlify (Production)</h3>
<ol>
  <li>Fork/clone this repository</li>
  <li>Connect to Netlify via GitHub</li>
  <li>Add environment variable: <code>OPENAI_API_KEY</code> (your OpenAI API key)</li>
  <li>Leave the <b>Base directory empty</b> in Netlify settings</li>
  <li>Deploy — <code>netlify.toml</code> handles the rest automatically</li>
</ol>

<h3>Local Development</h3>

<pre><code>git clone https://github.com/saivaibhavtamiri1306/Heartbeat-Viewer.git
cd Heartbeat-Viewer
pnpm install

// Start API server (terminal 1)
pnpm --filter @workspace/api-server run dev

// Start frontend (terminal 2)
pnpm --filter @workspace/holo-sync run dev
</code></pre>
