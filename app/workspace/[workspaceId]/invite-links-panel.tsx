"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createInviteLinkAction,
  revokeInviteLinkAction,
  type CreateInviteLinkActionState,
  type WorkspaceMemberActionState,
} from "./actions";

type InviteLinkItem = {
  id: string;
  role: "ADMIN" | "MEMBER";
  expiresAt: Date;
  maxUses: number;
  useCount: number;
  createdAt: Date;
  createdByName: string | null;
  createdByEmail: string | null;
};

type InviteLinksPanelProps = {
  workspaceId: string;
  inviteLinks: InviteLinkItem[];
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function InviteLinksPanel({
  workspaceId,
  inviteLinks,
}: InviteLinksPanelProps) {
  const [createError, setCreateError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [days, setDays] = useState("7");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [isPendingCreate, startCreateTransition] = useTransition();
  const [isPendingRevoke, startRevokeTransition] = useTransition();

  const hasActiveLinks = inviteLinks.length > 0;

  const activeLinksCountLabel = useMemo(() => {
    if (inviteLinks.length <= 1) return "1 lien actif";
    return `${inviteLinks.length} liens actifs`;
  }, [inviteLinks.length]);

  function handleCreate() {
    setCreateError(null);
    setGeneratedUrl(null);
    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("role", role);
    formData.set("expiresInDays", days);

    startCreateTransition(async () => {
      const result: CreateInviteLinkActionState =
        await createInviteLinkAction(formData);
      if (result.error) {
        setCreateError(result.error);
        return;
      }

      if (result.inviteToken) {
        setGeneratedUrl(
          `${window.location.origin}/invite/${result.inviteToken}`,
        );
      }
    });
  }

  function handleRevoke(inviteLinkId: string) {
    setRevokeError(null);
    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("inviteLinkId", inviteLinkId);

    startRevokeTransition(async () => {
      const result: WorkspaceMemberActionState =
        await revokeInviteLinkAction(formData);
      if (result.error) setRevokeError(result.error);
    });
  }

  async function handleCopy() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
  }

  return (
    <section className="mt-6 rounded-xl border border-border/60 bg-surface p-3.5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground/75">
            Invitation par lien
          </h3>
          <p className="mt-0.5 text-[11px] text-foreground/45">
            Générez un lien unique pour rejoindre ce workspace.
          </p>
        </div>
        <span className="rounded-full border border-border/60 bg-surface-2/60 px-2.5 py-1 text-[11px] font-semibold text-foreground/55">
          {activeLinksCountLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_140px_auto] md:items-end">
        <label className="flex flex-col gap-1 text-[11px] text-foreground/55">
          Rôle
          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "ADMIN" | "MEMBER")
            }
            className="h-9 rounded-lg border border-border/70 bg-surface-2/50 px-2.5 text-xs text-foreground outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
          >
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-foreground/55">
          Expire dans
          <select
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="h-9 rounded-lg border border-border/70 bg-surface-2/50 px-2.5 text-xs text-foreground outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
          >
            <option value="1">1 jour</option>
            <option value="3">3 jours</option>
            <option value="7">7 jours</option>
            <option value="14">14 jours</option>
            <option value="30">30 jours</option>
          </select>
        </label>

        <button
          type="button"
          onClick={handleCreate}
          disabled={isPendingCreate}
          className="inline-flex h-9 w-fit cursor-pointer items-center justify-center rounded-lg bg-brand-1 px-3 text-xs font-semibold text-white transition hover:bg-brand-2 disabled:opacity-60"
        >
          {isPendingCreate ? "Génération..." : "Générer un lien"}
        </button>
      </div>

      {createError ? (
        <p className="mt-3 text-xs text-red-400">{createError}</p>
      ) : null}

      {generatedUrl ? (
        <div className="mt-2 rounded-lg border border-brand-1/30 bg-brand-1/10 p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold text-brand-2">
            Lien prêt à partager
          </p>
          <p className="break-all font-mono text-[11px] text-foreground/70">
            {generatedUrl}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1.5 inline-flex rounded-lg border border-brand-1/30 bg-surface px-2 py-1 text-[11px] font-semibold text-brand-2 transition hover:bg-brand-1/10"
          >
            Copier le lien
          </button>
        </div>
      ) : null}

      <div className="mt-3 border-t border-border/50 pt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
          Liens actifs
        </p>

        {!hasActiveLinks ? (
          <p className="text-[11px] text-foreground/45">
            Aucun lien actif pour le moment.
          </p>
        ) : (
          <div className="space-y-1.5">
            {inviteLinks.map((link) => {
              const author =
                link.createdByName ?? link.createdByEmail ?? "Inconnu";
              return (
                <div
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-2/30 px-2.5 py-1.5"
                >
                  <div className="min-w-0 text-[11px] text-foreground/60">
                    <p className="truncate font-semibold text-foreground/80">
                      {link.role} · {author}
                    </p>
                    <p className="text-[11px] text-foreground/45">
                      Expire: {formatDate(link.expiresAt)} · {link.useCount}/
                      {link.maxUses}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(link.id)}
                    disabled={isPendingRevoke}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-60"
                  >
                    Révoquer
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {revokeError ? (
          <p className="mt-3 text-xs text-red-400">{revokeError}</p>
        ) : null}
      </div>
    </section>
  );
}
