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
    <div className="mx-auto grid w-full max-w-3xl gap-10 md:grid-cols-2">
      <form
        onSubmit={onCreateSubmit}
        noValidate
        className="flex flex-col gap-3 rounded-xl border border-border bg-noir-1/90 p-5 shadow-[0_20px_50px_-35px_var(--brand-1)] backdrop-blur"
      >
        <h2 className="text-lg font-semibold text-brand-5">
          {UI_MESSAGES.workspace.create.title}
        </h2>
        <p className="text-xs text-brand-5/70">
          {UI_MESSAGES.workspace.create.subtitle}
        </p>

        <label className="flex flex-col gap-1 text-sm">
          {UI_MESSAGES.workspace.create.nameLabel}
          <input
            {...registerCreate("name")}
            className="rounded-xl border border-border px-3 py-2 outline-none transition focus:border-brand-3 focus:ring-2 focus:ring-(--brand-5)/60"
            type="text"
            placeholder={UI_MESSAGES.workspace.create.namePlaceholder}
          />
        </label>
        {createErrors.name ? (
          <p className="text-sm text-red-600">{createErrors.name.message}</p>
        ) : null}

        {createServerError ? (
          <p className="text-sm text-red-600">{createServerError}</p>
        ) : null}

        <button
          className="cursor-pointer rounded-xl bg-linear-to-r from-brand-4 via-brand-1 to-brand-1 px-4 py-2 font-medium text-white text-xs shadow-[0_12px_30px_-18px_var(--brand-2)] transition hover:brightness-110 disabled:opacity-60"
          disabled={isCreating}
          type="submit"
        >
          {isCreating
            ? UI_MESSAGES.workspace.create.submitting
            : UI_MESSAGES.workspace.create.submit}
        </button>
      </form>

      <form
        onSubmit={onJoinSubmit}
        noValidate
        className="flex flex-col gap-3 rounded-xl border border-border bg-noir-1/90 p-5 shadow-[0_20px_50px_-35px_var(--brand-1)] backdrop-blur"
      >
        <h2 className="text-lg font-semibold text-brand-5">
          {UI_MESSAGES.workspace.join.title}
        </h2>
        <p className="text-xs text-brand-5/70">
          {UI_MESSAGES.workspace.join.subtitle}
        </p>

        <label className="flex flex-col gap-1 text-sm">
          {UI_MESSAGES.workspace.join.idLabel}
          <input
            {...registerJoin("workspaceId")}
            className="rounded-xl border border-border px-3 py-2 outline-none transition focus:border-brand-3 focus:ring-2 focus:ring-(--brand-5)/60"
            type="text"
            placeholder={UI_MESSAGES.workspace.join.idPlaceholder}
          />
        </label>
        {joinErrors.workspaceId ? (
          <p className="text-sm text-red-600">
            {joinErrors.workspaceId.message}
          </p>
        ) : null}

        {joinServerError ? (
          <p className="text-sm text-red-600">{joinServerError}</p>
        ) : null}

        <button
          className="cursor-pointer rounded-xl bg-linear-to-r from-brand-1 via-brand-4 to-brand-4 px-4 py-2 font-medium text-white text-xs shadow-[0_12px_30px_-18px_var(--brand-2)] transition hover:brightness-110 disabled:opacity-60"
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
