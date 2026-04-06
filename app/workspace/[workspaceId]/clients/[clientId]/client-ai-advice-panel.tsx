"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createClientTaskFromAdviceAction,
  generateClientNextActionAdviceAction,
  submitClientAdviceFeedbackAction,
} from "../actions";

type AdviceView = {
  overallReading: string;
  nextActionFocus: string;
  objectionResponse: string;
  persuasionAngle: string;
  bestTiming: string;
  score?: number;
  temperature?: string;
  mainObjections?: string[];
  recommendedStrategy?: string;
  nextBestAction?: string;
};

type LatestAdvice = {
  id: string;
  result: string;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: string | number | null;
  version: string | null;
  createdAt: Date;
  feedbackScore: number | null;
  feedbackNote: string | null;
};

type Props = {
  workspaceId: string;
  clientId: string;
  defaultCollapsed?: boolean;
  expandOnOpen?: boolean;
  hideExtendedSections?: boolean;
  fallbackAdvice: AdviceView;
  latestAdvice: LatestAdvice | null;
  quickStats: {
    totalInteractions: number;
    withResponse: number;
    interestedCount: number;
    negativeCount: number;
  };
  analysisContext: {
    interactionsAnalyzed: number;
    interactionsWithSummary: number;
    interactionsStructured: number;
    hasClientNotes: boolean;
    hasBudget: boolean;
    hasCompanyOrRole: boolean;
    hasCachedInsights: boolean;
  };
  adviceConfidence: {
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
  evidenceTitles: string[];
};

function extractAdviceFromResult(result: string): AdviceView | null {
  try {
    const parsed = JSON.parse(result) as Partial<AdviceView>;
    if (
      typeof parsed.overallReading === "string" &&
      typeof parsed.nextActionFocus === "string" &&
      typeof parsed.objectionResponse === "string" &&
      typeof parsed.persuasionAngle === "string" &&
      typeof parsed.bestTiming === "string"
    ) {
      return {
        overallReading: parsed.overallReading,
        nextActionFocus: parsed.nextActionFocus,
        objectionResponse: parsed.objectionResponse,
        persuasionAngle: parsed.persuasionAngle,
        bestTiming: parsed.bestTiming,
        score: typeof parsed.score === "number" ? parsed.score : undefined,
        temperature:
          typeof parsed.temperature === "string"
            ? parsed.temperature
            : undefined,
        mainObjections: Array.isArray(parsed.mainObjections)
          ? parsed.mainObjections.filter(
              (item): item is string => typeof item === "string",
            )
          : undefined,
        recommendedStrategy:
          typeof parsed.recommendedStrategy === "string"
            ? parsed.recommendedStrategy
            : undefined,
        nextBestAction:
          typeof parsed.nextBestAction === "string"
            ? parsed.nextBestAction
            : undefined,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ClientAiAdvicePanel({
  workspaceId,
  clientId,
  defaultCollapsed = false,
  expandOnOpen = false,
  hideExtendedSections = false,
  fallbackAdvice,
  latestAdvice,
  quickStats,
  analysisContext,
  adviceConfidence,
  grounding,
  evidenceTitles,
}: Props) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [isSubmittingFeedback, startSubmittingFeedback] = useTransition();
  const [isCreatingAction, startCreatingAction] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [feedbackNote, setFeedbackNote] = useState(
    latestAdvice?.feedbackNote ?? "",
  );

  const generatedAdvice = latestAdvice
    ? extractAdviceFromResult(latestAdvice.result)
    : null;
  const advice = generatedAdvice ?? fallbackAdvice;

  function generateAdvice() {
    setError(null);
    startGenerating(async () => {
      const result = await generateClientNextActionAdviceAction(
        workspaceId,
        clientId,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function submitFeedback(score: number) {
    if (!latestAdvice) return;

    setError(null);
    startSubmittingFeedback(async () => {
      const result = await submitClientAdviceFeedbackAction(
        workspaceId,
        clientId,
        latestAdvice.id,
        { score, note: feedbackNote || undefined },
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function createActionFromAdvice() {
    if (!latestAdvice) {
      setError("Aucun conseil IA historisé pour créer une action.");
      return;
    }

    setError(null);
    startCreatingAction(async () => {
      const result = await createClientTaskFromAdviceAction(
        workspaceId,
        clientId,
        latestAdvice.id,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const confidenceTone =
    adviceConfidence.level === "HIGH"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
      : adviceConfidence.level === "MEDIUM"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
        : "border-red-500/35 bg-red-500/10 text-red-300";
  const responseRate =
    quickStats.totalInteractions > 0
      ? Math.round(
          (quickStats.withResponse / quickStats.totalInteractions) * 100,
        )
      : 0;
  const structuredRate =
    analysisContext.interactionsAnalyzed > 0
      ? Math.round(
          (analysisContext.interactionsStructured /
            analysisContext.interactionsAnalyzed) *
            100,
        )
      : 0;
  const expandedStateClass =
    expandOnOpen && !isCollapsed ? "client-ai-advice-panel--expanded" : "";

  return (
    <section
      className={`client-ai-advice-panel rounded-2xl border border-border/70 bg-surface p-5 shadow-sm ${expandedStateClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-2/80">
            Conseil IA commercial
          </p>
          <h2 className="mt-1 font-heading text-xl font-bold text-foreground">
            Prochaine meilleure action
          </h2>
          {latestAdvice ? (
            <p className="mt-1 text-xs text-foreground/55">
              Généré le {formatDate(latestAdvice.createdAt)} ·
              {/* {(latestAdvice.provider ?? "unknown").toUpperCase()} · */}
              {/* {latestAdvice.model ?? "model inconnu"} */}
            </p>
          ) : (
            <p className="mt-1 text-xs text-foreground/55">
              Pas encore de génération historisée, affichage d&apos;un conseil
              local.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {latestAdvice && (
              <button
                type="button"
                onClick={createActionFromAdvice}
                disabled={
                  isGenerating || isSubmittingFeedback || isCreatingAction
                }
                className="cursor-pointer rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {isCreatingAction
                  ? "Création action..."
                  : "Créer l'action recommandée"}
              </button>
            )}

            <button
              type="button"
              onClick={generateAdvice}
              disabled={
                isGenerating || isSubmittingFeedback || isCreatingAction
              }
              className="cursor-pointer rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
            >
              {isGenerating ? "Génération..." : "Régénérer le conseil IA"}
            </button>

            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={
                isCollapsed ? "Déplier le conseil IA" : "Replier le conseil IA"
              }
              className="cursor-pointer rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground/65 transition hover:border-brand-1/35 hover:text-foreground"
            >
              <span aria-hidden>{isCollapsed ? "▾" : "▴"}</span>
            </button>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Réponses
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground/85">
                {quickStats.withResponse}/{quickStats.totalInteractions}
              </p>
              <p className="text-[11px] text-foreground/55">
                {responseRate}% de retour
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Signaux
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground/85">
                +{quickStats.interestedCount} / -{quickStats.negativeCount}
              </p>
              <p className="text-[11px] text-foreground/55">
                Interet vs risque
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Structuration
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground/85">
                {analysisContext.interactionsStructured}/
                {analysisContext.interactionsAnalyzed}
              </p>
              <p className="text-[11px] text-foreground/55">
                {structuredRate}% qualifiees
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Confiance
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground/85">
                {Math.round(adviceConfidence.score)}/100
              </p>
              <span
                className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${confidenceTone}`}
              >
                {adviceConfidence.level}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-brand-1/30 bg-brand-1/8 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-2/80">
              Action recommandee maintenant
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground/90">
              {advice.nextBestAction ?? advice.nextActionFocus}
            </p>
            <p className="mt-2 text-xs text-foreground/70">
              Timing conseille: {advice.bestTiming}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-surface-2/35 px-3 py-2.5 md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Diagnostic
              </p>
              <p className="mt-1 text-sm text-foreground/75">
                {advice.overallReading}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface-2/35 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Strategie de persuasion
              </p>
              <p className="mt-1 text-sm text-foreground/75">
                {advice.recommendedStrategy ?? advice.persuasionAngle}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface-2/35 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Reponse aux objections
              </p>
              <p className="mt-1 text-sm text-foreground/75">
                {advice.objectionResponse}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface-2/35 px-3 py-2.5 md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Objections dominantes
              </p>
              <p className="mt-1 text-sm text-foreground/75">
                {advice.mainObjections && advice.mainObjections.length > 0
                  ? advice.mainObjections.join(", ")
                  : "Aucune objection dominante detectee"}
              </p>
            </div>
          </div>

          {!hideExtendedSections && (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-surface px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                    Sources et ancrage
                  </p>
                  <p className="mt-1 text-xs text-foreground/70">
                    {grounding.grounded
                      ? `Conseil ancre sur ${grounding.evidenceCount} interaction(s).`
                      : "Ancrage faible, verifier avant execution."}
                  </p>
                  {adviceConfidence.missingSignals.length > 0 && (
                    <p className="mt-1 text-xs text-amber-400">
                      Donnees manquantes:{" "}
                      {adviceConfidence.missingSignals.join(" · ")}
                    </p>
                  )}
                  <ul className="mt-2 space-y-1 text-xs text-foreground/65">
                    {evidenceTitles.length > 0 ? (
                      evidenceTitles.map((title, index) => (
                        <li key={`${title}-${index}`} className="line-clamp-1">
                          • {title}
                        </li>
                      ))
                    ) : (
                      <li>Aucun titre source disponible.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-lg border border-border/60 bg-surface px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                    Qualite du contexte
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/70">
                    <p>Resumes: {analysisContext.interactionsWithSummary}</p>
                    <p>Structurees: {analysisContext.interactionsStructured}</p>
                    <p>
                      Notes client:{" "}
                      {analysisContext.hasClientNotes ? "oui" : "non"}
                    </p>
                    <p>Budget: {analysisContext.hasBudget ? "oui" : "non"}</p>
                    <p>
                      Societe/role:{" "}
                      {analysisContext.hasCompanyOrRole ? "oui" : "non"}
                    </p>
                    <p>
                      Cache insights:{" "}
                      {analysisContext.hasCachedInsights ? "oui" : "non"}
                    </p>
                  </div>
                  {latestAdvice && (
                    <p className="mt-2 text-[11px] text-foreground/50">
                      Tokens: {latestAdvice.totalTokens ?? "n/a"}
                      {latestAdvice.costUsd
                        ? ` · Cout estime $${String(latestAdvice.costUsd)}`
                        : ""}
                      {latestAdvice.version
                        ? ` · v${latestAdvice.version}`
                        : ""}
                    </p>
                  )}
                </div>
              </div>

              {latestAdvice && (
                <div className="mt-4 rounded-lg border border-border/60 bg-surface px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                    Feedback utilisateur
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => submitFeedback(1)}
                      disabled={
                        isGenerating || isSubmittingFeedback || isCreatingAction
                      }
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      Pertinent
                    </button>
                    <button
                      type="button"
                      onClick={() => submitFeedback(-1)}
                      disabled={
                        isGenerating || isSubmittingFeedback || isCreatingAction
                      }
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Peu utile
                    </button>
                    {latestAdvice.feedbackScore !== null && (
                      <span className="text-xs text-foreground/55">
                        Dernier score: {latestAdvice.feedbackScore}
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <label className="mb-1 block text-xs font-semibold text-foreground/60">
                      Commentaire feedback
                    </label>
                    <textarea
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                      rows={2}
                      placeholder="Pourquoi ce conseil est utile ou non"
                      className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-xs text-foreground placeholder:text-foreground/35 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </>
      )}

      {isCollapsed && error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
