"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  updateClientProjectAction,
  deleteClientProjectAction,
} from "../../../actions";

type ProjectStatus =
  | "PROSPECT"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELED";
type PricingType = "FIXED" | "HOURLY";

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

const inputClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";
const labelClass = "mb-1.5 block text-xs font-semibold text-foreground/60";

export type ProjectSnapshot = {
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
};

type Props = {
  project: ProjectSnapshot;
  workspaceId: string;
  clientId: string;
  isManager: boolean;
};

function toDateInputValue(date: Date | string | null): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().substring(0, 10);
}

export function ProjectDetailForm({
  project,
  workspaceId,
  clientId,
  isManager,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isConfirmDelete, setIsConfirmDelete] = useState(false);

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
  const [completedAt, setCompletedAt] = useState(
    toDateInputValue(project.completedAt),
  );

  function save() {
    setError(null);
    setSuccess(false);
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
          completedAt: completedAt || undefined,
        },
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  function handleDelete() {
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
      router.push(
        `/workspace/${workspaceId}/clients/${clientId}?view=projects`,
      );
    });
  }

  return (
    <div className="space-y-5">
      {/* Données principales */}
      <div className="rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
        <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
          Informations du projet
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {/* Nom */}
          <div className="md:col-span-4">
            <label className={labelClass}>Nom du projet</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Refonte landing page"
              className={inputClass}
            />
          </div>

          {/* Statut */}
          <div className="md:col-span-2">
            <label className={labelClass}>Statut</label>
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

          {/* Tarification */}
          <div className="md:col-span-2">
            <label className={labelClass}>Type de tarification</label>
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

          {/* Taux horaire */}
          <div className="md:col-span-2">
            <label className={labelClass}>Taux horaire (€/h)</label>
            <input
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              type="number"
              min="0"
              step="any"
              disabled={pricingType !== "HOURLY"}
              placeholder={pricingType !== "HOURLY" ? "—" : "75"}
              className={inputClass}
            />
          </div>

          {/* Budget estimé */}
          <div className="md:col-span-1">
            <label className={labelClass}>Budget estimé (€)</label>
            <input
              value={budgetEstimated}
              onChange={(e) => setBudgetEstimated(e.target.value)}
              type="number"
              min="0"
              step="any"
              className={inputClass}
            />
          </div>

          {/* Budget final */}
          <div className="md:col-span-1">
            <label className={labelClass}>Budget final (€)</label>
            <input
              value={budgetFinal}
              onChange={(e) => setBudgetFinal(e.target.value)}
              type="number"
              min="0"
              step="any"
              className={inputClass}
            />
          </div>

          {/* Dates */}
          <div className="md:col-span-2">
            <label className={labelClass}>Date de début</label>
            <input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              type="date"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Deadline</label>
            <input
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              type="date"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Date de clôture</label>
            <input
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              type="date"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div className="md:col-span-6">
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Contexte, objectifs, périmètre..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="md:col-span-6">
            <label className={labelClass}>Lien du projet (site web)</label>
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
          <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {success && !error && (
          <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            Modifications enregistrées.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isPending || !name.trim()}
            className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
          >
            {isPending ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>

          {isManager && (
            <div className="flex items-center gap-2">
              {isConfirmDelete ? (
                <>
                  <span className="text-xs text-foreground/50">
                    Supprimer définitivement&nbsp;?
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {isPending ? "..." : "Confirmer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmDelete(false)}
                    disabled={isPending}
                    className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmDelete(true)}
                  className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-semibold text-foreground/50 transition hover:border-red-500/30 hover:text-red-400"
                >
                  Supprimer le projet
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
