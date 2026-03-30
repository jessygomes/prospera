import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/app/components/app-navbar";
import { signOutAction } from "@/app/dashboard/actions";
import { prisma } from "@/lib/prisma";
import { ClientDetailForm } from "./client-detail-form";
import { ClientActionsSection } from "./client-actions-section";
import { ClientProjectsSection } from "./client-projects-section";
import { ClientDocumentsSection } from "./client-documents-section";
import { ClientNotesSection } from "./client-notes-section";

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

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

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

type PageProps = {
  params: Promise<{ workspaceId: string; clientId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { workspaceId, clientId } = await params;
  const { view: rawView } = await searchParams;
  const currentView =
    rawView === "actions"
      ? "actions"
      : rawView === "projects"
        ? "projects"
        : rawView === "documents"
          ? "documents"
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

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";
  const assignees = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));
  const lastPinnedNote =
    client.clientNotes.find((note) => note.isPinned) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}/clients`}
        backLabel="Clients"
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
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
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[client.status]}`}
                >
                  {STATUS_LABELS[client.status]}
                </span>
                <span className="inline-flex items-center rounded-full border border-border/60 bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/60">
                  Priorité {PRIORITY_LABELS[client.priority]}
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

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
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
                Factures
              </p>
              <p className="text-sm font-bold text-foreground">
                {client._count.invoices}
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

          <div className="mt-4 inline-flex rounded-xl border border-border/60 bg-surface-2/30 p-1">
            <Link
              href={`/workspace/${workspaceId}/clients/${client.id}?view=info`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currentView === "info"
                  ? "bg-brand-1 text-white"
                  : "text-foreground/55 hover:text-foreground"
              }`}
            >
              Infos client
            </Link>
            <Link
              href={`/workspace/${workspaceId}/clients/${client.id}?view=actions`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currentView === "actions"
                  ? "bg-brand-1 text-white"
                  : "text-foreground/55 hover:text-foreground"
              }`}
            >
              Actions commerciales
            </Link>
            <Link
              href={`/workspace/${workspaceId}/clients/${client.id}?view=projects`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currentView === "projects"
                  ? "bg-brand-1 text-white"
                  : "text-foreground/55 hover:text-foreground"
              }`}
            >
              Projets
            </Link>
            <Link
              href={`/workspace/${workspaceId}/clients/${client.id}?view=documents`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
              href={`/workspace/${workspaceId}/clients/${client.id}?view=notes`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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

        {currentView === "info" ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_340px]">
            <div>
              <section className="rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
                <ClientDetailForm
                  workspaceId={workspaceId}
                  client={client}
                  canDelete={isManager}
                />
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <section className="rounded-2xl border border-border/60 bg-surface p-4">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                  Aperçu
                </h2>
                <dl className="grid grid-cols-1 gap-2.5 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                      Email
                    </dt>
                    <dd className="break-all text-foreground/70">
                      {client.email ? (
                        <a
                          href={`mailto:${client.email}`}
                          className="text-brand-2 hover:underline"
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
                      Téléphone
                    </dt>
                    <dd className="text-foreground/70">
                      {client.phone ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                      Site
                    </dt>
                    <dd>
                      {client.website ? (
                        <a
                          href={client.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-2 hover:underline"
                        >
                          {client.website}
                        </a>
                      ) : (
                        <span className="text-foreground/70">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                      Dernier contact
                    </dt>
                    <dd className="text-foreground/70">
                      {formatDate(client.lastContactAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                      Prochaine relance
                    </dt>
                    <dd className="text-foreground/70">
                      {formatDate(client.nextFollowUpAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-foreground/35">
                      Dernière note épinglée
                    </dt>
                    {lastPinnedNote ? (
                      <dd className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs text-foreground/75">
                        <p className="line-clamp-3 whitespace-pre-wrap">
                          {lastPinnedNote.content}
                        </p>
                        <p className="mt-1 text-[10px] text-foreground/45">
                          {formatDateTime(lastPinnedNote.createdAt)}
                        </p>
                      </dd>
                    ) : (
                      <dd className="text-foreground/70">—</dd>
                    )}
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-border/60 bg-surface p-4">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                  Historique de statut
                </h2>

                {client.statusHistory.length === 0 ? (
                  <p className="text-sm text-foreground/50">
                    Aucun changement de statut enregistré.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {client.statusHistory.map((entry) => {
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
                              <span className="text-foreground/30">—</span>
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
                    })}
                  </div>
                )}
              </section>
            </aside>
          </div>
        ) : currentView === "actions" ? (
          <div>
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
