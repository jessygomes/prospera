import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNavbar } from "@/components/shared/app-navbar";
import { prisma } from "@/lib/prisma";

import { signOutAction } from "@/app/dashboard/actions";
import { InviteLinksPanel } from "../invite-links-panel";
import { MemberActions } from "../member-actions";
import { WorkspaceDeleteForm } from "../workspace-delete-form";
import { WorkspaceNameForm } from "../workspace-name-form";

type PageProps = {
  params: Promise<{ workspaceId: string }>;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function WorkspaceSettingsPage({ params }: PageProps) {
  const { workspaceId } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: true },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  const isOwner = membership.role === "OWNER";

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const inviteLinks = isManager
    ? await prisma.workspaceInviteLink.findMany({
        where: {
          workspaceId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          useCount: { lt: 1 },
        },
        select: {
          id: true,
          role: true,
          expiresAt: true,
          maxUses: true,
          useCount: true,
          createdAt: true,
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
        backHref={`/workspace/${workspaceId}`}
        backLabel="Workspace"
      />

      <main className="mx-auto w-full max-w-375 flex-1 px-4 py-10 sm:px-6 lg:px-20">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-2/70">
              Paramètres
            </p>
            <h1 className="font-heading text-3xl font-bold text-foreground">
              {membership.workspace.name}
            </h1>
            <p className="mt-1 text-xs text-foreground/45">
              Créé le {formatDate(membership.workspace.createdAt)}
            </p>
            <p className="mt-1 font-mono text-xs text-foreground/30">
              {membership.workspace.id}
            </p>
          </div>
          <Link
            href={`/workspace/${workspaceId}`}
            className="rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/60 transition hover:text-foreground"
          >
            Retour au workspace
          </Link>
        </div>

        <div className="space-y-6">
          <WorkspaceNameForm
            workspaceId={workspaceId}
            currentName={membership.workspace.name}
            canEdit={isManager}
          />

          <section className="rounded-xl border border-border/60 bg-surface p-4">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/40">
              Membres
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => {
                const name = member.user.name ?? member.user.email ?? "—";
                const initial = name[0]?.toUpperCase() ?? "U";
                const isOwner = member.role === "OWNER";
                const isMe = member.userId === userId;
                const showControls = isManager && !isMe;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/20 p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-1 to-brand-2 text-xs font-bold text-white">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {name}
                        {isMe ? (
                          <span className="ml-1.5 text-xs text-foreground/35">
                            (vous)
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-foreground/45">
                        {member.user.email}
                      </p>
                    </div>

                    {showControls ? (
                      <MemberActions
                        memberId={member.id}
                        workspaceId={workspaceId}
                        currentRole={
                          member.role as "OWNER" | "ADMIN" | "MEMBER"
                        }
                      />
                    ) : (
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                          isOwner
                            ? "bg-brand-1/15 text-brand-2"
                            : "bg-surface-2 text-foreground/50"
                        }`}
                      >
                        {member.role}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {isManager ? (
            <InviteLinksPanel
              workspaceId={workspaceId}
              inviteLinks={inviteLinks.map((link) => ({
                id: link.id,
                role: link.role as "ADMIN" | "MEMBER",
                expiresAt: link.expiresAt,
                maxUses: link.maxUses,
                useCount: link.useCount,
                createdAt: link.createdAt,
                createdByName: link.createdBy?.name ?? null,
                createdByEmail: link.createdBy?.email ?? null,
              }))}
            />
          ) : null}

          <WorkspaceDeleteForm
            workspaceId={workspaceId}
            workspaceName={membership.workspace.name}
            canDelete={isOwner}
          />
        </div>
      </main>
    </div>
  );
}
