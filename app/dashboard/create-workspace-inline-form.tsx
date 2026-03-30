"use client";

import { useState, useTransition } from "react";

import { UI_MESSAGES } from "@/lib/messages/ui";

import { createWorkspaceAction } from "./actions";

export function CreateWorkspaceInlineForm() {
  const [name, setName] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const formData = new FormData();
    formData.set("name", name);

    startTransition(async () => {
      const result = await createWorkspaceAction(formData);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2.5">
      <label className="text-xs font-medium uppercase tracking-wider text-foreground/40">
        Nouveau workspace
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
          type="text"
          placeholder={UI_MESSAGES.workspace.create.namePlaceholder}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-linear-to-r from-brand-1 to-brand-4 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_var(--brand-1)] transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending
            ? UI_MESSAGES.workspace.create.submitting
            : UI_MESSAGES.workspace.create.submit}
        </button>
      </div>
      {serverError ? (
        <p className="text-xs text-red-400">{serverError}</p>
      ) : null}
    </form>
  );
}