import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/components/shared/app-navbar";
import { signOutAction } from "@/app/dashboard/actions";
import { prisma } from "@/lib/prisma";
import { ProjectDetailForm } from "./project-detail-form";
import { ProjectDocumentsSection } from "./project-documents-section";

type ProjectStatus =
  | "PROSPECT"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELED";

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

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

const PRICING_LABELS = {
  FIXED: "Forfait",
  HOURLY: "Horaire",
} as const;

type PageProps = {
  params: Promise<{ workspaceId: string; clientId: string; projectId: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { workspaceId, clientId, projectId } = await params;
  const { edit } = await searchParams;
  const isEditMode = edit === "1";

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { name: true } } },
  });
  if (!membership) redirect("/dashboard");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, clientId },
    select: {
      id: true,
      name: true,
      description: true,
      websiteUrl: true,
      status: true,
      pricingType: true,
      budgetEstimated: true,
      budgetFinal: true,
      hourlyRate: true,
      startDate: true,
      deadline: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, fullName: true } },
      statusHistory: {
        orderBy: { changedAt: "desc" },
        take: 20,
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          changedAt: true,
          changedBy: { select: { name: true, email: true } },
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          name: true,
          url: true,
          category: true,
          mimeType: true,
          size: true,
          createdAt: true,
          uploadedBy: { select: { name: true, email: true } },
        },
      },
      invoices: {
        orderBy: { issueDate: "desc" },
        take: 40,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          issueDate: true,
          total: true,
        },
      },
      _count: { select: { invoices: true, documents: true } },
    },
  });

  if (!project) {
    redirect(`/workspace/${workspaceId}/clients/${clientId}?view=projects`);
  }

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}/clients/${clientId}?view=projects`}
        backLabel={project.client.fullName}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-20">
        {/* Header */}
        <div className="mb-6 rounded-2xl border border-border/60 bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brand-2/70">
                Détail du projet
              </p>
              <h1 className="truncate font-heading text-2xl font-bold text-foreground sm:text-3xl">
                {project.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[project.status as ProjectStatus]}`}
                >
                  {STATUS_LABELS[project.status as ProjectStatus]}
                </span>
                <Link
                  href={`/workspace/${workspaceId}/clients/${clientId}`}
                  className="inline-flex items-center rounded-full border border-border/60 bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-foreground/60 transition hover:text-foreground"
                >
                  {project.client.fullName}
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditMode ? (
                <Link
                  href={`/workspace/${workspaceId}/clients/${clientId}/projects/${project.id}`}
                  className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
                >
                  Annuler
                </Link>
              ) : (
                <Link
                  href={`/workspace/${workspaceId}/clients/${clientId}/projects/${project.id}?edit=1`}
                  className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4"
                >
                  Modifier
                </Link>
              )}
              {project.websiteUrl && (
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:border-brand-1/30 hover:text-foreground"
                >
                  Ouvrir le site
                </a>
              )}
              {project._count.invoices > 0 && (
                <span className="rounded-full border border-border/60 bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-foreground/50">
                  {project._count.invoices} facture
                  {project._count.invoices > 1 ? "s" : ""}
                </span>
              )}
              {project._count.documents > 0 && (
                <span className="rounded-full border border-border/60 bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-foreground/50">
                  {project._count.documents} document
                  {project._count.documents > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {isEditMode ? (
          <ProjectDetailForm
            project={project}
            workspaceId={workspaceId}
            clientId={clientId}
            isManager={isManager}
          />
        ) : (
          <section className="rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
            <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
              Informations du projet
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Nom du projet
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {project.name}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Type de tarification
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {PRICING_LABELS[project.pricingType]}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Budget estime
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {project.budgetEstimated != null
                    ? formatCurrency(project.budgetEstimated)
                    : "—"}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Budget final
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {project.budgetFinal != null
                    ? formatCurrency(project.budgetFinal)
                    : "—"}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Taux horaire
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {project.hourlyRate != null
                    ? `${formatCurrency(project.hourlyRate)} / h`
                    : "—"}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Lien du projet
                </p>
                {project.websiteUrl ? (
                  <a
                    href={project.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-sm font-semibold text-brand-2/75 hover:text-brand-2"
                  >
                    {project.websiteUrl}
                  </a>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    —
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Date de debut
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatDate(project.startDate)}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Deadline
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatDate(project.deadline)}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2 md:col-span-2">
                <p className="text-[11px] uppercase tracking-wider text-foreground/45">
                  Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-foreground">
                  {project.description || "—"}
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="mt-5">
          <ProjectDocumentsSection
            workspaceId={workspaceId}
            clientId={clientId}
            projectId={project.id}
            documents={project.documents}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
          <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
            Devis et factures lies
          </h2>
          {project.invoices.length === 0 ? (
            <p className="text-sm text-foreground/50">
              Aucun devis ou facture lie a ce projet pour le moment.
            </p>
          ) : (
            <ul className="space-y-2">
              {project.invoices.map((invoice) => {
                const isQuote = invoice.invoiceNumber.startsWith("DEV-");
                return (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-surface-2/20 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="text-xs text-foreground/45">
                        {isQuote ? "Devis" : "Facture"} · {invoice.status} ·{" "}
                        {formatDate(invoice.issueDate)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground/80">
                      {formatCurrency(Number(invoice.total))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Historique des statuts */}
        {project.statusHistory.length > 0 && (
          <div className="mt-5 rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
            <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
              Historique des statuts
            </h2>
            <ol className="space-y-2">
              {project.statusHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-border/40 bg-surface-2/20 px-3 py-2"
                >
                  <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
                    {entry.fromStatus && (
                      <>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[entry.fromStatus as ProjectStatus]}`}
                        >
                          {STATUS_LABELS[entry.fromStatus as ProjectStatus]}
                        </span>
                        <span className="text-foreground/30">→</span>
                      </>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[entry.toStatus as ProjectStatus]}`}
                    >
                      {STATUS_LABELS[entry.toStatus as ProjectStatus]}
                    </span>
                    {entry.note && (
                      <span className="text-foreground/50">
                        &mdash; {entry.note}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-foreground/40">
                    <p>{formatDate(entry.changedAt)}</p>
                    {entry.changedBy && (
                      <p>{entry.changedBy.name ?? entry.changedBy.email}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
