import { z } from "zod";
import { ERROR_MESSAGES } from "@/lib/messages/errors";

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

const CLIENT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const CLIENT_SOURCES = [
  "INSTAGRAM",
  "LINKEDIN",
  "EMAIL",
  "REFERRAL",
  "WEBSITE",
  "DISCORD",
  "OTHER",
] as const;

export const createClientSchema = z.object({
  fullName: z.string().trim().min(1, ERROR_MESSAGES.client.nameRequired),
  email: z
    .string()
    .email(ERROR_MESSAGES.auth.invalidEmail)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  companyType: z.string().trim().optional(),
  jobTitle: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  siret: z
    .string()
    .trim()
    .regex(/^\d{14}$/, "Le SIRET doit contenir 14 chiffres.")
    .optional()
    .or(z.literal("")),
  siren: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "Le SIREN doit contenir 9 chiffres.")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .url(ERROR_MESSAGES.client.invalidWebsite)
    .optional()
    .or(z.literal("")),
  linkedinUrl: z
    .string()
    .url("URL LinkedIn invalide.")
    .optional()
    .or(z.literal("")),
  instagramUrl: z
    .string()
    .url("URL Instagram invalide.")
    .optional()
    .or(z.literal("")),
  status: z.enum(CLIENT_STATUSES).default("PROSPECT"),
  priority: z.enum(CLIENT_PRIORITIES).default("MEDIUM"),
  source: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(CLIENT_SOURCES).optional(),
  ),
  budgetEstimated: z
    .number()
    .positive(ERROR_MESSAGES.client.invalidBudget)
    .optional(),
  contractSignedAt: z.preprocess(
    (v) => {
      if (v === "" || v == null) return undefined;
      if (v instanceof Date) return v;
      if (typeof v === "string") return new Date(v);
      return v;
    },
    z.date().optional(),
  ),
  notes: z.string().trim().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
