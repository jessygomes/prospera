"use client";

import { useMemo, useState, useTransition } from "react";

type ManualItemDraft = {
  id: string;
  label: string;
  priceHt: string;
};

type QuoteSource = {
  id: string;
  invoiceNumber: string;
  issueDateLabel: string;
  totalLabel: string;
};

type ProjectOption = {
  id: string;
  name: string;
};

type Props = {
  workspaceId: string;
  clientId: string;
  clientCompany: string;
  clientEmail: string | null;
  quoteSources: QuoteSource[];
  projectOptions: ProjectOption[];
  userInfo: {
    email: string;
  };
};

const inputClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

const textareaClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

const envBankName = process.env.NEXT_PUBLIC_BANK_NAME?.trim();
const envBankIban =
  process.env.NEXT_PUBLIC_BANK_IBAN?.trim() ||
  process.env.NEXT_PUBLIC_IBAN?.trim();

const defaultBankDetails = [
  `Banque : ${envBankName || "Crédit Mutuel"}`,
  `IBAN : ${envBankIban || "FR....................."}`,
].join("\n");

function createManualItem(): ManualItemDraft {
  return {
    id: Math.random().toString(36).slice(2),
    label: "",
    priceHt: "",
  };
}

export function InvoicePdfGenerator({
  workspaceId,
  clientId,
  clientCompany,
  clientEmail,
  quoteSources,
  projectOptions,
  userInfo,
}: Props) {
  const [mode, setMode] = useState<"from-quote" | "manual">("from-quote");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [creatorName, setCreatorName] = useState("PINTO BARRETO Jessy");
  const [creatorEmail, setCreatorEmail] = useState(userInfo.email || "");
  const [creatorPhone, setCreatorPhone] = useState("0621194403");
  const [creatorSiret, setCreatorSiret] = useState("89385282200012");

  const [issuedAt, setIssuedAt] = useState(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });

  const [paymentTerms, setPaymentTerms] = useState(
    "Le règlement s'effectue en 2 échéances de [somme] EUR pour un montant total de [total] EUR : une première échéance payable à la réception de la facture, et une seconde payable à la livraison du produit.",
  );
  const [conditionsText, setConditionsText] = useState(
    "Paiement à réception En cas de retard de paiement, application d'une indemnité forfaitaire pour frais de recouvrement de 40EUR selon l'article D-441-5 du code du commerce",
  );
  const [bankDetails, setBankDetails] = useState(defaultBankDetails);

  const [selectedQuoteId, setSelectedQuoteId] = useState(
    quoteSources[0]?.id ?? "",
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [manualItems, setManualItems] = useState<ManualItemDraft[]>([
    createManualItem(),
  ]);

  const manualPreviewTotal = useMemo(() => {
    return manualItems.reduce((total, item) => {
      const parsed = Number(item.priceHt);
      return total + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    }, 0);
  }, [manualItems]);

  function updateManualItem(id: string, patch: Partial<ManualItemDraft>) {
    setManualItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeManualItem(id: string) {
    setManualItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  }

  async function generateInvoicePdf() {
    setError(null);

    const commonPayload = {
      creator: {
        name: creatorName,
        email: creatorEmail,
        phone: creatorPhone,
        siret: creatorSiret,
      },
      issuedAt,
      paymentTerms,
      conditionsText,
      bankDetails,
      projectId: selectedProjectId || undefined,
    };

    let payload: Record<string, unknown> = commonPayload;

    if (mode === "from-quote") {
      if (!selectedQuoteId) {
        setError("Selectionne un devis source pour generer la facture.");
        return;
      }
      payload = {
        ...commonPayload,
        sourceQuoteId: selectedQuoteId,
      };
    } else {
      const preparedItems = manualItems
        .map((item) => ({
          label: item.label.trim(),
          priceHt: Number(item.priceHt),
        }))
        .filter(
          (item) =>
            item.label.length > 0 &&
            Number.isFinite(item.priceHt) &&
            item.priceHt >= 0,
        );

      if (preparedItems.length === 0) {
        setError("Ajoute au moins une ligne valide pour la facture.");
        return;
      }

      payload = {
        ...commonPayload,
        items: preparedItems,
      };
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          `/workspace/${workspaceId}/clients/${clientId}/invoice-pdf`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          const message = await response.text();
          setError(message || "Generation de la facture impossible.");
          return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const fileName = `facture-${clientCompany
          .toLowerCase()
          .replace(/[^a-z0-9]+/gi, "-")}.pdf`;

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        setError(
          "Une erreur est survenue pendant la generation de la facture.",
        );
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-border/60 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Facture PDF</h2>
          <p className="text-xs text-foreground/50">
            Genere une facture depuis un devis ou en saisie manuelle.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("from-quote")}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
            mode === "from-quote"
              ? "border-brand-1/40 bg-brand-1/10 text-brand-1"
              : "border-border/70 bg-surface-2 text-foreground/65"
          }`}
        >
          Depuis un devis
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
            mode === "manual"
              ? "border-brand-1/40 bg-brand-1/10 text-brand-1"
              : "border-border/70 bg-surface-2 text-foreground/65"
          }`}
        >
          Saisie manuelle
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Ton nom
            </label>
            <input
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Email
            </label>
            <input
              value={creatorEmail}
              onChange={(e) => setCreatorEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Telephone
            </label>
            <input
              value={creatorPhone}
              onChange={(e) => setCreatorPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              SIRET
            </label>
            <input
              value={creatorSiret}
              onChange={(e) => setCreatorSiret(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Date de facture
            </label>
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Entreprise cliente
            </label>
            <input value={clientCompany} readOnly className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Lier à un projet (optionnel)
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className={inputClass}
            >
              <option value="">Aucun projet</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === "from-quote" ? (
          <div className="rounded-xl border border-border/60 bg-surface-2/20 p-3">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Devis source
            </label>
            <select
              value={selectedQuoteId}
              onChange={(e) => setSelectedQuoteId(e.target.value)}
              className={inputClass}
            >
              {quoteSources.length === 0 ? (
                <option value="">Aucun devis disponible</option>
              ) : (
                quoteSources.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.invoiceNumber} - {quote.issueDateLabel} -{" "}
                    {quote.totalLabel}
                  </option>
                ))
              )}
            </select>
            {quoteSources.length === 0 && (
              <p className="mt-2 text-xs text-foreground/50">
                Crée d&apos;abord un devis pour utiliser ce mode.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-surface-2/20 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Lignes de facture
            </h3>
            <div className="space-y-2">
              {manualItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_auto]"
                >
                  <input
                    value={item.label}
                    onChange={(e) =>
                      updateManualItem(item.id, { label: e.target.value })
                    }
                    className={inputClass}
                    placeholder="Ex: Integration page Accueil"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.priceHt}
                    onChange={(e) =>
                      updateManualItem(item.id, { priceHt: e.target.value })
                    }
                    className={inputClass}
                    placeholder="Prix HT"
                  />
                  <button
                    type="button"
                    onClick={() => removeManualItem(item.id)}
                    className="rounded-lg border border-border/70 bg-surface px-3 py-2 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setManualItems((prev) => [...prev, createManualItem()])
              }
              className="mt-2 rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
            >
              Ajouter une ligne
            </button>

            <div className="mt-3 rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs text-foreground/65">
              Total HT (manuel):{" "}
              {new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "EUR",
              }).format(manualPreviewTotal)}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground/60">
            Echeance
          </label>
          <textarea
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            rows={3}
            className={textareaClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground/60">
            Conditions
          </label>
          <textarea
            value={conditionsText}
            onChange={(e) => setConditionsText(e.target.value)}
            rows={4}
            className={textareaClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground/60">
            Details bancaires
          </label>
          <textarea
            value={bankDetails}
            onChange={(e) => setBankDetails(e.target.value)}
            rows={3}
            className={textareaClass}
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {clientEmail && (
        <p className="mt-3 text-xs text-foreground/45">
          Contact client: {clientEmail}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={generateInvoicePdf}
          disabled={isPending}
          className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-60"
        >
          {isPending ? "Generation..." : "Generer la facture PDF"}
        </button>
      </div>
    </section>
  );
}
