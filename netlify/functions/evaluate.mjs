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
    const { question, answer, domain } = await req.json();

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
      return Response.json(evaluation, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } catch {
      return Response.json(
        { score: 3, strengths: "", weaknesses: "Could not parse evaluation", suggestion: "Try to be more specific" },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
  } catch (err) {
    console.error("Evaluate error:", err?.message || err);
    return Response.json({ error: "Evaluation failed" }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
};

export const config = {
  path: "/api/evaluate",
};
