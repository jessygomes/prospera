import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/app/components/app-navbar";
import { prisma } from "@/lib/prisma";

import { signOutAction } from "@/app/dashboard/actions";
import { ClientActionStatusInline } from "./clients/client-action-status-inline";
import { MemberActions } from "./member-actions";

type PageProps = {
  params: Promise<{ workspaceId: string }>;
};

type ProjectStatus =
  | "PROSPECT"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELED";

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PROSPECT: "Prospect",
  IN_PROGRESS: "En cours",
  ON_HOLD: "En pause",
  COMPLETED: "Termine",
  CANCELED: "Annule",
};

const PROJECT_STATUS_CLASSES: Record<ProjectStatus, string> = {
  PROSPECT: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  IN_PROGRESS: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  ON_HOLD: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELED: "bg-red-500/10 text-red-400 border-red-500/20",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "Sans echeance";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function WorkspacePage({ params }: PageProps) {
  const { workspaceId } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  // Vérification d'accès : l'utilisateur doit être membre du workspace
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: true },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  const workspace = membership.workspace;

  // Membres du workspace
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Stats rapides
  const [
    clientCount,
    projectCount,
    invoiceCount,
    actionCount,
    todoActions,
    activeProjects,
  ] = await Promise.all([
    prisma.client.count({ where: { workspaceId } }),
    prisma.project.count({ where: { workspaceId } }),
    prisma.invoice.count({ where: { workspaceId } }),
    prisma.clientAction.count({ where: { workspaceId } }),
    prisma.clientAction.findMany({
      where: { workspaceId, status: "TODO" },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            priority: true,
          },
        },
        assignedTo: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 80,
    }),
    prisma.project.findMany({
      where: {
        workspaceId,
        status: { in: ["PROSPECT", "IN_PROGRESS", "ON_HOLD"] },
      },
      select: {
        id: true,
        name: true,
        status: true,
        deadline: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            priority: true,
          },
        },
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
      take: 120,
    }),
  ]);

  const now = new Date();
  const urgentActions = [...todoActions]
    .sort((a, b) => {
      const aOverdue = a.dueDate ? a.dueDate.getTime() < now.getTime() : false;
      const bOverdue = b.dueDate ? b.dueDate.getTime() < now.getTime() : false;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

      const aHigh = a.client.priority === "HIGH";
      const bHigh = b.client.priority === "HIGH";
      if (aHigh !== bHigh) return aHigh ? -1 : 1;

      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .slice(0, 5);

  const projectStatusRank: Record<ProjectStatus, number> = {
    IN_PROGRESS: 0,
    ON_HOLD: 1,
    PROSPECT: 2,
    COMPLETED: 3,
    CANCELED: 4,
  };

  const urgentProjects = [...activeProjects]
    .sort((a, b) => {
      const aOverdue = a.deadline
        ? a.deadline.getTime() < now.getTime()
        : false;
      const bOverdue = b.deadline
        ? b.deadline.getTime() < now.getTime()
        : false;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

      const aHigh = a.client.priority === "HIGH";
      const bHigh = b.client.priority === "HIGH";
      if (aHigh !== bHigh) return aHigh ? -1 : 1;

      const statusDelta =
        projectStatusRank[a.status] - projectStatusRank[b.status];
      if (statusDelta !== 0) return statusDelta;

      if (a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;

      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .slice(0, 5);

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";

  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {/* En-tête */}
        <div className="mb-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-2/70">
            Workspace
          </p>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            {workspace.name}
          </h1>
          <p className="mt-1 font-mono text-xs text-foreground/30">
            {workspace.id}
          </p>
        </div>

        {/* Stats */}
        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-border/60 bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
              Membres
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {members.length}
            </p>
          </div>
          <Link
            href={`/workspace/${workspaceId}/clients`}
            className="group rounded-xl border border-border/60 bg-surface p-4 transition hover:border-brand-1/30 hover:bg-surface-2/50"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
              Clients
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {clientCount}
            </p>
            <p className="mt-2 text-xs text-brand-2/50 transition group-hover:text-brand-2">
              Voir →
            </p>
          </Link>
          <Link
            href={`/workspace/${workspaceId}/clients?view=actions&actionStatus=TODO`}
            className="group rounded-xl border border-border/60 bg-surface p-4 transition hover:border-brand-1/30 hover:bg-surface-2/50"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
              Actions
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {actionCount}
            </p>
            <p className="mt-2 text-xs text-brand-2/50 transition group-hover:text-brand-2">
              Voir →
            </p>
          </Link>
          <Link
            href={`/workspace/${workspaceId}/projects`}
            className="group rounded-xl border border-border/60 bg-surface p-4 transition hover:border-brand-1/30 hover:bg-surface-2/50"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
              Projets
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {projectCount}
            </p>
            <p className="mt-2 text-xs text-brand-2/50 transition group-hover:text-brand-2">
              Voir →
            </p>
          </Link>
          <div className="rounded-xl border border-border/60 bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
              Factures
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {invoiceCount}
            </p>
          </div>
        </div>

        {/* Actions urgentes */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
              Top 5 actions urgentes
            </h2>
            <Link
              href={`/workspace/${workspaceId}/clients?view=actions&actionStatus=TODO`}
              className="text-xs font-semibold text-brand-2/70 transition hover:text-brand-2"
            >
              Voir toutes les actions →
            </Link>
          </div>

          {urgentActions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-4 text-sm text-foreground/50">
              Aucune action urgente pour le moment.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-surface">
              {urgentActions.map((action) => {
                const isOverdue =
                  action.dueDate && action.dueDate.getTime() < now.getTime();
                const isHighPriorityClient = action.client.priority === "HIGH";

                return (
                  <div
                    key={action.id}
                    className="grid grid-cols-1 gap-2 border-b border-border/50 px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {action.title}
                        </p>
                        {isOverdue && (
                          <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                            Retard
                          </span>
                        )}
                        {isHighPriorityClient && (
                          <span className="inline-flex items-center rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                            Priorite haute
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground/45">
                        <span>Client: {action.client.fullName}</span>
                        <span>Echeance: {formatDate(action.dueDate)}</span>
                        <span>
                          Assigne:{" "}
                          {action.assignedTo?.name ??
                            action.assignedTo?.email ??
                            "Non assigne"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                      <ClientActionStatusInline
                        workspaceId={workspaceId}
                        taskId={action.id}
                        value={action.status}
                        compact
                      />
                      <Link
                        href={`/workspace/${workspaceId}/clients/${action.client.id}`}
                        className="inline-flex rounded-lg bg-brand-1/10 px-2.5 py-1 text-[11px] font-semibold text-brand-2 transition hover:bg-brand-1/20"
                      >
                        Ouvrir
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Projets urgents */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
              Top 5 projets urgents
            </h2>
            <Link
              href={`/workspace/${workspaceId}/projects`}
              className="text-xs font-semibold text-brand-2/70 transition hover:text-brand-2"
            >
              Voir tous les projets →
            </Link>
          </div>

          {urgentProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-4 text-sm text-foreground/50">
              Aucun projet urgent pour le moment.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-surface">
              {urgentProjects.map((project) => {
                const isOverdue =
                  project.deadline &&
                  project.deadline.getTime() < now.getTime();

                return (
                  <div
                    key={project.id}
                    className="grid grid-cols-1 gap-2 border-b border-border/50 px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {project.name}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PROJECT_STATUS_CLASSES[project.status]}`}
                        >
                          {PROJECT_STATUS_LABELS[project.status]}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                            Retard
                          </span>
                        )}
                        {project.client.priority === "HIGH" && (
                          <span className="inline-flex items-center rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                            Priorite haute
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground/45">
                        <span>Client: {project.client.fullName}</span>
                        <span>Deadline: {formatDate(project.deadline)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                      <Link
                        href={`/workspace/${workspaceId}/clients/${project.client.id}`}
                        className="inline-flex rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:border-brand-1/30 hover:text-foreground"
                      >
                        Client
                      </Link>
                      <Link
                        href={`/workspace/${workspaceId}/clients/${project.client.id}/projects/${project.id}`}
                        className="inline-flex rounded-lg bg-brand-1/10 px-2.5 py-1 text-[11px] font-semibold text-brand-2 transition hover:bg-brand-1/20"
                      >
                        Ouvrir
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Membres */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/40">
            Membres
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => {
              const name = member.user.name ?? member.user.email ?? "—";
              const initial = name[0].toUpperCase();
              const isOwner = member.role === "OWNER";
              const isMe = member.userId === userId;
              // Les contrôles ne s'affichent que pour les managers, et pas sur soi-même
              const showControls = isManager && !isMe;

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-1 to-brand-2 text-xs font-bold text-white">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {name}
                      {isMe ? (
                        <span className="ml-1.5 text-xs text-foreground/30">
                          (vous)
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-foreground/40">
                      {member.user.email}
                    </p>
                  </div>
                  {showControls ? (
                    <MemberActions
                      memberId={member.id}
                      workspaceId={workspaceId}
                      currentRole={member.role as "OWNER" | "ADMIN" | "MEMBER"}
                    />
                  ) : (
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                        isOwner
                          ? "bg-brand-1/15 text-brand-2"
                          : "bg-surface-2 text-foreground/50"
                      }`}
                    >
                      {member.role}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
