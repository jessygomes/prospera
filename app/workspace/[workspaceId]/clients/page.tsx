import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/app/components/app-navbar";
import { prisma } from "@/lib/prisma";
import { signOutAction } from "@/app/dashboard/actions";
import { ClientActionCreateInline } from "./client-action-create-inline";
import { ClientActionStatusInline } from "./client-action-status-inline";

// ─── Types ──────────────────────────────────────────────────────────────────

type ClientStatus =
  | "PROSPECT"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "INACTIVE";

type ClientActionStatus = "TODO" | "DONE" | "CANCELED";
type ActionQuickFilter =
  | "ALL"
  | "TODO"
  | "DONE"
  | "CANCELED"
  | "OVERDUE"
  | "TODAY"
  | "THIS_WEEK";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ClientStatus, string> = {
  PROSPECT: "Prospect",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  PROPOSAL_SENT: "Proposition",
  NEGOTIATION: "Négociation",
  WON: "Gagné",
  LOST: "Perdu",
  INACTIVE: "Inactif",
};

const STATUS_CLASSES: Record<ClientStatus, string> = {
  PROSPECT: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  CONTACTED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  QUALIFIED: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  PROPOSAL_SENT: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  NEGOTIATION: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  WON: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  LOST: "bg-red-500/10 text-red-400 border-red-500/20",
  INACTIVE: "bg-foreground/5 text-foreground/40 border-border/40",
};

const PRIORITY_CLASSES = {
  HIGH: "bg-red-500/10 text-red-400",
  MEDIUM: "bg-amber-500/10 text-amber-400",
  LOW: "bg-sky-500/10 text-sky-400",
};

const PRIORITY_LABELS = { HIGH: "Urgent", MEDIUM: "Moyen", LOW: "Faible" };

const ACTION_STATUS_LABELS: Record<ClientActionStatus, string> = {
  TODO: "À faire",
  DONE: "Fait",
  CANCELED: "Annulé",
};

const ACTION_STATUS_CLASSES: Record<ClientActionStatus, string> = {
  TODO: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  DONE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  CANCELED: "bg-red-500/10 text-red-400 border-red-500/25",
};

const ACTION_QUICK_FILTER_LABELS: Record<ActionQuickFilter, string> = {
  ALL: "Toutes",
  TODO: "À faire",
  DONE: "Faites",
  CANCELED: "Annulées",
  OVERDUE: "En retard",
  TODAY: "Aujourd'hui",
  THIS_WEEK: "Cette semaine",
};

const ALL_ACTION_QUICK_FILTERS: ActionQuickFilter[] = [
  "ALL",
  "TODO",
  "DONE",
  "CANCELED",
  "OVERDUE",
  "TODAY",
  "THIS_WEEK",
];

const PAGE_SIZE = 9;

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ClientStatus[];
const ALL_ACTION_STATUSES = ["TODO", "DONE", "CANCELED"] as const;

function isValidStatus(value: string): value is ClientStatus {
  return ALL_STATUSES.includes(value as ClientStatus);
}

function isValidActionStatus(value: string): value is ClientActionStatus {
  return ALL_ACTION_STATUSES.includes(value as ClientActionStatus);
}

function isValidActionQuickFilter(value: string): value is ActionQuickFilter {
  return ALL_ACTION_QUICK_FILTERS.includes(value as ActionQuickFilter);
}

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// ─── Page ───────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    status?: string;
    preview?: string;
    view?: string;
    actionStatus?: string;
    actionQuickFilter?: string;
    page?: string;
  }>;
};

export default async function ClientsPage({ params, searchParams }: PageProps) {
  const { workspaceId } = await params;
  const {
    status: rawStatus,
    preview: previewId,
    view: rawView,
    actionStatus: rawActionStatus,
    actionQuickFilter: rawActionQuickFilter,
    page: rawPage,
  } = await searchParams;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { name: true } } },
  });
  if (!membership) redirect("/dashboard");

  const currentView = rawView === "actions" ? "actions" : "clients";

  const activeStatus: ClientStatus | null =
    rawStatus && isValidStatus(rawStatus) ? rawStatus : null;

  const activeActionStatus: ClientActionStatus | null =
    rawActionStatus && isValidActionStatus(rawActionStatus)
      ? rawActionStatus
      : null;

  const activeActionQuickFilter: ActionQuickFilter =
    rawActionQuickFilter && isValidActionQuickFilter(rawActionQuickFilter)
      ? rawActionQuickFilter
      : activeActionStatus
        ? activeActionStatus
        : currentView === "actions"
          ? "TODO"
          : "ALL";

  const requestedPage = Number.parseInt(rawPage ?? "1", 10);
  const safeRequestedPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const clientsWhere = {
    workspaceId,
    ...(activeStatus ? { status: activeStatus } : {}),
  };

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

  const actionWhere: {
    workspaceId: string;
    status?: ClientActionStatus;
    dueDate?: { lt?: Date; gte?: Date };
  } = {
    workspaceId,
  };

  if (activeActionQuickFilter === "TODO") {
    actionWhere.status = "TODO";
  }
  if (activeActionQuickFilter === "DONE") {
    actionWhere.status = "DONE";
  }
  if (activeActionQuickFilter === "CANCELED") {
    actionWhere.status = "CANCELED";
  }
  if (activeActionQuickFilter === "OVERDUE") {
    actionWhere.status = "TODO";
    actionWhere.dueDate = { lt: startToday };
  }
  if (activeActionQuickFilter === "TODAY") {
    actionWhere.status = "TODO";
    actionWhere.dueDate = { gte: startToday, lt: endToday };
  }
  if (activeActionQuickFilter === "THIS_WEEK") {
    actionWhere.status = "TODO";
    actionWhere.dueDate = { gte: startToday, lt: endThisWeek };
  }

  const clientsFilteredCount =
    currentView === "clients"
      ? await prisma.client.count({ where: clientsWhere })
      : 0;

  const actionsFilteredCount =
    currentView === "actions"
      ? await prisma.clientAction.count({ where: actionWhere })
      : 0;

  const totalClientPages = Math.max(
    1,
    Math.ceil(clientsFilteredCount / PAGE_SIZE),
  );
  const totalActionPages = Math.max(
    1,
    Math.ceil(actionsFilteredCount / PAGE_SIZE),
  );
  const currentClientPage = Math.min(safeRequestedPage, totalClientPages);
  const currentActionPage = Math.min(safeRequestedPage, totalActionPages);

  const clients =
    currentView === "clients"
      ? await prisma.client.findMany({
          where: clientsWhere,
          orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
          skip: (currentClientPage - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : [];

  const previewClient =
    currentView === "clients" && previewId
      ? await prisma.client.findFirst({
          where: { id: previewId, workspaceId },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            company: true,
            jobTitle: true,
            status: true,
            priority: true,
            source: true,
            budgetEstimated: true,
            nextFollowUpAt: true,
            notes: true,
          },
        })
      : null;

  const clientActions =
    currentView === "actions"
      ? await prisma.clientAction.findMany({
          where: actionWhere,
          include: {
            client: {
              select: {
                id: true,
                fullName: true,
                company: true,
              },
            },
            assignedTo: {
              select: { name: true, email: true },
            },
            createdBy: {
              select: { name: true, email: true },
            },
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          skip: (currentActionPage - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : [];

  const actionClients =
    currentView === "actions"
      ? await prisma.client.findMany({
          where: { workspaceId },
          select: {
            id: true,
            fullName: true,
            company: true,
          },
          orderBy: { fullName: "asc" },
        })
      : [];

  const actionAssignees =
    currentView === "actions"
      ? await prisma.workspaceMember.findMany({
          where: { workspaceId },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : [];

  // Counts per status for filter tabs
  const statusCounts = await prisma.client.groupBy({
    by: ["status"],
    where: { workspaceId },
    _count: { _all: true },
  });

  const actionCounts = await prisma.clientAction.groupBy({
    by: ["status"],
    where: { workspaceId },
    _count: { _all: true },
  });
  const countByStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all]),
  ) as Partial<Record<ClientStatus, number>>;
  const totalCount = statusCounts.reduce((acc, s) => acc + s._count._all, 0);
  const totalActionCount = actionCounts.reduce(
    (acc, s) => acc + s._count._all,
    0,
  );

  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  const closePreviewHref = activeStatus
    ? `/workspace/${workspaceId}/clients?view=clients&status=${activeStatus}&page=${currentClientPage}`
    : `/workspace/${workspaceId}/clients?view=clients&page=${currentClientPage}`;

  function previewHref(clientId: string) {
    if (activeStatus) {
      return `/workspace/${workspaceId}/clients?view=clients&status=${activeStatus}&preview=${clientId}&page=${currentClientPage}`;
    }
    return `/workspace/${workspaceId}/clients?view=clients&preview=${clientId}&page=${currentClientPage}`;
  }

  function clientPageHref(page: number) {
    if (activeStatus) {
      return `/workspace/${workspaceId}/clients?view=clients&status=${activeStatus}&page=${page}`;
    }
    return `/workspace/${workspaceId}/clients?view=clients&page=${page}`;
  }

  function actionPageHref(page: number) {
    const filterPart =
      activeActionQuickFilter !== "ALL"
        ? `&actionQuickFilter=${activeActionQuickFilter}`
        : "";
    return `/workspace/${workspaceId}/clients?view=actions${filterPart}&page=${page}`;
  }

  function actionQuickFilterHref(filter: ActionQuickFilter) {
    const filterPart = filter !== "ALL" ? `&actionQuickFilter=${filter}` : "";
    return `/workspace/${workspaceId}/clients?view=actions${filterPart}&page=1`;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}`}
        backLabel={membership.workspace.name}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-2/70">
              Clients
            </p>
            <h1 className="font-heading text-3xl font-bold text-foreground">
              Pipeline CRM
            </h1>
            <p className="mt-1 text-sm text-foreground/40">
              {currentView === "clients"
                ? `${totalCount} client${totalCount !== 1 ? "s" : ""} dans ce workspace`
                : `${totalActionCount} action${totalActionCount !== 1 ? "s" : ""} commerciales`}
            </p>
          </div>
          {currentView === "clients" ? (
            <Link
              href={`/workspace/${workspaceId}/clients/new`}
              className="shrink-0 rounded-xl bg-brand-1 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(109,15,242,0.4)] transition hover:bg-brand-4 hover:shadow-[0_4px_24px_-4px_rgba(109,15,242,0.55)]"
            >
              + Nouveau client
            </Link>
          ) : null}
        </div>

        <div className="mb-6 flex gap-2 border-b border-border/50 pb-3">
          <Link
            href={`/workspace/${workspaceId}/clients?view=clients`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              currentView === "clients"
                ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                : "border-border/60 bg-surface text-foreground/50 hover:text-foreground"
            }`}
          >
            Clients
            <span className="ml-1.5 opacity-60">{totalCount}</span>
          </Link>
          <Link
            href={`/workspace/${workspaceId}/clients?view=actions&actionQuickFilter=TODO&page=1`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              currentView === "actions"
                ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                : "border-border/60 bg-surface text-foreground/50 hover:text-foreground"
            }`}
          >
            Actions
            <span className="ml-1.5 opacity-60">{totalActionCount}</span>
          </Link>
        </div>

        {currentView === "clients" ? (
          <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
            <Link
              href={`/workspace/${workspaceId}/clients?view=clients&page=1`}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                !activeStatus
                  ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                  : "border-border/60 bg-surface text-foreground/50 hover:border-border hover:text-foreground"
              }`}
            >
              Tous
              <span className="ml-1.5 opacity-60">{totalCount}</span>
            </Link>
            {ALL_STATUSES.map((s) => {
              const count = countByStatus[s] ?? 0;
              const isActive = activeStatus === s;
              return (
                <Link
                  key={s}
                  href={`/workspace/${workspaceId}/clients?view=clients&status=${s}&page=1`}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                      : "border-border/60 bg-surface text-foreground/50 hover:border-border hover:text-foreground"
                  }`}
                >
                  {STATUS_LABELS[s]}
                  <span className="ml-1.5 opacity-60">{count}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
            {ALL_ACTION_QUICK_FILTERS.map((s) => {
              const isActive = activeActionQuickFilter === s;
              return (
                <Link
                  key={s}
                  href={actionQuickFilterHref(s)}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                      : "border-border/60 bg-surface text-foreground/50 hover:border-border hover:text-foreground"
                  }`}
                >
                  {ACTION_QUICK_FILTER_LABELS[s]}
                </Link>
              );
            })}
          </div>
        )}

        {currentView === "clients" &&
          (clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/40 py-20 text-center">
              <p className="text-2xl">🧑‍💼</p>
              <p className="mt-3 text-sm font-medium text-foreground/60">
                {activeStatus
                  ? `Aucun client avec le statut « ${STATUS_LABELS[activeStatus]} »`
                  : "Aucun client pour l'instant"}
              </p>
              <Link
                href={`/workspace/${workspaceId}/clients/new`}
                className="mt-5 rounded-lg bg-brand-1/10 px-4 py-2 text-sm font-semibold text-brand-2 transition hover:bg-brand-1/20"
              >
                Créer le premier client
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {clients.map((client) => {
                const initial = client.fullName[0].toUpperCase();
                const isOverdue =
                  client.nextFollowUpAt && client.nextFollowUpAt < new Date();

                return (
                  <div
                    key={client.id}
                    className="group flex items-center gap-4 rounded-xl border border-border/60 bg-surface p-4 transition hover:border-brand-1/30 hover:shadow-[0_4px_20px_-8px_rgba(109,15,242,0.15)]"
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-1 to-brand-2 text-sm font-bold text-white">
                      {initial}
                    </div>

                    {/* Main info */}
                    <Link
                      href={`/workspace/${workspaceId}/clients/${client.id}`}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {client.fullName}
                        </span>
                        {client.company && (
                          <span className="text-xs text-foreground/40">
                            · {client.company}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {client.email && (
                          <span className="text-xs text-foreground/40">
                            {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span className="text-xs text-foreground/40">
                            {client.phone}
                          </span>
                        )}
                      </div>
                    </Link>

                    {/* Badges */}
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {client.nextFollowUpAt && (
                        <span
                          className={`text-xs font-medium ${
                            isOverdue ? "text-red-400" : "text-foreground/40"
                          }`}
                        >
                          {isOverdue ? "⚠\uFE0F " : ""}
                          Relance {formatDate(client.nextFollowUpAt)}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${PRIORITY_CLASSES[client.priority]}`}
                      >
                        {PRIORITY_LABELS[client.priority]}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[client.status]}`}
                      >
                        {STATUS_LABELS[client.status]}
                      </span>
                      <Link
                        href={previewHref(client.id)}
                        className="rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:border-brand-1/30 hover:text-brand-2"
                      >
                        Aperçu
                      </Link>
                      <Link
                        href={`/workspace/${workspaceId}/clients/${client.id}`}
                        className="rounded-lg bg-brand-1/10 px-2.5 py-1 text-[11px] font-semibold text-brand-2 transition hover:bg-brand-1/20"
                      >
                        Ouvrir
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {currentView === "clients" && clientsFilteredCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
            <p className="text-xs text-foreground/45">
              Page {currentClientPage} sur {totalClientPages} ·{" "}
              {clientsFilteredCount} client
              {clientsFilteredCount > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={clientPageHref(Math.max(1, currentClientPage - 1))}
                className={`rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground ${
                  currentClientPage === 1
                    ? "pointer-events-none opacity-40"
                    : ""
                }`}
              >
                Précédent
              </Link>
              <Link
                href={clientPageHref(
                  Math.min(totalClientPages, currentClientPage + 1),
                )}
                className={`rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground ${
                  currentClientPage === totalClientPages
                    ? "pointer-events-none opacity-40"
                    : ""
                }`}
              >
                Suivant
              </Link>
            </div>
          </div>
        )}

        {currentView === "actions" &&
          (clientActions.length === 0 ? (
            <>
              {actionClients.length > 0 && (
                <ClientActionCreateInline
                  workspaceId={workspaceId}
                  clients={actionClients}
                  assignees={actionAssignees.map(({ user }) => ({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                  }))}
                />
              )}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/40 py-20 text-center">
                <p className="text-2xl">✅</p>
                <p className="mt-3 text-sm font-medium text-foreground/60">
                  {activeActionQuickFilter !== "ALL"
                    ? `Aucune action pour le filtre « ${ACTION_QUICK_FILTER_LABELS[activeActionQuickFilter]} »`
                    : "Aucune action commerciale pour l'instant"}
                </p>
              </div>
            </>
          ) : (
            <>
              {actionClients.length > 0 && (
                <ClientActionCreateInline
                  workspaceId={workspaceId}
                  clients={actionClients}
                  assignees={actionAssignees.map(({ user }) => ({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                  }))}
                />
              )}
              <div className="flex flex-col gap-2">
                {clientActions.map((action) => {
                  const isOverdue =
                    action.status === "TODO" &&
                    action.dueDate !== null &&
                    action.dueDate < new Date();

                  return (
                    <div
                      key={action.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-surface p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {action.title}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_STATUS_CLASSES[action.status]}`}
                          >
                            {ACTION_STATUS_LABELS[action.status]}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/45">
                          <span>
                            Client:{" "}
                            <Link
                              href={`/workspace/${workspaceId}/clients/${action.client.id}`}
                              className="font-semibold text-brand-2 hover:underline"
                            >
                              {action.client.fullName}
                            </Link>
                          </span>
                          <span>Type: {action.type}</span>
                          <span>
                            Assigné:{" "}
                            {action.assignedTo?.name ??
                              action.assignedTo?.email ??
                              "—"}
                          </span>
                          <span>
                            Créé par:{" "}
                            {action.createdBy?.name ??
                              action.createdBy?.email ??
                              "—"}
                          </span>
                        </div>

                        {action.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-foreground/55">
                            {action.description}
                          </p>
                        )}
                      </div>

                      <div className="text-right text-xs">
                        <p
                          className={
                            isOverdue
                              ? "font-semibold text-red-400"
                              : "text-foreground/45"
                          }
                        >
                          {action.dueDate
                            ? `Échéance ${formatDate(action.dueDate)}`
                            : "Sans échéance"}
                        </p>
                        <div className="mt-1 flex justify-end">
                          <ClientActionStatusInline
                            workspaceId={workspaceId}
                            taskId={action.id}
                            value={action.status}
                          />
                        </div>
                        <Link
                          href={`/workspace/${workspaceId}/clients/${action.client.id}`}
                          className="mt-2 inline-block rounded-lg bg-brand-1/10 px-2.5 py-1 font-semibold text-brand-2 transition hover:bg-brand-1/20"
                        >
                          Ouvrir client
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {actionsFilteredCount > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                  <p className="text-xs text-foreground/45">
                    Page {currentActionPage} sur {totalActionPages} ·{" "}
                    {actionsFilteredCount} action
                    {actionsFilteredCount > 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={actionPageHref(Math.max(1, currentActionPage - 1))}
                      className={`rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground ${
                        currentActionPage === 1
                          ? "pointer-events-none opacity-40"
                          : ""
                      }`}
                    >
                      Précédent
                    </Link>
                    <Link
                      href={actionPageHref(
                        Math.min(totalActionPages, currentActionPage + 1),
                      )}
                      className={`rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground ${
                        currentActionPage === totalActionPages
                          ? "pointer-events-none opacity-40"
                          : ""
                      }`}
                    >
                      Suivant
                    </Link>
                  </div>
                </div>
              )}
            </>
          ))}

        {previewClient && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-surface p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-2/70">
                    Aperçu client
                  </p>
                  <h2 className="mt-1 font-heading text-2xl font-bold text-foreground">
                    {previewClient.fullName}
                  </h2>
                  <p className="mt-1 text-xs text-foreground/40">
                    {previewClient.company ?? "Sans entreprise"}
                  </p>
                </div>
                <Link
                  href={closePreviewHref}
                  className="rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground/60 transition hover:text-foreground"
                >
                  Fermer
                </Link>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 text-sm text-foreground/70">
                <div className="rounded-xl border border-border/60 bg-surface-2/40 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Email
                  </p>
                  <p className="mt-1 truncate">{previewClient.email ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface-2/40 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Téléphone
                  </p>
                  <p className="mt-1 truncate">{previewClient.phone ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface-2/40 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Statut
                  </p>
                  <p className="mt-1">{STATUS_LABELS[previewClient.status]}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface-2/40 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Priorité
                  </p>
                  <p className="mt-1">
                    {PRIORITY_LABELS[previewClient.priority]}
                  </p>
                </div>
              </div>

              {previewClient.notes && (
                <div className="mb-5 rounded-xl border border-border/60 bg-surface-2/40 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Notes
                  </p>
                  <p className="mt-1.5 line-clamp-4 text-sm text-foreground/70">
                    {previewClient.notes}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-foreground/40">
                  Budget estimé:{" "}
                  {previewClient.budgetEstimated
                    ? `${previewClient.budgetEstimated.toLocaleString("fr-FR")} €`
                    : "—"}
                </p>
                <Link
                  href={`/workspace/${workspaceId}/clients/${previewClient.id}`}
                  className="rounded-xl bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-4"
                >
                  Voir fiche complète
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
