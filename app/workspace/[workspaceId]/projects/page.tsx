import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/components/shared/app-navbar";
import { prisma } from "@/lib/prisma";
import { signOutAction } from "@/app/dashboard/actions";
import { ProjectsFilterBar } from "./projects-filter-bar";

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────

const ALL_STATUSES: ProjectStatus[] = [
  "PROSPECT",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELED",
];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PROSPECT: "Prospect",
  IN_PROGRESS: "En cours",
  ON_HOLD: "En pause",
  COMPLETED: "Terminé",
  CANCELED: "Annulé",
};

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  PROSPECT: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  IN_PROGRESS: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  ON_HOLD: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELED: "bg-red-500/10 text-red-400 border-red-500/20",
};

const SORT_ORDERS: Record<
  SortOption,
  | { createdAt: "asc" | "desc" }
  | { deadline: "asc" | "desc" }
  | { name: "asc" | "desc" }
> = {
  created_desc: { createdAt: "desc" },
  created_asc: { createdAt: "asc" },
  deadline_asc: { deadline: "asc" },
  deadline_desc: { deadline: "desc" },
  name_asc: { name: "asc" },
};

function isValidStatus(value: string): value is ProjectStatus {
  return ALL_STATUSES.includes(value as ProjectStatus);
}

function isValidSort(value: string): value is SortOption {
  return [
    "created_desc",
    "created_asc",
    "deadline_asc",
    "deadline_desc",
    "name_asc",
  ].includes(value);
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number | null | undefined): string {
  if (!value) return null!;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Page ───────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    status?: string;
    search?: string;
    sort?: string;
  }>;
};

export default async function ProjectsPage({
  params,
  searchParams,
}: PageProps) {
  const { workspaceId } = await params;
  const {
    status: rawStatus,
    search: rawSearch,
    sort: rawSort,
  } = await searchParams;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { name: true } } },
  });
  if (!membership) redirect("/dashboard");

  const statusFilter = isValidStatus(rawStatus ?? "")
    ? (rawStatus as ProjectStatus)
    : null;
  const searchFilter = rawSearch?.trim() || null;
  const sortKey: SortOption = isValidSort(rawSort ?? "")
    ? (rawSort as SortOption)
    : "created_desc";

  const projects = await prisma.project.findMany({
    where: {
      workspaceId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(searchFilter
        ? {
            OR: [
              { name: { contains: searchFilter, mode: "insensitive" } },
              {
                client: {
                  fullName: { contains: searchFilter, mode: "insensitive" },
                },
              },
              {
                client: {
                  company: { contains: searchFilter, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      pricingType: true,
      budgetEstimated: true,
      budgetFinal: true,
      hourlyRate: true,
      websiteUrl: true,
      startDate: true,
      deadline: true,
      completedAt: true,
      createdAt: true,
      client: {
        select: {
          id: true,
          fullName: true,
          company: true,
        },
      },
      _count: {
        select: { documents: true, invoices: true },
      },
    },
    orderBy: SORT_ORDERS[sortKey],
    take: 200,
  });

  const now = new Date();
  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  // Counts par statut pour les badges dans le header
  const statusCounts = ALL_STATUSES.reduce(
    (acc, s) => {
      acc[s] = projects.filter((p) => p.status === s).length;
      return acc;
    },
    {} as Record<ProjectStatus, number>,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}`}
        backLabel={membership.workspace.name}
      />

      <main className="mx-auto w-full max-w-400 flex-1 px-4 py-8 sm:px-6 lg:px-20">
        {/* En-tête */}
        <div className="mb-8">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brand-2/70">
            {membership.workspace.name}
          </p>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            Projets
          </h1>
          <p className="mt-1 text-sm text-foreground/40">
            {projects.length} projet{projects.length !== 1 ? "s" : ""}
            {statusFilter
              ? ` · filtrés : ${STATUS_LABELS[statusFilter]}`
              : null}
            {searchFilter ? ` · recherche : « ${searchFilter} »` : null}
          </p>

          {/* Compteurs statuts */}
          <div className="mt-4 flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[s]}`}
              >
                {STATUS_LABELS[s]}
                <span className="opacity-70">{statusCounts[s]}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Filtres */}
        <ProjectsFilterBar
          workspaceId={workspaceId}
          currentSearch={searchFilter ?? ""}
          currentStatus={statusFilter ?? "ALL"}
          currentSort={sortKey}
        />

        {/* Liste */}
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 px-6 py-12 text-center">
            <p className="text-sm text-foreground/50">Aucun projet trouvé.</p>
            {(statusFilter || searchFilter) && (
              <Link
                href={`/workspace/${workspaceId}/projects`}
                className="mt-3 inline-block text-xs font-semibold text-brand-2/70 hover:text-brand-2"
              >
                Effacer les filtres
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const isOverdue =
                project.deadline &&
                project.deadline < now &&
                project.status !== "COMPLETED" &&
                project.status !== "CANCELED";

              const budget =
                formatMoney(project.budgetFinal) ??
                formatMoney(project.budgetEstimated);

              return (
                <div
                  key={project.id}
                  className="flex flex-col rounded-2xl border border-border/60 bg-surface p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.1)] transition hover:border-brand-1/20 sm:p-4"
                >
                  {/* Header carte */}
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-heading text-sm font-bold text-foreground">
                        {project.name}
                      </p>
                      <Link
                        href={`/workspace/${workspaceId}/clients/${project.client.id}`}
                        className="mt-0.5 truncate text-xs text-brand-2/70 transition hover:text-brand-2"
                      >
                        {project.client.fullName}
                        {project.client.company
                          ? ` · ${project.client.company}`
                          : ""}
                      </Link>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASSES[project.status]}`}
                    >
                      {STATUS_LABELS[project.status]}
                    </span>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="mb-3 line-clamp-2 text-xs text-foreground/50">
                      {project.description}
                    </p>
                  )}

                  {/* Métadonnées */}
                  <div className="mt-auto space-y-1.5 border-t border-border/40 pt-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground/45">
                      {budget && (
                        <span>
                          <span className="text-foreground/30">Budget </span>
                          {budget}
                        </span>
                      )}
                      {project.pricingType === "HOURLY" &&
                        project.hourlyRate && (
                          <span>
                            <span className="text-foreground/30">Taux </span>
                            {formatMoney(project.hourlyRate)}/h
                          </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground/45">
                      {project.startDate && (
                        <span>
                          <span className="text-foreground/30">Début </span>
                          {formatDate(project.startDate)}
                        </span>
                      )}
                      {project.deadline && (
                        <span
                          className={
                            isOverdue ? "font-semibold text-red-400" : ""
                          }
                        >
                          <span
                            className={
                              isOverdue
                                ? "text-red-400/60"
                                : "text-foreground/30"
                            }
                          >
                            Deadline{" "}
                          </span>
                          {formatDate(project.deadline)}
                          {isOverdue && " ⚠"}
                        </span>
                      )}
                      {project.completedAt && (
                        <span>
                          <span className="text-foreground/30">Terminé </span>
                          {formatDate(project.completedAt)}
                        </span>
                      )}
                    </div>

                    {(project._count.documents > 0 ||
                      project._count.invoices > 0) && (
                      <div className="flex gap-3 text-[11px] text-foreground/35">
                        {project._count.invoices > 0 && (
                          <span>
                            {project._count.invoices} facture
                            {project._count.invoices > 1 ? "s" : ""}
                          </span>
                        )}
                        {project._count.documents > 0 && (
                          <span>
                            {project._count.documents} doc
                            {project._count.documents > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Link
                      href={`/workspace/${workspaceId}/clients/${project.client.id}/projects/${project.id}`}
                      className="w-full rounded-lg border border-border/70 bg-surface-2/40 px-3 py-1.5 text-center text-[11px] font-semibold text-foreground/60 transition hover:border-brand-1/30 hover:text-foreground sm:flex-1"
                    >
                      Voir le projet →
                    </Link>
                    {project.websiteUrl && (
                      <a
                        href={project.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full rounded-lg border border-border/70 bg-surface-2/40 px-3 py-1.5 text-center text-[11px] font-semibold text-foreground/50 transition hover:border-brand-1/30 hover:text-brand-2 sm:w-auto"
                      >
                        Site ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
