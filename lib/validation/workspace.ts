import { z } from "zod";
import { ERROR_MESSAGES } from "@/lib/messages/errors";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, ERROR_MESSAGES.workspace.nameTooShort),
});

export const joinWorkspaceSchema = z.object({
  workspaceId: z.string().trim().min(1, ERROR_MESSAGES.workspace.idRequired),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;
