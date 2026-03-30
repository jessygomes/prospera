"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteProjectDocumentAction } from "../../../actions";
import { useUploadThing } from "@/lib/uploadthing-client";

type DocumentCategory =
  | "CONTRACT"
  | "QUOTE"
  | "INVOICE"
  | "BRIEF"
  | "DELIVERY"
  | "OTHER";

type ProjectDocument = {
  id: string;
  name: string;
  url: string;
  category: DocumentCategory;
  mimeType: string | null;
  size: number | null;
  createdAt: Date;
  uploadedBy: {
    name: string | null;
    email: string | null;
  } | null;
};

type Props = {
  workspaceId: string;
  clientId: string;
  projectId: string;
  documents: ProjectDocument[];
};

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "CONTRACT", label: "Contrat" },
  { value: "QUOTE", label: "Devis" },
  { value: "INVOICE", label: "Facture" },
  { value: "BRIEF", label: "Brief" },
  { value: "DELIVERY", label: "Livrable" },
  { value: "OTHER", label: "Autre" },
];

const inputClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatSize(size: number | null): string {
  if (size == null) return "—";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageDocument(doc: ProjectDocument): boolean {
  if (doc.mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(doc.url);
}

export function ProjectDocumentsSection({
  workspaceId,
  clientId,
  projectId,
  documents,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<DocumentCategory>("OTHER");
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selectedFiles = useMemo(
    () => (uploadFiles ? Array.from(uploadFiles) : []),
    [uploadFiles],
  );

  const imagePreviews = useMemo(
    () =>
      selectedFiles
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, 8)
        .map((file) => ({
          name: file.name,
          url: URL.createObjectURL(file),
        })),
    [selectedFiles],
  );

  useEffect(() => {
    return () => {
      for (const preview of imagePreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [imagePreviews]);

  const { startUpload, isUploading } = useUploadThing("projectMedia", {
    onUploadError: (err) => {
      setError(err.message || "Upload impossible.");
    },
    onClientUploadComplete: () => {
      setUploadFiles(null);
      router.refresh();
    },
  });

  function deleteDocument(documentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteProjectDocumentAction(
        workspaceId,
        clientId,
        projectId,
        documentId,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setUploadFiles(files);
    }
  }

  async function uploadDocumentFiles() {
    if (!uploadFiles || uploadFiles.length === 0) return;

    setError(null);
    await startUpload(Array.from(uploadFiles), {
      workspaceId,
      clientId,
      projectId,
      category,
    });
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
      <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
        Documents et photos
      </h2>

      <div className="mb-5 rounded-xl border border-border/60 bg-surface-2/20 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/55">
          Upload direct (gratuit)
        </p>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-6">
          <div
            className={`md:col-span-4 rounded-lg border border-dashed p-3 transition ${
              isDragActive
                ? "border-brand-1 bg-brand-1/10"
                : "border-border/60 bg-surface-2/30"
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Fichier(s)
            </label>
            <p className="mb-2 text-xs text-foreground/45">
              Glisse-dépose tes images/documents ici ou sélectionne des
              fichiers.
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => setUploadFiles(e.target.files)}
              className="block w-full cursor-pointer rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand-1/15 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-brand-1"
            />

            {selectedFiles.length > 0 && (
              <p className="mt-2 text-xs text-foreground/50">
                {selectedFiles.length} fichier
                {selectedFiles.length > 1 ? "s" : ""} sélectionné
                {selectedFiles.length > 1 ? "s" : ""}.
              </p>
            )}

            {imagePreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {imagePreviews.map((preview) => (
                  <div
                    key={preview.url}
                    className="overflow-hidden rounded-md border border-border/60 bg-surface"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.url}
                      alt={preview.name}
                      className="h-24 w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Catégorie
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={uploadDocumentFiles}
            disabled={isUploading || !uploadFiles || uploadFiles.length === 0}
            className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-50"
          >
            {isUploading ? "Upload..." : "Uploader les fichiers"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 bg-surface-2/20 px-4 py-6 text-sm text-foreground/50">
          Aucun document pour ce projet.
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-lg border border-border/60 bg-surface-2/20 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {doc.name}
                  </p>
                  <p className="text-xs text-foreground/45">
                    {
                      CATEGORY_OPTIONS.find((o) => o.value === doc.category)
                        ?.label
                    }{" "}
                    · {formatSize(doc.size)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:border-brand-1/30 hover:text-foreground"
                  >
                    Ouvrir
                  </a>
                  {confirmDeleteId === doc.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        disabled={isPending}
                        className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={isPending}
                        className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:text-foreground disabled:opacity-50"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(doc.id)}
                      disabled={isPending}
                      className="rounded-md border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/50 transition hover:border-red-500/30 hover:text-red-400 disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              {isImageDocument(doc) && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 mb-2 inline-block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={doc.url}
                    alt={doc.name}
                    className="max-h-24 max-w-[180px] rounded-md border border-border/60 object-contain"
                  />
                </a>
              )}

              <p className="mt-1 text-[11px] text-foreground/40">
                Ajouté le {formatDate(doc.createdAt)}
                {doc.uploadedBy
                  ? ` par ${doc.uploadedBy.name ?? doc.uploadedBy.email ?? "—"}`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
