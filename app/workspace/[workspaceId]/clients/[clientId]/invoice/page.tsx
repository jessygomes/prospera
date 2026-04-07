import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/components/shared/app-navbar";
import { signOutAction } from "@/app/dashboard/actions";
import { prisma } from "@/lib/prisma";

import { InvoicePdfGenerator } from "../invoice-pdf-generator";

type PageProps = {
  params: Promise<{ workspaceId: string; clientId: string }>;
};

export default async function ClientInvoicePage({ params }: PageProps) {
  const { workspaceId, clientId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { name: true } } },
  });
  if (!membership) redirect("/dashboard");

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      id: true,
      fullName: true,
      company: true,
      email: true,
      projects: {
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!client) {
    redirect(`/workspace/${workspaceId}/clients`);
  }

  const quoteSources = await prisma.invoice.findMany({
    where: {
      workspaceId,
      clientId,
      invoiceNumber: {
        startsWith: "DEV-",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      total: true,
    },
  });

  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}/clients/${client.id}`}
        backLabel="Fiche client"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 rounded-2xl border border-border/60 bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-2/70">
                Facture client
              </p>
              <h1 className="mt-1 font-heading text-2xl font-bold text-foreground">
                {client.company ?? "Entreprise non renseignee"}
              </h1>
              {client.fullName && (
                <p className="mt-1 text-sm text-foreground/55">
                  Contact: {client.fullName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/workspace/${workspaceId}/clients/${client.id}/quote`}
                className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
              >
                Creer un devis
              </Link>
              <Link
                href={`/workspace/${workspaceId}/clients/${client.id}`}
                className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
              >
                Retour fiche client
              </Link>
            </div>
          </div>
        </div>

        <InvoicePdfGenerator
          workspaceId={workspaceId}
          clientId={client.id}
          clientCompany={client.company ?? "Entreprise non renseignee"}
          clientEmail={client.email}
          quoteSources={quoteSources.map((quote) => ({
            id: quote.id,
            invoiceNumber: quote.invoiceNumber,
            issueDateLabel: new Intl.DateTimeFormat("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(quote.issueDate),
            totalLabel: new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(Number(quote.total)),
          }))}
          projectOptions={client.projects.map((project) => ({
            id: project.id,
            name: project.name,
          }))}
          userInfo={{
            email: session.user?.email ?? "",
          }}
        />
      </main>
    </div>
  );
}
