import OpenAI from "openai";

export type InteractionOutcome =
  | "NO_RESPONSE"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "NEEDS_TIME"
  | "WON"
  | "LOST";

export type InteractionSentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export type InteractionAnalysis = {
  interactionOutcome?: InteractionOutcome;
  interactionSentiment?: InteractionSentiment;
  interactionObjections?: string[];
  provider: "openai" | "heuristic";
  reason?: string;
};

const IA_DEBUG = process.env.IA_DEBUG === "true";

function log(stage: string, payload?: Record<string, unknown>) {
  if (!IA_DEBUG) return;
  console.info("[IA-INTERACTION]", JSON.stringify({ stage, ...payload }));
}

function heuristicAnalyze(text: string): InteractionAnalysis {
  const corpus = text.toLowerCase();

  const outcome: InteractionOutcome =
    /pas de reponse|sans retour|ghost|non joignable/.test(corpus)
      ? "NO_RESPONSE"
      : /pas interesse|aucun interet|refuse|non merci/.test(corpus)
        ? "NOT_INTERESTED"
        : /reflechir|plus tard|besoin de temps|pas maintenant/.test(corpus)
          ? "NEEDS_TIME"
          : /signe|valide|ok pour avancer|accord/.test(corpus)
            ? "WON"
            : /perdu|abandon|choisi concurrent/.test(corpus)
              ? "LOST"
              : "INTERESTED";

  const sentiment: InteractionSentiment =
    /frustre|negatif|bloque|pas convaincu/.test(corpus)
      ? "NEGATIVE"
      : /interesse|enthousiaste|ok|positif/.test(corpus)
        ? "POSITIVE"
        : "NEUTRAL";

  const objections = [
    /prix|cher|budget|tarif/.test(corpus) ? "prix" : null,
    /timing|plus tard|moment|attendre/.test(corpus) ? "timing" : null,
    /confiance|preuve|reference|cas client/.test(corpus) ? "confiance" : null,
    /priorite|besoin|pas besoin/.test(corpus) ? "besoin" : null,
  ].filter((v): v is string => !!v);

  return {
    interactionOutcome: outcome,
    interactionSentiment: sentiment,
    interactionObjections: objections,
    provider: "heuristic",
    reason: "local-heuristic",
  };
}

export async function analyzeInteraction(
  text: string,
): Promise<InteractionAnalysis> {
  const cleaned = text.trim();
  if (!cleaned) {
    return { provider: "heuristic", reason: "empty-text" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("fallback.no-openai-key");
    return heuristicAnalyze(cleaned);
  }

  try {
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

    log("openai.request.start", { model, textChars: cleaned.length });

    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Tu analyses un compte-rendu commercial. Retourne uniquement un JSON strict.",
        },
        {
          role: "user",
          content: [
            "Extrait automatiquement:",
            "- interactionOutcome: NO_RESPONSE|INTERESTED|NOT_INTERESTED|NEEDS_TIME|WON|LOST",
            "- interactionSentiment: POSITIVE|NEUTRAL|NEGATIVE",
            "- interactionObjections: liste courte en francais (ex: prix, timing, confiance, besoin)",
            "",
            "Texte:",
            cleaned,
          ].join("\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interaction_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              interactionOutcome: {
                type: "string",
                enum: [
                  "NO_RESPONSE",
                  "INTERESTED",
                  "NOT_INTERESTED",
                  "NEEDS_TIME",
                  "WON",
                  "LOST",
                ],
              },
              interactionSentiment: {
                type: "string",
                enum: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
              },
              interactionObjections: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "interactionOutcome",
              "interactionSentiment",
              "interactionObjections",
            ],
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("no-content");
    }

    const parsed = JSON.parse(content) as {
      interactionOutcome: InteractionOutcome;
      interactionSentiment: InteractionSentiment;
      interactionObjections: string[];
    };

    log("openai.request.success", {
      model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      parsed,
    });

    return {
      interactionOutcome: parsed.interactionOutcome,
      interactionSentiment: parsed.interactionSentiment,
      interactionObjections: parsed.interactionObjections
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
      provider: "openai",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown-error";
    log("openai.request.error", { reason });
    const fallback = heuristicAnalyze(cleaned);
    return { ...fallback, reason };
  }
}
