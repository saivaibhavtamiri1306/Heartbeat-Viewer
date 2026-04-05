import OpenAI from "openai";

const DOMAIN_CONTEXTS = {
  upsc: "You are a senior UPSC Civil Services Interview Board member. You evaluate candidates on administrative aptitude, current affairs awareness, ethical reasoning, and clarity of thought.",
  swe: "You are a senior software engineering interviewer at a top tech company. You evaluate candidates on technical depth, system design thinking, problem-solving approach, and coding fundamentals.",
  nda: "You are a senior military officer on the SSB (Services Selection Board) panel. You evaluate candidates on leadership qualities, decision-making under pressure, patriotism, and mental toughness.",
  medical: "You are a senior medical professor conducting a NEET PG viva. You evaluate candidates on clinical knowledge, diagnostic reasoning, patient management, and medical ethics.",
  ibanking: "You are a Managing Director at a top investment bank. You evaluate candidates on financial acumen, deal knowledge, modeling skills, market awareness, and ability to think on their feet.",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const { question, answer, domain, difficulty, avatarName } = await req.json();

    if (!question || !answer || !domain) {
      return Response.json({ error: "question, answer, and domain are required" }, { status: 400 });
    }

    if (answer.length > 3000 || question.length > 1000) {
      return Response.json({ error: "Input too long" }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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
      return Response.json({ error: "No follow-up generated" }, { status: 500 });
    }

    return Response.json({ followUp, avatarName: avatarName || "HOLO-AI" }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Follow-up error:", err?.message || err);
    return Response.json({ error: "Follow-up generation failed", detail: err?.message }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
};

export const config = {
  path: "/api/followup",
};
