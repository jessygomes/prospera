import { z } from "zod";
import { createUploadthing, type FileRouter } from "uploadthing/next";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const f = createUploadthing();

const CATEGORY_VALUES = [
  "CONTRACT",
  "QUOTE",
  "INVOICE",
  "BRIEF",
  "DELIVERY",
  "OTHER",
] as const;

export const uploadRouter = {
  projectMedia: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 10,
    },
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
    blob: {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
  })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        clientId: z.string().min(1),
        projectId: z.string().min(1),
        category: z.enum(CATEGORY_VALUES),
      }),
    )
    .middleware(async ({ input }) => {
      const session = await auth();
      const userId = session?.user?.id;
      if (!userId) {
        throw new Error("Non authentifié.");
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: input.workspaceId,
          },
        },
        select: { id: true },
      });
      if (!membership) {
        throw new Error("Accès refusé au workspace.");
      }

      const project = await prisma.project.findFirst({
        where: {
          id: input.projectId,
          workspaceId: input.workspaceId,
          clientId: input.clientId,
        },
        select: { id: true },
      });
      if (!project) {
        throw new Error("Projet introuvable.");
      }

      return {
        userId,
        workspaceId: input.workspaceId,
        clientId: input.clientId,
        projectId: input.projectId,
        category: input.category,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const uploaded = file as {
        name: string;
        type?: string;
        size?: number;
        url?: string;
        ufsUrl?: string;
      };
      const fileUrl = uploaded.ufsUrl ?? uploaded.url;

      if (!fileUrl) {
        throw new Error("URL fichier manquante.");
      }

      await prisma.document.create({
        data: {
          workspaceId: metadata.workspaceId,
          clientId: metadata.clientId,
          projectId: metadata.projectId,
          name: uploaded.name || "Fichier",
          url: fileUrl,
          category: metadata.category,
          mimeType: uploaded.type || null,
          size: uploaded.size ?? null,
          uploadedById: metadata.userId,
        },
      });

      return { ok: true };
    }),

  clientMedia: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 10,
    },
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
    blob: {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
  })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        clientId: z.string().min(1),
        category: z.enum(CATEGORY_VALUES),
      }),
    )
    .middleware(async ({ input }) => {
      const session = await auth();
      const userId = session?.user?.id;
      if (!userId) {
        throw new Error("Non authentifié.");
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: input.workspaceId,
          },
        },
        select: { id: true },
      });
      if (!membership) {
        throw new Error("Accès refusé au workspace.");
      }

      const client = await prisma.client.findFirst({
        where: { id: input.clientId, workspaceId: input.workspaceId },
        select: { id: true },
      });
      if (!client) {
        throw new Error("Client introuvable.");
      }

      return {
        userId,
        workspaceId: input.workspaceId,
        clientId: input.clientId,
        category: input.category,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const uploaded = file as {
        name: string;
        type?: string;
        size?: number;
        url?: string;
        ufsUrl?: string;
      };
      const fileUrl = uploaded.ufsUrl ?? uploaded.url;

      if (!fileUrl) {
        throw new Error("URL fichier manquante.");
      }

      await prisma.document.create({
        data: {
          workspaceId: metadata.workspaceId,
          clientId: metadata.clientId,
          name: uploaded.name || "Fichier",
          url: fileUrl,
          category: metadata.category,
          mimeType: uploaded.type || null,
          size: uploaded.size ?? null,
          uploadedById: metadata.userId,
        },
      });

      return { ok: true };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
