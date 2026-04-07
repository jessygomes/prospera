import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/components/shared/app-navbar";
import { signOutAction } from "@/app/dashboard/actions";
import { prisma } from "@/lib/prisma";
import { buildClientAdvice } from "@/lib/ai/client-advice";
import { ClientDetailForm } from "./client-detail-form";
import { ClientActionsSection } from "./client-actions-section";
import { ClientProjectsSection } from "./client-projects-section";
import { ClientDocumentsSection } from "./client-documents-section";
import { ClientNotesSection } from "./client-notes-section";
import { ClientAiAdvicePanel } from "./client-ai-advice-panel";

type ClientStatus =
  | "PROSPECT"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "INACTIVE";

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

const PRIORITY_LABELS = { HIGH: "Urgent", MEDIUM: "Moyen", LOW: "Faible" };
type ClientPriority = keyof typeof PRIORITY_LABELS;
type Assignee = { id: string; name: string | null; email: string | null };
type StatusHistoryEntry = {
  id: string;
  fromStatus: ClientStatus | null;
  toStatus: ClientStatus;
  note: string | null;
  changedAt: Date;
  changedBy: { name: string | null; email: string | null } | null;
};

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(value: number | null | undefined): string {
  if (!value) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

type AdviceConfidenceView = {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
  missingSignals: string[];
};

type GroundingView = {
  grounded: boolean;
  evidenceInteractionIndexes: number[];
  evidenceCount: number;
  interactionsWindow: number;
};

function buildFallbackConfidence(params: {
  interactionsAnalyzed: number;
  interactionsWithSummary: number;
  interactionsStructured: number;
  hasClientNotes: boolean;
  hasBudget: boolean;
  hasCompanyOrRole: boolean;
  hasCachedInsights: boolean;
}): AdviceConfidenceView {
  let score = 35;
  const reasons: string[] = [];
  const missingSignals: string[] = [];

  if (params.interactionsAnalyzed >= 5) {
    score += 15;
    reasons.push("historique interactions suffisant");
  } else if (params.interactionsAnalyzed >= 2) {
    score += 8;
    reasons.push("historique interactions partiel");
  } else {
    missingSignals.push("historique interactions insuffisant");
  }

  if (params.interactionsAnalyzed > 0) {
    const summaryRatio =
      params.interactionsWithSummary / params.interactionsAnalyzed;
    const structuredRatio =
      params.interactionsStructured / params.interactionsAnalyzed;
    score += Math.round(Math.min(20, summaryRatio * 20));
    score += Math.round(Math.min(20, structuredRatio * 20));

    if (summaryRatio < 0.3) {
      missingSignals.push("trop peu de resumes interaction");
    }
    if (structuredRatio < 0.4) {
      missingSignals.push("trop peu de signaux structures");
    }
  }

  if (
    params.hasClientNotes ||
    params.hasBudget ||
    params.hasCompanyOrRole ||
    params.hasCachedInsights
  ) {
    score += 10;
    reasons.push("contexte client enrichi");
  } else {
    missingSignals.push("contexte client faible (notes/budget/societe/role)");
  }

  score = Math.max(0, Math.min(100, score));
  const level: "LOW" | "MEDIUM" | "HIGH" =
    score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";

  return { score, level, reasons, missingSignals };
}

type PageProps = {
  params: Promise<{ workspaceId: string; clientId: string }>;
  searchParams: Promise<{ view?: string; financeSort?: string }>;
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { workspaceId, clientId } = await params;
  const { view: rawView, financeSort: rawFinanceSort } = await searchParams;
  const financeSort =
    rawFinanceSort === "oldest" ? "oldest" : ("newest" as const);
  const currentView =
    rawView === "actions"
      ? "actions"
      : rawView === "projects"
        ? "projects"
        : rawView === "documents"
          ? "documents"
          : rawView === "finance"
            ? "finance"
            : rawView === "notes"
              ? "notes"
              : "info";

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { name: true } } },
  });
  if (!membership) redirect("/dashboard");

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      website: true,
      status: true,
      priority: true,
      source: true,
      budgetEstimated: true,
      notes: true,
      aiInsights: true,
      tags: true,
      nextFollowUpAt: true,
      lastContactAt: true,
      createdAt: true,
      updatedAt: true,
      actions: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          title: true,
          description: true,
          interactionSummary: true,
          interactionOutcome: true,
          interactionSentiment: true,
          interactionObjections: true,
          previousActionId: true,
          type: true,
          status: true,
          dueDate: true,
          doneAt: true,
          createdAt: true,
          createdById: true,
          assignedToId: true,
          createdBy: { select: { name: true, email: true } },
          assignedTo: { select: { name: true, email: true } },
        },
      },
      projects: {
        orderBy: [{ createdAt: "desc" }],
        take: 30,
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
        },
      },
      invoices: {
        orderBy:
          financeSort === "oldest"
            ? [{ issueDate: "asc" }, { createdAt: "asc" }]
            : [{ issueDate: "desc" }, { createdAt: "desc" }],
        take: 80,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          issueDate: true,
          dueDate: true,
          total: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      documents: {
        where: { projectId: null },
        orderBy: { createdAt: "desc" },
        take: 50,
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
      clientNotes: {
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 60,
        select: {
          id: true,
          content: true,
          isPinned: true,
          createdAt: true,
          author: { select: { name: true, email: true } },
        },
      },
      statusHistory: {
        orderBy: { changedAt: "desc" },
        take: 12,
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          changedAt: true,
          changedBy: {
            select: { name: true, email: true },
          },
        },
      },
      _count: {
        select: {
          actions: true,
          projects: true,
          invoices: true,
          documents: true,
          clientNotes: true,
        },
      },
    },
  });

  if (!client) {
    redirect(`/workspace/${workspaceId}/clients`);
  }

  const [quoteCount, invoiceCount] = await Promise.all([
    prisma.invoice.count({
      where: {
        workspaceId,
        clientId: client.id,
        invoiceNumber: {
          startsWith: "DEV-",
        },
      },
    }),
    prisma.invoice.count({
      where: {
        workspaceId,
        clientId: client.id,
        invoiceNumber: {
          startsWith: "FAC-",
        },
      },
    }),
  ]);

  const latestAdviceGeneration = await prisma.aiGeneration.findFirst({
    where: {
      workspaceId,
      clientId: client.id,
      type: "NEXT_ACTION_ADVICE",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      result: true,
      provider: true,
      model: true,
      metadata: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      costUsd: true,
      version: true,
      createdAt: true,
      feedbackScore: true,
      feedbackNote: true,
    },
  });
  const latestAdvice = latestAdviceGeneration
    ? {
        ...latestAdviceGeneration,
        costUsd: latestAdviceGeneration.costUsd
          ? latestAdviceGeneration.costUsd.toString()
          : null,
      }
    : null;

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";
  const assignees = members.map((m: { user: Assignee }) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));
  const pinnedNotes = client.clientNotes
    .filter((note: { isPinned: boolean }) => note.isPinned)
    .slice(0, 2);
  const latestStatusHistoryEntry = client.statusHistory[0] ?? null;
  const clientStatus = client.status as ClientStatus;
  const clientPriority = client.priority as ClientPriority;
  const advice = buildClientAdvice({
    client: {
      fullName: client.fullName,
      status: client.status,
      priority: client.priority,
      budgetEstimated: client.budgetEstimated,
      company: client.company,
      jobTitle: client.jobTitle,
      notes: client.notes,
      aiInsights: client.aiInsights,
    },
    actions: client.actions,
  });
  const interactionActions = client.actions.filter(
    (action) =>
      action.type === "CALL" ||
      action.type === "EMAIL" ||
      action.type === "FOLLOW_UP",
  );
  const interactionsWithSummary = interactionActions.filter(
    (action) =>
      !!(action.interactionSummary?.trim() || action.description?.trim()),
  ).length;
  const interactionsStructured = interactionActions.filter(
    (action) =>
      !!action.interactionOutcome ||
      !!action.interactionSentiment ||
      action.interactionObjections.length > 0,
  ).length;
  const fallbackQuickStats = {
    totalInteractions: client.actions.length,
    withResponse: client.actions.filter((a) => !!a.interactionOutcome).length,
    interestedCount: client.actions.filter(
      (a) => a.interactionOutcome === "INTERESTED",
    ).length,
    negativeCount: client.actions.filter(
      (a) => a.interactionSentiment === "NEGATIVE",
    ).length,
  };
  const metadataQuickStats = (() => {
    const quickStats = (
      latestAdviceGeneration?.metadata as
        | { quickStats?: unknown }
        | null
        | undefined
    )?.quickStats;
    if (
      !quickStats ||
      typeof quickStats !== "object" ||
      Array.isArray(quickStats)
    ) {
      return null;
    }
    const qs = quickStats as Record<string, unknown>;
    if (
      typeof qs.totalInteractions !== "number" ||
      typeof qs.withResponse !== "number" ||
      typeof qs.interestedCount !== "number" ||
      typeof qs.negativeCount !== "number"
    ) {
      return null;
    }

    return {
      totalInteractions: qs.totalInteractions,
      withResponse: qs.withResponse,
      interestedCount: qs.interestedCount,
      negativeCount: qs.negativeCount,
    };
  })();
  const quickStats = metadataQuickStats ?? fallbackQuickStats;
  const hasClientNotes =
    !!client.notes?.trim() || client.clientNotes.length > 0;
  const hasBudget = client.budgetEstimated !== null;
  const hasCompanyOrRole = !!(client.company || client.jobTitle);
  const hasCachedInsights = !!client.aiInsights;

  const metadata =
    latestAdviceGeneration?.metadata &&
    typeof latestAdviceGeneration.metadata === "object" &&
    !Array.isArray(latestAdviceGeneration.metadata)
      ? (latestAdviceGeneration.metadata as Record<string, unknown>)
      : null;

  const metadataConfidence = (() => {
    const confidence = metadata?.confidence;
    if (
      !confidence ||
      typeof confidence !== "object" ||
      Array.isArray(confidence)
    ) {
      return null;
    }
    const c = confidence as Record<string, unknown>;
    if (
      typeof c.score !== "number" ||
      (c.level !== "LOW" && c.level !== "MEDIUM" && c.level !== "HIGH")
    ) {
      return null;
    }
    const reasons = Array.isArray(c.reasons)
      ? c.reasons.filter((item): item is string => typeof item === "string")
      : [];
    const missingSignals = Array.isArray(c.missingSignals)
      ? c.missingSignals.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
    return {
      score: c.score,
      level: c.level,
      reasons,
      missingSignals,
    } as AdviceConfidenceView;
  })();

  const metadataGrounding = (() => {
    const grounding = metadata?.grounding;
    if (
      !grounding ||
      typeof grounding !== "object" ||
      Array.isArray(grounding)
    ) {
      return null;
    }
    const g = grounding as Record<string, unknown>;
    if (
      typeof g.grounded !== "boolean" ||
      typeof g.evidenceCount !== "number" ||
      typeof g.interactionsWindow !== "number" ||
      !Array.isArray(g.evidenceInteractionIndexes)
    ) {
      return null;
    }
    const evidenceInteractionIndexes = g.evidenceInteractionIndexes.filter(
      (item): item is number => typeof item === "number",
    );
    return {
      grounded: g.grounded,
      evidenceInteractionIndexes,
      evidenceCount: g.evidenceCount,
      interactionsWindow: g.interactionsWindow,
    } as GroundingView;
  })();

  const fallbackConfidence = buildFallbackConfidence({
    interactionsAnalyzed: interactionActions.length,
    interactionsWithSummary,
    interactionsStructured,
    hasClientNotes,
    hasBudget,
    hasCompanyOrRole,
    hasCachedInsights,
  });

  const adviceConfidence = metadataConfidence ?? fallbackConfidence;
  const grounding =
    metadataGrounding ??
    ({
      grounded: false,
      evidenceInteractionIndexes: [],
      evidenceCount: 0,
      interactionsWindow: Math.min(10, interactionActions.length),
    } satisfies GroundingView);
  const recentAdviceWindow = [...client.actions]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 10);
  const evidenceTitles = grounding.evidenceInteractionIndexes
    .map((index) => {
      const action = recentAdviceWindow[index - 1];
      if (!action) return null;
      const title = action.title?.trim();
      return title && title.length > 0
        ? title
        : action.interactionSummary?.trim() || "Interaction sans titre";
    })
    .filter((title): title is string => !!title);

  const clientFormSnapshot = {
    id: client.id,
    fullName: client.fullName,
    email: client.email,
    phone: client.phone,
    company: client.company,
    jobTitle: client.jobTitle,
    website: client.website,
    status: client.status,
    priority: client.priority,
    source: client.source,
    budgetEstimated: client.budgetEstimated,
    notes: client.notes,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}/clients`}
        backLabel="Clients"
      />

      <main className="mx-auto w-full max-w-400 flex-1 px-4 py-8 sm:px-6 lg:px-20">
        <div className="mb-6 rounded-2xl border border-border/60 bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brand-2/70">
                Fiche client
              </p>
              <h1 className="truncate font-heading text-2xl font-bold text-foreground sm:text-3xl">
                {client.fullName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[clientStatus]}`}
                >
                  {STATUS_LABELS[clientStatus]}
                </span>
                <span className="inline-flex items-center rounded-full border border-border/60 bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/60">
                  Priorité {PRIORITY_LABELS[clientPriority]}
                </span>
                {client.company && (
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-surface px-2.5 py-0.5 text-[11px] font-medium text-foreground/50">
                    {client.company}
                  </span>
                )}
              </div>
            </div>

            <Link
              href={`/workspace/${workspaceId}/clients`}
              className="shrink-0 rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground"
            >
              Retour liste
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-7">
            <div className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Actions
              </p>
              <p className="text-sm font-bold text-foreground">
                {client._count.actions}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Projets
              </p>
              <p className="text-sm font-bold text-foreground">
                {client._count.projects}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Devis
              </p>
              <p className="text-sm font-bold text-foreground">{quoteCount}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Factures
              </p>
              <p className="text-sm font-bold text-foreground">
                {invoiceCount}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Documents
              </p>
              <p className="text-sm font-bold text-foreground">
                {client._count.documents}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Notes
              </p>
              <p className="text-sm font-bold text-foreground">
                {client._count.clientNotes}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                Budget
              </p>
              <p className="text-sm font-bold text-foreground">
                {formatMoney(client.budgetEstimated)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="inline-flex min-w-max rounded-xl border border-border/60 bg-surface-2/30 p-1">
                <Link
                  href={`/workspace/${workspaceId}/clients/${client.id}?view=info`}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    currentView === "info"
                      ? "bg-brand-1 text-white"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  Infos client
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/clients/${client.id}?view=actions`}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    currentView === "actions"
                      ? "bg-brand-1 text-white"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  Actions commerciales
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/clients/${client.id}?view=projects`}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    currentView === "projects"
                      ? "bg-brand-1 text-white"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  Projets
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/clients/${client.id}?view=documents`}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    currentView === "documents"
                      ? "bg-brand-1 text-white"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  Documents
                  {client._count.documents > 0 && (
                    <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold">
                      {client._count.documents}
                    </span>
                  )}
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/clients/${client.id}?view=finance`}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    currentView === "finance"
                      ? "bg-brand-1 text-white"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  Devis & factures
                  {client.invoices.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold">
                      {client.invoices.length}
                    </span>
                  )}
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/clients/${client.id}?view=notes`}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    currentView === "notes"
                      ? "bg-brand-1 text-white"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  Notes
                  {client._count.clientNotes > 0 && (
                    <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold">
                      {client._count.clientNotes}
                    </span>
                  )}
                </Link>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/workspace/${workspaceId}/clients/${client.id}/quote`}
                className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4"
              >
                Créer un devis
              </Link>
              <Link
                href={`/workspace/${workspaceId}/clients/${client.id}/invoice`}
                className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
              >
                Créer une facture
              </Link>
            </div>
          </div>
        </div>

        {currentView === "info" ? (
          <div className="client-info-layout grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_340px]">
            <div>
              <section className="rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
                <ClientDetailForm
                  workspaceId={workspaceId}
                  client={clientFormSnapshot}
                  canDelete={isManager}
                />
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <ClientAiAdvicePanel
                workspaceId={workspaceId}
                clientId={client.id}
                defaultCollapsed
                expandOnOpen
                hideExtendedSections
                fallbackAdvice={advice}
                latestAdvice={latestAdvice}
                quickStats={quickStats}
                analysisContext={{
                  interactionsAnalyzed: interactionActions.length,
                  interactionsWithSummary,
                  interactionsStructured,
                  hasClientNotes,
                  hasBudget,
                  hasCompanyOrRole,
                  hasCachedInsights,
                }}
                adviceConfidence={adviceConfidence}
                grounding={grounding}
                evidenceTitles={evidenceTitles}
              />

              <section className="rounded-2xl border border-border/60 bg-surface p-4">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                  Notes épinglées
                </h2>
                <dl className="grid grid-cols-1 gap-2.5 text-sm">
                  <div className="mb-1">
                    {pinnedNotes.length > 0 ? (
                      <dd className="space-y-2">
                        {pinnedNotes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs text-foreground/75"
                          >
                            <p className="line-clamp-3 whitespace-pre-wrap">
                              {note.content}
                            </p>
                            <p className="mt-1 text-[10px] text-foreground/45">
                              {formatDateTime(note.createdAt)}
                            </p>
                          </div>
                        ))}
                      </dd>
                    ) : (
                      <dd className="text-foreground/70">—</dd>
                    )}
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-border/60 bg-surface p-4">
                <details className="group" open>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                        Historique de statut
                      </h2>

                      {latestStatusHistoryEntry ? (
                        <div className="mt-2 rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2 group-open:hidden">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            {latestStatusHistoryEntry.fromStatus ? (
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${STATUS_CLASSES[latestStatusHistoryEntry.fromStatus]}`}
                              >
                                {
                                  STATUS_LABELS[
                                    latestStatusHistoryEntry.fromStatus
                                  ]
                                }
                              </span>
                            ) : (
                              <span className="text-foreground/30">—</span>
                            )}
                            <span className="text-foreground/30">→</span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${STATUS_CLASSES[latestStatusHistoryEntry.toStatus]}`}
                            >
                              {STATUS_LABELS[latestStatusHistoryEntry.toStatus]}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-foreground/40">
                            {formatDateTime(latestStatusHistoryEntry.changedAt)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-foreground/50 group-open:hidden">
                          Aucun changement de statut enregistré.
                        </p>
                      )}
                    </div>

                    <span className="mt-0.5 text-xs text-foreground/55">
                      <span className="group-open:hidden">▾</span>
                      <span className="hidden group-open:inline">▴</span>
                    </span>
                  </summary>

                  <div className="mt-3 border-t border-border/50 pt-3">
                    {client.statusHistory.length === 0 ? (
                      <p className="text-sm text-foreground/50">
                        Aucun changement de statut enregistré.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {client.statusHistory.map(
                          (entry: StatusHistoryEntry) => {
                            const who =
                              entry.changedBy?.name ??
                              entry.changedBy?.email ??
                              "Système";

                            return (
                              <div
                                key={entry.id}
                                className="rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  {entry.fromStatus ? (
                                    <span
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${STATUS_CLASSES[entry.fromStatus]}`}
                                    >
                                      {STATUS_LABELS[entry.fromStatus]}
                                    </span>
                                  ) : (
                                    <span className="text-foreground/30">
                                      —
                                    </span>
                                  )}
                                  <span className="text-foreground/30">→</span>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${STATUS_CLASSES[entry.toStatus]}`}
                                  >
                                    {STATUS_LABELS[entry.toStatus]}
                                  </span>
                                </div>
                                <p className="mt-1 text-[10px] text-foreground/40">
                                  {formatDateTime(entry.changedAt)} · {who}
                                </p>
                                {entry.note && (
                                  <p className="mt-1 text-[11px] text-foreground/60">
                                    {entry.note}
                                  </p>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                </details>
              </section>
            </aside>
          </div>
        ) : currentView === "actions" ? (
          <div className="space-y-5">
            <ClientAiAdvicePanel
              workspaceId={workspaceId}
              clientId={client.id}
              fallbackAdvice={advice}
              latestAdvice={latestAdvice}
              quickStats={quickStats}
              analysisContext={{
                interactionsAnalyzed: interactionActions.length,
                interactionsWithSummary,
                interactionsStructured,
                hasClientNotes,
                hasBudget,
                hasCompanyOrRole,
                hasCachedInsights,
              }}
              adviceConfidence={adviceConfidence}
              grounding={grounding}
              evidenceTitles={evidenceTitles}
            />

            <ClientActionsSection
              workspaceId={workspaceId}
              clientId={client.id}
              tasks={client.actions}
              assignees={assignees}
            />
          </div>
        ) : currentView === "projects" ? (
          <div>
            <ClientProjectsSection
              workspaceId={workspaceId}
              clientId={client.id}
              projects={client.projects}
            />
          </div>
        ) : currentView === "documents" ? (
          <div>
            <ClientDocumentsSection
              workspaceId={workspaceId}
              clientId={client.id}
              documents={client.documents}
            />
          </div>
        ) : currentView === "finance" ? (
          <div className="rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-bold text-foreground">
                Devis et factures
              </h2>
              <div className="inline-flex rounded-lg border border-border/60 bg-surface-2 p-1 text-xs font-semibold">
                <Link
                  href={`/workspace/${workspaceId}/clients/${client.id}?view=finance&financeSort=newest`}
                  className={`rounded-md px-2 py-1 transition ${
                    financeSort === "newest"
                      ? "bg-brand-1 text-white"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  Plus récent
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/clients/${client.id}?view=finance&financeSort=oldest`}
                  className={`rounded-md px-2 py-1 transition ${
                    financeSort === "oldest"
                      ? "bg-brand-1 text-white"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  Plus ancien
                </Link>
              </div>
            </div>

            {client.invoices.length === 0 ? (
              <p className="text-sm text-foreground/50">
                Aucun devis ou facture pour ce client.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-foreground/45">
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Numero</th>
                      <th className="px-2 py-2">Statut</th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Echeance</th>
                      <th className="px-2 py-2">Projet</th>
                      <th className="px-2 py-2">PDF</th>
                      <th className="px-2 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.invoices.map((invoice) => {
                      const isQuote = invoice.invoiceNumber.startsWith("DEV-");
                      return (
                        <tr
                          key={invoice.id}
                          className="border-b border-border/40 text-foreground/80"
                        >
                          <td className="px-2 py-2">
                            <span className="inline-flex items-center rounded-full border border-border/60 bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-foreground/65">
                              {isQuote ? "Devis" : "Facture"}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-semibold text-foreground">
                            {invoice.invoiceNumber}
                          </td>
                          <td className="px-2 py-2">{invoice.status}</td>
                          <td className="px-2 py-2">
                            {new Intl.DateTimeFormat("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            }).format(invoice.issueDate)}
                          </td>
                          <td className="px-2 py-2">
                            {invoice.dueDate
                              ? new Intl.DateTimeFormat("fr-FR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                }).format(invoice.dueDate)
                              : "—"}
                          </td>
                          <td className="px-2 py-2">
                            {invoice.project ? (
                              <Link
                                href={`/workspace/${workspaceId}/clients/${client.id}/projects/${invoice.project.id}`}
                                className="text-brand-2/75 transition hover:text-brand-2"
                              >
                                {invoice.project.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <a
                              href={`/workspace/${workspaceId}/clients/${client.id}/invoices/${invoice.id}/pdf`}
                              className="inline-flex items-center rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-[11px] font-semibold text-foreground/65 transition hover:text-foreground"
                            >
                              Regenerer PDF
                            </a>
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-foreground">
                            {new Intl.NumberFormat("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                            }).format(Number(invoice.total))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            <ClientNotesSection
              workspaceId={workspaceId}
              clientId={client.id}
              notes={client.clientNotes}
            />
          </div>
        )}
      </main>
    </div>
  );
}
