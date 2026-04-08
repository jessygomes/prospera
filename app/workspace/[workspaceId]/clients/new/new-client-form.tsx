"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createClientSchema,
  type CreateClientInput,
} from "@/lib/validation/client";
import { createClientAction } from "../actions";

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

type Props = { workspaceId: string };

export function NewClientForm({ workspaceId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: { status: "PROSPECT", priority: "MEDIUM" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createClientAction(
        workspaceId,
        values as CreateClientInput,
      );
      if (result?.error) {
        setServerError(result.error);
      } else {
        router.push(`/workspace/${workspaceId}/clients`);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Section : Identité */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/40">
          Identité
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Nom complet <span className="text-red-400">*</span>
            </label>
            <input
              {...register("fullName")}
              placeholder="Jean Dupont"
              autoFocus
              className={inputClass}
            />
            {errors.fullName && (
              <p className={errorClass}>{errors.fullName.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Entreprise</label>
            <input
              {...register("company")}
              placeholder="Acme Corp"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type d entreprise</label>
            <input
              {...register("companyType")}
              placeholder="SaaS, E-commerce, Agence..."
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Poste</label>
            <input
              {...register("jobTitle")}
              placeholder="Directeur Marketing"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>SIRET</label>
            <input
              {...register("siret")}
              placeholder="14 chiffres"
              className={inputClass}
            />
            {errors.siret && <p className={errorClass}>{errors.siret.message}</p>}
          </div>
          <div>
            <label className={labelClass}>SIREN</label>
            <input
              {...register("siren")}
              placeholder="9 chiffres"
              className={inputClass}
            />
            {errors.siren && <p className={errorClass}>{errors.siren.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Adresse ligne 1</label>
            <input
              {...register("addressLine1")}
              placeholder="12 Rue des Lilas"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Adresse ligne 2</label>
            <input
              {...register("addressLine2")}
              placeholder="Bâtiment B, 2e étage"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Code postal</label>
            <input
              {...register("postalCode")}
              placeholder="75001"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ville</label>
            <input
              {...register("city")}
              placeholder="Paris"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Pays</label>
            <input
              {...register("country")}
              placeholder="France"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Section : Contact */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/40">
          Contact
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Email</label>
            <input
              {...register("email")}
              type="email"
              placeholder="jean@acme.fr"
              className={inputClass}
            />
            {errors.email && (
              <p className={errorClass}>{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input
              {...register("phone")}
              type="tel"
              placeholder="+33 6 00 00 00 00"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Site web</label>
            <input
              {...register("website")}
              type="url"
              placeholder="https://acme.fr"
              className={inputClass}
            />
            {errors.website && (
              <p className={errorClass}>{errors.website.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>LinkedIn</label>
            <input
              {...register("linkedinUrl")}
              type="url"
              placeholder="https://www.linkedin.com/company/..."
              className={inputClass}
            />
            {errors.linkedinUrl && (
              <p className={errorClass}>{errors.linkedinUrl.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Instagram</label>
            <input
              {...register("instagramUrl")}
              type="url"
              placeholder="https://www.instagram.com/..."
              className={inputClass}
            />
            {errors.instagramUrl && (
              <p className={errorClass}>{errors.instagramUrl.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Section : Commercial */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/40">
          Pipeline commercial
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Statut</label>
            <select {...register("status")} className={selectClass}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
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
              placeholder="5000"
              className={inputClass}
            />
            {errors.budgetEstimated && (
              <p className={errorClass}>{errors.budgetEstimated.message}</p>
            )}
          </div>
          <div className="sm:col-span-3">
            <label className={labelClass}>Contrat signé le</label>
            <input
              {...register("contractSignedAt")}
              type="date"
              className={inputClass}
            />
            {errors.contractSignedAt && (
              <p className={errorClass}>{errors.contractSignedAt.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Section : Notes */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/40">
          Notes
        </h2>
        <textarea
          {...register("notes")}
          rows={4}
          placeholder="Contexte, informations utiles, historique de la relation..."
          className={`${inputClass} resize-none`}
        />
      </section>

      {/* Error + Submit */}
      {serverError && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-brand-1 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(109,15,242,0.4)] transition hover:bg-brand-4 disabled:opacity-50"
        >
          {isPending ? "Création…" : "Créer le client"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="rounded-xl border border-border/70 bg-surface px-5 py-2.5 text-sm font-medium text-foreground/60 transition hover:text-foreground disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
