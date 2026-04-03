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

export type Difficulty = "easy" | "medium" | "hard";

export interface InterviewConfig {
  domain: Domain;
  background: string;
  difficulty: Difficulty;
  topics: string[];
}

export const BACKGROUNDS: Record<string, { label: string; options: string[] }> = {
  upsc: {
    label: "Educational Background",
    options: [
      "B.Tech / B.E. (Engineering)",
      "B.A. (Arts / Humanities)",
      "B.Sc. (Science)",
      "B.Com (Commerce)",
      "LLB / Law",
      "MBBS / Medical",
      "MBA / Management",
      "BCA / MCA (Computer Applications)",
      "B.Ed (Education)",
      "Other",
    ],
  },
  swe: {
    label: "Current Role / Background",
    options: [
      "B.Tech / B.E. (CS / IT)",
      "B.Tech / B.E. (Non-CS)",
      "BCA / MCA",
      "Self-Taught Developer",
      "Bootcamp Graduate",
      "M.Tech / MS (CS)",
      "B.Sc. (Computer Science)",
      "Working Professional (0-2 yrs)",
      "Working Professional (2-5 yrs)",
      "Working Professional (5+ yrs)",
    ],
  },
  nda: {
    label: "Educational Background",
    options: [
      "Class 12 (Science - PCM)",
      "Class 12 (Science - PCB)",
      "Class 12 (Arts / Humanities)",
      "Class 12 (Commerce)",
      "B.Tech / B.E. (Engineering)",
      "B.Sc. (Science)",
      "B.A. (Arts)",
      "NCC Cadet",
      "Sports Background",
      "Other",
    ],
  },
  medical: {
    label: "Medical Background",
    options: [
      "MBBS Final Year",
      "MBBS Intern",
      "MBBS Graduate (Preparing for PG)",
      "MD / MS Aspirant",
      "BDS (Dental)",
      "BAMS (Ayurveda)",
      "BHMS (Homeopathy)",
      "B.Pharm (Pharmacy)",
      "B.Sc. Nursing",
      "Other",
    ],
  },
  ibanking: {
    label: "Educational / Professional Background",
    options: [
      "B.Com / B.Com (Hons)",
      "BBA / BMS",
      "MBA (Finance)",
      "CA / CFA / CPA",
      "B.Tech (seeking finance role)",
      "M.Com / M.Sc. Finance",
      "Working Professional (Consulting)",
      "Working Professional (Accounting)",
      "Working Professional (Banking)",
      "Other",
    ],
  },
};

export const TOPICS: Record<string, { id: string; label: string; icon: string }[]> = {
  upsc: [
    { id: "polity", label: "Indian Polity & Constitution", icon: "📜" },
    { id: "economy", label: "Indian Economy", icon: "💰" },
    { id: "geography", label: "Geography & Environment", icon: "🌍" },
    { id: "history", label: "History & Culture", icon: "🏛" },
    { id: "ethics", label: "Ethics & Integrity", icon: "⚖" },
    { id: "current_affairs", label: "Current Affairs", icon: "📰" },
    { id: "governance", label: "Governance & Administration", icon: "🏢" },
    { id: "international", label: "International Relations", icon: "🌐" },
    { id: "science_tech", label: "Science & Technology", icon: "🔬" },
    { id: "society", label: "Indian Society & Social Issues", icon: "👥" },
  ],
  swe: [
    { id: "dsa", label: "Data Structures & Algorithms", icon: "🧮" },
    { id: "system_design", label: "System Design", icon: "🏗" },
    { id: "frontend", label: "Frontend / React / UI", icon: "🎨" },
    { id: "backend", label: "Backend / APIs / Databases", icon: "⚙" },
    { id: "os_networks", label: "OS & Computer Networks", icon: "🖥" },
    { id: "dbms", label: "DBMS & SQL", icon: "🗄" },
    { id: "oops", label: "OOPs & Design Patterns", icon: "📐" },
    { id: "behavioral", label: "Behavioral / HR", icon: "🤝" },
    { id: "devops", label: "DevOps & Cloud", icon: "☁" },
    { id: "ml_ai", label: "Machine Learning / AI", icon: "🤖" },
  ],
  nda: [
    { id: "gk_current", label: "General Knowledge & Current Affairs", icon: "📰" },
    { id: "leadership", label: "Leadership & OLQs", icon: "⭐" },
    { id: "defence", label: "Defence & Strategic Affairs", icon: "🎖" },
    { id: "geography_nda", label: "Geography & Geopolitics", icon: "🌍" },
    { id: "history_nda", label: "Indian History & Freedom Struggle", icon: "🏛" },
    { id: "science_nda", label: "Science & Technology", icon: "🔬" },
    { id: "personality", label: "Personality & Situation Reaction", icon: "🧠" },
    { id: "physical_fitness", label: "Physical Fitness & Sports", icon: "💪" },
  ],
  medical: [
    { id: "anatomy", label: "Anatomy", icon: "🦴" },
    { id: "physiology", label: "Physiology", icon: "❤" },
    { id: "biochemistry", label: "Biochemistry", icon: "🧪" },
    { id: "pathology", label: "Pathology", icon: "🔬" },
    { id: "pharmacology", label: "Pharmacology", icon: "💊" },
    { id: "medicine", label: "General Medicine", icon: "🩺" },
    { id: "surgery", label: "Surgery", icon: "🔪" },
    { id: "pediatrics", label: "Pediatrics", icon: "👶" },
    { id: "obgyn", label: "OB/GYN", icon: "🤰" },
    { id: "ethics_med", label: "Medical Ethics & Bioethics", icon: "⚖" },
  ],
  ibanking: [
    { id: "valuation", label: "Valuation (DCF, Comps, Precedents)", icon: "📊" },
    { id: "accounting", label: "Accounting & Financial Statements", icon: "📒" },
    { id: "mergers", label: "M&A / Mergers & Acquisitions", icon: "🤝" },
    { id: "lbo", label: "LBO / Leveraged Buyouts", icon: "🏦" },
    { id: "markets", label: "Capital Markets & Trading", icon: "📈" },
    { id: "equity_research", label: "Equity Research", icon: "🔍" },
    { id: "behavioral_ib", label: "Fit / Behavioral Questions", icon: "👔" },
    { id: "brain_teasers", label: "Brain Teasers & Mental Math", icon: "🧩" },
  ],
};

export interface Question {
  id: string;
  text: string;
  domain: string;
  topic: string;
  difficulty: Difficulty;
  avatarName?: string;
  avatarIndex?: number;
  followUp?: string;
  isInterrupt?: boolean;
  isBullshitTrigger?: boolean;
}

export const QUESTIONS: Record<string, Question[]> = {
  upsc: [
    { id: "u_pol_e1", text: "What are the fundamental rights guaranteed under the Indian Constitution? Can you name at least four?", domain: "upsc", topic: "polity", difficulty: "easy", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_pol_e2", text: "What is the difference between the Lok Sabha and the Rajya Sabha? Explain briefly.", domain: "upsc", topic: "polity", difficulty: "easy", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1 },
    { id: "u_pol_m1", text: "What do you understand by cooperative federalism in the Indian context, and how has it evolved post-2014?", domain: "upsc", topic: "polity", difficulty: "medium", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_pol_m2", text: "Has the GST Council actually functioned as a true federal body, or has it been dominated by the Centre?", domain: "upsc", topic: "polity", difficulty: "medium", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1, isInterrupt: true },
    { id: "u_pol_h1", text: "What is your opinion on Article 356, and do you think it has been misused? Cite specific instances.", domain: "upsc", topic: "polity", difficulty: "hard", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2, isInterrupt: true },
    { id: "u_pol_h2", text: "Critically examine the tension between parliamentary sovereignty and judicial review in India. Has the basic structure doctrine gone too far?", domain: "upsc", topic: "polity", difficulty: "hard", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },

    { id: "u_eco_e1", text: "What is GDP? How is it different from GNP?", domain: "upsc", topic: "economy", difficulty: "easy", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1 },
    { id: "u_eco_m1", text: "Explain the significance of the fiscal deficit and how it impacts the Indian economy.", domain: "upsc", topic: "economy", difficulty: "medium", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_eco_h1", text: "Evaluate the effectiveness of India's monetary policy framework post-inflation targeting. Has the MPC achieved its objectives?", domain: "upsc", topic: "economy", difficulty: "hard", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1, isBullshitTrigger: true },

    { id: "u_geo_e1", text: "What are the major river systems of India? Name at least three.", domain: "upsc", topic: "geography", difficulty: "easy", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2 },
    { id: "u_geo_m1", text: "Explain the phenomenon of monsoon and its importance for Indian agriculture.", domain: "upsc", topic: "geography", difficulty: "medium", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_geo_h1", text: "Critically analyze India's climate change commitments under the Paris Agreement. Are our NDCs ambitious enough given our development needs?", domain: "upsc", topic: "geography", difficulty: "hard", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2 },

    { id: "u_his_e1", text: "Who was the first Prime Minister of India and what were his key contributions?", domain: "upsc", topic: "history", difficulty: "easy", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_his_m1", text: "Discuss the role of the Non-Cooperation Movement in India's freedom struggle.", domain: "upsc", topic: "history", difficulty: "medium", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1 },
    { id: "u_his_h1", text: "How did Subhas Chandra Bose's approach to independence differ from Gandhi's? Evaluate their respective impacts on the freedom movement.", domain: "upsc", topic: "history", difficulty: "hard", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2 },

    { id: "u_eth_e1", text: "What do you understand by ethics? How is it different from morality?", domain: "upsc", topic: "ethics", difficulty: "easy", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2 },
    { id: "u_eth_m1", text: "A close friend who is also a civil servant is involved in corruption. What would you do?", domain: "upsc", topic: "ethics", difficulty: "medium", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_eth_h1", text: "You are a District Collector. A communal riot breaks out. A senior politician from the ruling party pressures you to not arrest the perpetrators from his community. How do you handle this ethically and administratively?", domain: "upsc", topic: "ethics", difficulty: "hard", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },

    { id: "u_ca_e1", text: "Name any three major government schemes launched in the last two years.", domain: "upsc", topic: "current_affairs", difficulty: "easy", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1 },
    { id: "u_ca_m1", text: "Discuss India's G20 presidency and its key outcomes.", domain: "upsc", topic: "current_affairs", difficulty: "medium", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_ca_h1", text: "Analyze the impact of the Russia-Ukraine conflict on India's foreign policy, energy security, and strategic autonomy.", domain: "upsc", topic: "current_affairs", difficulty: "hard", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2, isInterrupt: true },

    { id: "u_gov_e1", text: "What is the role of a District Collector? Name the key responsibilities.", domain: "upsc", topic: "governance", difficulty: "easy", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_gov_m1", text: "How do you balance administrative efficiency with political accountability as a civil servant?", domain: "upsc", topic: "governance", difficulty: "medium", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1 },
    { id: "u_gov_h1", text: "Critically evaluate the effectiveness of e-governance initiatives in India. Have they reduced corruption or merely digitized it?", domain: "upsc", topic: "governance", difficulty: "hard", avatarName: "CHAIRMAN SINGH", avatarIndex: 0, isBullshitTrigger: true },

    { id: "u_int_e1", text: "Name the permanent members of the UN Security Council.", domain: "upsc", topic: "international", difficulty: "easy", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2 },
    { id: "u_int_m1", text: "What is India's Act East Policy? How does it differ from the Look East Policy?", domain: "upsc", topic: "international", difficulty: "medium", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_int_h1", text: "Analyze India's strategic calculus in maintaining relations with both Russia and the United States. Is strategic autonomy sustainable in a bipolar world order?", domain: "upsc", topic: "international", difficulty: "hard", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1 },

    { id: "u_st_m1", text: "What is India's space programme? Discuss the significance of missions like Chandrayaan and Mangalyaan.", domain: "upsc", topic: "science_tech", difficulty: "medium", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1 },
    { id: "u_st_h1", text: "Discuss the ethical implications of AI in governance. Should algorithmic decision-making replace human discretion in public policy?", domain: "upsc", topic: "science_tech", difficulty: "hard", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2 },

    { id: "u_soc_e1", text: "What is the caste system? Is it still relevant in modern India?", domain: "upsc", topic: "society", difficulty: "easy", avatarName: "CHAIRMAN SINGH", avatarIndex: 0 },
    { id: "u_soc_m1", text: "Discuss the impact of urbanization on Indian society. Has it been more positive or negative?", domain: "upsc", topic: "society", difficulty: "medium", avatarName: "MEMBER DR. SHARMA", avatarIndex: 1 },
    { id: "u_soc_h1", text: "India ranks poorly on the gender inequality index. Analyze the structural, cultural, and policy-level barriers to gender equality in India.", domain: "upsc", topic: "society", difficulty: "hard", avatarName: "MEMBER ADV. KRISHNA", avatarIndex: 2 },
  ],

  swe: [
    { id: "s_dsa_e1", text: "What is the difference between an array and a linked list? When would you use one over the other?", domain: "swe", topic: "dsa", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_dsa_e2", text: "Explain what a stack and a queue are. Give a real-world example of each.", domain: "swe", topic: "dsa", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_dsa_m1", text: "Given an unsorted array, find the kth largest element. What is the most optimal solution?", domain: "swe", topic: "dsa", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_dsa_m2", text: "Explain how a hash map works internally. What happens during a collision?", domain: "swe", topic: "dsa", difficulty: "medium", avatarName: "HOLO-AI", isBullshitTrigger: true },
    { id: "s_dsa_h1", text: "Design an algorithm to find the median of a stream of integers in O(log n) time per insertion. Walk me through the data structure.", domain: "swe", topic: "dsa", difficulty: "hard", avatarName: "HOLO-AI" },
    { id: "s_dsa_h2", text: "Explain the time complexity of building a max-heap from an unsorted array, and why it is O(n) not O(n log n).", domain: "swe", topic: "dsa", difficulty: "hard", avatarName: "HOLO-AI", isBullshitTrigger: true },

    { id: "s_sd_e1", text: "What is the difference between monolithic and microservice architecture?", domain: "swe", topic: "system_design", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_sd_m1", text: "Design a URL shortener that handles 100 million requests per day. Walk me through the high-level architecture.", domain: "swe", topic: "system_design", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_sd_m2", text: "You mentioned caching. Which caching strategy would you use and why? LRU, LFU, or something else?", domain: "swe", topic: "system_design", difficulty: "medium", avatarName: "HOLO-AI", isBullshitTrigger: true },
    { id: "s_sd_h1", text: "Design a real-time chat system like WhatsApp. Cover message delivery guarantees, offline handling, and end-to-end encryption architecture.", domain: "swe", topic: "system_design", difficulty: "hard", avatarName: "HOLO-AI" },
    { id: "s_sd_h2", text: "Design a distributed rate limiter for an API gateway serving 10 million RPM across 50 data centers. How do you handle clock skew?", domain: "swe", topic: "system_design", difficulty: "hard", avatarName: "HOLO-AI" },

    { id: "s_fe_e1", text: "What is the virtual DOM in React? Why does React use it?", domain: "swe", topic: "frontend", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_fe_m1", text: "Explain the difference between useEffect and useLayoutEffect. When would you use each?", domain: "swe", topic: "frontend", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_fe_h1", text: "How would you architect a design system that supports server-side rendering, tree-shaking, and theming across multiple frameworks?", domain: "swe", topic: "frontend", difficulty: "hard", avatarName: "HOLO-AI" },

    { id: "s_be_e1", text: "What is a REST API? How is it different from GraphQL?", domain: "swe", topic: "backend", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_be_m1", text: "Explain the CAP theorem. Give an example of a system that prioritizes availability over consistency.", domain: "swe", topic: "backend", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_be_h1", text: "Design an event-driven microservice architecture with exactly-once processing guarantees using Kafka. How do you handle poison pills?", domain: "swe", topic: "backend", difficulty: "hard", avatarName: "HOLO-AI", isBullshitTrigger: true },

    { id: "s_os_e1", text: "What is the difference between a process and a thread?", domain: "swe", topic: "os_networks", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_os_m1", text: "Explain what happens when you type a URL in the browser and press Enter. Walk me through the entire flow.", domain: "swe", topic: "os_networks", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_os_h1", text: "Explain how TCP congestion control works. Compare Tahoe, Reno, and CUBIC. When would you choose UDP over TCP?", domain: "swe", topic: "os_networks", difficulty: "hard", avatarName: "HOLO-AI" },

    { id: "s_db_e1", text: "What is the difference between SQL and NoSQL databases? Give examples of each.", domain: "swe", topic: "dbms", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_db_m1", text: "Explain database indexing. What are the trade-offs of adding an index?", domain: "swe", topic: "dbms", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_db_h1", text: "Design a sharding strategy for a social media platform with 500 million users. How do you handle cross-shard queries and rebalancing?", domain: "swe", topic: "dbms", difficulty: "hard", avatarName: "HOLO-AI" },

    { id: "s_oo_e1", text: "What are the four pillars of Object-Oriented Programming?", domain: "swe", topic: "oops", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_oo_m1", text: "Explain the SOLID principles with examples. Which one do developers violate most often?", domain: "swe", topic: "oops", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_oo_h1", text: "Compare the Strategy, Observer, and Decorator patterns. Design a notification system using at least two of them.", domain: "swe", topic: "oops", difficulty: "hard", avatarName: "HOLO-AI" },

    { id: "s_bh_e1", text: "Tell me about yourself. Walk me through your resume.", domain: "swe", topic: "behavioral", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_bh_m1", text: "Describe the most complex technical problem you solved in production. What was the impact?", domain: "swe", topic: "behavioral", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_bh_h1", text: "Tell me about a time you disagreed with your tech lead on architecture. How did you handle it and what was the outcome?", domain: "swe", topic: "behavioral", difficulty: "hard", avatarName: "HOLO-AI" },

    { id: "s_do_e1", text: "What is Docker? How is it different from a virtual machine?", domain: "swe", topic: "devops", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_do_m1", text: "Explain CI/CD pipelines. What tools have you used and what are the key stages?", domain: "swe", topic: "devops", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_do_h1", text: "Design a zero-downtime deployment strategy for a stateful service running on Kubernetes. How do you handle database migrations?", domain: "swe", topic: "devops", difficulty: "hard", avatarName: "HOLO-AI" },

    { id: "s_ml_e1", text: "What is the difference between supervised and unsupervised learning? Give examples.", domain: "swe", topic: "ml_ai", difficulty: "easy", avatarName: "HOLO-AI" },
    { id: "s_ml_m1", text: "Explain the bias-variance tradeoff. How do you diagnose overfitting?", domain: "swe", topic: "ml_ai", difficulty: "medium", avatarName: "HOLO-AI" },
    { id: "s_ml_h1", text: "Design an ML pipeline for a real-time fraud detection system. Cover feature engineering, model selection, training, and serving at scale.", domain: "swe", topic: "ml_ai", difficulty: "hard", avatarName: "HOLO-AI" },
  ],

  nda: [
    { id: "n_gk_e1", text: "Who is the current President and Defence Minister of India?", domain: "nda", topic: "gk_current", difficulty: "easy", avatarName: "BRIG. MEHTA", avatarIndex: 0 },
    { id: "n_gk_m1", text: "Discuss India's recent developments in defence technology, including indigenous weapons systems.", domain: "nda", topic: "gk_current", difficulty: "medium", avatarName: "BRIG. MEHTA", avatarIndex: 0 },
    { id: "n_gk_h1", text: "Analyze the shifting geopolitical dynamics in South Asia. How should India respond to China's BRI and its growing influence in Nepal, Sri Lanka, and Myanmar?", domain: "nda", topic: "gk_current", difficulty: "hard", avatarName: "WING CDR. NAIR", avatarIndex: 2, isInterrupt: true },

    { id: "n_ld_e1", text: "Candidate, tell me about yourself — your background, motivation, and why you want to serve the nation.", domain: "nda", topic: "leadership", difficulty: "easy", avatarName: "BRIG. MEHTA", avatarIndex: 0 },
    { id: "n_ld_m1", text: "What does leadership mean to you? Give me a real example where you led a team under pressure.", domain: "nda", topic: "leadership", difficulty: "medium", avatarName: "COL. VERMA", avatarIndex: 1, isInterrupt: true },
    { id: "n_ld_h1", text: "You are leading a patrol in hostile territory. Your team is ambushed. Two soldiers are injured, radio is down. What do you do? Walk me through your decision-making.", domain: "nda", topic: "leadership", difficulty: "hard", avatarName: "BRIG. MEHTA", avatarIndex: 0 },

    { id: "n_df_e1", text: "Name the three wings of the Indian Armed Forces and their primary roles.", domain: "nda", topic: "defence", difficulty: "easy", avatarName: "COL. VERMA", avatarIndex: 1 },
    { id: "n_df_m1", text: "Explain India's nuclear doctrine. What is No First Use policy and do you think it should be revised?", domain: "nda", topic: "defence", difficulty: "medium", avatarName: "WING CDR. NAIR", avatarIndex: 2 },
    { id: "n_df_h1", text: "India faces a two-front threat from China and Pakistan simultaneously. How should India's military strategy adapt? Discuss force deployment and strategic options.", domain: "nda", topic: "defence", difficulty: "hard", avatarName: "BRIG. MEHTA", avatarIndex: 0, isBullshitTrigger: true },

    { id: "n_gg_m1", text: "What is India's strategic interest in the Indo-Pacific? Discuss the QUAD alliance.", domain: "nda", topic: "geography_nda", difficulty: "medium", avatarName: "WING CDR. NAIR", avatarIndex: 2 },
    { id: "n_hi_m1", text: "Discuss the role of the Indian National Army (INA) in the freedom struggle.", domain: "nda", topic: "history_nda", difficulty: "medium", avatarName: "COL. VERMA", avatarIndex: 1 },
    { id: "n_sc_m1", text: "What are hypersonic missiles? Why are they a game-changer in modern warfare?", domain: "nda", topic: "science_nda", difficulty: "medium", avatarName: "WING CDR. NAIR", avatarIndex: 2 },

    { id: "n_pr_e1", text: "How do you handle failure? Give me a real example.", domain: "nda", topic: "personality", difficulty: "easy", avatarName: "COL. VERMA", avatarIndex: 1 },
    { id: "n_pr_m1", text: "You witness a senior officer behaving unethically. What do you do? Walk me through your approach.", domain: "nda", topic: "personality", difficulty: "medium", avatarName: "BRIG. MEHTA", avatarIndex: 0 },
    { id: "n_pr_h1", text: "Your best friend in the unit has been caught leaking sensitive information to a foreign agent. You are the only one who knows. What do you do?", domain: "nda", topic: "personality", difficulty: "hard", avatarName: "BRIG. MEHTA", avatarIndex: 0 },

    { id: "n_pf_e1", text: "What is your daily fitness routine? How do you stay physically fit?", domain: "nda", topic: "physical_fitness", difficulty: "easy", avatarName: "COL. VERMA", avatarIndex: 1 },
    { id: "n_pf_m1", text: "An officer must be both mentally and physically tough. How do you train your mental resilience?", domain: "nda", topic: "physical_fitness", difficulty: "medium", avatarName: "BRIG. MEHTA", avatarIndex: 0 },
  ],

  medical: [
    { id: "m_an_e1", text: "Name the bones of the upper limb. How many are there in total?", domain: "medical", topic: "anatomy", difficulty: "easy", avatarName: "EXAMINER" },
    { id: "m_an_m1", text: "Describe the blood supply of the heart. What happens when the LAD artery is blocked?", domain: "medical", topic: "anatomy", difficulty: "medium", avatarName: "EXAMINER" },
    { id: "m_an_h1", text: "Explain the anatomical basis of referred pain in myocardial infarction. Why does the pain radiate to the left arm and jaw?", domain: "medical", topic: "anatomy", difficulty: "hard", avatarName: "EXAMINER" },

    { id: "m_ph_e1", text: "What is blood pressure? What are normal values for systolic and diastolic?", domain: "medical", topic: "physiology", difficulty: "easy", avatarName: "EXAMINER" },
    { id: "m_ph_m1", text: "Explain the Frank-Starling mechanism of the heart. What are its clinical implications?", domain: "medical", topic: "physiology", difficulty: "medium", avatarName: "EXAMINER" },
    { id: "m_ph_h1", text: "Describe the renin-angiotensin-aldosterone system in detail. How do ACE inhibitors work and what are the compensatory mechanisms?", domain: "medical", topic: "physiology", difficulty: "hard", avatarName: "EXAMINER", isBullshitTrigger: true },

    { id: "m_bc_e1", text: "What are amino acids? Name the essential amino acids.", domain: "medical", topic: "biochemistry", difficulty: "easy", avatarName: "EXAMINER" },
    { id: "m_bc_m1", text: "Explain the citric acid cycle and its significance in cellular metabolism.", domain: "medical", topic: "biochemistry", difficulty: "medium", avatarName: "EXAMINER" },

    { id: "m_pa_e1", text: "What is inflammation? Name the five cardinal signs.", domain: "medical", topic: "pathology", difficulty: "easy", avatarName: "EXAMINER" },
    { id: "m_pa_m1", text: "Differentiate between benign and malignant tumors. What are the hallmarks of cancer?", domain: "medical", topic: "pathology", difficulty: "medium", avatarName: "EXAMINER" },
    { id: "m_pa_h1", text: "Explain the pathophysiology of disseminated intravascular coagulation (DIC). How do you diagnose and manage it?", domain: "medical", topic: "pathology", difficulty: "hard", avatarName: "EXAMINER", isBullshitTrigger: true },

    { id: "m_pm_e1", text: "What is the mechanism of action of paracetamol?", domain: "medical", topic: "pharmacology", difficulty: "easy", avatarName: "EXAMINER" },
    { id: "m_pm_m1", text: "Compare the pharmacokinetics of oral vs intravenous drug administration. What is first-pass metabolism?", domain: "medical", topic: "pharmacology", difficulty: "medium", avatarName: "EXAMINER" },
    { id: "m_pm_h1", text: "A patient on warfarin presents with INR of 8.5 and minor bleeding. Walk me through your management. What drug interactions could have caused this?", domain: "medical", topic: "pharmacology", difficulty: "hard", avatarName: "EXAMINER" },

    { id: "m_md_e1", text: "What is diabetes mellitus? What is the difference between Type 1 and Type 2?", domain: "medical", topic: "medicine", difficulty: "easy", avatarName: "EXAMINER" },
    { id: "m_md_m1", text: "A 45-year-old male presents with sudden onset chest pain radiating to the left arm, diaphoresis, and nausea. Walk me through your initial assessment.", domain: "medical", topic: "medicine", difficulty: "medium", avatarName: "EXAMINER" },
    { id: "m_md_h1", text: "The ECG shows ST elevation in leads II, III, and aVF. What is your diagnosis, the artery involved, and your immediate management including door-to-balloon time?", domain: "medical", topic: "medicine", difficulty: "hard", avatarName: "EXAMINER", isBullshitTrigger: true },

    { id: "m_su_e1", text: "What is the difference between clean and contaminated wounds? How does it affect surgical management?", domain: "medical", topic: "surgery", difficulty: "easy", avatarName: "EXAMINER" },
    { id: "m_su_m1", text: "A patient presents with acute abdomen — right iliac fossa pain, rebound tenderness, fever. What is your differential diagnosis and management plan?", domain: "medical", topic: "surgery", difficulty: "medium", avatarName: "EXAMINER" },
    { id: "m_su_h1", text: "Describe the management of a poly-trauma patient using ATLS protocol. Prioritize your interventions.", domain: "medical", topic: "surgery", difficulty: "hard", avatarName: "EXAMINER" },

    { id: "m_pe_m1", text: "A 2-year-old child presents with barking cough, stridor, and mild respiratory distress. What is your diagnosis and management?", domain: "medical", topic: "pediatrics", difficulty: "medium", avatarName: "EXAMINER" },
    { id: "m_ob_m1", text: "Describe the stages of normal labor. What are the indications for cesarean section?", domain: "medical", topic: "obgyn", difficulty: "medium", avatarName: "EXAMINER" },

    { id: "m_et_m1", text: "A patient refuses blood transfusion on religious grounds but is critically ill. How do you proceed? Discuss the ethical and legal aspects.", domain: "medical", topic: "ethics_med", difficulty: "medium", avatarName: "EXAMINER" },
    { id: "m_et_h1", text: "A 14-year-old girl comes alone requesting an abortion. She refuses to involve her parents. Discuss the ethical, legal, and medical considerations in India.", domain: "medical", topic: "ethics_med", difficulty: "hard", avatarName: "EXAMINER" },
  ],

  ibanking: [
    { id: "i_val_e1", text: "What are the three main approaches to valuation? Name them.", domain: "ibanking", topic: "valuation", difficulty: "easy", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_val_m1", text: "Walk me through a DCF valuation. What are the key assumptions you make?", domain: "ibanking", topic: "valuation", difficulty: "medium", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_val_m2", text: "If WACC increases, what happens to the DCF valuation and why? Be precise.", domain: "ibanking", topic: "valuation", difficulty: "medium", avatarName: "MD RAJIV KAPOOR", isBullshitTrigger: true },
    { id: "i_val_h1", text: "When would a precedent transaction analysis give a higher valuation than a comparable company analysis? What adjustments do you make for control premiums?", domain: "ibanking", topic: "valuation", difficulty: "hard", avatarName: "MD RAJIV KAPOOR" },

    { id: "i_acc_e1", text: "What are the three main financial statements? How are they linked?", domain: "ibanking", topic: "accounting", difficulty: "easy", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_acc_m1", text: "If depreciation increases by 10 dollars, walk me through the impact on all three financial statements.", domain: "ibanking", topic: "accounting", difficulty: "medium", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_acc_h1", text: "Company A acquires Company B for 500 million. B has a book value of 300 million. Walk me through the acquisition accounting, goodwill creation, and impact on the combined entity's statements.", domain: "ibanking", topic: "accounting", difficulty: "hard", avatarName: "MD RAJIV KAPOOR", isBullshitTrigger: true },

    { id: "i_ma_e1", text: "What is an M&A deal? What is the difference between a merger and an acquisition?", domain: "ibanking", topic: "mergers", difficulty: "easy", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_ma_m1", text: "Walk me through the M&A process from start to finish. What are the key stages?", domain: "ibanking", topic: "mergers", difficulty: "medium", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_ma_h1", text: "Analyze a hostile takeover defense strategy. When would you recommend a poison pill vs a white knight? Discuss with a recent example.", domain: "ibanking", topic: "mergers", difficulty: "hard", avatarName: "MD RAJIV KAPOOR" },

    { id: "i_lb_m1", text: "What is a leveraged buyout? Walk me through a simple LBO model.", domain: "ibanking", topic: "lbo", difficulty: "medium", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_lb_h1", text: "What makes a company an ideal LBO candidate? Build a case for or against taking a retail chain private through an LBO.", domain: "ibanking", topic: "lbo", difficulty: "hard", avatarName: "MD RAJIV KAPOOR" },

    { id: "i_cm_e1", text: "What is the difference between equity and debt markets?", domain: "ibanking", topic: "markets", difficulty: "easy", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_cm_m1", text: "Explain the IPO process. What role does the investment bank play?", domain: "ibanking", topic: "markets", difficulty: "medium", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_cm_h1", text: "Compare the advantages of a SPAC vs traditional IPO. Why has SPAC popularity declined recently?", domain: "ibanking", topic: "markets", difficulty: "hard", avatarName: "MD RAJIV KAPOOR" },

    { id: "i_er_m1", text: "How do you write a stock pitch? Walk me through your framework for analyzing a company.", domain: "ibanking", topic: "equity_research", difficulty: "medium", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_er_h1", text: "Why is EBITDA used as a proxy for cash flow? What are its limitations, and when would you use unlevered free cash flow instead?", domain: "ibanking", topic: "equity_research", difficulty: "hard", avatarName: "MD RAJIV KAPOOR", isBullshitTrigger: true },

    { id: "i_bf_e1", text: "Why investment banking? Where do you see yourself in 5 years?", domain: "ibanking", topic: "behavioral_ib", difficulty: "easy", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_bf_m1", text: "Tell me about a deal you have analyzed. Walk me through your thesis and the key drivers.", domain: "ibanking", topic: "behavioral_ib", difficulty: "medium", avatarName: "MD RAJIV KAPOOR" },

    { id: "i_bt_m1", text: "You have 8 balls, one is heavier. You have a balance scale. What is the minimum number of weighings to find the heavy ball?", domain: "ibanking", topic: "brain_teasers", difficulty: "medium", avatarName: "MD RAJIV KAPOOR" },
    { id: "i_bt_h1", text: "What is 17 times 23 in your head? Now tell me — approximately how many gas stations are there in India and how did you estimate?", domain: "ibanking", topic: "brain_teasers", difficulty: "hard", avatarName: "MD RAJIV KAPOOR" },
  ],
};

export function getFilteredQuestions(
  domainId: string,
  topics: string[],
  difficulty: Difficulty,
  maxQuestions: number = 10
): Question[] {
  const allQuestions = QUESTIONS[domainId] || [];

  const difficultyPool: Difficulty[] =
    difficulty === "easy" ? ["easy", "medium"] :
    difficulty === "medium" ? ["easy", "medium", "hard"] :
    ["medium", "hard"];

  const difficultyWeight: Record<Difficulty, Record<Difficulty, number>> = {
    easy: { easy: 3, medium: 1, hard: 0 },
    medium: { easy: 1, medium: 3, hard: 1 },
    hard: { easy: 0, medium: 1, hard: 3 },
  };

  let filtered = allQuestions.filter(
    q => topics.includes(q.topic) && difficultyPool.includes(q.difficulty)
  );

  if (filtered.length === 0) {
    filtered = allQuestions.filter(q => difficultyPool.includes(q.difficulty));
  }

  if (filtered.length === 0) {
    filtered = allQuestions;
  }

  const weights = difficultyWeight[difficulty];
  const weighted = filtered.map(q => ({
    q,
    weight: weights[q.difficulty] || 1,
    rand: Math.random(),
  }));
  weighted.sort((a, b) => (b.weight + b.rand) - (a.weight + a.rand));

  const selected: Question[] = [];
  const usedTopics = new Set<string>();

  for (const { q } of weighted) {
    if (selected.length >= maxQuestions) break;
    selected.push(q);
    usedTopics.add(q.topic);
  }

  return selected;
}

export const EMPATHY_RESPONSES = [
  "Hey, I can see you're a little stressed right now. That's completely okay — take a deep breath. You are doing well. Let's try that again.",
  "Your heart rate has spiked a bit. That is perfectly normal in an interview setting. Relax your shoulders, take a sip of water if you need to, and we'll continue at your pace.",
  "I noticed some tension there. Remember — I am here to understand you, not to judge you. Breathe, refocus, and let's try again.",
  "It seems like you need a moment. Take it. There is no rush. Good interviewers want you to succeed.",
];

export const HR_SPIKE_RESPONSES = [
  "I notice your heart rate just jumped up. Are you feeling nervous about this topic? Take a moment if you need to.",
  "Your biometrics show a sudden increase in heart rate. That's interesting — this topic seems to be challenging for you. Let's explore why.",
  "I can see your pulse is climbing. Is this question hitting close to home? Remember, honesty is what we value most.",
  "Your heart rate spiked just now. Are you uncertain about your answer, or is something else on your mind?",
  "Interesting — your heartbeat accelerated noticeably. This tells me this area might need more preparation. Let's work through it.",
  "I'm detecting elevated cardiovascular activity. Don't worry — pressure is part of the process. Channel that energy into your response.",
];

export const HR_DROP_RESPONSES = [
  "Good — I can see your heart rate is settling down. You seem more comfortable now. Let's keep this momentum going.",
  "Your pulse has calmed considerably. That's a sign of composure. You're finding your rhythm — excellent.",
  "I notice your heart rate dropped. You seem more confident with this topic. That's showing through in your answers.",
  "Your biometrics show you're relaxing. That's great — confident candidates give better answers. Continue.",
  "Your cardiovascular data shows you're settling in nicely. Comfort breeds clarity — keep going.",
];

export const HR_ELEVATED_RESPONSES = [
  "Your heart rate has been elevated for a while now. Would you like to take a short pause before we continue?",
  "I've been monitoring your biometrics, and your heart rate remains high. Let's slow down — take a deep breath with me.",
  "Sustained elevated heart rate detected. This is a marathon, not a sprint. Pace yourself — we have time.",
];

export const BLUFF_RESPONSES = [
  "That is a strong claim. Can you be more specific? Walk me through exactly how you implemented that — step by step.",
  "Interesting. You mentioned that concept — can you define it precisely and give me a concrete example from your own work?",
  "I'd like to drill deeper into that. Can you explain the underlying mechanism in technical detail?",
];

export const STRESS_COOLDOWN_TRANSITIONS = [
  "I can see you're under some pressure. Let me ask you something a little lighter to help you settle in.",
  "Your biometrics suggest you're feeling the heat. Let's take a step back — here's something more straightforward for you.",
  "I notice your stress levels are elevated. A good interviewer adapts. Let me ease the difficulty for a moment.",
  "High heart rate detected. Let's shift gears — I'll ask something simpler so you can catch your breath and refocus.",
  "Your pulse tells me this is intense for you. No shame in that. Here's an easier one to rebuild your confidence.",
];

export const CALM_ESCALATION_TRANSITIONS = [
  "You've calmed down considerably. Good composure. But don't get too comfortable — let's see how you handle this.",
  "Your heart rate has settled. That means you're ready for the real challenge. Here's a tough one.",
  "I see you're relaxed now. Perfect. That means I can push you harder. Let's go.",
  "Biometrics show you've recovered well. Time to turn up the heat. Answer this.",
  "You seem very comfortable. Too comfortable, perhaps. Let me test your limits with something harder.",
  "Your stress levels dropped — which means the questions weren't hard enough. Let's fix that.",
];

export function getAdaptiveQuestion(
  domainId: string,
  targetDifficulty: "easy" | "hard",
  usedQuestionIds: Set<string>,
  currentTopics: string[]
): Question | null {
  const allQuestions = QUESTIONS[domainId] || [];

  const pool = allQuestions.filter(
    q => q.difficulty === targetDifficulty && !usedQuestionIds.has(q.id)
  );

  const topicMatched = pool.filter(q => currentTopics.includes(q.topic));
  const candidates = topicMatched.length > 0 ? topicMatched : pool;

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

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
