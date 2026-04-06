"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { ERROR_MESSAGES } from "@/lib/messages/errors";
import { signInSchema } from "@/lib/validation/auth";

export type SignInState = {
  error?: string;
};

export async function signInAction(formData: FormData): Promise<SignInState> {
  const callbackUrlRaw = String(formData.get("callbackUrl") ?? "").trim();
  const callbackUrl = callbackUrlRaw.startsWith("/") ? callbackUrlRaw : "/";

  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? ERROR_MESSAGES.common.invalidData,
    };
  }

  const { email, password } = parsed.data;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: ERROR_MESSAGES.auth.invalidCredentials };
    }

    throw error;
  }
}
