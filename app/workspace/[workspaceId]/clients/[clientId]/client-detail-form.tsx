"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createClientSchema,
  type CreateClientInput,
} from "@/lib/validation/client";
import { deleteClientAction, updateClientAction } from "../actions";

const STATUS_OPTIONS = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "CONTACTED", label: "Contacté" },
  { value: "QUALIFIED", label: "Qualifié" },
  { value: "PROPOSAL_SENT", label: "Proposition envoyée" },
  { value: "NEGOTIATION", label: "En négociation" },
  { value: "WON", label: "Gagné" },
  { value: "LOST", label: "Perdu" },
  { value: "INACTIVE", label: "Inactif" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyen" },
  { value: "HIGH", label: "Urgent" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "— Non renseigné" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "EMAIL", label: "Email" },
  { value: "REFERRAL", label: "Recommandation" },
  { value: "WEBSITE", label: "Site web" },
  { value: "DISCORD", label: "Discord" },
  { value: "OTHER", label: "Autre" },
];

const inputClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";
const selectClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";
const labelClass = "mb-1.5 block text-xs font-semibold text-foreground/60";
const errorClass = "mt-1 text-xs text-red-400";

type ClientSnapshot = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  status:
    | "PROSPECT"
    | "CONTACTED"
    | "QUALIFIED"
    | "PROPOSAL_SENT"
    | "NEGOTIATION"
    | "WON"
    | "LOST"
    | "INACTIVE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  source:
    | "INSTAGRAM"
    | "LINKEDIN"
    | "EMAIL"
    | "REFERRAL"
    | "WEBSITE"
    | "DISCORD"
    | "OTHER"
    | null;
  budgetEstimated: number | null;
  notes: string | null;
};

type Props = {
  workspaceId: string;
  client: ClientSnapshot;
  canDelete: boolean;
};

export function ClientDetailForm({ workspaceId, client, canDelete }: Props) {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(client.status);
  const [statusChangeNote, setStatusChangeNote] = useState("");
  const [isPendingSave, startSaveTransition] = useTransition();
  const [isPendingDelete, startDeleteTransition] = useTransition();

  const defaultFormValues = {
    fullName: client.fullName,
    email: client.email ?? "",
    phone: client.phone ?? "",
    company: client.company ?? "",
    jobTitle: client.jobTitle ?? "",
    website: client.website ?? "",
    status: client.status,
    priority: client.priority,
    source: client.source ?? undefined,
    budgetEstimated: client.budgetEstimated ?? undefined,
    notes: client.notes ?? "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: defaultFormValues,
  });
  const hasStatusChanged = selectedStatus !== client.status;
  const statusRegister = register("status");

  const onSubmit = handleSubmit((rawValues) => {
    const values = rawValues as CreateClientInput;
    const payload: CreateClientInput = {
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      company: values.company,
      jobTitle: values.jobTitle,
      website: values.website,
      status: values.status,
      priority: values.priority,
      source: values.source,
      budgetEstimated: values.budgetEstimated,
      notes: values.notes,
    };

    const statusChangeNotePayload =
      hasStatusChanged && statusChangeNote
        ? statusChangeNote.trim() || undefined
        : undefined;

    setSaveError(null);
    startSaveTransition(async () => {
      const result = await updateClientAction(
        workspaceId,
        client.id,
        payload,
        statusChangeNotePayload,
      );
      if (result?.error) {
        setSaveError(result.error);
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  });

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteClientAction(workspaceId, client.id);
      if (result?.error) {
        setDeleteError(result.error);
        return;
      }
      router.push(`/workspace/${workspaceId}/clients`);
    });
  }

  function cancelEdit() {
    reset(defaultFormValues);
    setSelectedStatus(client.status);
    setStatusChangeNote("");
    setSaveError(null);
    setDeleteError(null);
    setConfirmDelete(false);
    setIsEditing(false);
  }

  const statusLabel =
    STATUS_OPTIONS.find((option) => option.value === client.status)?.label ??
    client.status;
  const priorityLabel =
    PRIORITY_OPTIONS.find((option) => option.value === client.priority)
      ?.label ?? client.priority;
  const sourceLabel =
    SOURCE_OPTIONS.find((option) => option.value === (client.source ?? ""))
      ?.label ?? "— Non renseigne";
  const budgetLabel =
    client.budgetEstimated !== null
      ? new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(client.budgetEstimated)
      : "—";

  if (!isEditing) {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
              Informations client
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_20px_-4px_rgba(109,15,242,0.4)] transition hover:bg-brand-4"
          >
            Modifier
          </button>
        </div>

        <section className="rounded-xl border border-border/60 bg-surface-2/20 p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
            Informations principales
          </h3>
          <dl className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Nom complet
              </dt>
              <dd className="mt-0.5 font-medium text-foreground/80">
                {client.fullName}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Entreprise
              </dt>
              <dd className="mt-0.5 text-foreground/75">
                {client.company ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Poste
              </dt>
              <dd className="mt-0.5 text-foreground/75">
                {client.jobTitle ?? "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border/60 bg-surface-2/20 p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
            Contact
          </h3>
          <dl className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Email
              </dt>
              <dd className="mt-0.5 break-all text-foreground/75">
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="font-medium text-brand-2 hover:underline"
                  >
                    {client.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Telephone
              </dt>
              <dd className="mt-0.5 text-foreground/75">
                {client.phone ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Site web
              </dt>
              <dd className="mt-0.5 break-all text-foreground/75">
                {client.website ? (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-2 hover:underline"
                  >
                    {client.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border/60 bg-surface-2/20 p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
            Pipeline
          </h3>
          <dl className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Statut
              </dt>
              <dd className="mt-0.5 text-foreground/75">{statusLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Priorite
              </dt>
              <dd className="mt-0.5 text-foreground/75">{priorityLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Source
              </dt>
              <dd className="mt-0.5 text-foreground/75">{sourceLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                Budget estime
              </dt>
              <dd className="mt-0.5 text-foreground/75">{budgetLabel}</dd>
            </div>
          </dl>

          <div className="mt-2.5 border-t border-border/50 pt-2.5">
            <p className="text-[11px] uppercase tracking-wider text-foreground/35">
              Notes
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/75">
              {client.notes?.trim() ? client.notes : "Aucune note client."}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground/40">
            Edition client
          </h2>
          <p className="mt-1 text-sm text-foreground/55">
            Modifiez les informations puis sauvegardez les changements.
          </p>
        </div>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={isPendingSave || isPendingDelete}
          className="rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
        >
          Annuler modifications
        </button>
      </div>

      <section>
        <h2 className="mb-3 border-b border-border/50 pb-2 text-xs font-semibold uppercase tracking-widest text-foreground/40">
          Informations principales
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nom complet</label>
            <input {...register("fullName")} className={inputClass} />
            {errors.fullName && (
              <p className={errorClass}>{errors.fullName.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Entreprise</label>
            <input {...register("company")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Poste</label>
            <input {...register("jobTitle")} className={inputClass} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 border-b border-border/50 pb-2 text-xs font-semibold uppercase tracking-widest text-foreground/40">
          Contact
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Email</label>
            <input {...register("email")} type="email" className={inputClass} />
            {errors.email && (
              <p className={errorClass}>{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input {...register("phone")} type="tel" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Site web</label>
            <input {...register("website")} type="url" className={inputClass} />
            {errors.website && (
              <p className={errorClass}>{errors.website.message}</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 border-b border-border/50 pb-2 text-xs font-semibold uppercase tracking-widest text-foreground/40">
          Pipeline
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Statut</label>
            <select
              {...statusRegister}
              onChange={(e) => {
                statusRegister.onChange(e);
                setSelectedStatus(e.target.value as ClientSnapshot["status"]);
              }}
              className={selectClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {hasStatusChanged && (
            <div className="sm:col-span-3 rounded-lg border border-brand-1/20 bg-brand-1/5 p-3">
              <label className={labelClass}>
                Note de changement (optionnel)
              </label>
              <textarea
                value={statusChangeNote}
                onChange={(e) => setStatusChangeNote(e.target.value)}
                rows={2}
                placeholder="Ex: Qualification validée après appel découverte"
                className={`${inputClass} resize-none`}
              />
              <p className="mt-1 text-[11px] text-foreground/45">
                Cette note sera enregistree dans l historique de statut.
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Priorité</label>
            <select {...register("priority")} className={selectClass}>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Source</label>
            <select {...register("source")} className={selectClass}>
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className={labelClass}>Budget estimé (€)</label>
            <input
              {...register("budgetEstimated", {
                setValueAs: (v) =>
                  v === "" || v === undefined || v === null || isNaN(Number(v))
                    ? undefined
                    : Number(v),
              })}
              type="number"
              min="0"
              step="any"
              className={inputClass}
            />
            {errors.budgetEstimated && (
              <p className={errorClass}>{errors.budgetEstimated.message}</p>
            )}
          </div>
          <div className="sm:col-span-3">
            <label className={labelClass}>Notes</label>
            <textarea
              {...register("notes")}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </section>

      {saveError && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-4">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPendingSave || isPendingDelete || !isDirty}
            className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(109,15,242,0.4)] transition hover:bg-brand-4 disabled:opacity-50"
          >
            {isPendingSave ? "Sauvegarde…" : "Sauvegarder"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={isPendingSave || isPendingDelete}
            className="rounded-lg border border-border/70 bg-surface px-4 py-2 text-sm font-medium text-foreground/60 transition hover:text-foreground disabled:opacity-50"
          >
            Annuler
          </button>
        </div>

        {canDelete && (
          <div className="flex items-center gap-2">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={isPendingSave || isPendingDelete}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                Supprimer le client
              </button>
            ) : (
              <>
                <span className="text-xs text-foreground/40">Confirmer ?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPendingSave || isPendingDelete}
                  className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                  {isPendingDelete ? "…" : "Oui"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isPendingSave || isPendingDelete}
                  className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground/50 transition hover:text-foreground disabled:opacity-50"
                >
                  Non
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {deleteError}
        </p>
      )}
    </form>
  );
}
