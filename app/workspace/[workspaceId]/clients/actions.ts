"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UTApi } from "uploadthing/server";
import { z } from "zod";
import {
  createClientSchema,
  type CreateClientInput,
} from "@/lib/validation/client";

const CLIENT_ACTION_TYPES = [
  "CALL",
  "EMAIL",
  "FOLLOW_UP",
  "MEETING",
  "PROPOSAL",
  "OTHER",
] as const;

const CLIENT_ACTION_STATUSES = ["TODO", "DONE", "CANCELED"] as const;
const PROJECT_STATUSES = [
  "PROSPECT",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELED",
] as const;
const PRICING_TYPES = ["FIXED", "HOURLY"] as const;

const createClientTaskSchema = z.object({
  title: z.string().trim().min(2, "Le titre de l action est requis."),
  type: z.enum(CLIENT_ACTION_TYPES),
  description: z.string().trim().optional(),
  dueDate: z.string().optional(),
  assignedToId: z.string().optional(),
});

const updateClientTaskSchema = z.object({
  title: z.string().trim().min(2, "Le titre de l action est requis."),
  type: z.enum(CLIENT_ACTION_TYPES),
  status: z.enum(CLIENT_ACTION_STATUSES),
  description: z.string().trim().optional(),
  dueDate: z.string().optional(),
  assignedToId: z.string().optional(),
});

const createClientNoteSchema = z.object({
  content: z.string().trim().min(1, "La note ne peut pas être vide.").max(2000),
  isPinned: z.boolean().optional(),
});

const createClientProjectSchema = z.object({
  name: z.string().trim().min(2, "Le nom du projet est requis."),
  description: z.string().trim().optional(),
  websiteUrl: z.string().trim().url("URL de site invalide.").optional(),
  status: z.enum(PROJECT_STATUSES),
  pricingType: z.enum(PRICING_TYPES),
  budgetEstimated: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  startDate: z.string().optional(),
  deadline: z.string().optional(),
});

async function requireWorkspaceMember(workspaceId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) redirect("/dashboard");

  return { userId, membership };
}

export async function createClientAction(
  workspaceId: string,
  values: CreateClientInput,
): Promise<{ error: string } | null> {
  await requireWorkspaceMember(workspaceId);

  const parsed = createClientSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const d = parsed.data;

  await prisma.client.create({
    data: {
      fullName: d.fullName,
      email: d.email || null,
      phone: d.phone || null,
      company: d.company || null,
      jobTitle: d.jobTitle || null,
      website: d.website || null,
      status: d.status,
      priority: d.priority,
      source: d.source ?? null,
      budgetEstimated: d.budgetEstimated ?? null,
      notes: d.notes || null,
      workspaceId,
    },
  });

  return null;
}

export async function updateClientAction(
  workspaceId: string,
  clientId: string,
  values: CreateClientInput,
  statusChangeNote?: string,
): Promise<{ error: string } | null> {
  const { userId } = await requireWorkspaceMember(workspaceId);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { workspaceId: true, status: true },
  });
  if (!client || client.workspaceId !== workspaceId) {
    return { error: "Client introuvable." };
  }

  const parsed = createClientSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const d = parsed.data;
  const statusChanged = client.status !== d.status;

  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: clientId },
      data: {
        fullName: d.fullName,
        email: d.email || null,
        phone: d.phone || null,
        company: d.company || null,
        jobTitle: d.jobTitle || null,
        website: d.website || null,
        status: d.status,
        priority: d.priority,
        source: d.source ?? null,
        budgetEstimated: d.budgetEstimated ?? null,
        notes: d.notes || null,
      },
    });

    if (statusChanged) {
      await tx.clientStatusHistory.create({
        data: {
          workspaceId,
          clientId,
          fromStatus: client.status,
          toStatus: d.status,
          changedById: userId,
          note: statusChangeNote ?? null,
        },
      });
    }
  });

  return null;
}

export async function deleteClientAction(
  workspaceId: string,
  clientId: string,
): Promise<{ error: string } | null> {
  const { membership } = await requireWorkspaceMember(workspaceId);

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  if (!isManager) {
    return { error: "Seuls les managers peuvent supprimer un client." };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { workspaceId: true },
  });
  if (!client || client.workspaceId !== workspaceId) {
    return { error: "Client introuvable." };
  }

  await prisma.client.delete({ where: { id: clientId } });
  return null;
}

export async function createClientTaskAction(
  workspaceId: string,
  clientId: string,
  values: {
    title: string;
    type: (typeof CLIENT_ACTION_TYPES)[number];
    description?: string;
    dueDate?: string;
    assignedToId?: string;
  },
): Promise<{ error: string } | null> {
  const { userId } = await requireWorkspaceMember(workspaceId);

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { id: true },
  });
  if (!client) return { error: "Client introuvable." };

  const parsed = createClientTaskSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const d = parsed.data;

  if (d.assignedToId) {
    const assignee = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: d.assignedToId, workspaceId } },
      select: { id: true },
    });
    if (!assignee) {
      return { error: "L utilisateur assigne n est pas membre du workspace." };
    }
  }

  await prisma.clientAction.create({
    data: {
      workspaceId,
      clientId,
      title: d.title,
      type: d.type,
      description: d.description || null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      createdById: userId,
      assignedToId: d.assignedToId || null,
    },
  });

  return null;
}

export async function updateClientTaskAction(
  workspaceId: string,
  clientId: string,
  taskId: string,
  values: {
    title: string;
    type: (typeof CLIENT_ACTION_TYPES)[number];
    status: (typeof CLIENT_ACTION_STATUSES)[number];
    description?: string;
    dueDate?: string;
    assignedToId?: string;
  },
): Promise<{ error: string } | null> {
  await requireWorkspaceMember(workspaceId);

  const task = await prisma.clientAction.findFirst({
    where: { id: taskId, workspaceId, clientId },
    select: { id: true },
  });
  if (!task) return { error: "Action introuvable." };

  const parsed = updateClientTaskSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const d = parsed.data;

  if (d.assignedToId) {
    const assignee = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: d.assignedToId, workspaceId } },
      select: { id: true },
    });
    if (!assignee) {
      return { error: "L utilisateur assigne n est pas membre du workspace." };
    }
  }

  await prisma.clientAction.update({
    where: { id: taskId },
    data: {
      title: d.title,
      type: d.type,
      status: d.status,
      description: d.description || null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      assignedToId: d.assignedToId || null,
      doneAt: d.status === "DONE" ? new Date() : null,
    },
  });

  return null;
}

export async function deleteClientTaskAction(
  workspaceId: string,
  clientId: string,
  taskId: string,
): Promise<{ error: string } | null> {
  const { userId, membership } = await requireWorkspaceMember(workspaceId);

  const task = await prisma.clientAction.findFirst({
    where: { id: taskId, workspaceId, clientId },
    select: { id: true, createdById: true },
  });
  if (!task) return { error: "Action introuvable." };

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  const canDelete = isManager || task.createdById === userId;
  if (!canDelete) {
    return { error: "Vous ne pouvez pas supprimer cette action." };
  }

  await prisma.clientAction.delete({ where: { id: taskId } });
  return null;
}

export async function createClientNoteAction(
  workspaceId: string,
  clientId: string,
  values: { content: string; isPinned?: boolean },
): Promise<{ error: string } | null> {
  const { userId } = await requireWorkspaceMember(workspaceId);

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { id: true },
  });
  if (!client) return { error: "Client introuvable." };

  const parsed = createClientNoteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.clientNote.create({
    data: {
      workspaceId,
      clientId,
      content: parsed.data.content,
      isPinned: parsed.data.isPinned ?? false,
      authorId: userId,
    },
  });

  return null;
}

export async function deleteClientNoteAction(
  workspaceId: string,
  clientId: string,
  noteId: string,
): Promise<{ error: string } | null> {
  const { userId, membership } = await requireWorkspaceMember(workspaceId);

  const note = await prisma.clientNote.findFirst({
    where: { id: noteId, workspaceId, clientId },
    select: { id: true, authorId: true },
  });
  if (!note) return { error: "Note introuvable." };

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  const canDelete = isManager || note.authorId === userId;
  if (!canDelete) {
    return { error: "Vous ne pouvez pas supprimer cette note." };
  }

  await prisma.clientNote.delete({ where: { id: noteId } });
  return null;
}

export async function updateClientTaskStatusQuickAction(
  workspaceId: string,
  taskId: string,
  status: (typeof CLIENT_ACTION_STATUSES)[number],
): Promise<{ error: string } | null> {
  await requireWorkspaceMember(workspaceId);

  const parsedStatus = z.enum(CLIENT_ACTION_STATUSES).safeParse(status);
  if (!parsedStatus.success) {
    return { error: "Statut d action invalide." };
  }

  const task = await prisma.clientAction.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true },
  });
  if (!task) {
    return { error: "Action introuvable." };
  }

  await prisma.clientAction.update({
    where: { id: taskId },
    data: {
      status,
      doneAt: status === "DONE" ? new Date() : null,
    },
  });

  return null;
}

export async function createClientProjectAction(
  workspaceId: string,
  clientId: string,
  values: {
    name: string;
    description?: string;
    websiteUrl?: string;
    status: (typeof PROJECT_STATUSES)[number];
    pricingType: (typeof PRICING_TYPES)[number];
    budgetEstimated?: number;
    hourlyRate?: number;
    startDate?: string;
    deadline?: string;
  },
): Promise<{ error: string } | null> {
  await requireWorkspaceMember(workspaceId);

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { id: true },
  });
  if (!client) return { error: "Client introuvable." };

  const parsed = createClientProjectSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const d = parsed.data;

  if (d.pricingType === "HOURLY" && !d.hourlyRate) {
    return { error: "Le taux horaire est requis pour une tarification horaire." };
  }

  await prisma.project.create({
    data: {
      workspaceId,
      clientId,
      name: d.name,
      description: d.description || null,
      websiteUrl: d.websiteUrl || null,
      status: d.status,
      pricingType: d.pricingType,
      budgetEstimated: d.budgetEstimated ?? null,
      hourlyRate: d.pricingType === "HOURLY" ? (d.hourlyRate ?? null) : null,
      startDate: d.startDate ? new Date(d.startDate) : null,
      deadline: d.deadline ? new Date(d.deadline) : null,
    },
  });

  return null;
}

const updateClientProjectSchema = z.object({
  name: z.string().trim().min(2, "Le nom du projet est requis."),
  description: z.string().trim().optional(),
  websiteUrl: z.string().trim().url("URL de site invalide.").optional(),
  status: z.enum(PROJECT_STATUSES),
  pricingType: z.enum(PRICING_TYPES),
  budgetEstimated: z.number().min(0).optional(),
  budgetFinal: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  startDate: z.string().optional(),
  deadline: z.string().optional(),
  completedAt: z.string().optional(),
});

export async function updateClientProjectAction(
  workspaceId: string,
  clientId: string,
  projectId: string,
  values: {
    name: string;
    description?: string;
    websiteUrl?: string;
    status: (typeof PROJECT_STATUSES)[number];
    pricingType: (typeof PRICING_TYPES)[number];
    budgetEstimated?: number;
    budgetFinal?: number;
    hourlyRate?: number;
    startDate?: string;
    deadline?: string;
    completedAt?: string;
  },
): Promise<{ error: string } | null> {
  const { userId } = await requireWorkspaceMember(workspaceId);

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, clientId },
    select: { id: true, status: true, completedAt: true },
  });
  if (!project) return { error: "Projet introuvable." };

  const parsed = updateClientProjectSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;

  if (d.pricingType === "HOURLY" && !d.hourlyRate) {
    return { error: "Le taux horaire est requis pour une tarification horaire." };
  }

  const statusChanged = project.status !== d.status;
  const autoCompletedAt =
    d.status === "COMPLETED" && project.status !== "COMPLETED"
      ? new Date()
      : project.completedAt;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        name: d.name,
        description: d.description || null,
        websiteUrl: d.websiteUrl || null,
        status: d.status,
        pricingType: d.pricingType,
        budgetEstimated: d.budgetEstimated ?? null,
        budgetFinal: d.budgetFinal ?? null,
        hourlyRate: d.pricingType === "HOURLY" ? (d.hourlyRate ?? null) : null,
        startDate: d.startDate ? new Date(d.startDate) : null,
        deadline: d.deadline ? new Date(d.deadline) : null,
        completedAt: d.completedAt ? new Date(d.completedAt) : autoCompletedAt,
      },
    });

    if (statusChanged) {
      await tx.projectStatusHistory.create({
        data: {
          workspaceId,
          projectId,
          fromStatus: project.status,
          toStatus: d.status,
          changedById: userId,
        },
      });
    }
  });

  return null;
}

export async function deleteClientProjectAction(
  workspaceId: string,
  clientId: string,
  projectId: string,
): Promise<{ error: string } | null> {
  const { membership } = await requireWorkspaceMember(workspaceId);

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  if (!isManager) {
    return { error: "Seuls les managers peuvent supprimer un projet." };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, clientId },
    select: { id: true },
  });
  if (!project) return { error: "Projet introuvable." };

  await prisma.project.delete({ where: { id: projectId } });
  return null;
}

export async function deleteProjectDocumentAction(
  workspaceId: string,
  clientId: string,
  projectId: string,
  documentId: string,
): Promise<{ error: string } | null> {
  const { userId, membership } = await requireWorkspaceMember(workspaceId);

  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId, clientId, projectId },
    select: { id: true, uploadedById: true, url: true },
  });
  if (!document) return { error: "Document introuvable." };

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  const canDelete = isManager || document.uploadedById === userId;
  if (!canDelete) {
    return { error: "Vous ne pouvez pas supprimer ce document." };
  }

  // Best effort: if this is an UploadThing URL, remove remote file too.
  try {
    const parsed = new URL(document.url);
    const host = parsed.hostname.toLowerCase();
    const isUploadThing =
      host.includes("utfs.io") ||
      host.includes("ufs.sh") ||
      host.includes("uploadthing");
    if (isUploadThing) {
      const key = parsed.pathname.split("/").filter(Boolean).pop();
      if (key) {
        const utapi = new UTApi();
        await utapi.deleteFiles(key);
      }
    }
  } catch {
    // Ignore URL parse issues and continue DB deletion.
  }

  await prisma.document.delete({ where: { id: documentId } });
  return null;
}

export async function deleteClientDocumentAction(
  workspaceId: string,
  clientId: string,
  documentId: string,
): Promise<{ error: string } | null> {
  const { userId, membership } = await requireWorkspaceMember(workspaceId);

  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId, clientId },
    select: { id: true, uploadedById: true, url: true },
  });
  if (!document) return { error: "Document introuvable." };

  const isManager = membership.role === "OWNER" || membership.role === "ADMIN";
  const canDelete = isManager || document.uploadedById === userId;
  if (!canDelete) {
    return { error: "Vous ne pouvez pas supprimer ce document." };
  }

  // Best effort: if this is an UploadThing URL, remove remote file too.
  try {
    const parsed = new URL(document.url);
    const host = parsed.hostname.toLowerCase();
    const isUploadThing =
      host.includes("utfs.io") ||
      host.includes("ufs.sh") ||
      host.includes("uploadthing");
    if (isUploadThing) {
      const key = parsed.pathname.split("/").filter(Boolean).pop();
      if (key) {
        const utapi = new UTApi();
        await utapi.deleteFiles(key);
      }
    }
  } catch {
    // Ignore URL parse issues and continue DB deletion.
  }

  await prisma.document.delete({ where: { id: documentId } });
  return null;
}
