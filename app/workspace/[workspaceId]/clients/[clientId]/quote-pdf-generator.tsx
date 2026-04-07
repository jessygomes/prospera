"use client";

import { useMemo, useState, useTransition } from "react";

type QuoteItemDraft = {
  id: string;
  label: string;
  priceHt: string;
};

type SitePageDraft = {
  id: string;
  title: string;
  description: string;
};

type Props = {
  workspaceId: string;
  clientId: string;
  clientCompany: string;
  clientEmail: string | null;
  defaultSummary: string;
  defaultPages: string[];
  userInfo: {
    name: string;
    email: string;
  };
};

const inputClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

const textareaClass =
  "w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-1/40 focus:ring-2 focus:ring-brand-1/15";

function createDraftItem(): QuoteItemDraft {
  return {
    id: Math.random().toString(36).slice(2),
    label: "",
    priceHt: "",
  };
}

function createSitePageDraft(): SitePageDraft {
  return {
    id: Math.random().toString(36).slice(2),
    title: "",
    description: "",
  };
}

export function QuotePdfGenerator({
  workspaceId,
  clientId,
  clientCompany,
  clientEmail,
  defaultSummary,
  defaultPages,
  userInfo,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [creatorName, setCreatorName] = useState("PINTO BARRETO Jessy");
  const [creatorEmail, setCreatorEmail] = useState(userInfo.email || "");
  const [creatorPhone, setCreatorPhone] = useState("0621194403");
  const [creatorSiret, setCreatorSiret] = useState("89385282200012");

  const [createdAt, setCreatedAt] = useState(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });

  const [needSummary, setNeedSummary] = useState(defaultSummary || "");
  const [sitePages, setSitePages] = useState<SitePageDraft[]>(
    defaultPages.length > 0
      ? defaultPages.map((page, index) => ({
          id: `default-page-${index}`,
          title: page,
          description: "",
        }))
      : [createSitePageDraft()],
  );
  const [features, setFeatures] = useState("");
  const [technicalDescription, setTechnicalDescription] = useState(
    "Le site web sera entièrement développer en code pur pour une meilleure optimisation et liberté d’expression. Nous utiliserons principalement les langages informatiques : HTML & CSS pour un référencement naturel et ajouter le style graphique ainsi que JavaScripts (React JS via Next.JS) pour un site dynamique.\n\nVous aurez accès à l’ensemble des fichiers du code source une fois le site livré.\n\nLe site sera responsive, ainsi il s’adaptera parfaitement à l’ensemble des supports (ordinateurs, tablettes et mobiles). Ce système permet de garantir une navigation et une expérience utilisateur optimal quel que soit le support utilisé par les visiteurs du site.",
  );
  const [planning, setPlanning] = useState(
    "La première version du site web pourra être livrée dans un délai maximum de 2 à 3 semaines à compter de la réception de l’ensemble des éléments de contenu (textes, images, vidéo). S’il n’y pas de retour client, ce sera la livraison finale. La seconde version du site web pourra être livrée dans un délai maximum de 2 semaines à compter de la réception des retours clients.",
  );
  const [paymentTerms, setPaymentTerms] = useState(
    "50% a la commande, 50% a la livraison.",
  );

  const [maintenanceDescription, setMaintenanceDescription] = useState(
    "La maintenance technique vous permet de bénéficier des dernières mises à jour ou de toutes modifications minimes dans votre site qui ne nécessitent pas de refaire un devis complet.\n\nIl est possible de nous confier la réalisation de ces tâches en souscrivant à un contrat de maintenance.",
  );

  const [items, setItems] = useState<QuoteItemDraft[]>([createDraftItem()]);

  const previewTotalHt = useMemo(() => {
    return items.reduce((total, item) => {
      const parsed = Number(item.priceHt);
      return total + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    }, 0);
  }, [items]);

  function updateItem(id: string, patch: Partial<QuoteItemDraft>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  }

  function updateSitePage(id: string, patch: Partial<SitePageDraft>) {
    setSitePages((prev) =>
      prev.map((page) => (page.id === id ? { ...page, ...patch } : page)),
    );
  }

  function removeSitePage(id: string) {
    setSitePages((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((page) => page.id !== id);
    });
  }

  async function generatePdf() {
    setError(null);

    const preparedItems = items
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
      setError("Ajoute au moins une ligne de devis valide.");
      return;
    }

    const preparedSitePages = sitePages
      .map((page) => ({
        title: page.title.trim(),
        description: page.description.trim(),
      }))
      .filter((page) => page.title.length > 0 && page.description.length > 0);

    if (
      preparedSitePages.length > 0 &&
      preparedSitePages.length !== sitePages.length
    ) {
      setError("Renseigne un nom et une description pour chaque page du site.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          `/workspace/${workspaceId}/clients/${clientId}/quote-pdf`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              creator: {
                name: creatorName,
                email: creatorEmail,
                phone: creatorPhone,
                siret: creatorSiret,
              },
              createdAt,
              needSummary,
              sitePages: preparedSitePages,
              features: features
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
              technicalDescription,
              planning,
              paymentTerms,
              maintenance: {
                description: maintenanceDescription,
              },
              items: preparedItems,
            }),
          },
        );

        if (!response.ok) {
          const message = await response.text();
          setError(message || "Generation du PDF impossible.");
          return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const fileName = `devis-${clientCompany.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.pdf`;

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        setError("Une erreur est survenue pendant la generation du PDF.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Devis PDF</h2>
          <p className="text-xs text-foreground/50">
            Genere un devis structure avec TVA et zone de signature client.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border/50 bg-surface-2/20 px-3 py-2 text-xs text-foreground/60">
        Total HT actuel:{" "}
        {new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(previewTotalHt)}
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
              Date du devis
            </label>
            <input
              type="date"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Entreprise cliente
            </label>
            <input value={clientCompany} readOnly className={inputClass} />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface-2/20 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Contenu de la proposition
          </h3>
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Resume du besoin
              </label>
              <textarea
                value={needSummary}
                onChange={(e) => setNeedSummary(e.target.value)}
                rows={4}
                className={textareaClass}
                placeholder="Decris le besoin du client pour ce projet (objectif, contexte, contraintes)."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Pages du site (nom + description)
              </label>
              <div className="space-y-2">
                {sitePages.map((page) => (
                  <div
                    key={page.id}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-surface p-2.5"
                  >
                    <input
                      value={page.title}
                      onChange={(e) =>
                        updateSitePage(page.id, { title: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Nom de la page (ex: Accueil)"
                    />
                    <textarea
                      value={page.description}
                      onChange={(e) =>
                        updateSitePage(page.id, {
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className={textareaClass}
                      placeholder="Description de la page"
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() => removeSitePage(page.id)}
                        className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
                      >
                        Supprimer la page
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setSitePages((prev) => [...prev, createSitePageDraft()])
                }
                className="mt-2 rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
              >
                Ajouter une page
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Fonctionnalites incluses (une ligne = un point)
              </label>
              <textarea
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                rows={4}
                className={textareaClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Description technique
              </label>
              <textarea
                value={technicalDescription}
                onChange={(e) => setTechnicalDescription(e.target.value)}
                rows={4}
                className={textareaClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Planning
              </label>
              <textarea
                value={planning}
                onChange={(e) => setPlanning(e.target.value)}
                rows={3}
                className={textareaClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Modalites de paiement
              </label>
              <textarea
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                rows={3}
                className={textareaClass}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface-2/20 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Lignes de devis
          </h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_auto]"
              >
                <input
                  value={item.label}
                  onChange={(e) =>
                    updateItem(item.id, { label: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Ex: Design maquette Figma"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.priceHt}
                  onChange={(e) =>
                    updateItem(item.id, { priceHt: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Prix HT"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-lg border border-border/70 bg-surface px-3 py-2 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, createDraftItem()])}
            className="mt-2 rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
          >
            Ajouter une ligne
          </button>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface-2/20 p-3">
          <p className="text-xs font-semibold text-foreground/75">
            Option Maintenance technique: 40 EUR / mois
          </p>
          <p className="mt-1 text-xs text-foreground/50">
            Le PDF inclura une case Oui/Non a cocher par le client.
          </p>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/60">
                Description maintenance
              </label>
              <textarea
                value={maintenanceDescription}
                onChange={(e) => setMaintenanceDescription(e.target.value)}
                rows={3}
                className={textareaClass}
              />
            </div>
          </div>
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
          onClick={generatePdf}
          disabled={isPending}
          className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-4 disabled:opacity-60"
        >
          {isPending ? "Generation..." : "Generer le devis PDF"}
        </button>
      </div>
    </section>
  );
}
