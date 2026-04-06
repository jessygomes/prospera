import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { AppNavbar } from "@/components/shared/app-navbar";
import { CreateWorkspaceInlineForm } from "./create-workspace-inline-form";
import { JoinWorkspaceInlineForm } from "./join-workspace-inline-form";
import { signOutAction } from "./actions";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    redirect("/onboarding/workspace");
  }

  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
      />

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-375 flex-1 px-4 py-10 sm:px-6 lg:px-20">
        {/* Page heading */}
        <div className="mb-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-2/70">
            Tableau de bord
          </p>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Bonjour, {session.user?.name ?? "là"}&nbsp;👋
          </h1>
          <p className="mt-1.5 text-sm text-foreground/50">
            Retrouvez et gérez vos espaces de travail ci-dessous.
          </p>
        </div>

        {/* Stats row */}
        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-surface p-4">
            <p className="text-xs text-foreground/40 uppercase tracking-wider font-medium">
              Workspaces
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {memberships.length}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border border-border/60 bg-surface p-4 sm:col-span-2 lg:col-span-3">
            <div className="grid gap-4 lg:grid-cols-2">
              <CreateWorkspaceInlineForm />
              <JoinWorkspaceInlineForm />
            </div>
          </div>
        </div>

        {/* Section workspaces */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
              Vos espaces de travail
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memberships.map((membership) => {
              const initial = membership.workspace.name[0].toUpperCase();
              const isOwner = membership.role === "OWNER";

              return (
                <Link
                  key={membership.id}
                  href={`/workspace/${membership.workspace.id}`}
                  className="group relative rounded-xl border border-border/60 bg-surface p-5 transition-all duration-200 hover:border-brand-2/40 hover:shadow-[0_8px_30px_-8px_var(--brand-1)] hover:-translate-y-0.5"
                >
                  {/* Workspace icon */}
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-brand-1/20 to-brand-3/10 text-base font-bold text-brand-2 ring-1 ring-brand-3/20">
                    {initial}
                  </div>

                  <h3 className="font-heading text-base font-semibold text-foreground leading-tight">
                    {membership.workspace.name}
                  </h3>

                  <p className="mt-0.5 font-mono text-[10px] text-foreground/30 truncate">
                    {membership.workspace.id}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                        isOwner
                          ? "bg-brand-1/15 text-brand-2"
                          : "bg-surface-2 text-foreground/50"
                      }`}
                    >
                      {membership.role}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
