"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hashInviteToken } from "@/lib/invite-link";
import { prisma } from "@/lib/prisma";

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    redirect("/dashboard");
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const tokenHash = hashInviteToken(token);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.workspaceInviteLink.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        workspaceId: true,
        role: true,
        expiresAt: true,
        revokedAt: true,
        maxUses: true,
        useCount: true,
      },
    });

    if (!link) {
      return { error: "Lien d'invitation introuvable." } as const;
    }

    const isInvalid =
      !!link.revokedAt ||
      link.expiresAt <= now ||
      link.useCount >= link.maxUses;
    if (isInvalid) {
      return {
        error: "Ce lien d'invitation a expiré ou a été révoqué.",
      } as const;
    }

    const existingMembership = await tx.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: link.workspaceId } },
      select: { id: true },
    });

    if (!existingMembership) {
      const role = link.role === "ADMIN" ? "ADMIN" : "MEMBER";
      await tx.workspaceMember.create({
        data: {
          userId,
          workspaceId: link.workspaceId,
          role,
        },
      });

      await tx.workspaceInviteLink.update({
        where: { id: link.id },
        data: { useCount: { increment: 1 } },
      });
    }

    return { workspaceId: link.workspaceId } as const;
  });

  if ("error" in result) {
    const errorMessage = result.error ?? "Invitation invalide.";
    redirect(`/invite/${token}?error=${encodeURIComponent(errorMessage)}`);
  }

  redirect(`/workspace/${result.workspaceId}`);
}
