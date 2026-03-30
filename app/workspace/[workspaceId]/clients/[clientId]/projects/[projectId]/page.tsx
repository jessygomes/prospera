import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/app/components/app-navbar";
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

type PageProps = {
  params: Promise<{ workspaceId: string; clientId: string; projectId: string }>;
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const { workspaceId, clientId, projectId } = await params;

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

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
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

        {/* Formulaire d'édition */}
        <ProjectDetailForm
          project={project}
          workspaceId={workspaceId}
          clientId={clientId}
          isManager={isManager}
        />

        <div className="mt-5">
          <ProjectDocumentsSection
            workspaceId={workspaceId}
            clientId={clientId}
            projectId={project.id}
            documents={project.documents}
          />
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
