"use client";

import { useState, useTransition } from "react";

import {
  deleteWorkspaceAction,
  type WorkspaceSettingsActionState,
} from "./actions";

type WorkspaceDeleteFormProps = {
  workspaceId: string;
  workspaceName: string;
  canDelete: boolean;
};

export function WorkspaceDeleteForm({
  workspaceId,
  workspaceName,
  canDelete,
}: WorkspaceDeleteFormProps) {
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);

    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("confirmName", confirmName);

    startTransition(async () => {
      const result: WorkspaceSettingsActionState =
        await deleteWorkspaceAction(formData);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-300">
        Zone dangereuse
      </h2>
      <p className="text-sm text-foreground/70">
        Supprimer ce workspace efface définitivement toutes les données liées:
        membres, clients, projets, factures, documents, notes, actions et
        historique.
      </p>

      {!canDelete ? (
        <p className="mt-3 text-xs text-foreground/55">
          Seul le propriétaire du workspace peut effectuer cette action.
        </p>
      ) : (
        <>
          <label className="mt-4 block text-xs font-semibold text-foreground/60">
            Saisis exactement le nom du workspace pour confirmer:{" "}
            {workspaceName}
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={workspaceName}
              className="min-w-70 flex-1 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-foreground outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/25"
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending || confirmName.trim() !== workspaceName}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Suppression..." : "Supprimer définitivement"}
            </button>
          </div>
        </>
      )}

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </section>
  );
}
