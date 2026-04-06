"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateClientStatusQuickAction } from "./actions";

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

type Props = {
  workspaceId: string;
  clientId: string;
  value: ClientStatus;
};

export function ClientStatusInline({ workspaceId, clientId, value }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: ClientStatus) {
    if (next === value) return;

    setError(null);
    startTransition(async () => {
      const result = await updateClientStatusQuickAction(
        workspaceId,
        clientId,
        next,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="min-w-0 flex flex-1 flex-col gap-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ClientStatus)}
        disabled={isPending}
        className="w-full min-w-0 max-w-full rounded-lg border border-border/70 bg-surface-2 px-2 py-1 text-[11px] font-semibold text-foreground/70 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15 disabled:opacity-50"
      >
        {(Object.keys(STATUS_LABELS) as ClientStatus[]).map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
