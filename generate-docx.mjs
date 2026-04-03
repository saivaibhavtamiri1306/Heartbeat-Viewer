import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign, TableLayoutType } from "docx";
import { readFileSync, writeFileSync } from "fs";

const md = readFileSync("HOLO_SYNC_DOCUMENTATION.md", "utf-8");
const lines = md.split("\n");

const children = [];

function t(text, opts = {}) {
  return new TextRun({ text, size: opts.size || 22, font: "Calibri", ...opts });
}

function parseLine(line) {
  const runs = [];
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const p of parts) {
    if (p.startsWith("**") && p.endsWith("**")) {
      runs.push(t(p.slice(2, -2), { bold: true }));
    } else if (p.startsWith("`") && p.endsWith("`")) {
      runs.push(t(p.slice(1, -1), { font: "Consolas", size: 20, color: "2E86C1" }));
    } else if (p.length > 0) {
      runs.push(t(p));
    }
  }
  return runs;
}

function cell(text, opts = {}) {
  const textRuns = typeof text === "string" ? [t(text, {
    size: opts.textSize || 20,
    bold: opts.bold || false,
    color: opts.textColor || "000000",
    font: opts.font || "Calibri",
  })] : text;

  return new TableCell({
    children: [new Paragraph({
      children: textRuns,
      alignment: opts.align || AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
    })],
    verticalAlign: VerticalAlign.CENTER,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    borders: opts.noBorder ? {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    } : {
      top: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || "2E86C1" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || "2E86C1" },
      left: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || "2E86C1" },
      right: { style: BorderStyle.SINGLE, size: 4, color: opts.borderColor || "2E86C1" },
    },
    columnSpan: opts.colSpan || 1,
    rowSpan: opts.rowSpan || 1,
  });
}

function arrowRow(cols, arrowText = "⬇") {
  return new TableRow({
    children: Array.from({ length: cols }, () =>
      cell(arrowText, { noBorder: true, textSize: 24, bold: true, textColor: "2E86C1" })
    ),
  });
}

function spacerRow(cols) {
  return new TableRow({
    children: Array.from({ length: cols }, () =>
      cell("", { noBorder: true, textSize: 8 })
    ),
  });
}

function buildFlowDiagram() {
  const rows = [
    new TableRow({ children: [
      cell("STEP 1: Open App", { fill: "1B4F72", textColor: "FFFFFF", bold: true, textSize: 22, colSpan: 3 }),
    ]}),
    new TableRow({ children: [
      cell("You see a futuristic landing page with 5 interview domains", { colSpan: 3, fill: "EBF5FB", textSize: 18 }),
    ]}),
    arrowRow(3),
    new TableRow({ children: [
      cell("STEP 2: Pick Domain & Difficulty", { fill: "1B4F72", textColor: "FFFFFF", bold: true, textSize: 22, colSpan: 3 }),
    ]}),
    new TableRow({ children: [
      cell("UPSC / SWE / NDA / Medical / Banking  +  Easy / Medium / Hard", { colSpan: 3, fill: "EBF5FB", textSize: 18 }),
    ]}),
    arrowRow(3),
    new TableRow({ children: [
      cell("STEP 3: Interview Starts", { fill: "1A5276", textColor: "FFFFFF", bold: true, textSize: 22, colSpan: 3 }),
    ]}),
    new TableRow({ children: [
      cell("Webcam ON", { fill: "D4EFDF", textSize: 18, bold: true }),
      cell("3D Avatar Appears", { fill: "D6EAF8", textSize: 18, bold: true }),
      cell("Timer Starts", { fill: "FADBD8", textSize: 18, bold: true }),
    ]}),
    arrowRow(3),
    new TableRow({ children: [
      cell("STEP 4: While You Answer (Real-Time Processing)", { fill: "7D3C98", textColor: "FFFFFF", bold: true, textSize: 22, colSpan: 3 }),
    ]}),
    new TableRow({ children: [
      cell("Face Detection\n(478 landmarks)", { fill: "F5EEF8", textSize: 17 }),
      cell("Heart Rate\n(rPPG from skin)", { fill: "F5EEF8", textSize: 17 }),
      cell("Eye Contact\n(iris tracking)", { fill: "F5EEF8", textSize: 17 }),
    ]}),
    new TableRow({ children: [
      cell("Speech → Text\n(Web Speech API)", { fill: "F5EEF8", textSize: 17 }),
      cell("Filler Words\n(um, uh, like...)", { fill: "F5EEF8", textSize: 17 }),
      cell("Answer Timer\n(countdown)", { fill: "F5EEF8", textSize: 17 }),
    ]}),
    arrowRow(3),
    new TableRow({ children: [
      cell("STEP 5: AI Processes Your Answer", { fill: "B7950B", textColor: "FFFFFF", bold: true, textSize: 22, colSpan: 3 }),
    ]}),
    new TableRow({ children: [
      cell("GPT-4o-mini\nEvaluates Answer\n(Score 1-10)", { fill: "FEF9E7", textSize: 17 }),
      cell("Generates Smart\nFollow-Up Question\n(Based on YOUR answer)", { fill: "FEF9E7", textSize: 17 }),
      cell("Adaptive Difficulty\n(HR high → easier)\n(HR low → harder)", { fill: "FEF9E7", textSize: 17 }),
    ]}),
    arrowRow(3),
    new TableRow({ children: [
      cell("STEP 6: Interview Report", { fill: "117A65", textColor: "FFFFFF", bold: true, textSize: 22, colSpan: 3 }),
    ]}),
    new TableRow({ children: [
      cell("Scores + Heart Rate\nGraph + Eye Contact %", { fill: "D5F5E3", textSize: 17 }),
      cell("Each Answer:\nScore + Strengths\n+ Weaknesses", { fill: "D5F5E3", textSize: 17 }),
      cell("Speech Analytics:\nWPM + Fillers\n+ Vocabulary", { fill: "D5F5E3", textSize: 17 }),
    ]}),
  ];
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });
}

function buildArchDiagram() {
  const rows = [
    new TableRow({ children: [
      cell("BROWSER (Client Side — Everything runs locally)", { fill: "1B4F72", textColor: "FFFFFF", bold: true, textSize: 24, colSpan: 4 }),
    ]}),
    spacerRow(4),
    new TableRow({ children: [
      cell("WEBCAM\n(Camera Feed)", { fill: "AED6F1", bold: true, textSize: 18, borderColor: "2980B9" }),
      cell("MediaPipe\nFace Landmarker\n(478 points)", { fill: "AED6F1", bold: true, textSize: 18, borderColor: "2980B9" }),
      cell("Web Speech API\n(Voice → Text)", { fill: "AED6F1", bold: true, textSize: 18, borderColor: "2980B9" }),
      cell("Three.js Canvas\n(3D Avatar)", { fill: "AED6F1", bold: true, textSize: 18, borderColor: "2980B9" }),
    ]}),
    arrowRow(4),
    new TableRow({ children: [
      cell("useWebcam\n(camera stream)", { fill: "D6EAF8", textSize: 17 }),
      cell("useFaceDetection\n(face boxes)", { fill: "D6EAF8", textSize: 17 }),
      cell("useSpeechRecognition\n(text + analytics)", { fill: "D6EAF8", textSize: 17 }),
      cell("Avatar3D\n(head + animations)", { fill: "D6EAF8", textSize: 17 }),
    ]}),
    arrowRow(4),
    new TableRow({ children: [
      cell("useHeartbeat\n(rPPG → BPM)", { fill: "D4EFDF", textSize: 17, borderColor: "27AE60" }),
      cell("useEyeContact\n(gaze tracking)", { fill: "D4EFDF", textSize: 17, borderColor: "27AE60" }),
      cell("Filler Detection\n(um, uh, like)", { fill: "D4EFDF", textSize: 17, borderColor: "27AE60" }),
      cell("Mouth Sync\n(lip animation)", { fill: "D4EFDF", textSize: 17, borderColor: "27AE60" }),
    ]}),
    arrowRow(4),
    new TableRow({ children: [
      cell("Interview.tsx  (THE BRAIN — coordinates all features)", { fill: "7D3C98", textColor: "FFFFFF", bold: true, textSize: 22, colSpan: 4 }),
    ]}),
    spacerRow(4),
    new TableRow({ children: [
      cell("WebcamFeed\n(green ROI boxes)", { fill: "F5EEF8", textSize: 17, borderColor: "8E44AD" }),
      cell("HeartbeatMonitor\n(BPM display)", { fill: "F5EEF8", textSize: 17, borderColor: "8E44AD" }),
      cell("InterviewChat\n(Q&A messages)", { fill: "F5EEF8", textSize: 17, borderColor: "8E44AD" }),
      cell("AnswerTimer\n+ EyeContact", { fill: "F5EEF8", textSize: 17, borderColor: "8E44AD" }),
    ]}),
    arrowRow(4),
    new TableRow({ children: [
      cell("Vite Dev Proxy  →  /api/*  forwards to Express backend", { fill: "F39C12", textColor: "FFFFFF", bold: true, textSize: 20, colSpan: 4 }),
    ]}),
    arrowRow(4),
    new TableRow({ children: [
      cell("API SERVER (Express.js — Port 8080)", { fill: "922B21", textColor: "FFFFFF", bold: true, textSize: 24, colSpan: 4 }),
    ]}),
    spacerRow(4),
    new TableRow({ children: [
      cell("POST /api/tts\nText → Voice\n(OpenAI TTS)", { fill: "FADBD8", bold: true, textSize: 17, borderColor: "E74C3C" }),
      cell("POST /api/followup\nAnswer → Follow-Up\n(GPT-4o-mini)", { fill: "FADBD8", bold: true, textSize: 17, borderColor: "E74C3C" }),
      cell("POST /api/evaluate\nAnswer → Score\n(GPT-4o-mini)", { fill: "FADBD8", bold: true, textSize: 17, borderColor: "E74C3C" }),
      cell("GET /api/health\nServer Status\nCheck", { fill: "FADBD8", bold: true, textSize: 17, borderColor: "E74C3C" }),
    ]}),
    arrowRow(4),
    new TableRow({ children: [
      cell("OpenAI API  (GPT-4o-mini + TTS Voices: onyx, echo, fable, nova)", { fill: "1C2833", textColor: "00D4FF", bold: true, textSize: 20, colSpan: 4 }),
    ]}),
  ];
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });
}

function buildRppgPipeline() {
  const steps = [
    ["1. GRAB PIXELS", "Sample forehead + cheek ROI pixels from webcam frame", "D4EFDF", "27AE60"],
    ["2. EXTRACT RGB", "Get Red, Green, Blue channel averages (every 4th pixel)", "D4EFDF", "27AE60"],
    ["3. BUFFER", "Store last 256 samples (~8.5 seconds at 30fps)", "D6EAF8", "2980B9"],
    ["4. SMOOTH", "5-point moving average to reduce random noise", "D6EAF8", "2980B9"],
    ["5. BANDPASS FILTER", "Butterworth filter: keep only 0.75–3.0 Hz (45–180 BPM)", "AED6F1", "2471A3"],
    ["6. WINDOW", "Apply Hamming window to reduce edge effects", "AED6F1", "2471A3"],
    ["7. FFT", "Fast Fourier Transform: time → frequency domain", "F5EEF8", "8E44AD"],
    ["8. FIND PEAK", "Locate strongest frequency in heart rate band", "F5EEF8", "8E44AD"],
    ["9. INTERPOLATE", "Parabolic interpolation for precise peak position", "FADBD8", "E74C3C"],
    ["10. SMOOTH OUTPUT", "EMA smoothing + IQR outlier rejection → Final BPM", "FADBD8", "E74C3C"],
  ];

  const rows = [
    new TableRow({ children: [
      cell("rPPG HEART RATE DETECTION PIPELINE", { fill: "1B4F72", textColor: "FFFFFF", bold: true, textSize: 24, colSpan: 2 }),
    ]}),
  ];

  for (let i = 0; i < steps.length; i++) {
    const [step, desc, fillC, borderC] = steps[i];
    rows.push(new TableRow({ children: [
      cell(step, { fill: fillC, bold: true, textSize: 20, borderColor: borderC, width: 35 }),
      cell(desc, { fill: fillC, textSize: 18, borderColor: borderC, width: 65, align: AlignmentType.LEFT }),
    ]}));
    if (i < steps.length - 1) {
      rows.push(new TableRow({ children: [
        cell("⬇", { noBorder: true, textSize: 20, bold: true, textColor: "2E86C1" }),
        cell("", { noBorder: true }),
      ]}));
    }
  }

  rows.push(spacerRow(2));
  rows.push(new TableRow({ children: [
    cell("OUTPUT: Heart Rate in BPM  +  Signal Quality Index (SQI)", { fill: "117A65", textColor: "FFFFFF", bold: true, textSize: 22, colSpan: 2 }),
  ]}));

  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED });
}

function buildApiFlow() {
  const rows = [
    new TableRow({ children: [
      cell("FRONTEND → BACKEND API COMMUNICATION", { fill: "1B4F72", textColor: "FFFFFF", bold: true, textSize: 24, colSpan: 3 }),
    ]}),
    spacerRow(3),
    new TableRow({ children: [
      cell("Frontend\n(React App)", { fill: "D6EAF8", bold: true, textSize: 20, borderColor: "2980B9", width: 30 }),
      cell("→  POST /api/tts  →\n\"Say this text aloud\"", { fill: "FEF9E7", textSize: 18, bold: true, borderColor: "F39C12", width: 40 }),
      cell("Backend\n(Express Server)", { fill: "FADBD8", bold: true, textSize: 20, borderColor: "E74C3C", width: 30 }),
    ]}),
    new TableRow({ children: [
      cell("", { noBorder: true }),
      cell("←  MP3 Audio File  ←", { fill: "FEF9E7", textSize: 18, borderColor: "F39C12" }),
      cell("", { noBorder: true }),
    ]}),
    spacerRow(3),
    new TableRow({ children: [
      cell("User answers\na question", { fill: "D6EAF8", textSize: 18, borderColor: "2980B9" }),
      cell("→  POST /api/followup  →\n\"Generate a follow-up\"", { fill: "FEF9E7", textSize: 18, bold: true, borderColor: "F39C12" }),
      cell("Calls GPT-4o-mini\nwith domain context", { fill: "FADBD8", textSize: 18, borderColor: "E74C3C" }),
    ]}),
    new TableRow({ children: [
      cell("", { noBorder: true }),
      cell("←  { followUp: \"...\" }  ←", { fill: "FEF9E7", textSize: 18, borderColor: "F39C12" }),
      cell("", { noBorder: true }),
    ]}),
    spacerRow(3),
    new TableRow({ children: [
      cell("Answer needs\nscoring", { fill: "D6EAF8", textSize: 18, borderColor: "2980B9" }),
      cell("→  POST /api/evaluate  →\n\"Score this answer\"", { fill: "FEF9E7", textSize: 18, bold: true, borderColor: "F39C12" }),
      cell("Returns score,\nstrengths, weaknesses", { fill: "FADBD8", textSize: 18, borderColor: "E74C3C" }),
    ]}),
    new TableRow({ children: [
      cell("", { noBorder: true }),
      cell("←  { score: 7, strengths: \"...\" }  ←", { fill: "FEF9E7", textSize: 18, borderColor: "F39C12" }),
      cell("", { noBorder: true }),
    ]}),
  ];
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED });
}

function buildFileStructure() {
  const items = [
    ["workspace/", "", "1B4F72", "FFFFFF", true],
    ["  artifacts/", "", "2874A6", "FFFFFF", true],
    ["    holo-sync/  (FRONTEND)", "React + Vite + Three.js", "1A5276", "FFFFFF", true],
    ["      src/pages/Landing.tsx", "Home page (domain selection)", "D6EAF8", "000000", false],
    ["      src/pages/InterviewConfig.tsx", "Setup page (difficulty, count)", "D6EAF8", "000000", false],
    ["      src/pages/Interview.tsx", "Main interview page (THE BIG ONE)", "AED6F1", "000000", true],
    ["      src/components/Avatar3D.tsx", "3D holographic head (Three.js)", "D4EFDF", "000000", false],
    ["      src/components/WebcamFeed.tsx", "Webcam + green ROI boxes", "D4EFDF", "000000", false],
    ["      src/components/HeartbeatMonitor.tsx", "Heart rate display panel", "D4EFDF", "000000", false],
    ["      src/components/InterviewChat.tsx", "Chat messages panel", "D4EFDF", "000000", false],
    ["      src/components/InterviewReport.tsx", "Post-interview report card", "D4EFDF", "000000", false],
    ["      src/components/AnswerTimer.tsx", "Countdown timer", "D4EFDF", "000000", false],
    ["      src/components/EyeContactIndicator.tsx", "Eye contact status", "D4EFDF", "000000", false],
    ["      src/hooks/useHeartbeat.ts", "rPPG heart rate detection", "F5EEF8", "000000", false],
    ["      src/hooks/useFaceDetection.ts", "MediaPipe face tracking", "F5EEF8", "000000", false],
    ["      src/hooks/useEyeContact.ts", "Eye contact detection", "F5EEF8", "000000", false],
    ["      src/hooks/useSpeechRecognition.ts", "Voice-to-text + analytics", "F5EEF8", "000000", false],
    ["      src/hooks/useTTS.ts", "Text-to-speech", "F5EEF8", "000000", false],
    ["      src/hooks/useWebcam.ts", "Camera access", "F5EEF8", "000000", false],
    ["      src/data/questions.ts", "500+ interview questions", "FEF9E7", "000000", false],
    ["    api-server/  (BACKEND)", "Express.js + OpenAI", "922B21", "FFFFFF", true],
    ["      src/routes/tts/index.ts", "Text-to-speech endpoint", "FADBD8", "000000", false],
    ["      src/routes/followup/index.ts", "AI follow-up + evaluation", "FADBD8", "000000", false],
    ["      src/routes/health.ts", "Health check endpoint", "FADBD8", "000000", false],
    ["      src/app.ts", "Express setup + middleware", "FADBD8", "000000", false],
  ];

  const rows = [
    new TableRow({ children: [
      cell("FILE / FOLDER", { fill: "1B4F72", textColor: "FFFFFF", bold: true, textSize: 20, width: 55 }),
      cell("PURPOSE", { fill: "1B4F72", textColor: "FFFFFF", bold: true, textSize: 20, width: 45 }),
    ]}),
  ];

  for (const [name, purpose, fill, tc, bold] of items) {
    rows.push(new TableRow({ children: [
      cell(name, { fill, textColor: tc, bold, textSize: 18, align: AlignmentType.LEFT, font: "Consolas" }),
      cell(purpose, { fill, textColor: tc, textSize: 18, align: AlignmentType.LEFT }),
    ]}));
  }

  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED });
}

function buildPanelDiagram() {
  const rows = [
    new TableRow({ children: [
      cell("CROSS-FIRE PANEL MODE (UPSC / NDA)", { fill: "1B4F72", textColor: "FFFFFF", bold: true, textSize: 24, colSpan: 3 }),
    ]}),
    spacerRow(3),
    new TableRow({ children: [
      cell("👤 Avatar 1\n\nCHAIRMAN SINGH\nVoice: Onyx (deep)\nEmotion: Stern", { fill: "FADBD8", bold: true, textSize: 17, borderColor: "E74C3C" }),
      cell("👤 Avatar 2\n\nDR. SHARMA\nVoice: Echo (clear)\nEmotion: Curious", { fill: "D6EAF8", bold: true, textSize: 17, borderColor: "2980B9" }),
      cell("👤 Avatar 3\n\nADV. KRISHNA\nVoice: Fable (warm)\nEmotion: Empathetic", { fill: "D4EFDF", bold: true, textSize: 17, borderColor: "27AE60" }),
    ]}),
    arrowRow(3),
    new TableRow({ children: [
      cell("They take turns asking questions  →  Active speaker has GLOW effect  →  Name shown at bottom", { fill: "FEF9E7", textSize: 18, colSpan: 3 }),
    ]}),
  ];
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED });
}

let inCode = false;
let codeBlock = [];
let inTable = false;
let tableRows = [];
let skipCodeBlock = false;

function flushTable() {
  if (tableRows.length < 2) { inTable = false; tableRows = []; return; }
  const rows = tableRows.filter(r => !r.match(/^\|[\s-|]+\|$/));
  const tRows = rows.map((row, ri) => {
    const cells = row.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());
    return new TableRow({
      children: cells.map(c => new TableCell({
        children: [new Paragraph({ children: parseLine(c), spacing: { before: 40, after: 40 } })],
        width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
        shading: ri === 0 ? { fill: "1B4F72", type: ShadingType.CLEAR } : undefined,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 3, color: ri === 0 ? "1B4F72" : "BDC3C7" },
          bottom: { style: BorderStyle.SINGLE, size: 3, color: ri === 0 ? "1B4F72" : "BDC3C7" },
          left: { style: BorderStyle.SINGLE, size: 3, color: ri === 0 ? "1B4F72" : "BDC3C7" },
          right: { style: BorderStyle.SINGLE, size: 3, color: ri === 0 ? "1B4F72" : "BDC3C7" },
        },
      })),
    });
  });
  children.push(new Table({ rows: tRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
  inTable = false;
  tableRows = [];
}

let diagramsInserted = {
  flow: false,
  arch: false,
  rppg: false,
  api: false,
  file: false,
  panel: false,
};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.startsWith("```")) {
    if (inCode) {
      const blockText = codeBlock.join("\n");
      if (blockText.includes("BROWSER") && blockText.includes("API SERVER") && !diagramsInserted.arch) {
        children.push(buildArchDiagram());
        children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
        diagramsInserted.arch = true;
      } else if (blockText.includes("Frontend (Browser)") && blockText.includes("Backend") && !diagramsInserted.api) {
        children.push(buildApiFlow());
        children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
        diagramsInserted.api = true;
      } else if (blockText.includes("workspace/") && blockText.includes("holo-sync") && !diagramsInserted.file) {
        children.push(buildFileStructure());
        children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
        diagramsInserted.file = true;
      } else if (!blockText.includes("┌") && !blockText.includes("│") && !blockText.includes("├") && blockText.trim().length > 0) {
        children.push(new Paragraph({
          children: [t(blockText, { font: "Consolas", size: 18 })],
          shading: { fill: "F4F6F7", type: ShadingType.CLEAR },
          spacing: { before: 80, after: 80 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "2E86C1" } },
        }));
      }
      codeBlock = [];
      inCode = false;
    } else {
      if (inTable) flushTable();
      inCode = true;
    }
    continue;
  }

  if (inCode) { codeBlock.push(line); continue; }

  if (line.startsWith("|") && line.includes("|")) {
    inTable = true;
    tableRows.push(line);
    continue;
  } else if (inTable) {
    flushTable();
  }

  if (line.trim() === "## 4. How does the whole thing work?" || line.includes("How does the whole thing work")) {
    children.push(new Paragraph({
      children: [t("4. How Does The Whole Thing Work? (Big Picture)", { bold: true, size: 30, color: "1B4F72" })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E86C1" } },
    }));
    if (!diagramsInserted.flow) {
      children.push(new Paragraph({ children: [t("Complete Interview Flow:", { bold: true, size: 24, color: "1A5276" })], spacing: { before: 120, after: 80 } }));
      children.push(buildFlowDiagram());
      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      diagramsInserted.flow = true;
    }
    continue;
  }

  if (line.includes("7.2") && line.includes("Heart Rate") && !diagramsInserted.rppg) {
    children.push(new Paragraph({
      children: [t("7.2 Heart Rate Detection (rPPG)", { bold: true, size: 26, color: "2874A6" })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 80 },
    }));
    children.push(new Paragraph({ children: [t("Signal Processing Pipeline:", { bold: true, size: 22, color: "1A5276" })], spacing: { before: 80, after: 80 } }));
    children.push(buildRppgPipeline());
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    diagramsInserted.rppg = true;
    continue;
  }

  if (line.includes("7.12") && line.includes("Cross-Fire") && !diagramsInserted.panel) {
    children.push(new Paragraph({
      children: [t("7.12 Cross-Fire Panel Mode", { bold: true, size: 26, color: "2874A6" })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 80 },
    }));
    children.push(buildPanelDiagram());
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    diagramsInserted.panel = true;
    continue;
  }

  if (line.startsWith("# ") && !line.startsWith("##")) {
    children.push(new Paragraph({
      children: [t(line.slice(2), { bold: true, size: 36, color: "1A5276" })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 100 },
      alignment: AlignmentType.CENTER,
    }));
  } else if (line.startsWith("## ")) {
    children.push(new Paragraph({
      children: [t(line.slice(3), { bold: true, size: 30, color: "1B4F72" })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E86C1" } },
    }));
  } else if (line.startsWith("### ")) {
    children.push(new Paragraph({
      children: [t(line.slice(4), { bold: true, size: 26, color: "2874A6" })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 60 },
    }));
  } else if (line.startsWith("- ") || line.startsWith("  - ")) {
    const indent = line.startsWith("  - ") ? 720 : 360;
    const text = line.replace(/^\s*-\s*/, "");
    children.push(new Paragraph({
      children: parseLine(text),
      bullet: { level: line.startsWith("  - ") ? 1 : 0 },
      spacing: { before: 40, after: 40 },
      indent: { left: indent },
    }));
  } else if (line.match(/^\d+\.\s/)) {
    const text = line.replace(/^\d+\.\s*/, "");
    children.push(new Paragraph({
      children: parseLine(text),
      numbering: { reference: "default-numbering", level: 0 },
      spacing: { before: 40, after: 40 },
    }));
  } else if (line.startsWith("> ")) {
    children.push(new Paragraph({
      children: [t(line.slice(2), { italics: true, color: "5D6D7E" })],
      indent: { left: 480 },
      shading: { fill: "EBF5FB", type: ShadingType.CLEAR },
      spacing: { before: 60, after: 60 },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: "2E86C1" } },
    }));
  } else if (line.startsWith("---")) {
    children.push(new Paragraph({
      text: "",
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "BDC3C7" } },
      spacing: { before: 120, after: 120 },
    }));
  } else if (line.trim() === "") {
    children.push(new Paragraph({ text: "", spacing: { before: 40, after: 40 } }));
  } else {
    children.push(new Paragraph({
      children: parseLine(line),
      spacing: { before: 40, after: 40 },
    }));
  }
}

if (inTable) flushTable();

if (!diagramsInserted.api) {
  children.push(buildApiFlow());
  children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
}

const doc = new Document({
  numbering: {
    config: [{
      reference: "default-numbering",
      levels: [{
        level: 0,
        format: "decimal",
        text: "%1.",
        alignment: AlignmentType.START,
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 800, right: 800, bottom: 800, left: 800 },
      },
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("HOLO_SYNC_DOCUMENTATION.docx", buffer);
console.log("DOCX generated with proper diagrams!");
