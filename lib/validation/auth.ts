import { z } from "zod";
import { ERROR_MESSAGES } from "@/lib/messages/errors";

export const signInSchema = z.object({
  email: z
    .email(ERROR_MESSAGES.auth.invalidEmail)
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, ERROR_MESSAGES.auth.passwordRequired),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, ERROR_MESSAGES.auth.nameTooShort),
  email: z
    .email(ERROR_MESSAGES.auth.invalidEmail)
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, ERROR_MESSAGES.auth.passwordTooShort),
  confirmPassword: z.string().min(8, ERROR_MESSAGES.auth.passwordTooShort),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: ERROR_MESSAGES.auth.passwordsDoNotMatch,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
