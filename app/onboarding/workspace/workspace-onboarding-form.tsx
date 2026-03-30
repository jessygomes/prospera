"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { UI_MESSAGES } from "@/lib/messages/ui";
import {
  createWorkspaceSchema,
  joinWorkspaceSchema,
  type CreateWorkspaceInput,
  type JoinWorkspaceInput,
} from "@/lib/validation/workspace";

import { createWorkspaceAction, joinWorkspaceAction } from "./actions";

export function WorkspaceOnboardingForm() {
  const [createServerError, setCreateServerError] = useState<string | null>(
    null,
  );
  const [joinServerError, setJoinServerError] = useState<string | null>(null);
  const [isCreating, startCreateTransition] = useTransition();
  const [isJoining, startJoinTransition] = useTransition();

  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    formState: { errors: createErrors },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
    },
  });

  const {
    register: registerJoin,
    handleSubmit: handleJoinSubmit,
    formState: { errors: joinErrors },
  } = useForm<JoinWorkspaceInput>({
    resolver: zodResolver(joinWorkspaceSchema),
    defaultValues: {
      workspaceId: "",
    },
  });

  const onCreateSubmit = handleCreateSubmit((values) => {
    setCreateServerError(null);

    const formData = new FormData();
    formData.set("name", values.name);

    startCreateTransition(async () => {
      const result = await createWorkspaceAction(formData);
      if (result?.error) {
        setCreateServerError(result.error);
      }
    });
  });

  const onJoinSubmit = handleJoinSubmit((values) => {
    setJoinServerError(null);

    const formData = new FormData();
    formData.set("workspaceId", values.workspaceId);

    startJoinTransition(async () => {
      const result = await joinWorkspaceAction(formData);
      if (result?.error) {
        setJoinServerError(result.error);
      }
    });
  });

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 md:grid-cols-2">
      {/* ── Créer un workspace ── */}
      <form
        onSubmit={onCreateSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.3)]"
      >
        <div>
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-brand-1/20 to-brand-3/10 ring-1 ring-brand-3/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand-2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <h2 className="font-heading text-base font-bold text-foreground">
            {UI_MESSAGES.workspace.create.title}
          </h2>
          <p className="mt-1 text-xs text-foreground/50">
            {UI_MESSAGES.workspace.create.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="block text-xs font-medium text-foreground/50"
            htmlFor="create-name"
          >
            {UI_MESSAGES.workspace.create.nameLabel}
          </label>
          <input
            id="create-name"
            {...registerCreate("name")}
            className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
            type="text"
            placeholder={UI_MESSAGES.workspace.create.namePlaceholder}
          />
          {createErrors.name && (
            <p className="text-xs text-red-400">{createErrors.name.message}</p>
          )}
        </div>

        {createServerError && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            {createServerError}
          </p>
        )}

        <button
          className="mt-auto w-full cursor-pointer rounded-lg bg-linear-to-r from-brand-1 to-brand-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_var(--brand-1)] transition hover:brightness-110 disabled:opacity-60"
          disabled={isCreating}
          type="submit"
        >
          {isCreating
            ? UI_MESSAGES.workspace.create.submitting
            : UI_MESSAGES.workspace.create.submit}
        </button>
      </form>

      {/* ── Rejoindre un workspace ── */}
      <form
        onSubmit={onJoinSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.3)]"
      >
        <div>
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 ring-1 ring-border/60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground/50"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
          <h2 className="font-heading text-base font-bold text-foreground">
            {UI_MESSAGES.workspace.join.title}
          </h2>
          <p className="mt-1 text-xs text-foreground/50">
            {UI_MESSAGES.workspace.join.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="block text-xs font-medium text-foreground/50"
            htmlFor="join-id"
          >
            {UI_MESSAGES.workspace.join.idLabel}
          </label>
          <input
            id="join-id"
            {...registerJoin("workspaceId")}
            className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
            type="text"
            placeholder={UI_MESSAGES.workspace.join.idPlaceholder}
          />
          {joinErrors.workspaceId && (
            <p className="text-xs text-red-400">
              {joinErrors.workspaceId.message}
            </p>
          )}
        </div>

        {joinServerError && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            {joinServerError}
          </p>
        )}

        <button
          className="mt-auto w-full cursor-pointer rounded-lg border border-border/70 bg-surface-2 py-2.5 text-sm font-semibold text-foreground/70 transition hover:border-brand-2/40 hover:text-foreground disabled:opacity-60"
          disabled={isJoining}
          type="submit"
        >
          {isJoining
            ? UI_MESSAGES.workspace.join.submitting
            : UI_MESSAGES.workspace.join.submit}
        </button>
      </form>
    </div>
  );
}
