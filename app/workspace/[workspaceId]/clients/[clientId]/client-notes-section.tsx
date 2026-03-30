"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClientNoteAction, deleteClientNoteAction } from "../actions";

type ClientNote = {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  author: {
    name: string | null;
    email: string | null;
  } | null;
};

type Props = {
  workspaceId: string;
  clientId: string;
  notes: ClientNote[];
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ClientNotesSection({ workspaceId, clientId, notes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function submitNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createClientNoteAction(workspaceId, clientId, {
        content,
        isPinned,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      setContent("");
      setIsPinned(false);
      router.refresh();
    });
  }

  function deleteNote(noteId: string) {
    setError(null);

    startTransition(async () => {
      const result = await deleteClientNoteAction(
        workspaceId,
        clientId,
        noteId,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }

      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
      <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
        Notes client
      </h2>

      <form
        onSubmit={submitNote}
        className="mb-5 rounded-xl border border-border/60 bg-surface-2/20 p-3"
      >
        <label className="mb-1 block text-xs font-semibold text-foreground/60">
          Nouvelle note
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Ajoute ici une note contextuelle sur ce client..."
          className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-foreground/60">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-border/70 bg-surface-2 text-brand-1"
            />
            Épingler cette note
          </label>

          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
          >
            {isPending ? "Ajout..." : "Ajouter la note"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 bg-surface-2/20 px-4 py-6 text-sm text-foreground/50">
          Aucune note pour ce client.
        </p>
      ) : (
        <div className="space-y-2.5">
          {notes.map((note) => {
            const author = note.author?.name ?? note.author?.email ?? "Système";

            return (
              <article
                key={note.id}
                className="rounded-lg border border-border/60 bg-surface-2/20 px-3 py-2.5"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {note.isPinned && (
                      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        Épinglée
                      </span>
                    )}
                    <span className="text-[11px] text-foreground/40">
                      {formatDate(note.createdAt)} · {author}
                    </span>
                  </div>

                  {confirmDeleteId === note.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deleteNote(note.id)}
                        disabled={isPending}
                        className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:text-foreground"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(note.id)}
                      className="rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[11px] font-semibold text-red-400/70 transition hover:border-red-500/40 hover:text-red-400"
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm text-foreground/80">
                  {note.content}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
