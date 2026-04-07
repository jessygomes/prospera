import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/components/shared/app-navbar";
import { signOutAction } from "@/app/dashboard/actions";
import { prisma } from "@/lib/prisma";

import { QuotePdfGenerator } from "../quote-pdf-generator";

type PageProps = {
  params: Promise<{ workspaceId: string; clientId: string }>;
};

export default async function ClientQuotePage({ params }: PageProps) {
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
      notes: true,
      projects: {
        select: { name: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!client) {
    redirect(`/workspace/${workspaceId}/clients`);
  }

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
                Devis client
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

            <Link
              href={`/workspace/${workspaceId}/clients/${client.id}`}
              className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground/65 transition hover:text-foreground"
            >
              Retour fiche client
            </Link>
          </div>
        </div>

        <QuotePdfGenerator
          workspaceId={workspaceId}
          clientId={client.id}
          clientCompany={client.company ?? "Entreprise non renseignee"}
          clientEmail={client.email}
          defaultSummary=""
          defaultPages={[]}
          userInfo={{
            name: session.user?.name ?? "",
            email: session.user?.email ?? "",
          }}
        />
      </main>
    </div>
  );
}
