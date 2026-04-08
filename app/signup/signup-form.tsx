"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signUpAction } from "./actions";
import { UI_MESSAGES } from "@/lib/messages/ui";
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";
import Image from "next/image";

type SignUpFormProps = {
  callbackUrl?: string;
};

export function SignUpForm({ callbackUrl }: SignUpFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("email", values.email);
    formData.set("password", values.password);
    formData.set("confirmPassword", values.confirmPassword);
    if (callbackUrl) {
      formData.set("callbackUrl", callbackUrl);
    }

    startTransition(async () => {
      const result = await signUpAction(formData);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  });

  return (
    <div className="w-full max-w-2xl">
      {/* Logo */}
      <div className="text-center">
        {/* <span className="font-heading text-2xl font-bold text-foreground">
          Prospera
        </span> */}
        <Image
          src="/logo.png"
          alt="Prospera"
          width={100}
          height={100}
          className="h-32 w-32 mx-auto"
        />
      </div>

      <div className="rounded-2xl border border-border/60  p-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.3)]">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-bold text-foreground">
            {UI_MESSAGES.auth.signUp.title}
          </h1>
          <p className="mt-1 text-sm text-foreground/50">
            {UI_MESSAGES.auth.signUp.subtitle}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1.5">
            <label
              className="block text-xs font-medium text-foreground/50"
              htmlFor="signup-name"
            >
              {UI_MESSAGES.auth.signUp.nameLabel}
            </label>
            <input
              id="signup-name"
              {...register("name")}
              className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
              type="text"
              autoComplete="name"
              placeholder="Jean Dupont"
            />
            {errors.name && (
              <p className="text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="block text-xs font-medium text-foreground/50"
              htmlFor="signup-email"
            >
              {UI_MESSAGES.auth.signUp.emailLabel}
            </label>
            <input
              id="signup-email"
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
              htmlFor="signup-password"
            >
              {UI_MESSAGES.auth.signUp.passwordLabel}
            </label>
            <div className="relative">
              <input
                id="signup-password"
                {...register("password")}
                className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 pr-20 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-foreground/60 transition hover:text-foreground"
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="block text-xs font-medium text-foreground/50"
              htmlFor="signup-confirm-password"
            >
              {UI_MESSAGES.auth.signUp.confirmPasswordLabel}
            </label>
            <div className="relative">
              <input
                id="signup-confirm-password"
                {...register("confirmPassword")}
                className="w-full rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2.5 pr-20 text-sm text-foreground placeholder:text-foreground/30 outline-none transition focus:border-brand-2/60 focus:ring-2 focus:ring-brand-1/15"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-foreground/60 transition hover:text-foreground"
                aria-label={
                  showConfirmPassword
                    ? "Masquer la confirmation du mot de passe"
                    : "Afficher la confirmation du mot de passe"
                }
              >
                {showConfirmPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-xs text-red-400 sm:col-span-2">
              {serverError}
            </p>
          )}

          <button
            className="mt-1 w-full cursor-pointer rounded-lg bg-linear-to-r from-brand-1 to-brand-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_var(--brand-1)] transition hover:brightness-110 disabled:opacity-60 sm:col-span-2"
            type="submit"
            disabled={isPending}
          >
            {isPending
              ? UI_MESSAGES.auth.signUp.submitting
              : UI_MESSAGES.auth.signUp.submit}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-xs text-foreground/40">
        {UI_MESSAGES.auth.signUp.hasAccountPrefix}{" "}
        <Link
          className="font-medium text-brand-3 transition-colors hover:text-brand-2"
          href={
            callbackUrl
              ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
              : "/signin"
          }
        >
          {UI_MESSAGES.auth.signUp.hasAccountCta}
        </Link>
      </p>
    </div>
  );
}
