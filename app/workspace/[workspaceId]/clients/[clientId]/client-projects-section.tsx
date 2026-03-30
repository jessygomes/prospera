"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  createClientProjectAction,
  updateClientProjectAction,
  deleteClientProjectAction,
} from "../actions";

type ProjectStatus =
  | "PROSPECT"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELED";

type PricingType = "FIXED" | "HOURLY";

type ClientProject = {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  status: ProjectStatus;
  pricingType: PricingType;
  budgetEstimated: number | null;
  budgetFinal: number | null;
  hourlyRate: number | null;
  startDate: Date | null;
  deadline: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

type Props = {
  workspaceId: string;
  clientId: string;
  projects: ClientProject[];
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "ON_HOLD", label: "En pause" },
  { value: "COMPLETED", label: "Terminé" },
  { value: "CANCELED", label: "Annulé" },
];

const PRICING_OPTIONS: { value: PricingType; label: string }[] = [
  { value: "FIXED", label: "Forfait" },
  { value: "HOURLY", label: "Horaire" },
];

const STATUS_BADGES: Record<ProjectStatus, string> = {
  PROSPECT: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  IN_PROGRESS: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  ON_HOLD: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELED: "bg-red-500/10 text-red-400 border-red-500/20",
};

const inputClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

const compactInputClass =
  "w-full rounded-md border border-border/70 bg-surface-2/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatMoney(value: number | null | undefined): string {
  if (!value) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function toDateInputValue(date: Date | string | null): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().substring(0, 10);
}

// ─── ProjectRow ──────────────────────────────────────────────────────────────

function ProjectRow({
  project,
  workspaceId,
  clientId,
  onMutated,
}: {
  project: ClientProject;
  workspaceId: string;
  clientId: string;
  onMutated: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmDelete, setIsConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Edit fields
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(project.websiteUrl ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [pricingType, setPricingType] = useState<PricingType>(
    project.pricingType,
  );
  const [budgetEstimated, setBudgetEstimated] = useState(
    project.budgetEstimated != null ? String(project.budgetEstimated) : "",
  );
  const [budgetFinal, setBudgetFinal] = useState(
    project.budgetFinal != null ? String(project.budgetFinal) : "",
  );
  const [hourlyRate, setHourlyRate] = useState(
    project.hourlyRate != null ? String(project.hourlyRate) : "",
  );
  const [startDate, setStartDate] = useState(
    toDateInputValue(project.startDate),
  );
  const [deadline, setDeadline] = useState(toDateInputValue(project.deadline));

  function cancelEdit() {
    setIsEditing(false);
    setError(null);
    setName(project.name);
    setDescription(project.description ?? "");
    setWebsiteUrl(project.websiteUrl ?? "");
    setStatus(project.status);
    setPricingType(project.pricingType);
    setBudgetEstimated(
      project.budgetEstimated != null ? String(project.budgetEstimated) : "",
    );
    setBudgetFinal(
      project.budgetFinal != null ? String(project.budgetFinal) : "",
    );
    setHourlyRate(project.hourlyRate != null ? String(project.hourlyRate) : "");
    setStartDate(toDateInputValue(project.startDate));
    setDeadline(toDateInputValue(project.deadline));
  }

  function saveEdit() {
    setError(null);
    startTransition(async () => {
      const result = await updateClientProjectAction(
        workspaceId,
        clientId,
        project.id,
        {
          name,
          description: description || undefined,
          websiteUrl: websiteUrl || undefined,
          status,
          pricingType,
          budgetEstimated:
            budgetEstimated.trim() === "" ? undefined : Number(budgetEstimated),
          budgetFinal:
            budgetFinal.trim() === "" ? undefined : Number(budgetFinal),
          hourlyRate: hourlyRate.trim() === "" ? undefined : Number(hourlyRate),
          startDate: startDate || undefined,
          deadline: deadline || undefined,
        },
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      setIsEditing(false);
      onMutated();
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteClientProjectAction(
        workspaceId,
        clientId,
        project.id,
      );
      if (result?.error) {
        setError(result.error);
        setIsConfirmDelete(false);
        return;
      }
      onMutated();
    });
  }

  if (isEditing) {
    return (
      <div className="rounded-lg border border-brand-1/30 bg-surface-2/30 px-3 py-2.5">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Nom
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={compactInputClass}
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Statut
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className={compactInputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Tarif
            </label>
            <select
              value={pricingType}
              onChange={(e) => setPricingType(e.target.value as PricingType)}
              className={compactInputClass}
            >
              {PRICING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Taux horaire
            </label>
            <input
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              type="number"
              min="0"
              disabled={pricingType !== "HOURLY"}
              className={compactInputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Budget estimé (€)
            </label>
            <input
              value={budgetEstimated}
              onChange={(e) => setBudgetEstimated(e.target.value)}
              type="number"
              min="0"
              className={compactInputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Budget final (€)
            </label>
            <input
              value={budgetFinal}
              onChange={(e) => setBudgetFinal(e.target.value)}
              type="number"
              min="0"
              className={compactInputClass}
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Début
            </label>
            <input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              type="date"
              className={compactInputClass}
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Deadline
            </label>
            <input
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              type="date"
              className={compactInputClass}
            />
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${compactInputClass} resize-none`}
            />
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Lien du projet
            </label>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              type="url"
              placeholder="https://..."
              className={compactInputClass}
            />
          </div>
        </div>

        {error && (
          <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={saveEdit}
            disabled={isPending || !name.trim()}
            className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
          >
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={isPending}
            className="rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {project.name}
          </p>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGES[project.status]}`}
          >
            {STATUS_OPTIONS.find((o) => o.value === project.status)?.label}
          </span>
          <span className="inline-flex shrink-0 items-center rounded-full border border-border/60 bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground/55">
            {
              PRICING_OPTIONS.find((o) => o.value === project.pricingType)
                ?.label
            }
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`/workspace/${workspaceId}/clients/${clientId}/projects/${project.id}`}
            className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:border-brand-1/30 hover:text-foreground"
          >
            Détails →
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setIsConfirmDelete(false);
            }}
            className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:border-brand-1/30 hover:text-foreground"
          >
            Modifier
          </button>
          {isConfirmDelete ? (
            <>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isPending}
                className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                {isPending ? "..." : "Confirmer"}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmDelete(false)}
                disabled={isPending}
                className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmDelete(true)}
              className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/50 transition hover:border-red-500/30 hover:text-red-400"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/45">
        {project.budgetEstimated != null && (
          <span>Estimé&nbsp;: {formatMoney(project.budgetEstimated)}</span>
        )}
        {project.budgetFinal != null && (
          <span>Final&nbsp;: {formatMoney(project.budgetFinal)}</span>
        )}
        {project.hourlyRate != null && (
          <span>Taux&nbsp;: {formatMoney(project.hourlyRate)}/h</span>
        )}
        {project.startDate && (
          <span>Début&nbsp;: {formatDate(project.startDate)}</span>
        )}
        {project.deadline && (
          <span>Deadline&nbsp;: {formatDate(project.deadline)}</span>
        )}
      </div>

      {project.websiteUrl && (
        <a
          href={project.websiteUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center text-xs font-medium text-brand-2 hover:text-brand-1"
        >
          Ouvrir le lien du projet
        </a>
      )}

      {project.description && (
        <p className="mt-1 text-xs text-foreground/55">{project.description}</p>
      )}
    </div>
  );
}

// ─── ClientProjectsSection ───────────────────────────────────────────────────

export function ClientProjectsSection({
  workspaceId,
  clientId,
  projects,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PROSPECT");
  const [pricingType, setPricingType] = useState<PricingType>("FIXED");
  const [budgetEstimated, setBudgetEstimated] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");

  function createProject() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createClientProjectAction(workspaceId, clientId, {
        name,
        description: description || undefined,
        websiteUrl: websiteUrl || undefined,
        status,
        pricingType,
        budgetEstimated:
          budgetEstimated.trim() === "" ? undefined : Number(budgetEstimated),
        hourlyRate: hourlyRate.trim() === "" ? undefined : Number(hourlyRate),
        startDate: startDate || undefined,
        deadline: deadline || undefined,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      setName("");
      setDescription("");
      setWebsiteUrl("");
      setStatus("PROSPECT");
      setPricingType("FIXED");
      setBudgetEstimated("");
      setHourlyRate("");
      setStartDate("");
      setDeadline("");
      setIsCreateOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            Projets du client
          </h2>
          <p className="text-sm text-foreground/45">
            Crée et suis les projets liés à ce client.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border/60 bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-foreground/50">
            {projects.length} projet{projects.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => setIsCreateOpen((v) => !v)}
            className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/70 transition hover:border-brand-1/30 hover:text-foreground"
          >
            {isCreateOpen ? "Replier" : "+ Nouveau projet"}
          </button>
        </div>
      </div>

      {isCreateOpen && (
        <div className="mb-5 rounded-xl border border-border/60 bg-surface-2/30 p-3">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-6">
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Nom du projet
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Refonte landing page"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Tarification
              </label>
              <select
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value as PricingType)}
                className={inputClass}
              >
                {PRICING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Budget estimé
              </label>
              <input
                value={budgetEstimated}
                onChange={(e) => setBudgetEstimated(e.target.value)}
                type="number"
                min="0"
                step="any"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Taux horaire
              </label>
              <input
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                type="number"
                min="0"
                step="any"
                disabled={pricingType !== "HOURLY"}
                className={inputClass}
              />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Début
              </label>
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                type="date"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Deadline
              </label>
              <input
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                type="date"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Lien du projet
              </label>
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                type="url"
                placeholder="https://..."
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={createProject}
              disabled={isPending || !name.trim()}
              className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
            >
              {isPending ? "Création..." : "Créer le projet"}
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              disabled={isPending}
              className="rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 bg-surface-2/20 px-4 py-6 text-sm text-foreground/50">
          Aucun projet pour ce client.
        </p>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              workspaceId={workspaceId}
              clientId={clientId}
              onMutated={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </section>
  );
}
