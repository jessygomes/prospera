"use client";

import { useState, useTransition } from "react";

import {
  updateWorkspaceNameAction,
  type WorkspaceSettingsActionState,
} from "./actions";

type WorkspaceNameFormProps = {
  workspaceId: string;
  currentName: string;
  canEdit: boolean;
};

export function WorkspaceNameForm({
  workspaceId,
  currentName,
  canEdit,
}: WorkspaceNameFormProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);

    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("name", name);

    startTransition(async () => {
      const result: WorkspaceSettingsActionState =
        await updateWorkspaceNameAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  if (!canEdit) {
    return (
      <section className="rounded-xl border border-border/60 bg-surface p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-foreground/40">
          Informations du workspace
        </h2>
        <p className="text-sm text-foreground/70">Nom: {currentName}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/60 bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-foreground/40">
        Informations du workspace
      </h2>

      <label className="mb-1 block text-xs font-semibold text-foreground/60">
        Nom du workspace
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-70 flex-1 rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
          placeholder="Nom du workspace"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || name.trim() === currentName}
          className="rounded-lg bg-brand-1 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-2 disabled:opacity-60"
        >
          {isPending ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      {saved ? (
        <p className="mt-2 text-xs text-emerald-300">Nom mis à jour.</p>
      ) : null}
    </section>
  );
}
