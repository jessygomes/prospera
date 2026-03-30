"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateClientTaskStatusQuickAction } from "./actions";

type ActionStatus = "TODO" | "DONE" | "CANCELED";

const STATUS_LABELS: Record<ActionStatus, string> = {
  TODO: "À faire",
  DONE: "Fait",
  CANCELED: "Annulé",
};

type Props = {
  workspaceId: string;
  taskId: string;
  value: ActionStatus;
  compact?: boolean;
};

export function ClientActionStatusInline({
  workspaceId,
  taskId,
  value,
  compact = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: ActionStatus) {
    if (next === value) return;

    setError(null);
    startTransition(async () => {
      const result = await updateClientTaskStatusQuickAction(
        workspaceId,
        taskId,
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
    <div
      className={`flex ${compact ? "items-center" : "flex-col items-end gap-1"}`}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ActionStatus)}
        disabled={isPending}
        className={`rounded-lg border border-border/70 bg-surface-2 text-[11px] font-semibold text-foreground/70 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15 disabled:opacity-50 ${compact ? "px-2 py-1" : "px-2 py-1"}`}
      >
        {(Object.keys(STATUS_LABELS) as ActionStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
