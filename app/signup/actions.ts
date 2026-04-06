"use server";

import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { ERROR_MESSAGES } from "@/lib/messages/errors";
import { signUpSchema } from "@/lib/validation/auth";

export type SignUpState = {
  error?: string;
};

export async function signUpAction(formData: FormData): Promise<SignUpState> {
  const callbackUrlRaw = String(formData.get("callbackUrl") ?? "").trim();
  const callbackUrl = callbackUrlRaw.startsWith("/") ? callbackUrlRaw : "/";

  const parsed = signUpSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? ERROR_MESSAGES.common.invalidData,
    };
  }

  const { name, email, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: ERROR_MESSAGES.auth.accountAlreadyExists };
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: ERROR_MESSAGES.auth.autoSignInFailed };
    }

    throw error;
  }
}
