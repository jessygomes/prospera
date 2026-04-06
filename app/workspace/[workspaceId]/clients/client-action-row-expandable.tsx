"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { updateClientTaskAction } from "./actions";
import { ClientActionStatusInline } from "./client-action-status-inline";

type ActionType =
  | "CALL"
  | "EMAIL"
  | "FOLLOW_UP"
  | "MEETING"
  | "PROPOSAL"
  | "OTHER";
type ActionStatus = "TODO" | "DONE" | "CANCELED";
type InteractionOutcome =
  | "NO_RESPONSE"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "NEEDS_TIME"
  | "WON"
  | "LOST";
type InteractionSentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

type Assignee = { id: string; name: string | null; email: string | null };

type ActionRowAction = {
  id: string;
  clientId: string;
  title: string;
  type: ActionType;
  status: ActionStatus;
  description: string | null;
  interactionSummary: string | null;
  interactionOutcome: InteractionOutcome | null;
  interactionSentiment: InteractionSentiment | null;
  interactionObjections: string[];
  previousActionId: string | null;
  dueDate: Date | null;
  doneAt: Date | null;
  createdAt: Date;
  assignedToId: string | null;
  createdBy: { name: string | null; email: string | null } | null;
  assignedTo: { name: string | null; email: string | null } | null;
  client: {
    id: string;
    fullName: string;
    company: string | null;
  };
};

type Props = {
  workspaceId: string;
  action: ActionRowAction;
  assignees: Assignee[];
  chainableActions: Array<{ id: string; title: string }>;
};

const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  TODO: "À faire",
  DONE: "Fait",
  CANCELED: "Annulé",
};

const ACTION_STATUS_CLASSES: Record<ActionStatus, string> = {
  TODO: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  DONE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  CANCELED: "bg-red-500/10 text-red-400 border-red-500/25",
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  CALL: "Appel",
  EMAIL: "Email",
  FOLLOW_UP: "Relance",
  MEETING: "Réunion",
  PROPOSAL: "Proposition",
  OTHER: "Autre",
};

const TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "CALL", label: "Appel" },
  { value: "EMAIL", label: "Email" },
  { value: "FOLLOW_UP", label: "Relance" },
  { value: "MEETING", label: "Réunion" },
  { value: "PROPOSAL", label: "Proposition" },
  { value: "OTHER", label: "Autre" },
];

const STATUS_OPTIONS: { value: ActionStatus; label: string }[] = [
  { value: "TODO", label: "À faire" },
  { value: "DONE", label: "Fait" },
  { value: "CANCELED", label: "Annulé" },
];

const OUTCOME_OPTIONS: { value: InteractionOutcome; label: string }[] = [
  { value: "NO_RESPONSE", label: "Aucune réponse" },
  { value: "INTERESTED", label: "Intéressé" },
  { value: "NOT_INTERESTED", label: "Pas intéressé" },
  { value: "NEEDS_TIME", label: "A besoin de temps" },
  { value: "WON", label: "Gagné" },
  { value: "LOST", label: "Perdu" },
];

const SENTIMENT_OPTIONS: { value: InteractionSentiment; label: string }[] = [
  { value: "POSITIVE", label: "Positif" },
  { value: "NEUTRAL", label: "Neutre" },
  { value: "NEGATIVE", label: "Négatif" },
];

const compactInputClass =
  "w-full rounded-md border border-border/70 bg-surface-2/50 px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

function formatDate(date: Date | null | undefined): string {
  if (!date) return "Sans échéance";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toInputDate(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toObjectionsInput(value: string[]): string {
  return value.join(", ");
}

function fromObjectionsInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ClientActionRowExpandable({
  workspaceId,
  action,
  assignees,
  chainableActions,
}: Props) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPendingSave, startSaveTransition] = useTransition();

  const [title, setTitle] = useState(action.title);
  const [type, setType] = useState<ActionType>(action.type);
  const [status, setStatus] = useState<ActionStatus>(action.status);
  const [dueDate, setDueDate] = useState(toInputDate(action.dueDate));
  const [assignedToId, setAssignedToId] = useState(action.assignedToId ?? "");
  const [description, setDescription] = useState(action.description ?? "");
  const [interactionSummary, setInteractionSummary] = useState(
    action.interactionSummary ?? "",
  );
  const [interactionOutcome, setInteractionOutcome] = useState<
    InteractionOutcome | ""
  >(action.interactionOutcome ?? "");
  const [interactionSentiment, setInteractionSentiment] = useState<
    InteractionSentiment | ""
  >(action.interactionSentiment ?? "");
  const [interactionObjections, setInteractionObjections] = useState(
    toObjectionsInput(action.interactionObjections),
  );
  const [previousActionId, setPreviousActionId] = useState(
    action.previousActionId ?? "",
  );

  function save() {
    setError(null);
    startSaveTransition(async () => {
      const result = await updateClientTaskAction(
        workspaceId,
        action.clientId,
        action.id,
        {
          title,
          type,
          status,
          dueDate: dueDate || undefined,
          assignedToId: assignedToId || undefined,
          description: description || undefined,
          interactionSummary: interactionSummary || undefined,
          interactionOutcome: interactionOutcome || undefined,
          interactionSentiment: interactionSentiment || undefined,
          interactionObjections: fromObjectionsInput(interactionObjections),
          previousActionId: previousActionId || undefined,
        },
      );

      if (result?.error) {
        setError(result.error);
        return;
      }

      setIsEditing(false);
      setIsExpanded(true);
      router.refresh();
    });
  }

  const isOverdue =
    status === "TODO" && action.dueDate !== null && action.dueDate < new Date();
  const hasDueDate = !!action.dueDate;
  const shouldShowDoneWithoutSummaryWarning =
    status === "DONE" && !interactionSummary.trim();

  return (
    <div className="rounded-xl border border-border/60 bg-surface p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {title}
            </p>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_STATUS_CLASSES[status]}`}
            >
              {ACTION_STATUS_LABELS[status]}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-foreground/45 sm:gap-x-3 sm:text-xs">
            <span>
              Client:{" "}
              <Link
                href={`/workspace/${workspaceId}/clients/${action.client.id}`}
                className="font-semibold text-brand-2 hover:underline"
              >
                {action.client.fullName}
              </Link>
            </span>
            <span>Type: {ACTION_TYPE_LABELS[type]}</span>
            <span>
              Assigné:{" "}
              {action.assignedTo?.name ?? action.assignedTo?.email ?? "—"}
            </span>
            <span>
              Échéance:{" "}
              {dueDate ? formatDate(new Date(dueDate)) : "Sans échéance"}
            </span>
            {hasDueDate && status === "TODO" && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  isOverdue
                    ? "border-red-500/25 bg-red-500/10 text-red-400"
                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {isOverdue ? "En retard" : "Dans les temps"}
              </span>
            )}
          </div>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
          <button
            type="button"
            onClick={() => {
              setIsExpanded(true);
              setIsEditing((prev) => !prev);
            }}
            className="rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-foreground/60 transition hover:text-foreground sm:py-1 sm:text-xs"
          >
            {isEditing ? "Fermer édition" : "Modifier"}
          </button>
          <ClientActionStatusInline
            workspaceId={workspaceId}
            taskId={action.id}
            value={status}
            compact
          />
          <button
            type="button"
            onClick={() => {
              setIsExpanded((prev) => !prev);
              setIsEditing(false);
            }}
            aria-label={isExpanded ? "Replier l'action" : "Déplier l'action"}
            className="rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-foreground/60 transition hover:text-foreground sm:py-1 sm:text-xs"
          >
            <span aria-hidden>{isExpanded ? "▴" : "▾"}</span>
          </button>
        </div>
      </div>

      {shouldShowDoneWithoutSummaryWarning && (
        <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
          Action faite sans résumé d&apos;interaction.
        </p>
      )}

      {!isExpanded ? null : isEditing ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Titre
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={compactInputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ActionType)}
              className={compactInputClass}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Statut
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ActionStatus)}
              className={compactInputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Échéance
            </label>
            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              type="date"
              className={compactInputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Assigné à
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className={compactInputClass}
            >
              <option value="">— Non assigné</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email ?? "Utilisateur"}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Description interne
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${compactInputClass} resize-y`}
            />
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Résumé interaction
            </label>
            <textarea
              value={interactionSummary}
              onChange={(e) => setInteractionSummary(e.target.value)}
              rows={2}
              className={`${compactInputClass} resize-y`}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Résultat structuré
            </label>
            <select
              value={interactionOutcome}
              onChange={(e) =>
                setInteractionOutcome(e.target.value as InteractionOutcome | "")
              }
              className={compactInputClass}
            >
              <option value="">— Non renseigné</option>
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Sentiment client
            </label>
            <select
              value={interactionSentiment}
              onChange={(e) =>
                setInteractionSentiment(
                  e.target.value as InteractionSentiment | "",
                )
              }
              className={compactInputClass}
            >
              <option value="">— Non renseigné</option>
              {SENTIMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Objections détectées
            </label>
            <input
              value={interactionObjections}
              onChange={(e) => setInteractionObjections(e.target.value)}
              className={compactInputClass}
            />
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
              Action précédente
            </label>
            <select
              value={previousActionId}
              onChange={(e) => setPreviousActionId(e.target.value)}
              className={compactInputClass}
            >
              <option value="">— Début de séquence</option>
              {chainableActions
                .filter((candidate) => candidate.id !== action.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
            </select>
          </div>

          {error && (
            <p className="md:col-span-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2 md:col-span-4">
            <button
              type="button"
              onClick={save}
              disabled={isPendingSave || !title.trim()}
              className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
            >
              {isPendingSave ? "Sauvegarde…" : "Sauvegarder"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-border/50 bg-surface-2/30 p-3 text-xs text-foreground/70">
          {description && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/35">
                Description
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{description}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground/35">
              Résumé interaction
            </p>
            <p className="mt-0.5 whitespace-pre-wrap">
              {interactionSummary?.trim() || "Aucun résumé renseigné."}
            </p>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/35">
                Résultat
              </p>
              <p>
                {interactionOutcome
                  ? OUTCOME_OPTIONS.find((o) => o.value === interactionOutcome)
                      ?.label
                  : "Non renseigné"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/35">
                Sentiment
              </p>
              <p>
                {interactionSentiment
                  ? SENTIMENT_OPTIONS.find(
                      (o) => o.value === interactionSentiment,
                    )?.label
                  : "Non renseigné"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/35">
                Objections
              </p>
              <p>
                {action.interactionObjections.length > 0
                  ? action.interactionObjections.join(", ")
                  : "Aucune"}
              </p>
            </div>
          </div>

          <div className="mt-2 border-t border-border/50 pt-2 text-[11px] text-foreground/50">
            <p>
              Créé par:{" "}
              {action.createdBy?.name ?? action.createdBy?.email ?? "—"}
            </p>
            <p>
              Terminé:{" "}
              {action.doneAt ? formatDate(action.doneAt) : "Non terminé"}
            </p>
            <p className={isOverdue ? "font-semibold text-red-400" : ""}>
              Échéance: {formatDate(action.dueDate)}
            </p>
          </div>

          {error && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
