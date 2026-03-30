"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { ERROR_MESSAGES } from "@/lib/messages/errors";
import { prisma } from "@/lib/prisma";

export type WorkspaceMemberActionState = {
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
