"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createClientTaskAction,
  deleteClientTaskAction,
  updateClientTaskStatusQuickAction,
  updateClientTaskAction,
} from "../actions";

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

type ClientTask = {
  id: string;
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
  createdById: string | null;
  assignedToId: string | null;
  createdBy: { name: string | null; email: string | null } | null;
  assignedTo: { name: string | null; email: string | null } | null;
};

type Props = {
  workspaceId: string;
  clientId: string;
  tasks: ClientTask[];
  assignees: Assignee[];
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

type StatusSortMode = "TODO_FIRST" | "DONE_FIRST" | "CANCELED_FIRST";
type ProductivityFilter = "ALL" | "TODO" | "OVERDUE" | "TODAY" | "THIS_WEEK";

const STATUS_SORT_OPTIONS: { value: StatusSortMode; label: string }[] = [
  { value: "TODO_FIRST", label: "À faire en premier" },
  { value: "DONE_FIRST", label: "Faites en premier" },
  { value: "CANCELED_FIRST", label: "Annulées en premier" },
];

const PRODUCTIVITY_FILTERS: { value: ProductivityFilter; label: string }[] = [
  { value: "ALL", label: "Toutes" },
  { value: "TODO", label: "À faire" },
  { value: "OVERDUE", label: "En retard" },
  { value: "TODAY", label: "Aujourd'hui" },
  { value: "THIS_WEEK", label: "Cette semaine" },
];

const STATUS_BADGES: Record<ActionStatus, string> = {
  TODO: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  DONE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  CANCELED: "bg-red-500/10 text-red-400 border-red-500/25",
};

const inputClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";
const compactInputClass =
  "w-full rounded-md border border-border/70 bg-surface-2/50 px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

function toInputDate(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusRank(status: ActionStatus, mode: StatusSortMode): number {
  if (mode === "DONE_FIRST") {
    return status === "DONE" ? 0 : status === "TODO" ? 1 : 2;
  }
  if (mode === "CANCELED_FIRST") {
    return status === "CANCELED" ? 0 : status === "TODO" ? 1 : 2;
  }
  return status === "TODO" ? 0 : status === "DONE" ? 1 : 2;
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

function ActionRow({
  workspaceId,
  clientId,
  task,
  assignees,
  chainableActions,
}: {
  workspaceId: string;
  clientId: string;
  task: ClientTask;
  assignees: Assignee[];
  chainableActions: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [isPendingSave, startSaveTransition] = useTransition();
  const [isPendingDelete, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPendingQuickStatus, startQuickStatusTransition] = useTransition();

  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState<ActionType>(task.type);
  const [status, setStatus] = useState<ActionStatus>(task.status);
  const [quickStatus, setQuickStatus] = useState<ActionStatus>(task.status);
  const [dueDate, setDueDate] = useState(toInputDate(task.dueDate));
  const [assignedToId, setAssignedToId] = useState(task.assignedToId ?? "");
  const [description, setDescription] = useState(task.description ?? "");
  const [interactionSummary, setInteractionSummary] = useState(
    task.interactionSummary ?? "",
  );
  const [interactionOutcome, setInteractionOutcome] = useState<
    InteractionOutcome | ""
  >(task.interactionOutcome ?? "");
  const [interactionSentiment, setInteractionSentiment] = useState<
    InteractionSentiment | ""
  >(task.interactionSentiment ?? "");
  const [interactionObjections, setInteractionObjections] = useState(
    toObjectionsInput(task.interactionObjections),
  );
  const [previousActionId, setPreviousActionId] = useState(
    task.previousActionId ?? "",
  );
  const hasStructuredSignal =
    !!interactionOutcome ||
    !!interactionSentiment ||
    fromObjectionsInput(interactionObjections).length > 0;
  const shouldShowActionResultWarning =
    quickStatus === "DONE" && !task.interactionSummary?.trim();

  function resetEditingState() {
    setTitle(task.title);
    setType(task.type);
    setStatus(task.status);
    setQuickStatus(task.status);
    setDueDate(toInputDate(task.dueDate));
    setAssignedToId(task.assignedToId ?? "");
    setDescription(task.description ?? "");
    setInteractionSummary(task.interactionSummary ?? "");
    setInteractionOutcome(task.interactionOutcome ?? "");
    setInteractionSentiment(task.interactionSentiment ?? "");
    setInteractionObjections(toObjectionsInput(task.interactionObjections));
    setPreviousActionId(task.previousActionId ?? "");
    setError(null);
    setConfirmDelete(false);
  }

  function quickUpdateStatus(nextStatus: ActionStatus) {
    if (nextStatus === quickStatus) return;

    setError(null);
    const previousStatus = quickStatus;
    setQuickStatus(nextStatus);
    setStatus(nextStatus);

    startQuickStatusTransition(async () => {
      const result = await updateClientTaskStatusQuickAction(
        workspaceId,
        task.id,
        nextStatus,
      );
      if (result?.error) {
        setQuickStatus(previousStatus);
        setStatus(previousStatus);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function save() {
    setError(null);
    startSaveTransition(async () => {
      const result = await updateClientTaskAction(
        workspaceId,
        clientId,
        task.id,
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
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteClientTaskAction(
        workspaceId,
        clientId,
        task.id,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!isEditing) {
    return (
      <div className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGES[quickStatus]}`}
            >
              {STATUS_OPTIONS.find((o) => o.value === quickStatus)?.label}
            </span>
            {hasStructuredSignal && (
              <span className="inline-flex items-center rounded-full border border-brand-1/35 bg-brand-1/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-2">
                Analyse structurée active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div>
              <select
                value={quickStatus}
                onChange={(e) =>
                  quickUpdateStatus(e.target.value as ActionStatus)
                }
                disabled={isPendingQuickStatus}
                className="rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1 text-xs text-foreground outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15 disabled:opacity-60"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className=" rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground/65 transition hover:border-brand-1/35 hover:text-foreground"
            >
              Modifier
            </button>
          </div>
        </div>

        {shouldShowActionResultWarning && (
          <p className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
            Pensez a renseigner le resultat de l&apos;action (resume, resultat,
            sentiment ou objections).
          </p>
        )}

        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-[10px] uppercase tracking-wider text-foreground/35">
              Titre
            </p>
            <p className="mt-0.5 font-medium text-foreground/80">
              {task.title}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground/35">
              Type
            </p>
            <p className="mt-0.5 text-xs text-foreground/75">
              {TYPE_OPTIONS.find((o) => o.value === task.type)?.label}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground/35">
              Échéance
            </p>
            <p className="mt-0.5 text-xs text-foreground/75">
              {formatDate(task.dueDate)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground/35">
              Assigné à
            </p>
            <p className="mt-0.5 text-xs text-foreground/75">
              {task.assignedTo?.name ?? task.assignedTo?.email ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground/35">
              Créée par
            </p>
            <p className="mt-0.5 text-xs text-foreground/75">
              {task.createdBy?.name ?? task.createdBy?.email ?? "—"}
            </p>
          </div>
        </div>

        {task.description && (
          <div className="mt-2 border-t border-border/40 pt-2">
            <p className="text-[10px] uppercase tracking-wider text-foreground/35">
              Description interne
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground/75">
              {task.description}
            </p>
          </div>
        )}

        <div className="mt-2 rounded-lg border border-border/50 bg-surface-2/45 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-foreground/35">
            Résumé interaction
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground/75">
            {task.interactionSummary?.trim()
              ? task.interactionSummary
              : "Aucun résumé renseigné."}
          </p>

          <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/35">
                Résultat structuré
              </p>
              <p className="mt-0.5 text-foreground/75">
                {task.interactionOutcome
                  ? OUTCOME_OPTIONS.find(
                      (o) => o.value === task.interactionOutcome,
                    )?.label
                  : "Non renseigné"}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/35">
                Sentiment client
              </p>
              <p className="mt-0.5 text-xs text-foreground/75">
                {task.interactionSentiment
                  ? SENTIMENT_OPTIONS.find(
                      (o) => o.value === task.interactionSentiment,
                    )?.label
                  : "Non renseigné"}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/35">
                Objections détectées
              </p>
              <p className="mt-0.5 text-xs text-foreground/75">
                {task.interactionObjections.length > 0
                  ? task.interactionObjections.join(", ")
                  : "Aucune objection renseignée"}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGES[status]}`}
        >
          {STATUS_OPTIONS.find((o) => o.value === status)?.label}
        </span>
        {hasStructuredSignal && (
          <span className="inline-flex items-center rounded-full border border-brand-1/35 bg-brand-1/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-2">
            Analyse structurée active
          </span>
        )}
        <span className="text-[10px] text-foreground/40">
          Échéance: {formatDate(task.dueDate)}
        </span>
        <span className="text-[10px] text-foreground/30">
          Créée par {task.createdBy?.name ?? task.createdBy?.email ?? "—"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
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
            Description / objectif de l&apos;action
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Objectif précis de l'action (ex: obtenir validation devis avant vendredi)"
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
            placeholder="Résultat de l'appel/email/relance, réaction du client, objections..."
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
            placeholder="prix, timing, concurrence"
            className={compactInputClass}
          />
        </div>

        <div className="md:col-span-4">
          <label className="mb-1 block text-[10px] font-semibold text-foreground/60">
            Action précédente (chaîne)
          </label>
          <select
            value={previousActionId}
            onChange={(e) => setPreviousActionId(e.target.value)}
            className={compactInputClass}
          >
            <option value="">— Début de séquence</option>
            {chainableActions
              .filter((candidate) => candidate.id !== task.id)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={isPendingSave || isPendingDelete}
            className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
          >
            {isPendingSave ? "Sauvegarde…" : "Sauvegarder"}
          </button>
          <button
            type="button"
            onClick={() => {
              resetEditingState();
              setIsEditing(false);
            }}
            disabled={isPendingSave || isPendingDelete}
            className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
          >
            Annuler
          </button>
        </div>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isPendingSave || isPendingDelete}
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            Supprimer
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-foreground/40">Confirmer ?</span>
            <button
              type="button"
              onClick={remove}
              disabled={isPendingSave || isPendingDelete}
              className="rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
            >
              {isPendingDelete ? "…" : "Oui"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={isPendingSave || isPendingDelete}
              className="rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground/50 transition hover:text-foreground"
            >
              Non
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientActionsSection({
  workspaceId,
  clientId,
  tasks,
  assignees,
}: Props) {
  const PAGE_SIZE = 9;
  const router = useRouter();
  const [isPendingCreate, startCreateTransition] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sortMode, setSortMode] = useState<StatusSortMode>("TODO_FIRST");
  const [productivityFilter, setProductivityFilter] =
    useState<ProductivityFilter>("ALL");
  const [page, setPage] = useState(1);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActionType>("FOLLOW_UP");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [description, setDescription] = useState("");
  const [interactionSummary, setInteractionSummary] = useState("");
  const [interactionOutcome, setInteractionOutcome] = useState<
    InteractionOutcome | ""
  >("");
  const [interactionSentiment, setInteractionSentiment] = useState<
    InteractionSentiment | ""
  >("");
  const [interactionObjections, setInteractionObjections] = useState("");
  const [previousActionId, setPreviousActionId] = useState("");

  const filteredTasks = useMemo(() => {
    if (productivityFilter === "ALL") return tasks;

    const now = new Date();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);
    const endThisWeek = new Date(startToday);
    endThisWeek.setDate(endThisWeek.getDate() + 7);

    return tasks.filter((task) => {
      if (productivityFilter === "TODO") {
        return task.status === "TODO";
      }

      if (!task.dueDate) return false;
      const dueTime = new Date(task.dueDate).getTime();

      if (productivityFilter === "OVERDUE") {
        return task.status === "TODO" && dueTime < startToday.getTime();
      }

      if (productivityFilter === "TODAY") {
        return (
          task.status === "TODO" &&
          dueTime >= startToday.getTime() &&
          dueTime < endToday.getTime()
        );
      }

      if (productivityFilter === "THIS_WEEK") {
        return (
          task.status === "TODO" &&
          dueTime >= startToday.getTime() &&
          dueTime < endThisWeek.getTime()
        );
      }

      return true;
    });
  }, [tasks, productivityFilter]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const byStatus =
        getStatusRank(a.status, sortMode) - getStatusRank(b.status, sortMode);
      if (byStatus !== 0) return byStatus;

      const aDue = a.dueDate
        ? new Date(a.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate
        ? new Date(b.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredTasks, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedTasks = sortedTasks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function createTask() {
    setCreateError(null);
    startCreateTransition(async () => {
      const result = await createClientTaskAction(workspaceId, clientId, {
        title,
        type,
        dueDate: dueDate || undefined,
        assignedToId: assignedToId || undefined,
        description: description || undefined,
        interactionSummary: interactionSummary || undefined,
        interactionOutcome: interactionOutcome || undefined,
        interactionSentiment: interactionSentiment || undefined,
        interactionObjections: fromObjectionsInput(interactionObjections),
        previousActionId: previousActionId || undefined,
      });
      if (result?.error) {
        setCreateError(result.error);
        return;
      }

      setTitle("");
      setType("FOLLOW_UP");
      setDueDate("");
      setAssignedToId("");
      setDescription("");
      setInteractionSummary("");
      setInteractionOutcome("");
      setInteractionSentiment("");
      setInteractionObjections("");
      setPreviousActionId("");
      setIsCreateOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            Actions commerciales
          </h2>
          <p className="text-sm text-foreground/45">
            To-do, suivi, assignation et échéances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border/60 bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-foreground/50">
            {tasks.length} action{tasks.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => setIsCreateOpen((value) => !value)}
            className="cursor-pointer rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4"
          >
            {isCreateOpen ? "Replier" : "+ Nouvelle action"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <div className="mr-auto flex flex-wrap items-center gap-1.5">
          {PRODUCTIVITY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setProductivityFilter(filter.value);
                setPage(1);
              }}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                productivityFilter === filter.value
                  ? "border-brand-1/35 bg-brand-1/12 text-brand-2"
                  : "border-border/70 bg-surface text-foreground/55 hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className="text-xs font-semibold text-foreground/55">
          Tri statut
        </label>
        <select
          value={sortMode}
          onChange={(e) => {
            setSortMode(e.target.value as StatusSortMode);
            setPage(1);
          }}
          className="rounded-lg border border-border/70 bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15"
        >
          {STATUS_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isCreateOpen && (
        <div className="mb-6 rounded-xl border border-border/60 bg-surface-2/30 p-3">
          <>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
              Nouvelle action
            </h3>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-6">
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-foreground/60">
                  Titre
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Relancer pour validation du devis"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-xs font-semibold text-foreground/60">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ActionType)}
                  className={inputClass}
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-xs font-semibold text-foreground/60">
                  Échéance
                </label>
                <input
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  type="date"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-xs font-semibold text-foreground/60">
                  Assigné à
                </label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Non assigné</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name ?? a.email ?? "Utilisateur"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <details className="mt-2 rounded-lg border border-border/60 bg-surface px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-foreground/55">
                Options
              </summary>
              <div className="mt-2">
                <label className="mb-1 block text-xs font-semibold text-foreground/60">
                  Résumé interaction
                </label>
                <textarea
                  value={interactionSummary}
                  onChange={(e) => setInteractionSummary(e.target.value)}
                  rows={3}
                  placeholder="Ce qui s'est passé, réaction client, objections, niveau d'intérêt..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground/60">
                    Résultat structuré
                  </label>
                  <select
                    value={interactionOutcome}
                    onChange={(e) =>
                      setInteractionOutcome(
                        e.target.value as InteractionOutcome | "",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">— Non renseigné</option>
                    {OUTCOME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground/60">
                    Sentiment client
                  </label>
                  <select
                    value={interactionSentiment}
                    onChange={(e) =>
                      setInteractionSentiment(
                        e.target.value as InteractionSentiment | "",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">— Non renseigné</option>
                    {SENTIMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-2">
                <label className="mb-1 block text-xs font-semibold text-foreground/60">
                  Objections détectées
                </label>
                <input
                  value={interactionObjections}
                  onChange={(e) => setInteractionObjections(e.target.value)}
                  placeholder="prix, timing, concurrence"
                  className={inputClass}
                />
              </div>

              <div className="mt-2">
                <label className="mb-1 block text-xs font-semibold text-foreground/60">
                  Action précédente (chaîne)
                </label>
                <select
                  value={previousActionId}
                  onChange={(e) => setPreviousActionId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Début de séquence</option>
                  {tasks.map((existingTask) => (
                    <option key={existingTask.id} value={existingTask.id}>
                      {existingTask.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2">
                <label className="mb-1 block text-xs font-semibold text-foreground/60">
                  Description interne
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Contexte complémentaire (optionnel)"
                  className={`${inputClass} resize-none`}
                />
              </div>
            </details>

            {createError && (
              <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {createError}
              </p>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={createTask}
                disabled={isPendingCreate || !title.trim()}
                className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
              >
                {isPendingCreate ? "Création…" : "Ajouter l action"}
              </button>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                disabled={isPendingCreate}
                className="rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </>
        </div>
      )}

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-surface-2/20 px-4 py-6 text-sm text-foreground/50">
            Aucune action pour ce client.
          </p>
        ) : paginatedTasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-surface-2/20 px-4 py-6 text-sm text-foreground/50">
            Aucune action ne correspond au filtre sélectionné.
          </p>
        ) : (
          paginatedTasks.map((task) => (
            <ActionRow
              key={task.id}
              workspaceId={workspaceId}
              clientId={clientId}
              task={task}
              assignees={assignees}
              chainableActions={tasks.map((candidate) => ({
                id: candidate.id,
                title: candidate.title,
              }))}
            />
          ))
        )}
      </div>

      {tasks.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
          <p className="text-xs text-foreground/45">
            Page {currentPage} sur {totalPages} · {sortedTasks.length} action
            {sortedTasks.length > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
