import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();

const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60000;

function checkRateLimit(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

let openaiModule: any = null;

async function getOpenAI() {
  if (!openaiModule) {
    openaiModule = await import("@workspace/integrations-openai-ai-server");
  }
  return openaiModule.openai;
}

const DOMAIN_CONTEXTS: Record<string, string> = {
  upsc: "You are a senior UPSC Civil Services Interview Board member. You evaluate candidates on administrative aptitude, current affairs awareness, ethical reasoning, and clarity of thought.",
  swe: "You are a senior software engineering interviewer at a top tech company. You evaluate candidates on technical depth, system design thinking, problem-solving approach, and coding fundamentals.",
  nda: "You are a senior military officer on the SSB (Services Selection Board) panel. You evaluate candidates on leadership qualities, decision-making under pressure, patriotism, and mental toughness.",
  medical: "You are a senior medical professor conducting a NEET PG viva. You evaluate candidates on clinical knowledge, diagnostic reasoning, patient management, and medical ethics.",
  ibanking: "You are a Managing Director at a top investment bank. You evaluate candidates on financial acumen, deal knowledge, modeling skills, market awareness, and ability to think on their feet.",
};

router.post("/followup", async (req, res) => {
  if (!checkRateLimit(req)) {
    res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    return;
  }
  try {
    const { question, answer, domain, difficulty, avatarName } = req.body;

    if (!question || !answer || !domain) {
      res.status(400).json({ error: "question, answer, and domain are required" });
      return;
    }

    if (answer.length > 3000 || question.length > 1000) {
      res.status(400).json({ error: "Input too long" });
      return;
    }

    const openai = await getOpenAI();
    const context = DOMAIN_CONTEXTS[domain] || DOMAIN_CONTEXTS.swe;

    const difficultyGuide = difficulty === "hard"
      ? "Ask a challenging, probing follow-up that tests the depth of their knowledge. Be tough but fair."
      : difficulty === "easy"
      ? "Ask a gentle clarifying follow-up that helps the candidate elaborate on their answer."
      : "Ask a balanced follow-up that digs slightly deeper into their response.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${context}

You are conducting a live interview. Based on the candidate's answer to the previous question, generate ONE natural follow-up question.

Rules:
- ${difficultyGuide}
- Keep it concise (1-2 sentences max)
- Make it directly relevant to what the candidate said
- If the answer was vague or incorrect, probe that weakness specifically
- If the answer was strong, push them to go deeper or apply to a real scenario
- Sound natural and conversational, like a real interviewer
- Do NOT praise or evaluate — just ask the follow-up question
- Respond with ONLY the follow-up question, nothing else`,
        },
        {
          role: "user",
          content: `Previous question: "${question}"\n\nCandidate's answer: "${answer}"`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const followUp = completion.choices[0]?.message?.content?.trim() || "";

    if (!followUp) {
      res.status(500).json({ error: "No follow-up generated" });
      return;
    }

    res.json({ followUp, avatarName: avatarName || "HOLO-AI" });
  } catch (err: any) {
    console.error("Follow-up error:", err?.message || err);
    res.status(500).json({ error: "Follow-up generation failed" });
  }
});

router.post("/evaluate", async (req, res) => {
  if (!checkRateLimit(req)) {
    res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    return;
  }
  try {
    const { question, answer, domain } = req.body;

    if (!question || !answer || !domain) {
      res.status(400).json({ error: "question, answer, and domain are required" });
      return;
    }

    if (answer.length > 3000 || question.length > 1000) {
      res.status(400).json({ error: "Input too long" });
      return;
    }

    const openai = await getOpenAI();
    const context = DOMAIN_CONTEXTS[domain] || DOMAIN_CONTEXTS.swe;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${context}

Evaluate the candidate's answer STRICTLY. Return a JSON object with:
- "score": number 0-10 (0 = completely wrong/irrelevant/nonsense/gibberish/off-topic, 1 = barely relevant, 5 = mediocre, 7 = good, 10 = exceptional)
- "strengths": string (1 sentence, or empty string if score is 0-2)
- "weaknesses": string (1 sentence)
- "suggestion": string (1 sentence improvement tip)

SCORING RULES:
- Score 0: Answer is wrong, irrelevant, gibberish, off-topic, or shows zero understanding
- Score 1-2: Answer is vague, extremely superficial, or mostly incorrect
- Score 3-4: Answer shows some awareness but is substantially incomplete or has major errors
- Score 5-6: Answer is mediocre — partially correct but lacks depth or has notable gaps
- Score 7-8: Answer is good — mostly correct with reasonable depth
- Score 9-10: Answer is excellent — comprehensive, accurate, well-structured

Be a strict evaluator. Do NOT give participation points. Wrong answers get 0.
Return ONLY valid JSON, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `Question: "${question}"\n\nAnswer: "${answer}"`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const evaluation = JSON.parse(cleaned);
      res.json(evaluation);
    } catch {
      res.json({ score: 3, strengths: "", weaknesses: "Could not parse evaluation", suggestion: "Try to be more specific" });
    }
  } catch (err: any) {
    console.error("Evaluate error:", err?.message || err);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

export default router;
