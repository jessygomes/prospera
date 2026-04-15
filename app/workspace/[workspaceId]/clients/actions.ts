"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UTApi } from "uploadthing/server";
import { z } from "zod";
import {
  createClientSchema,
  type CreateClientInput,
} from "@/lib/validation/client";
import { generateClientNextAdvice } from "@/lib/ai/generate-client-next-advice";
import { analyzeInteraction } from "@/lib/ai/analyze-interaction";

const CLIENT_ACTION_TYPES = [
  "CALL",
  "EMAIL",
  "FOLLOW_UP",
  "MEETING",
  "PROPOSAL",
  "OTHER",
] as const;
const CLIENT_INTERACTION_OUTCOMES = [
  "NO_RESPONSE",
  "INTERESTED",
  "NOT_INTERESTED",
  "NEEDS_TIME",
  "WON",
  "LOST",
] as const;
const CLIENT_INTERACTION_SENTIMENTS = [
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
] as const;

const CLIENT_ACTION_STATUSES = ["TODO", "DONE", "CANCELED"] as const;
const CLIENT_STATUSES = [
  "PROSPECT",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "INACTIVE",
] as const;
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
  interactionSummary: z.string().trim().max(2000).optional(),
  interactionOutcome: z.enum(CLIENT_INTERACTION_OUTCOMES).optional(),
  interactionSentiment: z.enum(CLIENT_INTERACTION_SENTIMENTS).optional(),
  interactionObjections: z
    .array(z.string().trim().min(1).max(120))
    .max(15)
    .optional(),
  previousActionId: z.string().optional(),
  dueDate: z.string().optional(),
  assignedToId: z.string().optional(),
});

const updateClientTaskSchema = z.object({
  title: z.string().trim().min(2, "Le titre de l action est requis."),
  type: z.enum(CLIENT_ACTION_TYPES),
  status: z.enum(CLIENT_ACTION_STATUSES),
  description: z.string().trim().optional(),
  interactionSummary: z.string().trim().max(2000).optional(),
  interactionOutcome: z.enum(CLIENT_INTERACTION_OUTCOMES).optional(),
  interactionSentiment: z.enum(CLIENT_INTERACTION_SENTIMENTS).optional(),
  interactionObjections: z
    .array(z.string().trim().min(1).max(120))
    .max(15)
    .optional(),
  previousActionId: z.string().optional(),
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

function extractUploadThingKey(url: string): string | null {
  try {
    const parsed = new URL(url);
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
}

async function deleteUploadThingFiles(urls: string[]) {
  const uploadThingKeys = Array.from(
    new Set(
      urls
        .map((url) => extractUploadThingKey(url))
        .filter((key): key is string => Boolean(key)),
    ),
  );

  if (uploadThingKeys.length === 0) return;

  try {
    const utapi = new UTApi();
    await utapi.deleteFiles(uploadThingKeys);
  } catch {
    // Suppression distante best effort: on continue la suppression base.
  }
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
      companyType: d.companyType || null,
      jobTitle: d.jobTitle || null,
      addressLine1: d.addressLine1 || null,
      addressLine2: d.addressLine2 || null,
      city: d.city || null,
      postalCode: d.postalCode || null,
      country: d.country || null,
      siret: d.siret || null,
      siren: d.siren || null,
      website: d.website || null,
      linkedinUrl: d.linkedinUrl || null,
      instagramUrl: d.instagramUrl || null,
      status: d.status,
      priority: d.priority,
      source: d.source ?? null,
      budgetEstimated: d.budgetEstimated ?? null,
      contractSignedAt: d.contractSignedAt ?? null,
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
        companyType: d.companyType || null,
        jobTitle: d.jobTitle || null,
        addressLine1: d.addressLine1 || null,
        addressLine2: d.addressLine2 || null,
        city: d.city || null,
        postalCode: d.postalCode || null,
        country: d.country || null,
        siret: d.siret || null,
        siren: d.siren || null,
        website: d.website || null,
        linkedinUrl: d.linkedinUrl || null,
        instagramUrl: d.instagramUrl || null,
        status: d.status,
        priority: d.priority,
        source: d.source ?? null,
        budgetEstimated: d.budgetEstimated ?? null,
        contractSignedAt: d.contractSignedAt ?? null,
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

  const documents = await prisma.document.findMany({
    where: { workspaceId, clientId },
    select: { url: true },
  });

  await deleteUploadThingFiles(documents.map((document) => document.url));

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
    interactionSummary?: string;
    interactionOutcome?: (typeof CLIENT_INTERACTION_OUTCOMES)[number];
    interactionSentiment?: (typeof CLIENT_INTERACTION_SENTIMENTS)[number];
    interactionObjections?: string[];
    previousActionId?: string;
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

  const interactionSourceText = (
    d.interactionSummary ||
    d.description ||
    ""
  ).trim();
  const shouldAutoAnalyze =
    interactionSourceText.length > 0 &&
    (d.interactionOutcome === undefined ||
      d.interactionSentiment === undefined ||
      d.interactionObjections === undefined);

  const autoAnalysis = shouldAutoAnalyze
    ? await analyzeInteraction(interactionSourceText)
    : null;

  const finalInteractionOutcome =
    d.interactionOutcome ?? autoAnalysis?.interactionOutcome ?? null;
  const finalInteractionSentiment =
    d.interactionSentiment ?? autoAnalysis?.interactionSentiment ?? null;
  const finalInteractionObjections =
    d.interactionObjections ?? autoAnalysis?.interactionObjections ?? [];

  if (d.previousActionId) {
    const parentAction = await prisma.clientAction.findFirst({
      where: { id: d.previousActionId, workspaceId, clientId },
      select: { id: true },
    });
    if (!parentAction) {
      return { error: "L action precedente est introuvable." };
    }
  }

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
      interactionSummary: d.interactionSummary || null,
      interactionOutcome: finalInteractionOutcome,
      interactionSentiment: finalInteractionSentiment,
      interactionObjections: finalInteractionObjections,
      previousActionId: d.previousActionId || null,
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
    interactionSummary?: string;
    interactionOutcome?: (typeof CLIENT_INTERACTION_OUTCOMES)[number];
    interactionSentiment?: (typeof CLIENT_INTERACTION_SENTIMENTS)[number];
    interactionObjections?: string[];
    previousActionId?: string;
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

  const interactionSourceText = (
    d.interactionSummary ||
    d.description ||
    ""
  ).trim();
  const shouldAutoAnalyze =
    interactionSourceText.length > 0 &&
    (d.interactionOutcome === undefined ||
      d.interactionSentiment === undefined ||
      d.interactionObjections === undefined);

  const autoAnalysis = shouldAutoAnalyze
    ? await analyzeInteraction(interactionSourceText)
    : null;

  const finalInteractionOutcome =
    d.interactionOutcome ?? autoAnalysis?.interactionOutcome ?? null;
  const finalInteractionSentiment =
    d.interactionSentiment ?? autoAnalysis?.interactionSentiment ?? null;
  const finalInteractionObjections =
    d.interactionObjections ?? autoAnalysis?.interactionObjections ?? [];

  if (d.previousActionId) {
    if (d.previousActionId === taskId) {
      return { error: "Une action ne peut pas se référencer elle-même." };
    }

    const parentAction = await prisma.clientAction.findFirst({
      where: { id: d.previousActionId, workspaceId, clientId },
      select: { id: true },
    });
    if (!parentAction) {
      return { error: "L action precedente est introuvable." };
    }
  }

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
      interactionSummary: d.interactionSummary || null,
      interactionOutcome: finalInteractionOutcome,
      interactionSentiment: finalInteractionSentiment,
      interactionObjections: finalInteractionObjections,
      previousActionId: d.previousActionId || null,
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

export async function updateClientNotePinAction(
  workspaceId: string,
  clientId: string,
  noteId: string,
  isPinned: boolean,
): Promise<{ error: string } | null> {
  await requireWorkspaceMember(workspaceId);

  const note = await prisma.clientNote.findFirst({
    where: { id: noteId, workspaceId, clientId },
    select: { id: true },
  });
  if (!note) {
    return { error: "Note introuvable." };
  }

  await prisma.clientNote.update({
    where: { id: noteId },
    data: { isPinned },
  });

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

export async function updateClientStatusQuickAction(
  workspaceId: string,
  clientId: string,
  status: (typeof CLIENT_STATUSES)[number],
): Promise<{ error: string } | null> {
  const { userId } = await requireWorkspaceMember(workspaceId);

  const parsedStatus = z.enum(CLIENT_STATUSES).safeParse(status);
  if (!parsedStatus.success) {
    return { error: "Statut client invalide." };
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { id: true, status: true },
  });
  if (!client) {
    return { error: "Client introuvable." };
  }

  if (client.status === status) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: clientId },
      data: { status },
    });

    await tx.clientStatusHistory.create({
      data: {
        workspaceId,
        clientId,
        fromStatus: client.status,
        toStatus: status,
        changedById: userId,
      },
    });
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
    return {
      error: "Le taux horaire est requis pour une tarification horaire.",
    };
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

const parsedAdviceSchema = z.object({
  nextActionFocus: z.string().trim().min(1),
  nextBestAction: z.string().trim().optional(),
  bestTiming: z.string().trim().optional(),
  persuasionAngle: z.string().trim().optional(),
  objectionResponse: z.string().trim().optional(),
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
    return {
      error: "Le taux horaire est requis pour une tarification horaire.",
    };
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

  await deleteUploadThingFiles([document.url]);

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

  await deleteUploadThingFiles([document.url]);

  await prisma.document.delete({ where: { id: documentId } });
  return null;
}

export async function generateClientNextActionAdviceAction(
  workspaceId: string,
  clientId: string,
): Promise<{ error: string } | null> {
  const traceId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `advice-${Date.now()}`;
  const iaDebug = process.env.IA_DEBUG === "true";
  const log = (stage: string, payload?: Record<string, unknown>) => {
    if (!iaDebug) return;
    console.info(
      "[IA-ADVICE-ACTION]",
      JSON.stringify({ traceId, stage, workspaceId, clientId, ...payload }),
    );
  };

  log("start");

  const { userId } = await requireWorkspaceMember(workspaceId);

  log("auth.ok", { userId });

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      id: true,
      fullName: true,
      status: true,
      priority: true,
      budgetEstimated: true,
      company: true,
      jobTitle: true,
      notes: true,
      aiInsights: true,
      actions: {
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          title: true,
          type: true,
          status: true,
          description: true,
          interactionSummary: true,
          interactionOutcome: true,
          interactionSentiment: true,
          interactionObjections: true,
          createdAt: true,
          doneAt: true,
        },
      },
    },
  });

  if (!client) return { error: "Client introuvable." };

  log("client.loaded", {
    fullName: client.fullName,
    actionsLoaded: client.actions.length,
  });

  const generated = await generateClientNextAdvice({
    client: {
      fullName: client.fullName,
      status: client.status,
      priority: client.priority,
      budgetEstimated: client.budgetEstimated,
      company: client.company,
      jobTitle: client.jobTitle,
      notes: client.notes,
      aiInsights: client.aiInsights,
    },
    actions: client.actions,
  });

  log("generation.done", {
    provider: generated.provider,
    model: generated.model,
    inputTokens: generated.inputTokens ?? null,
    outputTokens: generated.outputTokens ?? null,
    totalTokens: generated.totalTokens ?? null,
    costUsd: generated.costUsd ?? null,
    fallbackReason: generated.fallbackReason ?? null,
  });

  const adviceVersion = generated.promptVersion;

  await prisma.$transaction(async (tx) => {
    const savedGeneration = await tx.aiGeneration.create({
      data: {
        type: "NEXT_ACTION_ADVICE",
        prompt: generated.prompt,
        result: generated.resultRaw,
        provider: generated.provider,
        model: generated.model,
        inputTokens: generated.inputTokens ?? null,
        outputTokens: generated.outputTokens ?? null,
        totalTokens: generated.totalTokens ?? null,
        costUsd:
          typeof generated.costUsd === "number"
            ? generated.costUsd.toFixed(6)
            : null,
        version: adviceVersion,
        metadata: {
          source: generated.provider,
          generatedAt: new Date().toISOString(),
          fallback: generated.provider === "heuristic",
          fallbackReason: generated.fallbackReason ?? null,
          quickStats: generated.quickStats,
          promptVersion: generated.promptVersion,
          confidence: generated.confidence,
          grounding: generated.grounding,
        },
        workspaceId,
        clientId,
        createdById: userId,
      },
    });

    log("db.generation.saved", {
      generationId: savedGeneration.id,
      provider: savedGeneration.provider,
      totalTokens: savedGeneration.totalTokens,
    });

    await tx.client.update({
      where: { id: clientId },
      data: {
        aiInsights: {
          score: generated.aiInsights.score,
          temperature: generated.aiInsights.temperature,
          mainObjections: generated.aiInsights.mainObjections ?? [],
          recommendedStrategy:
            generated.aiInsights.recommendedStrategy ??
            generated.advice.persuasionAngle,
          nextBestAction:
            generated.aiInsights.nextBestAction ??
            generated.advice.nextActionFocus,
        },
      },
    });

    log("db.client-insights.updated");
  });

  revalidatePath(`/workspace/${workspaceId}/clients/${clientId}?view=actions`);
  log("done");
  return null;
}

export async function submitClientAdviceFeedbackAction(
  workspaceId: string,
  clientId: string,
  generationId: string,
  values: { score: number; note?: string },
): Promise<{ error: string } | null> {
  await requireWorkspaceMember(workspaceId);

  const parsed = z
    .object({
      score: z.number().int().min(-1).max(5),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse(values);

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const generation = await prisma.aiGeneration.findFirst({
    where: {
      id: generationId,
      workspaceId,
      clientId,
      type: "NEXT_ACTION_ADVICE",
    },
    select: { id: true },
  });

  if (!generation) {
    return { error: "Conseil IA introuvable." };
  }

  await prisma.aiGeneration.update({
    where: { id: generationId },
    data: {
      feedbackScore: parsed.data.score,
      feedbackNote: parsed.data.note || null,
      feedbackAt: new Date(),
    },
  });

  revalidatePath(`/workspace/${workspaceId}/clients/${clientId}?view=actions`);
  return null;
}

export async function createClientTaskFromAdviceAction(
  workspaceId: string,
  clientId: string,
  generationId?: string,
): Promise<{ error: string } | null> {
  const { userId } = await requireWorkspaceMember(workspaceId);

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { id: true },
  });
  if (!client) return { error: "Client introuvable." };

  const generation = await prisma.aiGeneration.findFirst({
    where: {
      workspaceId,
      clientId,
      type: "NEXT_ACTION_ADVICE",
      ...(generationId ? { id: generationId } : {}),
    },
    orderBy: generationId ? undefined : { createdAt: "desc" },
    select: {
      id: true,
      result: true,
      provider: true,
      model: true,
      createdAt: true,
    },
  });

  if (!generation) {
    return { error: "Aucun conseil IA disponible pour creer une action." };
  }

  let parsedResult: unknown;
  try {
    parsedResult = JSON.parse(generation.result);
  } catch {
    return { error: "Le format du conseil IA est invalide." };
  }

  const parsedAdvice = parsedAdviceSchema.safeParse(parsedResult);
  if (!parsedAdvice.success) {
    return {
      error: "Le conseil IA ne contient pas de prochaine action exploitable.",
    };
  }

  const advisedAction =
    parsedAdvice.data.nextBestAction || parsedAdvice.data.nextActionFocus;
  const compactAction = advisedAction.replace(/\s+/g, " ").trim();
  const title =
    compactAction.length > 88
      ? `${compactAction.slice(0, 85)}...`
      : compactAction;

  const latestClientAction = await prisma.clientAction.findFirst({
    where: { workspaceId, clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 2);
  dueDate.setHours(9, 0, 0, 0);

  const descriptionParts = [
    `Objectif recommande: ${compactAction}`,
    parsedAdvice.data.bestTiming
      ? `Timing recommande: ${parsedAdvice.data.bestTiming}`
      : null,
    parsedAdvice.data.persuasionAngle
      ? `Angle de persuasion: ${parsedAdvice.data.persuasionAngle}`
      : null,
    parsedAdvice.data.objectionResponse
      ? `Reponse objection: ${parsedAdvice.data.objectionResponse}`
      : null,
    `Source: generation IA ${generation.id} (${generation.provider ?? "unknown"}/${generation.model ?? "unknown"})`,
  ].filter((part): part is string => !!part);

  await prisma.clientAction.create({
    data: {
      workspaceId,
      clientId,
      title,
      type: "FOLLOW_UP",
      status: "TODO",
      description: descriptionParts.join("\n"),
      dueDate,
      previousActionId: latestClientAction?.id ?? null,
      createdById: userId,
    },
  });

  revalidatePath(`/workspace/${workspaceId}/clients/${clientId}?view=actions`);
  return null;
}
