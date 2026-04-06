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
  actions: Array<{
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
  }>;
};

export type ClientAdvice = {
  overallReading: string;
  nextActionFocus: string;
  objectionResponse: string;
  persuasionAngle: string;
  bestTiming: string;
};

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function asAiInsights(value: unknown): {
  score?: number;
  temperature?: string;
  mainObjections?: string[];
  recommendedStrategy?: string;
  nextBestAction?: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return {
    score: typeof candidate.score === "number" ? candidate.score : undefined,
    temperature:
      typeof candidate.temperature === "string"
        ? candidate.temperature
        : undefined,
    mainObjections: Array.isArray(candidate.mainObjections)
      ? candidate.mainObjections
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : undefined,
    recommendedStrategy:
      typeof candidate.recommendedStrategy === "string"
        ? candidate.recommendedStrategy
        : undefined,
    nextBestAction:
      typeof candidate.nextBestAction === "string"
        ? candidate.nextBestAction
        : undefined,
  };
}

export function buildClientAdvice(input: AdviceInput): ClientAdvice {
  const aiInsights = asAiInsights(input.client.aiInsights);

  const summaries = input.actions
    .filter(
      (action) =>
        (action.type === "CALL" ||
          action.type === "EMAIL" ||
          action.type === "FOLLOW_UP") &&
        !!(action.interactionSummary || action.description),
    )
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 8)
    .map(
      (action) =>
        (action.interactionSummary ?? action.description ?? "").toLowerCase(),
    );

  const completedInteractions = input.actions.filter(
    (action) =>
      action.status === "DONE" &&
      (action.type === "CALL" ||
        action.type === "EMAIL" ||
        action.type === "FOLLOW_UP"),
  );

  const outcomeCounts = completedInteractions.reduce<Record<string, number>>(
    (acc, action) => {
      if (action.interactionOutcome) {
        acc[action.interactionOutcome] = (acc[action.interactionOutcome] ?? 0) + 1;
      }
      return acc;
    },
    {},
  );

  const sentimentCounts = completedInteractions.reduce<Record<string, number>>(
    (acc, action) => {
      if (action.interactionSentiment) {
        acc[action.interactionSentiment] =
          (acc[action.interactionSentiment] ?? 0) + 1;
      }
      return acc;
    },
    {},
  );

  const objectionCounts = completedInteractions
    .flatMap((action) => action.interactionObjections)
    .reduce<Record<string, number>>((acc, objection) => {
      const key = objection.toLowerCase().trim();
      if (!key) return acc;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

  const topObjection = Object.entries(objectionCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const corpus = `${summaries.join(" ")} ${(input.client.notes ?? "").toLowerCase()}`;

  const hasPriceObjection = containsAny(corpus, [
    /prix/i,
    /trop cher/i,
    /cher/i,
    /co[uû]t/i,
    /budget/i,
    /tarif/i,
  ]);
  const hasDelaySignal = containsAny(corpus, [
    /r[eé]fl[eé]chir/i,
    /plus tard/i,
    /pas maintenant/i,
    /mois prochain/i,
    /report/i,
    /attendre/i,
  ]);
  const hasInterestSignal = containsAny(corpus, [
    /int[eé]ress/i,
    /curieux/i,
    /pertinent/i,
    /aime/i,
    /besoin/i,
  ]);
  const hasNoResponseSignal = containsAny(corpus, [
    /pas de r[eé]ponse/i,
    /sans retour/i,
    /silence/i,
    /ghost/i,
    /non joignable/i,
  ]);

  const frequentNegative = (sentimentCounts.NEGATIVE ?? 0) >= 2;
  const frequentNeedsTime = (outcomeCounts.NEEDS_TIME ?? 0) >= 2;
  const frequentNoResponse = (outcomeCounts.NO_RESPONSE ?? 0) >= 2;
  const frequentInterest = (outcomeCounts.INTERESTED ?? 0) >= 2;

  const scorePrefix =
    typeof aiInsights?.score === "number"
      ? `Score IA actuel: ${Math.round(aiInsights.score)}/100. `
      : "";

  const overallReading = aiInsights?.temperature
    ? `${scorePrefix}Température détectée: ${aiInsights.temperature}. ${aiInsights.recommendedStrategy ?? ""}`.trim()
    : hasPriceObjection && hasInterestSignal
      ? `${scorePrefix}Le client montre de l'intérêt, mais le frein principal semble être la perception du prix.`
      : hasDelaySignal || frequentNeedsTime
        ? `${scorePrefix}Le client ne ferme pas la porte, mais repousse la décision; il faut cadrer une prochaine étape ferme.`
        : hasNoResponseSignal || frequentNoResponse
          ? `${scorePrefix}Le principal risque est l'inertie (absence de réponse), plus que le rejet explicite.`
          : frequentNegative
            ? `${scorePrefix}La tonalité est plutôt négative sur les derniers échanges; il faut réduire la friction et revalider le besoin.`
            : `${scorePrefix}Le contexte est neutre à positif; il faut renforcer la clarté de la valeur et obtenir un engagement concret.`;

  const nextActionFocus = aiInsights?.nextBestAction
    ? aiInsights.nextBestAction
    : hasPriceObjection || topObjection?.[0] === "prix"
    ? "Prochain appel: commencer par reformuler le besoin, puis proposer 2 options (offre allégée vs offre complète) avec impact attendu."
    : hasDelaySignal || frequentNeedsTime
      ? "Prochaine relance: poser une question de qualification fermée et obtenir une date de décision précise."
      : hasNoResponseSignal || frequentNoResponse
        ? "Prochain message: relance courte avec une seule proposition de créneau et une date limite de réponse."
        : frequentInterest
          ? "Prochain appel: verrouiller le plan d'action (étapes, date, responsable) pour transformer l'intérêt en décision."
          : "Prochain contact: valider les objectifs prioritaires du client et conclure sur une action datée.";

  const objectionResponse = hasPriceObjection || topObjection?.[0] === "prix"
    ? "Réponse objection prix: recadrer sur le ROI (temps gagné, opportunités captées, coût de l'inaction), puis proposer une étape pilote."
    : hasDelaySignal || topObjection?.[0] === "timing"
      ? "Réponse objection timing: transformer le 'plus tard' en micro-engagement (15 min d'atelier, mini-livrable, date jalon)."
      : topObjection
        ? `Réponse objection dominante (${topObjection[0]}): reformuler, quantifier l'impact business et répondre avec une preuve client similaire.`
        : "Réponse objections: reformuler l'objection, vérifier l'impact business, répondre avec preuve concrète (cas proche).";

  const persuasionAngle = aiInsights?.recommendedStrategy
    ? aiInsights.recommendedStrategy
    : input.client.budgetEstimated && input.client.budgetEstimated > 0
      ? "Angle recommandé: valeur business mesurable, avec projection alignée au budget estimé et scénario prudent."
      : "Angle recommandé: démontrer un gain concret rapide et réduire le risque perçu via une première étape légère.";

  const bestTiming = hasNoResponseSignal || frequentNoResponse
    ? "Timing conseillé: relance sous 48h, puis dernier rappel 4-5 jours après si aucun retour."
    : hasDelaySignal || frequentNeedsTime
      ? "Timing conseillé: relance à la date explicitement convenue; sinon reprendre contact dans 5-7 jours."
      : "Timing conseillé: maintenir un rythme régulier (3-5 jours ouvrés) jusqu'à obtention d'une décision claire.";

  return {
    overallReading,
    nextActionFocus,
    objectionResponse,
    persuasionAngle,
    bestTiming,
  };
}
