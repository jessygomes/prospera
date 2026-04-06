import OpenAI from "openai";
import { buildClientAdvice, type ClientAdvice } from "@/lib/ai/client-advice";

type StructuredAction = {
  title: string;
  type: "CALL" | "EMAIL" | "FOLLOW_UP" | "MEETING" | "PROPOSAL" | "OTHER";
  status: "TODO" | "DONE" | "CANCELED";
  description: string | null;
  interactionSummary: string | null;
  interactionOutcome:
    | "NO_RESPONSE"
    | "INTERESTED"
    | "NOT_INTERESTED"
    | "NEEDS_TIME"
    | "WON"
    | "LOST"
    | null;
  interactionSentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  interactionObjections: string[];
  createdAt: Date;
  doneAt: Date | null;
};

type AdviceInput = {
  client: {
    fullName: string;
    status: string;
    priority: string;
    budgetEstimated: number | null;
    company: string | null;
    jobTitle: string | null;
    notes: string | null;
    aiInsights: unknown;
  };
  actions: StructuredAction[];
};

type LlmAdviceResponse = ClientAdvice & {
  score?: number;
  temperature?: string;
  mainObjections?: string[];
  recommendedStrategy?: string;
  nextBestAction?: string;
  evidenceInteractionIndexes?: number[];
};

export type GeneratedAdvice = {
  advice: ClientAdvice;
  provider: string;
  model: string;
  prompt: string;
  promptVersion: string;
  quickStats: {
    totalInteractions: number;
    withResponse: number;
    interestedCount: number;
    negativeCount: number;
  };
  resultRaw: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  fallbackReason?: string;
  confidence: {
    score: number;
    level: "LOW" | "MEDIUM" | "HIGH";
    reasons: string[];
    missingSignals: string[];
  };
  grounding: {
    grounded: boolean;
    evidenceInteractionIndexes: number[];
    evidenceCount: number;
    interactionsWindow: number;
  };
  aiInsights: {
    score?: number;
    temperature?: string;
    mainObjections?: string[];
    recommendedStrategy?: string;
    nextBestAction?: string;
  };
};

const OPENAI_PRICING_PER_1M_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
};

const ADVICE_PROMPT_VERSION = "next-action-v3-action-goal";

const IA_DEBUG = process.env.IA_DEBUG === "true";

function logIa(
  traceId: string,
  stage: string,
  payload?: Record<string, unknown>,
) {
  if (!IA_DEBUG) return;
  console.info("[IA-ADVICE]", JSON.stringify({ traceId, stage, ...payload }));
}

function logIaError(
  traceId: string,
  stage: string,
  error: unknown,
  payload?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : "unknown-error";
  console.error(
    "[IA-ADVICE]",
    JSON.stringify({ traceId, stage, error: message, ...payload }),
  );
}

function extractJsonObject(text: string): string | null {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  return text.slice(firstBrace, lastBrace + 1);
}

function normalizeAdviceResponse(value: unknown): LlmAdviceResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const v = value as Record<string, unknown>;
  const asString = (key: string) =>
    typeof v[key] === "string" ? (v[key] as string).trim() : "";

  const overallReading = asString("overallReading");
  const nextActionFocus = asString("nextActionFocus");
  const objectionResponse = asString("objectionResponse");
  const persuasionAngle = asString("persuasionAngle");
  const bestTiming = asString("bestTiming");

  if (
    !overallReading ||
    !nextActionFocus ||
    !objectionResponse ||
    !persuasionAngle ||
    !bestTiming
  ) {
    return null;
  }

  const mainObjections = Array.isArray(v.mainObjections)
    ? v.mainObjections
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : undefined;

  const evidenceInteractionIndexes = Array.isArray(v.evidenceInteractionIndexes)
    ? v.evidenceInteractionIndexes
        .map((item) =>
          typeof item === "number" && Number.isInteger(item) ? item : null,
        )
        .filter((item): item is number => item !== null)
    : undefined;

  return {
    overallReading,
    nextActionFocus,
    objectionResponse,
    persuasionAngle,
    bestTiming,
    score: typeof v.score === "number" ? v.score : undefined,
    temperature: typeof v.temperature === "string" ? v.temperature : undefined,
    mainObjections,
    recommendedStrategy:
      typeof v.recommendedStrategy === "string"
        ? v.recommendedStrategy
        : undefined,
    nextBestAction:
      typeof v.nextBestAction === "string" ? v.nextBestAction : undefined,
    evidenceInteractionIndexes,
  };
}

function buildPrompt(input: AdviceInput): string {
  const lastInteractions = input.actions
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 10)
    .map((action, index) => ({
      index: index + 1,
      recencyWeight: index === 0 ? "HIGH" : index < 3 ? "MEDIUM" : "LOW", //  AJOUT
      title: action.title,
      type: action.type,
      status: action.status,
      actionGoal: action.description,
      interactionSummary: action.interactionSummary,
      outcome: action.interactionOutcome,
      sentiment: action.interactionSentiment,
      objections: action.interactionObjections,
      createdAt: action.createdAt,
    }));

  const quickStats = {
    totalInteractions: input.actions.length,
    withResponse: input.actions.filter((a) => a.interactionOutcome).length,
    interestedCount: input.actions.filter(
      (a) => a.interactionOutcome === "INTERESTED",
    ).length,
    negativeCount: input.actions.filter(
      (a) => a.interactionSentiment === "NEGATIVE",
    ).length,
  };

  return [
    "Tu es un closer B2B expert.",
    "",
    "Ta mission : analyser un prospect et donner la meilleure stratégie pour le convertir.",
    "",
    "Raisonnement interne (ne pas afficher) :",
    "1. Evaluer l'intérêt réel du client",
    "2. Identifier les blocages principaux (prix, timing, confiance, besoin)",
    "3. Déterminer le niveau de maturité (cold, warm, hot)",
    "4. Déduire l'action optimale pour closer",
    "",
    "Important:",
    "- Analyse les patterns (hésitation, répétition, objections).",
    "- Priorise les signaux implicites.",
    "- Distingue l'objectif de l'action (actionGoal) du résultat de l'interaction (interactionSummary).",
    "- Si hésitation → réduire le risque.",
    "- Ton objectif est de maximiser la conversion.",
    "",
    "Réponds UNIQUEMENT en JSON valide avec ces clés:",
    "overallReading, nextActionFocus, objectionResponse, persuasionAngle, bestTiming, score, temperature, mainObjections, recommendedStrategy, nextBestAction, evidenceInteractionIndexes",
    "",
    "Contraintes strictes:",
    "- Conseils spécifiques au contexte.",
    "- nextActionFocus = action concrète précise.",
    "- objectionResponse = phrase utilisable directement.",
    "- persuasionAngle = angle psychologique clair.",
    "- bestTiming = timing + justification.",
    "- score entre 0 et 100.",
    "- temperature parmi cold, warm, hot.",
    "- evidenceInteractionIndexes = liste des index (1..10) des interactions qui justifient ton conseil.",
    "- Ne donne pas de conseil s'il n'est pas ancre dans les interactions listees.",
    "",
    "Contexte client:",
    JSON.stringify(input.client, null, 2),
    "",
    "Historique interactions:",
    JSON.stringify(lastInteractions, null, 2),
    "Statistiques rapides:",
    JSON.stringify(quickStats, null, 2),
  ].join("\n");
}

function buildQuickStats(input: AdviceInput) {
  return {
    totalInteractions: input.actions.length,
    withResponse: input.actions.filter((a) => a.interactionOutcome).length,
    interestedCount: input.actions.filter(
      (a) => a.interactionOutcome === "INTERESTED",
    ).length,
    negativeCount: input.actions.filter(
      (a) => a.interactionSentiment === "NEGATIVE",
    ).length,
  };
}

function buildAdviceConfidence(
  input: AdviceInput,
  quickStats: ReturnType<typeof buildQuickStats>,
) {
  const reasons: string[] = [];
  const missingSignals: string[] = [];

  let score = 35;

  if (quickStats.totalInteractions >= 5) {
    score += 15;
    reasons.push("historique interactions suffisant");
  } else if (quickStats.totalInteractions >= 2) {
    score += 8;
    reasons.push("historique interactions partiel");
  } else {
    missingSignals.push("historique interactions insuffisant");
  }

  if (quickStats.totalInteractions > 0) {
    const withResponseRatio =
      quickStats.withResponse / quickStats.totalInteractions;
    const structuredSignals = input.actions.filter(
      (action) =>
        !!action.interactionOutcome ||
        !!action.interactionSentiment ||
        action.interactionObjections.length > 0,
    ).length;
    const structuredRatio = structuredSignals / quickStats.totalInteractions;

    score += Math.round(Math.min(20, withResponseRatio * 20));
    score += Math.round(Math.min(20, structuredRatio * 20));

    if (withResponseRatio < 0.3) {
      missingSignals.push("trop peu d interactions avec resultat explicite");
    }
    if (structuredRatio < 0.4) {
      missingSignals.push("trop peu de signaux structures");
    }
  }

  const hasContextualClientData =
    !!input.client.notes?.trim() ||
    input.client.budgetEstimated !== null ||
    !!input.client.company ||
    !!input.client.jobTitle ||
    !!input.client.aiInsights;

  if (hasContextualClientData) {
    score += 10;
    reasons.push("contexte client enrichi");
  } else {
    missingSignals.push("contexte client faible (notes/budget/societe/role)");
  }

  score = Math.max(0, Math.min(100, score));

  const level: "LOW" | "MEDIUM" | "HIGH" =
    score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";

  return {
    score,
    level,
    reasons,
    missingSignals,
  };
}

async function callOpenAI(
  traceId: string,
  prompt: string,
): Promise<{
  text: string;
  model: string;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquant");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  logIa(traceId, "openai.request.start", {
    model,
    promptChars: prompt.length,
    apiKeyPresent: !!apiKey,
  });

  if (model === "gpt-4-0613") {
    logIa(traceId, "openai.model.warning", {
      warning:
        "OPENAI_MODEL=gpt-4-0613 peut etre incompatible avec response_format json_schema. Utiliser gpt-4.1-mini recommande.",
    });
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Tu es un assistant commercial expert. Réponds uniquement en JSON strict.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "client_next_action_advice",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            overallReading: { type: "string" },
            nextActionFocus: { type: "string" },
            objectionResponse: { type: "string" },
            persuasionAngle: { type: "string" },
            bestTiming: { type: "string" },
            score: { type: "number" },
            temperature: { type: "string" },
            mainObjections: {
              type: "array",
              items: { type: "string" },
            },
            recommendedStrategy: { type: "string" },
            nextBestAction: { type: "string" },
            evidenceInteractionIndexes: {
              type: "array",
              minItems: 1,
              items: {
                type: "integer",
                minimum: 1,
                maximum: 10,
              },
            },
          },
          required: [
            "overallReading",
            "nextActionFocus",
            "objectionResponse",
            "persuasionAngle",
            "bestTiming",
            "score",
            "temperature",
            "mainObjections",
            "recommendedStrategy",
            "nextBestAction",
            "evidenceInteractionIndexes",
          ],
        },
      },
    },
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI n'a retourne aucun contenu");

  logIa(traceId, "openai.request.success", {
    model,
    inputTokens: completion.usage?.prompt_tokens,
    outputTokens: completion.usage?.completion_tokens,
    totalTokens: completion.usage?.total_tokens,
    rawPreview: text.slice(0, 500),
  });

  return {
    text,
    model,
    usage: {
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    },
  };
}

async function callAnthropic(
  traceId: string,
  prompt: string,
): Promise<{
  text: string;
  model: string;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant");

  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";

  logIa(traceId, "anthropic.request.start", {
    model,
    promptChars: prompt.length,
    apiKeyPresent: !!apiKey,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0.2,
      system:
        "Tu es un assistant commercial expert. Réponds uniquement en JSON strict.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text) throw new Error("Anthropic n'a retourne aucun contenu");

  logIa(traceId, "anthropic.request.success", {
    model,
    rawPreview: text.slice(0, 500),
  });

  return { text, model, usage: {} };
}

export async function generateClientNextAdvice(
  input: AdviceInput,
): Promise<GeneratedAdvice> {
  const traceId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `ia-${Date.now()}`;

  const prompt = buildPrompt(input);
  const quickStats = buildQuickStats(input);
  const confidence = buildAdviceConfidence(input, quickStats);
  const interactionsWindow = Math.min(10, input.actions.length);

  const fallback = buildClientAdvice(input);

  logIa(traceId, "generation.start", {
    clientName: input.client.fullName,
    clientStatus: input.client.status,
    interactionsCount: input.actions.length,
    promptChars: prompt.length,
  });

  try {
    const provider = process.env.OPENAI_API_KEY
      ? "openai"
      : process.env.ANTHROPIC_API_KEY
        ? "anthropic"
        : null;

    logIa(traceId, "generation.provider.selected", {
      provider: provider ?? "none",
      openaiEnabled: !!process.env.OPENAI_API_KEY,
      anthropicEnabled: !!process.env.ANTHROPIC_API_KEY,
    });

    if (!provider) {
      logIa(traceId, "generation.fallback.no-provider");
      return {
        advice: fallback,
        provider: "heuristic",
        model: "local-rules-v1",
        prompt,
        promptVersion: ADVICE_PROMPT_VERSION,
        quickStats,
        resultRaw: JSON.stringify(fallback, null, 2),
        fallbackReason: "no-provider-configured",
        confidence,
        grounding: {
          grounded: false,
          evidenceInteractionIndexes: [],
          evidenceCount: 0,
          interactionsWindow,
        },
        aiInsights: {
          recommendedStrategy: fallback.persuasionAngle,
          nextBestAction: fallback.nextActionFocus,
        },
      };
    }

    const completion =
      provider === "openai"
        ? await callOpenAI(traceId, prompt)
        : await callAnthropic(traceId, prompt);

    const maybeJson = extractJsonObject(completion.text);
    logIa(traceId, "generation.response.received", {
      provider,
      model: completion.model,
      hasJson: !!maybeJson,
      responseChars: completion.text.length,
    });

    const parsed = maybeJson
      ? normalizeAdviceResponse(JSON.parse(maybeJson))
      : null;

    if (!parsed) {
      throw new Error("Format JSON LLM invalide");
    }

    const evidenceInteractionIndexes = (
      parsed.evidenceInteractionIndexes ?? []
    ).filter((idx) => idx >= 1 && idx <= interactionsWindow);

    if (evidenceInteractionIndexes.length === 0) {
      throw new Error("Advice non ancre: aucune interaction source valide");
    }

    const advice: ClientAdvice = {
      overallReading: parsed.overallReading,
      nextActionFocus: parsed.nextActionFocus,
      objectionResponse: parsed.objectionResponse,
      persuasionAngle: parsed.persuasionAngle,
      bestTiming: parsed.bestTiming,
    };

    const pricing = OPENAI_PRICING_PER_1M_TOKENS[completion.model];
    const costUsd =
      provider === "openai" &&
      pricing &&
      completion.usage.inputTokens !== undefined &&
      completion.usage.outputTokens !== undefined
        ? (completion.usage.inputTokens / 1_000_000) * pricing.input +
          (completion.usage.outputTokens / 1_000_000) * pricing.output
        : undefined;

    logIa(traceId, "generation.success", {
      provider,
      model: completion.model,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
      totalTokens: completion.usage.totalTokens,
      costUsd,
    });

    return {
      advice,
      provider,
      model: completion.model,
      prompt,
      promptVersion: ADVICE_PROMPT_VERSION,
      quickStats,
      resultRaw: JSON.stringify(parsed, null, 2),
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
      totalTokens: completion.usage.totalTokens,
      costUsd,
      confidence,
      grounding: {
        grounded: true,
        evidenceInteractionIndexes,
        evidenceCount: evidenceInteractionIndexes.length,
        interactionsWindow,
      },
      aiInsights: {
        score: parsed.score,
        temperature: parsed.temperature,
        mainObjections: parsed.mainObjections,
        recommendedStrategy: parsed.recommendedStrategy,
        nextBestAction: parsed.nextBestAction,
      },
    };
  } catch (error) {
    const fallbackReason =
      error instanceof Error ? error.message : "unknown-generation-error";

    logIaError(traceId, "generation.fallback.error", error, {
      fallbackReason,
      promptChars: prompt.length,
    });

    return {
      advice: fallback,
      provider: "heuristic",
      model: "local-rules-v1",
      prompt,
      promptVersion: ADVICE_PROMPT_VERSION,
      quickStats,
      resultRaw: JSON.stringify(fallback, null, 2),
      fallbackReason,
      confidence,
      grounding: {
        grounded: false,
        evidenceInteractionIndexes: [],
        evidenceCount: 0,
        interactionsWindow,
      },
      aiInsights: {
        recommendedStrategy: fallback.persuasionAngle,
        nextBestAction: fallback.nextActionFocus,
      },
    };
  }
}
