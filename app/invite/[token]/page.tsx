import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hashInviteToken } from "@/lib/invite-link";
import { prisma } from "@/lib/prisma";

import { acceptInviteAction } from "../actions";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function InvitePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { error } = await searchParams;
  const cleanedToken = token.trim();
  if (!cleanedToken) {
    redirect("/dashboard");
  }

  const tokenHash = hashInviteToken(cleanedToken);
  const invite = await prisma.workspaceInviteLink.findUnique({
    where: { tokenHash },
    select: {
      role: true,
      expiresAt: true,
      revokedAt: true,
      maxUses: true,
      useCount: true,
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-border/60 bg-surface p-6">
          <h1 className="text-xl font-semibold text-foreground">
            Invitation invalide
          </h1>
          <p className="mt-2 text-sm text-foreground/55">
            Ce lien n&apos;existe pas ou n&apos;est plus valide.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white"
          >
            Retour au dashboard
          </Link>
        </div>
      </main>
    );
  }

  const isExpired =
    !!invite.revokedAt ||
    invite.expiresAt <= new Date() ||
    invite.useCount >= invite.maxUses;

  const session = await auth();
  const userId = session?.user?.id;

  const alreadyMember = userId
    ? await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: invite.workspace.id,
          },
        },
        select: { id: true },
      })
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-border/60 bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-2/70">
          Invitation workspace
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          Rejoindre {invite.workspace.name}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          Rôle proposé: <span className="font-semibold">{invite.role}</span>
        </p>

        {isExpired ? (
          <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            Ce lien a expiré, a été révoqué, ou a déjà été utilisé.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {!userId && !isExpired ? (
          <div className="mt-5 space-y-2">
            <p className="text-sm text-foreground/60">
              Connectez-vous pour accepter cette invitation.
            </p>
            <Link
              href={`/signin?callbackUrl=${encodeURIComponent(`/invite/${cleanedToken}`)}`}
              className="inline-flex rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white"
            >
              Se connecter
            </Link>
          </div>
        ) : null}

        {alreadyMember && !isExpired ? (
          <div className="mt-5 space-y-2">
            <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              Vous êtes déjà membre de ce workspace.
            </p>
            <Link
              href={`/workspace/${invite.workspace.id}`}
              className="inline-flex rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white"
            >
              Ouvrir le workspace
            </Link>
          </div>
        ) : null}

        {userId && !alreadyMember && !isExpired ? (
          <form action={acceptInviteAction} className="mt-5 space-y-3">
            <input type="hidden" name="token" value={cleanedToken} />
            <button
              type="submit"
              className="inline-flex rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white"
            >
              Accepter l&apos;invitation
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
