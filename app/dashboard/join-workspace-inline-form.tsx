"use client";

import { useState, useTransition } from "react";

import { UI_MESSAGES } from "@/lib/messages/ui";

import { joinWorkspaceAction } from "./actions";

export function JoinWorkspaceInlineForm() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const formData = new FormData();
    formData.set("workspaceId", workspaceId);

    startTransition(async () => {
      const result = await joinWorkspaceAction(formData);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2.5">
      <label className="text-xs font-medium uppercase tracking-wider text-foreground/40">
        Rejoindre un workspace
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
          className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
          type="text"
          placeholder={UI_MESSAGES.workspace.join.idPlaceholder}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-border/70 bg-surface-2 px-4 py-2.5 text-sm font-semibold text-foreground/70 transition hover:border-brand-2/40 hover:text-foreground disabled:opacity-60"
        >
          {isPending
            ? UI_MESSAGES.workspace.join.submitting
            : UI_MESSAGES.workspace.join.submit}
        </button>
      </div>
      {serverError ? (
        <p className="text-xs text-red-400">{serverError}</p>
      ) : null}
    </form>
  );
}
