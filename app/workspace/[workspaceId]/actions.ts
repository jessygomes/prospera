"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";

import { auth } from "@/auth";
import { generateInviteToken, hashInviteToken } from "@/lib/invite-link";
import { ERROR_MESSAGES } from "@/lib/messages/errors";
import { prisma } from "@/lib/prisma";

export type WorkspaceMemberActionState = {
  error?: string;
};

export type CreateInviteLinkActionState = {
  error?: string;
  inviteToken?: string;
};

export type WorkspaceSettingsActionState = {
  error?: string;
};

async function getCurrentUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");
  return userId;
}

/** Vérifie que l'appelant est OWNER ou ADMIN dans ce workspace */
async function requireManagerRole(
  callerId: string,
  workspaceId: string,
): Promise<void> {
  const caller = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: callerId, workspaceId } },
    select: { role: true },
  });
  if (!caller || (caller.role !== "OWNER" && caller.role !== "ADMIN")) {
    throw new Error(ERROR_MESSAGES.common.invalidData);
  }
}

export async function updateMemberRoleAction(
  formData: FormData,
): Promise<WorkspaceMemberActionState> {
  const callerId = await getCurrentUserId();
  const memberId = String(formData.get("memberId") ?? "");
  const newRole = String(formData.get("role") ?? "") as "ADMIN" | "MEMBER";
  const workspaceId = String(formData.get("workspaceId") ?? "");

  if (!memberId || !workspaceId || !["ADMIN", "MEMBER"].includes(newRole)) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  try {
    await requireManagerRole(callerId, workspaceId);
  } catch {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  // Récupère le membre cible
  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { role: true, workspaceId: true },
  });

  if (!target || target.workspaceId !== workspaceId) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  // Impossible de modifier le rôle d'un OWNER
  if (target.role === "OWNER") {
    return { error: "Impossible de modifier le rôle du propriétaire." };
  }

  await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role: newRole },
  });

  revalidatePath(`/workspace/${workspaceId}`);
  return {};
}

export async function removeMemberAction(
  formData: FormData,
): Promise<WorkspaceMemberActionState> {
  const callerId = await getCurrentUserId();
  const memberId = String(formData.get("memberId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");

  if (!memberId || !workspaceId) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  try {
    await requireManagerRole(callerId, workspaceId);
  } catch {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { role: true, workspaceId: true, userId: true },
  });

  if (!target || target.workspaceId !== workspaceId) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  // Impossible de retirer le dernier OWNER
  if (target.role === "OWNER") {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return {
        error: "Impossible de retirer le seul propriétaire du workspace.",
      };
    }
  }

  await prisma.workspaceMember.delete({ where: { id: memberId } });

  revalidatePath(`/workspace/${workspaceId}`);
  return {};
}

export async function createInviteLinkAction(
  formData: FormData,
): Promise<CreateInviteLinkActionState> {
  const callerId = await getCurrentUserId();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const role = String(formData.get("role") ?? "MEMBER") as "ADMIN" | "MEMBER";
  const expiresInDays = Number(formData.get("expiresInDays") ?? 7);

  if (!workspaceId || !["ADMIN", "MEMBER"].includes(role)) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  if (
    !Number.isFinite(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > 30
  ) {
    return {
      error: "La durée de validité doit être comprise entre 1 et 30 jours.",
    };
  }

  try {
    await requireManagerRole(callerId, workspaceId);
  } catch {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  const inviteToken = generateInviteToken();
  const tokenHash = hashInviteToken(inviteToken);

  await prisma.workspaceInviteLink.create({
    data: {
      workspaceId,
      createdById: callerId,
      role,
      tokenHash,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      maxUses: 1,
    },
  });

  revalidatePath(`/workspace/${workspaceId}`);
  return { inviteToken };
}

export async function revokeInviteLinkAction(
  formData: FormData,
): Promise<WorkspaceMemberActionState> {
  const callerId = await getCurrentUserId();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const inviteLinkId = String(formData.get("inviteLinkId") ?? "");

  if (!workspaceId || !inviteLinkId) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  try {
    await requireManagerRole(callerId, workspaceId);
  } catch {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  const link = await prisma.workspaceInviteLink.findUnique({
    where: { id: inviteLinkId },
    select: { workspaceId: true, revokedAt: true },
  });

  if (!link || link.workspaceId !== workspaceId) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  if (!link.revokedAt) {
    await prisma.workspaceInviteLink.update({
      where: { id: inviteLinkId },
      data: { revokedAt: new Date() },
    });
  }

  revalidatePath(`/workspace/${workspaceId}`);
  return {};
}

export async function updateWorkspaceNameAction(
  formData: FormData,
): Promise<WorkspaceSettingsActionState> {
  const callerId = await getCurrentUserId();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!workspaceId) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  if (name.length < 2 || name.length > 80) {
    return {
      error: "Le nom du workspace doit contenir entre 2 et 80 caractères.",
    };
  }

  try {
    await requireManagerRole(callerId, workspaceId);
  } catch {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name },
  });

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath(`/workspace/${workspaceId}/settings`);
  return {};
}

export async function deleteWorkspaceAction(
  formData: FormData,
): Promise<WorkspaceSettingsActionState> {
  const callerId = await getCurrentUserId();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();

  if (!workspaceId) {
    return { error: ERROR_MESSAGES.common.invalidData };
  }

  const callerMembership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: callerId, workspaceId } },
    select: {
      role: true,
      workspace: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!callerMembership || callerMembership.role !== "OWNER") {
    return {
      error: "Seul le proprietaire du workspace peut le supprimer.",
    };
  }

  if (!callerMembership.workspace) {
    return { error: ERROR_MESSAGES.workspace.notFound };
  }

  if (confirmName !== callerMembership.workspace.name) {
    return {
      error:
        "Le nom saisi ne correspond pas. Saisis exactement le nom du workspace pour confirmer.",
    };
  }

  const documents = await prisma.document.findMany({
    where: { workspaceId },
    select: { url: true },
  });

  const uploadThingKeys = Array.from(
    new Set(
      documents
        .map((document) => {
          try {
            const parsed = new URL(document.url);
            const host = parsed.hostname.toLowerCase();
            const isUploadThing =
              host.includes("utfs.io") ||
              host.includes("ufs.sh") ||
              host.includes("uploadthing");
            if (!isUploadThing) return null;

            return parsed.pathname.split("/").filter(Boolean).pop() ?? null;
          } catch {
            return null;
          }
        })
        .filter((key): key is string => Boolean(key)),
    ),
  );

  if (uploadThingKeys.length > 0) {
    try {
      const utapi = new UTApi();
      await utapi.deleteFiles(uploadThingKeys);
    } catch {
      // Suppression distante best effort: on continue la suppression base.
    }
  }

  await prisma.workspace.delete({ where: { id: workspaceId } });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
