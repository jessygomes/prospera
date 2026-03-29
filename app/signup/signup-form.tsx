"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signUpAction } from "./actions";
import { UI_MESSAGES } from "@/lib/messages/ui";
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";

export function SignUpForm() {
  const [serverError, setServerError] = useState<string | null>(null);
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
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("email", values.email);
    formData.set("password", values.password);

    startTransition(async () => {
      const result = await signUpAction(formData);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border border-border p-6 shadow-[0_20px_50px_-35px_var(--brand-1)] backdrop-blur"
    >
      <h2 className="text-2xl font-semibold text-brand-5 text-center">
        {UI_MESSAGES.auth.signUp.title}
      </h2>
      <p className="text-sm text-brand-5/80 text-center">
        {UI_MESSAGES.auth.signUp.subtitle}
      </p>

      <label className="flex flex-col gap-1 text-sm">
        {UI_MESSAGES.auth.signUp.nameLabel}
        <input
          {...register("name")}
          className="rounded-xl border border-border px-3 py-2 outline-none transition focus:border-brand-3 focus:ring-2 focus:ring-(--brand-5)/60"
          type="text"
          autoComplete="name"
        />
      </label>
      {errors.name ? (
        <p className="text-sm text-red-600">{errors.name.message}</p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        {UI_MESSAGES.auth.signUp.emailLabel}
        <input
          {...register("email")}
          className="rounded-xl border border-border px-3 py-2 outline-none transition focus:border-brand-3 focus:ring-2 focus:ring-(--brand-5)/60"
          type="email"
          autoComplete="email"
        />
      </label>
      {errors.email ? (
        <p className="text-sm text-red-600">{errors.email.message}</p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        {UI_MESSAGES.auth.signUp.passwordLabel}
        <input
          {...register("password")}
          className="rounded-xl border border-border px-3 py-2 outline-none transition focus:border-brand-3 focus:ring-2 focus:ring-(--brand-5)/60"
          type="password"
          autoComplete="new-password"
        />
      </label>
      {errors.password ? (
        <p className="text-sm text-red-600">{errors.password.message}</p>
      ) : null}

      {serverError ? (
        <p className="text-sm text-red-600">{serverError}</p>
      ) : null}

      <button
        className="cursor-pointer text-sm rounded-xl bg-linear-to-r from-brand-1 to-brand-4 px-4 py-2 font-medium text-white shadow-[0_12px_30px_-18px_var(--brand-2)] transition hover:brightness-110 disabled:opacity-60"
        type="submit"
        disabled={isPending}
      >
        {isPending
          ? UI_MESSAGES.auth.signUp.submitting
          : UI_MESSAGES.auth.signUp.submit}
      </button>

      <p className="text-xs opacity-80">
        {UI_MESSAGES.auth.signUp.hasAccountPrefix}{" "}
        <Link
          className="font-medium text-brand-3 decoration-brand-5 transition hover:text-brand-5"
          href="/signin"
        >
          {UI_MESSAGES.auth.signUp.hasAccountCta}
        </Link>
      </p>
    </form>
  );
}
