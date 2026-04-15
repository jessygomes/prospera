import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/components/shared/app-navbar";
import { prisma } from "@/lib/prisma";
import { signOutAction } from "@/app/dashboard/actions";
import { ClientActionCreateInline } from "./client-action-create-inline";
import { ClientActionRowExpandable } from "./client-action-row-expandable";
import { ProspectPipelineBoard } from "./prospect-pipeline-board";

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
type ClientPriority = "HIGH" | "MEDIUM" | "LOW";
type ClientsLayout = "board" | "list";
type ClientsScope = "ALL" | "MINE";
type ActionQuickFilter =
  | "ALL"
  | "TODO"
  | "DONE"
  | "CANCELED"
  | "OVERDUE"
  | "TODAY"
  | "THIS_WEEK";
type ClientHealthFilter = "ALL" | "WITHOUT_BUDGET" | "WITHOUT_PINNED_NOTE";
type ActionSummaryFilter = "ALL" | "MISSING";

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

const ALL_CLIENT_HEALTH_FILTERS: ClientHealthFilter[] = [
  "ALL",
  "WITHOUT_BUDGET",
  "WITHOUT_PINNED_NOTE",
];

const ALL_ACTION_SUMMARY_FILTERS: ActionSummaryFilter[] = ["ALL", "MISSING"];

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

function isValidClientHealthFilter(value: string): value is ClientHealthFilter {
  return ALL_CLIENT_HEALTH_FILTERS.includes(value as ClientHealthFilter);
}

function isValidActionSummaryFilter(
  value: string,
): value is ActionSummaryFilter {
  return ALL_ACTION_SUMMARY_FILTERS.includes(value as ActionSummaryFilter);
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
    clientsLayout?: string;
    clientsScope?: string;
    actionStatus?: string;
    actionQuickFilter?: string;
    actionSummary?: string;
    clientHealth?: string;
    page?: string;
  }>;
};

export default async function ClientsPage({ params, searchParams }: PageProps) {
  const { workspaceId } = await params;
  const {
    status: rawStatus,
    preview: previewId,
    view: rawView,
    clientsLayout: rawClientsLayout,
    clientsScope: rawClientsScope,
    actionStatus: rawActionStatus,
    actionQuickFilter: rawActionQuickFilter,
    actionSummary: rawActionSummary,
    clientHealth: rawClientHealth,
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
  const currentClientsLayout: ClientsLayout =
    rawClientsLayout === "board" ? "board" : "list";
  const currentClientsScope: ClientsScope =
    rawClientsScope === "MINE" ? "MINE" : "ALL";

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
        : "ALL";

  const activeClientHealthFilter: ClientHealthFilter =
    rawClientHealth && isValidClientHealthFilter(rawClientHealth)
      ? rawClientHealth
      : "ALL";

  const activeActionSummaryFilter: ActionSummaryFilter =
    rawActionSummary && isValidActionSummaryFilter(rawActionSummary)
      ? rawActionSummary
      : "ALL";

  const requestedPage = Number.parseInt(rawPage ?? "1", 10);
  const safeRequestedPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const mineClientIds =
    currentView === "clients" && currentClientsScope === "MINE"
      ? await prisma.clientAction.findMany({
          where: {
            workspaceId,
            assignedToId: userId,
            status: "TODO",
          },
          select: { clientId: true },
          distinct: ["clientId"],
        })
      : [];

  const mineClientIdValues = mineClientIds.map((entry) => entry.clientId);

  const clientsWhere = {
    workspaceId,
    ...(currentClientsScope === "MINE"
      ? { id: { in: mineClientIdValues } }
      : {}),
    ...(currentClientsLayout === "list" && activeStatus
      ? { status: activeStatus }
      : {}),
    ...(activeClientHealthFilter === "WITHOUT_BUDGET"
      ? { budgetEstimated: null }
      : {}),
    ...(activeClientHealthFilter === "WITHOUT_PINNED_NOTE"
      ? {
          clientNotes: {
            none: { isPinned: true },
          },
        }
      : {}),
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
    OR?: Array<{ interactionSummary: null } | { interactionSummary: "" }>;
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

  if (activeActionSummaryFilter === "MISSING") {
    actionWhere.OR = [{ interactionSummary: null }, { interactionSummary: "" }];
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
      ? currentClientsLayout === "list"
        ? await prisma.client.findMany({
            where: clientsWhere,
            orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
            skip: (currentClientPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          })
        : await prisma.client.findMany({
            where: {
              workspaceId,
              ...(currentClientsScope === "MINE"
                ? { id: { in: mineClientIdValues } }
                : {}),
            },
            orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
            take: 200,
          })
      : [];

  const todoActionCountsByClient =
    currentView === "clients" && clients.length > 0
      ? await prisma.clientAction.groupBy({
          by: ["clientId"],
          where: {
            workspaceId,
            status: "TODO",
            clientId: { in: clients.map((client) => client.id) },
          },
          _count: { _all: true },
        })
      : [];

  const todoCountByClientId = Object.fromEntries(
    todoActionCountsByClient.map((entry) => [
      entry.clientId,
      entry._count._all,
    ]),
  ) as Record<string, number>;

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
            commercialObjective: true,
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
          orderBy: [{ createdAt: "desc" }],
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

  const actionAssigneeOptions = actionAssignees.map(({ user }) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  }));

  const displayedActionClientIds =
    currentView === "actions"
      ? Array.from(new Set(clientActions.map((action) => action.client.id)))
      : [];

  const chainableActionsForVisibleClients =
    currentView === "actions" && displayedActionClientIds.length > 0
      ? await prisma.clientAction.findMany({
          where: {
            workspaceId,
            clientId: { in: displayedActionClientIds },
          },
          select: {
            id: true,
            title: true,
            clientId: true,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : [];

  const chainableActionsByClientId = chainableActionsForVisibleClients.reduce<
    Record<string, Array<{ id: string; title: string }>>
  >((acc, entry) => {
    if (!acc[entry.clientId]) {
      acc[entry.clientId] = [];
    }
    acc[entry.clientId].push({ id: entry.id, title: entry.title });
    return acc;
  }, {});

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

  const pipelineStatuses: ClientStatus[] = [
    "PROSPECT",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
  ];
  const activePipelineCount = pipelineStatuses.reduce(
    (sum, status) => sum + (countByStatus[status] ?? 0),
    0,
  );

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [
    followUpTodayCount,
    overdueFollowUpCount,
    wonLast30Days,
    lostLast30Days,
  ] = await Promise.all([
    prisma.client.count({
      where: {
        workspaceId,
        status: { in: pipelineStatuses },
        nextFollowUpAt: { gte: startToday, lt: endToday },
      },
    }),
    prisma.client.count({
      where: {
        workspaceId,
        status: { in: pipelineStatuses },
        nextFollowUpAt: { lt: startToday },
      },
    }),
    prisma.clientStatusHistory.count({
      where: {
        workspaceId,
        toStatus: "WON",
        changedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.clientStatusHistory.count({
      where: {
        workspaceId,
        toStatus: "LOST",
        changedAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const pipelineValueAgg = await prisma.client.aggregate({
    where: {
      workspaceId,
      status: { in: pipelineStatuses },
    },
    _sum: { budgetEstimated: true },
  });

  const pipelineValue = pipelineValueAgg._sum.budgetEstimated ?? 0;

  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  const closePreviewHref = activeStatus
    ? `/workspace/${workspaceId}/clients?view=clients&clientsLayout=${currentClientsLayout}&clientsScope=${currentClientsScope}&status=${activeStatus}&page=${currentClientPage}`
    : `/workspace/${workspaceId}/clients?view=clients&clientsLayout=${currentClientsLayout}&clientsScope=${currentClientsScope}&page=${currentClientPage}`;

  function previewHref(clientId: string) {
    if (activeStatus) {
      return `/workspace/${workspaceId}/clients?view=clients&clientsLayout=${currentClientsLayout}&clientsScope=${currentClientsScope}&status=${activeStatus}&preview=${clientId}&page=${currentClientPage}`;
    }
    return `/workspace/${workspaceId}/clients?view=clients&clientsLayout=${currentClientsLayout}&clientsScope=${currentClientsScope}&preview=${clientId}&page=${currentClientPage}`;
  }

  function clientPageHref(page: number) {
    const layoutPart = `&clientsLayout=${currentClientsLayout}`;
    const scopePart = `&clientsScope=${currentClientsScope}`;
    if (activeStatus) {
      return `/workspace/${workspaceId}/clients?view=clients${layoutPart}${scopePart}&status=${activeStatus}&page=${page}`;
    }
    return `/workspace/${workspaceId}/clients?view=clients${layoutPart}${scopePart}&page=${page}`;
  }

  function clientsLayoutHref(layout: ClientsLayout) {
    const statusPart = activeStatus ? `&status=${activeStatus}` : "";
    return `/workspace/${workspaceId}/clients?view=clients&clientsLayout=${layout}&clientsScope=${currentClientsScope}${statusPart}&page=1`;
  }

  function clientsScopeHref(scope: ClientsScope) {
    const statusPart = activeStatus ? `&status=${activeStatus}` : "";
    return `/workspace/${workspaceId}/clients?view=clients&clientsLayout=${currentClientsLayout}&clientsScope=${scope}${statusPart}&page=1`;
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

  const activeAutoFilterBadges: string[] = [];
  if (currentView === "clients" && activeClientHealthFilter !== "ALL") {
    activeAutoFilterBadges.push(
      activeClientHealthFilter === "WITHOUT_BUDGET"
        ? "Filtre auto: clients sans budget"
        : "Filtre auto: clients sans note épinglée",
    );
  }
  if (currentView === "actions" && activeActionSummaryFilter === "MISSING") {
    activeAutoFilterBadges.push("Filtre auto: actions faites sans résumé");
  }

  const clearAutoFiltersHref =
    currentView === "clients"
      ? `/workspace/${workspaceId}/clients?view=clients&clientsLayout=${currentClientsLayout}&clientsScope=${currentClientsScope}${activeStatus ? `&status=${activeStatus}` : ""}&page=1`
      : `/workspace/${workspaceId}/clients?view=actions${activeActionQuickFilter !== "ALL" ? `&actionQuickFilter=${activeActionQuickFilter}` : ""}&page=1`;

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}`}
        backLabel={membership.workspace.name}
      />

      <main className="mx-auto w-full max-w-375 flex-1 px-4 py-10 sm:px-6 lg:px-20">
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
        </div>

        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-border/60 bg-surface-2/55 p-1 shadow-[0_8px_24px_-20px_rgba(0,0,0,0.35)]">
            <Link
              href={`/workspace/${workspaceId}/clients?view=clients`}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold tracking-wide transition ${
                currentView === "clients"
                  ? "bg-brand-1 text-white shadow-[0_8px_20px_-12px_rgba(109,15,242,0.7)]"
                  : "text-foreground/55 hover:bg-surface hover:text-foreground"
              }`}
            >
              Clients
              <span className="ml-1.5 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold text-current/85">
                {totalCount}
              </span>
            </Link>
            <Link
              href={`/workspace/${workspaceId}/clients?view=actions&actionQuickFilter=TODO&page=1`}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold tracking-wide transition ${
                currentView === "actions"
                  ? "bg-brand-1 text-white shadow-[0_8px_20px_-12px_rgba(109,15,242,0.7)]"
                  : "text-foreground/55 hover:bg-surface hover:text-foreground"
              }`}
            >
              Actions
              <span className="ml-1.5 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold text-current/85">
                {totalActionCount}
              </span>
            </Link>
          </div>

          {currentView === "actions" && actionClients.length > 0 ? (
            <ClientActionCreateInline
              compact
              workspaceId={workspaceId}
              clients={actionClients}
              assignees={actionAssigneeOptions}
            />
          ) : currentView === "clients" ? (
            <Link
              href={`/workspace/${workspaceId}/clients/new`}
              className="shrink-0 rounded-xl bg-brand-1 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(109,15,242,0.4)] transition hover:bg-brand-4 hover:shadow-[0_4px_24px_-4px_rgba(109,15,242,0.55)]"
            >
              + Nouveau client
            </Link>
          ) : null}
        </div>

        {activeAutoFilterBadges.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {activeAutoFilterBadges.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-brand-1/35 bg-brand-1/10 px-2.5 py-1 text-[11px] font-semibold text-brand-2"
              >
                {label}
              </span>
            ))}
            <Link
              href={clearAutoFiltersHref}
              className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:text-foreground"
            >
              Retirer filtres auto
            </Link>
          </div>
        )}

        {currentView === "clients" && (
          <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            <div className="rounded-xl border border-border/60 bg-surface px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                Prospects actifs
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {activePipelineCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                Relances aujourd&apos;hui
              </p>
              <p className="mt-1 text-xl font-bold text-amber-300">
                {followUpTodayCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                Relances en retard
              </p>
              <p className="mt-1 text-xl font-bold text-red-400">
                {overdueFollowUpCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                Gagnés (30j)
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-300">
                {wonLast30Days}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                Valeur pipeline
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {pipelineValue.toLocaleString("fr-FR")} €
              </p>
              <p className="mt-0.5 text-[11px] text-foreground/45">
                Perdus (30j): {lostLast30Days}
              </p>
            </div>
          </div>
        )}

        {currentView === "clients" ? (
          <div className="mb-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex gap-2">
                <Link
                  href={clientsLayoutHref("board")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    currentClientsLayout === "board"
                      ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                      : "border-border/60 bg-surface text-foreground/50 hover:text-foreground"
                  }`}
                >
                  Pipeline prospects
                </Link>
                <Link
                  href={clientsLayoutHref("list")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    currentClientsLayout === "list"
                      ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                      : "border-border/60 bg-surface text-foreground/50 hover:text-foreground"
                  }`}
                >
                  Liste
                </Link>
              </div>

              {currentClientsLayout === "list" && (
                <div className="w-full rounded-xl border border-border/60 bg-surface/35 px-2.5 py-2 md:min-w-0 md:flex-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5">
                    <span className="shrink-0 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                      Portée
                    </span>
                    <Link
                      href={clientsScopeHref("ALL")}
                      className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                        currentClientsScope === "ALL"
                          ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                          : "border-border/60 bg-surface text-foreground/50 hover:text-foreground"
                      }`}
                    >
                      Tous
                    </Link>
                    <Link
                      href={clientsScopeHref("MINE")}
                      className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                        currentClientsScope === "MINE"
                          ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                          : "border-border/60 bg-surface text-foreground/50 hover:text-foreground"
                      }`}
                    >
                      Mes prospects (actions à faire)
                    </Link>

                    <span className="mx-1 h-4 w-px shrink-0 bg-border/60" />

                    <span className="shrink-0 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                      Statut
                    </span>
                    <Link
                      href={`/workspace/${workspaceId}/clients?view=clients&clientsLayout=${currentClientsLayout}&clientsScope=${currentClientsScope}&page=1`}
                      className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                        !activeStatus
                          ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                          : "border-border/60 bg-surface text-foreground/50 hover:border-border hover:text-foreground"
                      }`}
                    >
                      Tous
                      <span className="ml-1 opacity-60">{totalCount}</span>
                    </Link>
                    {ALL_STATUSES.map((s) => {
                      const count = countByStatus[s] ?? 0;
                      const isActive = activeStatus === s;
                      return (
                        <Link
                          key={s}
                          href={`/workspace/${workspaceId}/clients?view=clients&clientsLayout=${currentClientsLayout}&clientsScope=${currentClientsScope}&status=${s}&page=1`}
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                            isActive
                              ? "border-brand-1/30 bg-brand-1/10 text-brand-2"
                              : "border-border/60 bg-surface text-foreground/50 hover:border-border hover:text-foreground"
                          }`}
                        >
                          {STATUS_LABELS[s]}
                          <span className="ml-1 opacity-60">{count}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-border/60 bg-surface/35 px-2.5 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5">
              <span className="shrink-0 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Filtre
              </span>
              {ALL_ACTION_QUICK_FILTERS.map((s) => {
                const isActive = activeActionQuickFilter === s;
                return (
                  <Link
                    key={s}
                    href={actionQuickFilterHref(s)}
                    className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
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
          ) : currentClientsLayout === "board" ? (
            <ProspectPipelineBoard
              workspaceId={workspaceId}
              activeStatus={activeStatus}
              clients={clients.map((client) => ({
                id: client.id,
                fullName: client.fullName,
                company: client.company,
                status: client.status,
                priority: client.priority as ClientPriority,
                budgetEstimated: client.budgetEstimated,
                nextFollowUpAtIso: client.nextFollowUpAt
                  ? client.nextFollowUpAt.toISOString()
                  : null,
                todoActionsCount: todoCountByClientId[client.id] ?? 0,
              }))}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {clients.map((client) => {
                const initial = client.fullName[0].toUpperCase();
                const isOverdue =
                  client.nextFollowUpAt && client.nextFollowUpAt < new Date();

                return (
                  <div
                    key={client.id}
                    className="group flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-surface p-3 transition hover:border-brand-1/30 hover:shadow-[0_4px_20px_-8px_rgba(109,15,242,0.15)] sm:flex-row sm:items-center sm:gap-4 sm:p-4"
                  >
                    <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-0 sm:flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-1 to-brand-2 text-xs font-bold text-white sm:h-10 sm:w-10 sm:text-sm">
                        {initial}
                      </div>

                      <Link
                        href={`/workspace/${workspaceId}/clients/${client.id}`}
                        className="min-w-0 flex-1"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {client.fullName}
                          </span>
                          {client.company && (
                            <span className="text-xs text-foreground/40">
                              · {client.company}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-x-3">
                          {client.email && (
                            <span className="truncate text-[11px] text-foreground/40 sm:text-xs">
                              {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="text-[11px] text-foreground/40 sm:text-xs">
                              {client.phone}
                            </span>
                          )}
                        </div>
                      </Link>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
                      {client.nextFollowUpAt && (
                        <span
                          className={`text-[11px] font-medium sm:text-xs ${
                            isOverdue ? "text-red-400" : "text-foreground/40"
                          }`}
                        >
                          {isOverdue ? "⚠\uFE0F " : ""}
                          Relance {formatDate(client.nextFollowUpAt)}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:text-[11px] ${PRIORITY_CLASSES[client.priority]}`}
                      >
                        {PRIORITY_LABELS[client.priority]}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:text-[11px] ${STATUS_CLASSES[client.status]}`}
                      >
                        {STATUS_LABELS[client.status]}
                      </span>
                      <Link
                        href={previewHref(client.id)}
                        className="hidden rounded-lg border border-border/70 bg-surface-2 px-2 py-1 text-[10px] font-semibold text-foreground/60 transition hover:border-brand-1/30 hover:text-brand-2 sm:inline-flex sm:px-2.5 sm:text-[11px]"
                      >
                        Aperçu
                      </Link>
                      <Link
                        href={`/workspace/${workspaceId}/clients/${client.id}`}
                        className="rounded-lg bg-brand-1/10 px-2 py-1 text-[10px] font-semibold text-brand-2 transition hover:bg-brand-1/20 sm:px-2.5 sm:text-[11px]"
                      >
                        Ouvrir
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {currentView === "clients" &&
          currentClientsLayout === "list" &&
          clientsFilteredCount > 0 && (
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
              <>
                <div className="flex flex-col gap-2">
                  {clientActions.map((action) => (
                    <ClientActionRowExpandable
                      key={action.id}
                      workspaceId={workspaceId}
                      action={{
                        ...action,
                        clientId: action.client.id,
                      }}
                      assignees={actionAssigneeOptions}
                      chainableActions={
                        chainableActionsByClientId[action.client.id] ?? []
                      }
                    />
                  ))}
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
                        href={actionPageHref(
                          Math.max(1, currentActionPage - 1),
                        )}
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
            </>
          ))}

        {previewClient && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-3 sm:p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-surface p-3 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.5)] sm:p-4 lg:p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-2/70">
                    Aperçu client
                  </p>
                  <h2 className="mt-1 font-heading text-lg font-bold text-foreground sm:text-2xl">
                    {previewClient.fullName}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-foreground/40 sm:text-xs">
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

              <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-foreground/70 lg:grid-cols-5 sm:mb-4 sm:text-sm">
                <div className="rounded-xl border border-border/60 bg-surface-2/40 p-2.5 sm:p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Email
                  </p>
                  <p className="mt-1 wrap-break-word leading-5 sm:truncate">
                    {previewClient.email ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface-2/40 p-2.5 sm:p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Téléphone
                  </p>
                  <p className="mt-1 wrap-break-word leading-5">
                    {previewClient.phone ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface-2/40 p-2.5 sm:p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Statut
                  </p>
                  <p className="mt-1">{STATUS_LABELS[previewClient.status]}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface-2/40 p-2.5 sm:p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Priorité
                  </p>
                  <p className="mt-1">
                    {PRIORITY_LABELS[previewClient.priority]}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-border/60 bg-surface-2/40 p-2.5 lg:col-span-1 sm:p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Budget estimé
                  </p>
                  <p className="mt-1 leading-5">
                    {previewClient.budgetEstimated
                      ? `${previewClient.budgetEstimated.toLocaleString("fr-FR")} €`
                      : "—"}
                  </p>
                </div>
              </div>

              {previewClient.commercialObjective && (
                <div className="mb-3 rounded-xl border border-border/60 bg-surface-2/40 p-2.5 sm:mb-4 sm:p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Objectif commercial
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground/70 sm:text-sm sm:leading-6">
                    {previewClient.commercialObjective}
                  </p>
                </div>
              )}

              {previewClient.notes && (
                <div className="mb-3 rounded-xl border border-border/60 bg-surface-2/40 p-2.5 sm:mb-4 sm:p-3">
                  <p className="text-[11px] uppercase tracking-wider text-foreground/40">
                    Notes
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground/70 sm:text-sm sm:leading-6">
                    {previewClient.notes}
                  </p>
                </div>
              )}

              <div className="border-t border-border/50 pt-2.5">
                <Link
                  href={`/workspace/${workspaceId}/clients/${previewClient.id}`}
                  className="block w-full rounded-xl bg-brand-1 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-4"
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
