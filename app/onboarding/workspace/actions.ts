"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ERROR_MESSAGES } from "@/lib/messages/errors";
import { prisma } from "@/lib/prisma";
import {
  createWorkspaceSchema,
  joinWorkspaceSchema,
} from "@/lib/validation/workspace";

export type WorkspaceActionState = {
  error?: string;
};

async function getCurrentUserId() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  return userId;
}

export async function createWorkspaceAction(
  formData: FormData,
): Promise<WorkspaceActionState> {
  const userId = await getCurrentUserId();
  const parsed = createWorkspaceSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? ERROR_MESSAGES.common.invalidData,
    };
  }

  const { name } = parsed.data;

  await prisma.workspace.create({
    data: {
      name,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  redirect("/dashboard");
}

export async function joinWorkspaceAction(
  formData: FormData,
): Promise<WorkspaceActionState> {
  const userId = await getCurrentUserId();
  const parsed = joinWorkspaceSchema.safeParse({
    workspaceId: String(formData.get("workspaceId") ?? ""),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? ERROR_MESSAGES.common.invalidData,
    };
  }

  const { workspaceId } = parsed.data;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return { error: ERROR_MESSAGES.workspace.notFound };
  }

  const existingMembership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    select: { id: true },
  });

  if (existingMembership) {
    redirect("/dashboard");
  }

  await prisma.workspaceMember.create({
    data: {
      userId,
      workspaceId,
      role: "MEMBER",
    },
  });

  redirect("/dashboard");
}
