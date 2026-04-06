"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClientTaskAction } from "./actions";

type ClientOption = {
  id: string;
  fullName: string;
  company: string | null;
};

type AssigneeOption = {
  id: string;
  name: string | null;
  email: string | null;
};

type ActionType =
  | "CALL"
  | "EMAIL"
  | "FOLLOW_UP"
  | "MEETING"
  | "PROPOSAL"
  | "OTHER";

const TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "CALL", label: "Appel" },
  { value: "EMAIL", label: "Email" },
  { value: "FOLLOW_UP", label: "Relance" },
  { value: "MEETING", label: "Réunion" },
  { value: "PROPOSAL", label: "Proposition" },
  { value: "OTHER", label: "Autre" },
];

const inputClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

type Props = {
  workspaceId: string;
  clients: ClientOption[];
  assignees: AssigneeOption[];
  compact?: boolean;
};

export function ClientActionCreateInline({
  workspaceId,
  clients,
  assignees,
  compact = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [clientSearch, setClientSearch] = useState(clients[0]?.fullName ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActionType>("FOLLOW_UP");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [description, setDescription] = useState("");

  const selectedClient =
    clients.find((client) => client.id === clientId) ?? null;

  const filteredClients = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return clients.slice(0, 8);
    }

    return clients
      .filter((client) => {
        const haystack =
          `${client.fullName} ${client.company ?? ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .slice(0, 8);
  }, [clientSearch, clients]);

  function resetForm() {
    setClientId(clients[0]?.id ?? "");
    setClientSearch(clients[0]?.fullName ?? "");
    setTitle("");
    setType("FOLLOW_UP");
    setDueDate("");
    setAssignedToId("");
    setDescription("");
    setIsClientPickerOpen(false);
  }

  function selectClient(nextClient: ClientOption) {
    setClientId(nextClient.id);
    setClientSearch(nextClient.fullName);
    setIsClientPickerOpen(false);
  }

  function handleCreate() {
    if (!clientId || !title.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await createClientTaskAction(workspaceId, clientId, {
        title,
        type,
        dueDate: dueDate || undefined,
        assignedToId: assignedToId || undefined,
        description: description || undefined,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }

      resetForm();
      setIsExpanded(false);
      router.refresh();
    });
  }

  const formContent = (
    <>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-6">
        <div className="relative md:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-foreground/60">
            Client
          </label>
          <input
            value={clientSearch}
            onFocus={() => setIsClientPickerOpen(true)}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setClientId("");
              setIsClientPickerOpen(true);
            }}
            placeholder="Nom du client ou entreprise"
            className={inputClass}
          />
          {isClientPickerOpen && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border/70 bg-surface p-1 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)]">
              {filteredClients.length === 0 ? (
                <p className="px-3 py-2 text-xs text-foreground/45">
                  Aucun client ne correspond a la recherche.
                </p>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectClient(client)}
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-surface-2"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {client.fullName}
                    </span>
                    <span className="text-[11px] text-foreground/45">
                      {client.company ?? "Sans entreprise"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-foreground/60">
            Titre
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Relancer pour validation du devis"
            className={inputClass}
          />
        </div>

        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-semibold text-foreground/60">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ActionType)}
            className={inputClass}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-semibold text-foreground/60">
            Echeance
          </label>
          <input
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            type="date"
            className={inputClass}
          />
        </div>
      </div>

      <details className="mt-2 rounded-xl border border-border/50 bg-surface-2/30 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-foreground/55">
          Options
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Assigne a
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Non assigne</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name ?? assignee.email ?? "Utilisateur"}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="Contexte, objectif, elements a verifier..."
            />
          </div>
        </div>
      </details>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending || !clientId || !title.trim() || !selectedClient}
          className="rounded-xl bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
        >
          {isPending ? "Creation..." : "Ajouter l action"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setIsClientPickerOpen(false);
            if (selectedClient) {
              setClientSearch(selectedClient.fullName);
            }
          }}
          disabled={isPending}
          className="rounded-xl border border-border/70 bg-surface px-4 py-2 text-sm font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </>
  );

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="shrink-0 rounded-xl bg-brand-1 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(109,15,242,0.4)] transition hover:bg-brand-4 hover:shadow-[0_4px_24px_-4px_rgba(109,15,242,0.55)]"
        >
          {isExpanded ? "Fermer" : "+ Nouvelle action"}
        </button>

        {isExpanded && (
          <div className="absolute right-0 z-30 mt-2 w-[min(860px,92vw)] rounded-2xl border border-border/60 bg-surface p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]">
            {formContent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-surface p-4 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">
            Nouvelle action
          </h2>
          <p className="text-sm text-foreground/45">
            {isExpanded
              ? "Creation rapide dans la pipeline CRM."
              : "Formulaire compact et repliable."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="rounded-xl border border-border/70 bg-surface-2 px-3 py-2 text-xs font-semibold text-foreground/70 transition hover:border-brand-1/30 hover:text-foreground"
        >
          {isExpanded ? "Replier" : "+ Nouvelle action"}
        </button>
      </div>

      {isExpanded ? <div className="mt-4">{formContent}</div> : null}
    </div>
  );
}
