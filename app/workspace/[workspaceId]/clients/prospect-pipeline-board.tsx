"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateClientStatusQuickAction } from "./actions";
import { ClientStatusInline } from "./client-status-inline";

type ClientStatus =
  | "PROSPECT"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "INACTIVE";

type ClientPriority = "HIGH" | "MEDIUM" | "LOW";

type ProspectCard = {
  id: string;
  fullName: string;
  company: string | null;
  status: ClientStatus;
  priority: ClientPriority;
  budgetEstimated: number | null;
  nextFollowUpAtIso: string | null;
  todoActionsCount: number;
};

type Props = {
  workspaceId: string;
  clients: ProspectCard[];
  activeStatus: ClientStatus | null;
};

const BOARD_COLUMNS: {
  id: ClientStatus;
  title: string;
  toneClass: string;
}[] = [
  {
    id: "PROSPECT",
    title: "Nouveaux",
    toneClass: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  },
  {
    id: "CONTACTED",
    title: "Contactés",
    toneClass: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  },
  {
    id: "QUALIFIED",
    title: "Qualifiés",
    toneClass: "border-violet-500/30 bg-violet-500/5 text-violet-300",
  },
  {
    id: "PROPOSAL_SENT",
    title: "Proposition",
    toneClass: "border-orange-500/30 bg-orange-500/5 text-orange-300",
  },
  {
    id: "NEGOTIATION",
    title: "Négociation",
    toneClass: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
  },
  {
    id: "WON",
    title: "Gagnés",
    toneClass: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  },
  {
    id: "LOST",
    title: "Perdus",
    toneClass: "border-red-500/30 bg-red-500/5 text-red-300",
  },
  {
    id: "INACTIVE",
    title: "Inactifs",
    toneClass: "border-foreground/20 bg-foreground/5 text-foreground/60",
  },
];

const PRIORITY_CLASSES: Record<ClientPriority, string> = {
  HIGH: "bg-red-500/10 text-red-400",
  MEDIUM: "bg-amber-500/10 text-amber-400",
  LOW: "bg-sky-500/10 text-sky-400",
};

const PRIORITY_LABELS: Record<ClientPriority, string> = {
  HIGH: "Urgent",
  MEDIUM: "Moyen",
  LOW: "Faible",
};

function formatDateFromIso(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function ProspectPipelineBoard({
  workspaceId,
  clients,
  activeStatus,
}: Props) {
  const router = useRouter();
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [recentlyMovedClientId, setRecentlyMovedClientId] = useState<
    string | null
  >(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<ClientStatus | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clientsByColumn = useMemo(() => {
    const grouped: Record<ClientStatus, ProspectCard[]> = {
      PROSPECT: [],
      CONTACTED: [],
      QUALIFIED: [],
      PROPOSAL_SENT: [],
      NEGOTIATION: [],
      WON: [],
      LOST: [],
      INACTIVE: [],
    };

    clients.forEach((client) => {
      grouped[client.status].push(client);
    });

    return grouped;
  }, [clients]);

  function onDragStart(clientId: string) {
    setDraggedClientId(clientId);
    setError(null);
  }

  function onDragEnd() {
    setDraggedClientId(null);
    setDropTargetStatus(null);
  }

  function onDrop(nextStatus: ClientStatus) {
    if (!draggedClientId) return;

    const dragged = clients.find((client) => client.id === draggedClientId);
    if (!dragged || dragged.status === nextStatus) {
      setDraggedClientId(null);
      setDropTargetStatus(null);
      return;
    }

    startTransition(async () => {
      const result = await updateClientStatusQuickAction(
        workspaceId,
        dragged.id,
        nextStatus,
      );

      if (result?.error) {
        setError(result.error);
        return;
      }

      setRecentlyMovedClientId(dragged.id);
      setTimeout(() => {
        setRecentlyMovedClientId(null);
      }, 900);

      setDraggedClientId(null);
      setDropTargetStatus(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="pb-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          {BOARD_COLUMNS.map((column) => {
            const columnItems = activeStatus
              ? column.id === activeStatus
                ? clientsByColumn[column.id]
                : []
              : clientsByColumn[column.id];

            const isDropActive =
              dropTargetStatus === column.id && draggedClientId !== null;

            return (
              <div
                key={column.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTargetStatus(column.id);
                }}
                onDragLeave={() => {
                  if (dropTargetStatus === column.id) setDropTargetStatus(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  onDrop(column.id);
                }}
                className={`rounded-2xl border bg-surface/70 p-2 transition ${
                  isDropActive
                    ? "border-brand-1/50 ring-2 ring-brand-1/20"
                    : "border-border/60"
                }`}
              >
                <div
                  className={`mb-2 flex items-center justify-between rounded-xl border px-2 py-1.5 ${column.toneClass}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide">
                    {column.title}
                  </p>
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold text-white/80">
                    {columnItems.length}
                  </span>
                </div>

                {columnItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-surface-2/40 p-2 text-center text-xs text-foreground/45">
                    Dépose un prospect ici
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {columnItems.map((client) => {
                      const initial = client.fullName[0]?.toUpperCase() ?? "?";
                      const isOverdue =
                        client.nextFollowUpAtIso !== null &&
                        new Date(client.nextFollowUpAtIso) < new Date();
                      const followUpLabel = formatDateFromIso(
                        client.nextFollowUpAtIso,
                      );

                      return (
                        <article
                          key={client.id}
                          draggable={!isPending}
                          onDragStart={() => onDragStart(client.id)}
                          onDragEnd={onDragEnd}
                          className={`rounded-xl border border-border/60 bg-surface p-2.5 transition ${
                            draggedClientId === client.id ? "opacity-60" : ""
                          } ${
                            recentlyMovedClientId === client.id
                              ? "ring-2 ring-emerald-400/35"
                              : ""
                          }`}
                        >
                          <div className="mb-2 flex items-start gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-1 to-brand-2 text-xs font-bold text-white">
                              {initial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/workspace/${workspaceId}/clients/${client.id}`}
                                className="block truncate text-sm font-semibold text-foreground transition hover:text-brand-2 hover:underline"
                              >
                                {client.fullName}
                              </Link>
                              <p className="truncate text-xs text-foreground/45">
                                {client.company ?? "Sans entreprise"}
                              </p>
                            </div>
                          </div>

                          <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${PRIORITY_CLASSES[client.priority]}`}
                            >
                              {PRIORITY_LABELS[client.priority]}
                            </span>
                            {client.budgetEstimated && (
                              <span className="rounded-full border border-border/60 bg-surface-2 px-2 py-0.5 text-foreground/60">
                                {client.budgetEstimated.toLocaleString("fr-FR")}{" "}
                                €
                              </span>
                            )}
                          </div>

                          {followUpLabel && (
                            <p
                              className={`mb-2 text-xs ${
                                isOverdue
                                  ? "font-semibold text-red-400"
                                  : "text-foreground/45"
                              }`}
                            >
                              Relance {followUpLabel}
                            </p>
                          )}

                          <div className="flex min-w-0 items-center gap-2">
                            <Link
                              href={`/workspace/${workspaceId}/clients/${client.id}?view=actions`}
                              className="shrink-0 whitespace-nowrap rounded-lg border border-border/70 bg-surface-2 px-2 py-1 text-[11px] font-semibold text-foreground/65 transition hover:border-brand-1/35 hover:text-brand-2"
                            >
                              {client.todoActionsCount} action
                              {client.todoActionsCount > 1 ? "s" : ""}
                            </Link>
                            <ClientStatusInline
                              workspaceId={workspaceId}
                              clientId={client.id}
                              value={client.status}
                            />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
