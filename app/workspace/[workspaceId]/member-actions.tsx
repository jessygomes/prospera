"use client";

import { useTransition, useState } from "react";

import {
  updateMemberRoleAction,
  removeMemberAction,
  type WorkspaceMemberActionState,
} from "./actions";

type Role = "OWNER" | "ADMIN" | "MEMBER";

type MemberActionsProps = {
  memberId: string;
  workspaceId: string;
  currentRole: Role;
};

export function MemberActions({
  memberId,
  workspaceId,
  currentRole,
}: MemberActionsProps) {
  const [roleError, setRoleError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [isPendingRole, startRoleTransition] = useTransition();
  const [isPendingRemove, startRemoveTransition] = useTransition();

  function handleRoleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setRoleError(null);
    const newRole = event.target.value;

    const formData = new FormData();
    formData.set("memberId", memberId);
    formData.set("workspaceId", workspaceId);
    formData.set("role", newRole);

    startRoleTransition(async () => {
      const result: WorkspaceMemberActionState =
        await updateMemberRoleAction(formData);
      if (result?.error) setRoleError(result.error);
    });
  }

  function handleRemove() {
    setRemoveError(null);
    const formData = new FormData();
    formData.set("memberId", memberId);
    formData.set("workspaceId", workspaceId);

    setConfirmingRemove(false);
    startRemoveTransition(async () => {
      const result: WorkspaceMemberActionState =
        await removeMemberAction(formData);
      if (result?.error) setRemoveError(result.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {/* Sélecteur de rôle — désactivé pour OWNER */}
        <select
          value={currentRole}
          onChange={handleRoleChange}
          disabled={currentRole === "OWNER" || isPendingRole}
          className="rounded-lg border border-border/70 bg-surface-2/50 px-2 py-1 text-xs font-medium text-foreground/70 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="OWNER" disabled>
            OWNER
          </option>
          <option value="ADMIN">ADMIN</option>
          <option value="MEMBER">MEMBER</option>
        </select>

        {/* Bouton retirer */}
        {currentRole !== "OWNER" && !confirmingRemove && (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            disabled={isPendingRemove}
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
            aria-label="Retirer du workspace"
          >
            {isPendingRemove ? "…" : "Retirer"}
          </button>
        )}

        {/* Confirmation */}
        {confirmingRemove && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-foreground/50">Confirmer ?</span>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPendingRemove}
              className="rounded-lg border border-red-500/30 bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 hover:text-red-300 disabled:opacity-50"
            >
              {isPendingRemove ? "…" : "Oui"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingRemove(false);
                setRemoveError(null);
              }}
              disabled={isPendingRemove}
              className="rounded-lg border border-border/70 bg-surface-2 px-2 py-1 text-xs font-medium text-foreground/50 transition hover:text-foreground disabled:opacity-50"
            >
              Non
            </button>
          </div>
        )}
      </div>

      {roleError && <p className="text-[11px] text-red-400">{roleError}</p>}
      {removeError && <p className="text-[11px] text-red-400">{removeError}</p>}
    </div>
  );
}
