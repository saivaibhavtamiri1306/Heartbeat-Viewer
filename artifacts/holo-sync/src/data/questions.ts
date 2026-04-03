export interface Domain {
  id: string;
  label: string;
  icon: string;
  description: string;
  panelMode: boolean;
  color: string;
}

export const DOMAINS: Domain[] = [
  {
    id: "upsc",
    label: "UPSC Civil Services",
    icon: "⚖",
    description: "Indian Administrative Service & Civil Services examination preparation",
    panelMode: true,
    color: "#ffaa00",
  },
  {
    id: "swe",
    label: "Software Engineering",
    icon: "💻",
    description: "Full-Stack, Backend, System Design & DSA interviews",
    panelMode: false,
    color: "#00d4ff",
  },
  {
    id: "nda",
    label: "NDA / SSB Defence",
    icon: "⚔",
    description: "National Defence Academy & Services Selection Board",
    panelMode: true,
    color: "#ff4444",
  },
  {
    id: "medical",
    label: "Medical / NEET PG",
    icon: "⚕",
    description: "MBBS, PG Medical entrance & clinical case discussions",
    panelMode: false,
    color: "#00ff88",
  },
  {
    id: "ibanking",
    label: "Investment Banking",
    icon: "📈",
    description: "IB, M&A, financial modeling & technical finance interviews",
    panelMode: false,
    color: "#aa00ff",
  },
];

export interface Question {
  id: string;
  text: string;
  domain: string;
  avatarName?: string;
  avatarIndex?: number;
  followUp?: string;
  isInterrupt?: boolean;
  isBullshitTrigger?: boolean;
}

export const QUESTIONS: Record<string, Question[]> = {
  upsc: [
    {
      id: "u1",
      text: "Good morning. I am Chairman Singh. Let us begin. What do you understand by the concept of cooperative federalism in the Indian context, and how has it evolved post-2014?",
      avatarName: "CHAIRMAN SINGH",
      avatarIndex: 0,
    },
    {
      id: "u2",
      text: "You mentioned cooperative federalism. But tell me — has the GST Council actually functioned as a true federal body, or has it been dominated by the Centre?",
      avatarName: "MEMBER DR. SHARMA",
      avatarIndex: 1,
      isInterrupt: true,
    },
    {
      id: "u3",
      text: "Forget GST for a moment. What is your opinion on Article 356, and do you think it has been misused?",
      avatarName: "MEMBER ADV. KRISHNA",
      avatarIndex: 2,
      isInterrupt: true,
    },
    {
      id: "u4",
      text: "Let us move on. If you were posted as a District Collector during a communal riot, what would be your first three actions in the first hour?",
      avatarName: "CHAIRMAN SINGH",
      avatarIndex: 0,
    },
    {
      id: "u5",
      text: "How do you balance administrative efficiency with political accountability as a civil servant?",
      avatarName: "MEMBER DR. SHARMA",
      avatarIndex: 1,
    },
  ],
  swe: [
    {
      id: "s1",
      text: "Hello. I am your technical interviewer today. Let's begin with system design. Can you walk me through how you would design a distributed URL shortener that handles 100 million requests per day?",
      avatarName: "HOLO-AI",
    },
    {
      id: "s2",
      text: "Interesting. You mentioned caching. Can you be specific — which caching strategy would you use and why? LRU, LFU, or something else?",
      avatarName: "HOLO-AI",
      isBullshitTrigger: true,
    },
    {
      id: "s3",
      text: "Let's shift to algorithms. Given an unsorted array, find the kth largest element. What is the most optimal solution?",
      avatarName: "HOLO-AI",
    },
    {
      id: "s4",
      text: "You mentioned using a heap. Can you tell me the exact time complexity of building a max-heap from an unsorted array, and why?",
      avatarName: "HOLO-AI",
      isBullshitTrigger: true,
    },
    {
      id: "s5",
      text: "Let's talk about your experience. Describe the most complex technical problem you have solved in production.",
      avatarName: "HOLO-AI",
    },
  ],
  nda: [
    {
      id: "n1",
      text: "Candidate, I am Brigadier Mehta. Stand easy. Tell me about yourself — your background, motivation, and why you want to serve the nation.",
      avatarName: "BRIG. MEHTA",
      avatarIndex: 0,
    },
    {
      id: "n2",
      text: "Leadership. What does it mean to you? Give me a real example where you led a team under pressure.",
      avatarName: "COL. VERMA",
      avatarIndex: 1,
      isInterrupt: true,
    },
    {
      id: "n3",
      text: "Current affairs — tell me about India's strategic interests in the Indo-Pacific and our relationship with QUAD.",
      avatarName: "WING CDR. NAIR",
      avatarIndex: 2,
      isInterrupt: true,
    },
    {
      id: "n4",
      text: "Physical and mental fitness — how do you maintain them? And what is your daily routine?",
      avatarName: "BRIG. MEHTA",
      avatarIndex: 0,
    },
  ],
  medical: [
    {
      id: "m1",
      text: "Good morning, Doctor. A 45-year-old male presents with sudden onset chest pain radiating to the left arm, diaphoresis, and nausea. Walk me through your initial assessment.",
      avatarName: "EXAMINER",
    },
    {
      id: "m2",
      text: "The ECG shows ST elevation in leads II, III, and aVF. What is your diagnosis and immediate management?",
      avatarName: "EXAMINER",
      isBullshitTrigger: true,
    },
    {
      id: "m3",
      text: "What is the golden hour in MI management and what is the door-to-balloon time target?",
      avatarName: "EXAMINER",
    },
    {
      id: "m4",
      text: "Now, an ethical question — a patient refuses blood transfusion on religious grounds but is critically ill. How do you proceed?",
      avatarName: "EXAMINER",
    },
  ],
  ibanking: [
    {
      id: "i1",
      text: "Welcome. Let us begin. Walk me through your understanding of DCF valuation — what are the key assumptions you make?",
      avatarName: "MD RAJIV KAPOOR",
    },
    {
      id: "i2",
      text: "If WACC increases, what happens to the DCF valuation and why? Be precise.",
      avatarName: "MD RAJIV KAPOOR",
      isBullshitTrigger: true,
    },
    {
      id: "i3",
      text: "Tell me about a major M&A deal you have analyzed. Walk me through your thesis.",
      avatarName: "MD RAJIV KAPOOR",
    },
    {
      id: "i4",
      text: "Why is EBITDA used as a proxy for cash flow? What are its limitations?",
      avatarName: "MD RAJIV KAPOOR",
      isBullshitTrigger: true,
    },
    {
      id: "i5",
      text: "Where do you see yourself in 5 years? Why investment banking specifically?",
      avatarName: "MD RAJIV KAPOOR",
    },
  ],
};

export const EMPATHY_RESPONSES = [
  "Hey, I can see you're a little stressed right now. That's completely okay — take a deep breath. You are doing well. Let's try that again.",
  "Your heart rate has spiked a bit. That is perfectly normal in an interview setting. Relax your shoulders, take a sip of water if you need to, and we'll continue at your pace.",
  "I noticed some tension there. Remember — I am here to understand you, not to judge you. Breathe, refocus, and let's try again.",
  "It seems like you need a moment. Take it. There is no rush. Good interviewers want you to succeed.",
];

export const BLUFF_RESPONSES = [
  "That is a strong claim. Can you be more specific? Walk me through exactly how you implemented that — step by step.",
  "Interesting. You mentioned that concept — can you define it precisely and give me a concrete example from your own work?",
  "I'd like to drill deeper into that. Can you explain the underlying mechanism in technical detail?",
];

export const PANEL_AVATARS = {
  upsc: [
    { name: "Chairman Singh", emotion: "stern" as const },
    { name: "Dr. Sharma", emotion: "curious" as const },
    { name: "Adv. Krishna", emotion: "neutral" as const },
  ],
  nda: [
    { name: "Brig. Mehta", emotion: "stern" as const },
    { name: "Col. Verma", emotion: "curious" as const },
    { name: "Wg Cdr. Nair", emotion: "neutral" as const },
  ],
};
