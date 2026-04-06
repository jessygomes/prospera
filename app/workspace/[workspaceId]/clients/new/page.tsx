import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/components/shared/app-navbar";
import { prisma } from "@/lib/prisma";
import { signOutAction } from "@/app/dashboard/actions";
import { NewClientForm } from "./new-client-form";

type PageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function NewClientPage({ params }: PageProps) {
  const { workspaceId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { name: true } } },
  });
  if (!membership) redirect("/dashboard");

  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}/clients`}
        backLabel="Clients"
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-20">
        <div className="mb-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-2/70">
            Nouveau client
          </p>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Ajouter un client
          </h1>
          <p className="mt-1 text-sm text-foreground/40">
            Workspace : {membership.workspace.name}
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface p-8 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.15)]">
          <NewClientForm workspaceId={workspaceId} />
        </div>
      </main>
    </div>
  );
}
