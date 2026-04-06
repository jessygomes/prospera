"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signInAction } from "./actions";
import { UI_MESSAGES } from "@/lib/messages/ui";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";

type SignInFormProps = {
  callbackUrl?: string;
};

export function SignInForm({ callbackUrl }: SignInFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    if (callbackUrl) {
      formData.set("callbackUrl", callbackUrl);
    }

    startTransition(async () => {
      const result = await signInAction(formData);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  });

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="font-heading text-2xl font-bold text-foreground">
          Prospera
        </span>
      </div>

      <div className="rounded-2xl border border-border/60 p-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.3)]">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-bold text-foreground">
            {UI_MESSAGES.auth.signIn.title}
          </h1>
          <p className="mt-1 text-sm text-foreground/50">
            {UI_MESSAGES.auth.signIn.subtitle}
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              className="block text-xs font-medium text-foreground/50"
              htmlFor="signin-email"
            >
              {UI_MESSAGES.auth.signIn.emailLabel}
            </label>
            <input
              id="signin-email"
              {...register("email")}
              className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
              type="email"
              autoComplete="email"
              placeholder="jean@exemple.com"
            />
            {errors.email && (
              <p className="text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="block text-xs font-medium text-foreground/50"
              htmlFor="signin-password"
            >
              {UI_MESSAGES.auth.signIn.passwordLabel}
            </label>
            <input
              id="signin-password"
              {...register("password")}
              className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              {serverError}
            </p>
          )}

          <button
            className="mt-1 w-full cursor-pointer rounded-lg bg-linear-to-r from-brand-1 to-brand-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_var(--brand-1)] transition hover:brightness-110 disabled:opacity-60"
            type="submit"
            disabled={isPending}
          >
            {isPending
              ? UI_MESSAGES.auth.signIn.submitting
              : UI_MESSAGES.auth.signIn.submit}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-xs text-foreground/40">
        {UI_MESSAGES.auth.signIn.noAccountPrefix}{" "}
        <Link
          className="font-medium text-brand-3 transition-colors hover:text-brand-2"
          href={
            callbackUrl
              ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`
              : "/signup"
          }
        >
          {UI_MESSAGES.auth.signIn.noAccountCta}
        </Link>
      </p>
    </div>
  );
}
