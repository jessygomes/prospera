"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ProjectStatus =
  | "PROSPECT"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELED";

type SortOption =
  | "created_desc"
  | "created_asc"
  | "deadline_asc"
  | "deadline_desc"
  | "name_asc";

const STATUS_OPTIONS: { value: ProjectStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "ON_HOLD", label: "En pause" },
  { value: "COMPLETED", label: "Terminé" },
  { value: "CANCELED", label: "Annulé" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "created_desc", label: "Plus récents" },
  { value: "created_asc", label: "Plus anciens" },
  { value: "deadline_asc", label: "Deadline proche" },
  { value: "deadline_desc", label: "Deadline lointaine" },
  { value: "name_asc", label: "Nom A → Z" },
];

const STATUS_CLASSES: Record<ProjectStatus | "ALL", string> = {
  ALL: "border-brand-1/50 bg-brand-1/10 text-brand-2",
  PROSPECT: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  IN_PROGRESS: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  ON_HOLD: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  COMPLETED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  CANCELED: "border-red-500/40 bg-red-500/10 text-red-400",
};

const STATUS_INACTIVE =
  "border-border/60 bg-surface-2/30 text-foreground/55 hover:border-border hover:text-foreground";

type Props = {
  workspaceId: string;
  currentSearch: string;
  currentStatus: ProjectStatus | "ALL";
  currentSort: SortOption;
};

export function ProjectsFilterBar({
  workspaceId,
  currentSearch,
  currentStatus,
  currentSort,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [, startTransition] = useTransition();

  function buildUrl(overrides: {
    search?: string;
    status?: ProjectStatus | "ALL";
    sort?: SortOption;
  }) {
    const params = new URLSearchParams();
    const s = overrides.search ?? search;
    const st = overrides.status ?? currentStatus;
    const so = overrides.sort ?? currentSort;
    if (s) params.set("search", s);
    if (st !== "ALL") params.set("status", st);
    if (so !== "created_desc") params.set("sort", so);
    const qs = params.toString();
    return `/workspace/${workspaceId}/projects${qs ? `?${qs}` : ""}`;
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(buildUrl({ search }));
    });
  }

  function handleStatusClick(status: ProjectStatus | "ALL") {
    startTransition(() => {
      router.push(buildUrl({ status, search }));
    });
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    startTransition(() => {
      router.push(buildUrl({ sort: e.target.value as SortOption }));
    });
  }

  function handleClear() {
    setSearch("");
    startTransition(() => {
      router.push(`/workspace/${workspaceId}/projects`);
    });
  }

  const hasFilters =
    currentSearch || currentStatus !== "ALL" || currentSort !== "created_desc";

  return (
    <div className="mb-6 space-y-3">
      {/* Barre de recherche + tri */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-1 items-center gap-2 min-w-0"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par client, entreprise ou projet…"
            className="min-w-0 flex-1 rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-brand-1 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-4"
          >
            Rechercher
          </button>
        </form>

        <select
          value={currentSort}
          onChange={handleSortChange}
          className="shrink-0 rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filtres de statut */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_OPTIONS.map((opt) => {
          const active = currentStatus === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleStatusClick(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                active ? STATUS_CLASSES[opt.value] : STATUS_INACTIVE
              }`}
            >
              {opt.label}
            </button>
          );
        })}

        {hasFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-foreground/40 transition hover:border-red-500/30 hover:text-red-400"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
