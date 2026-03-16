"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "~/components/locale-provider";
import { readFormString } from "~/lib/forms";

export function PasswordResetConfirmForm(props: { token: string }) {
  const { messages } = useI18n();
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const token = props.token.trim();
  const tokenMissing = token.length === 0;
  const displayError = tokenMissing ? messages.resetConfirm.missingToken : error;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (tokenMissing) {
          setError(messages.resetConfirm.missingToken);
          return;
        }

        const form = new FormData(event.currentTarget);

        startTransition(async () => {
          setError("");

          try {
            const response = await fetch("/api/password-reset/confirm", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                token,
                password: readFormString(form, "password"),
                confirmPassword: readFormString(form, "confirmPassword"),
              }),
            });

            const data = (await response.json().catch(() => null)) as
              | {
                  error?: { message?: string };
                }
              | null;

            if (!response.ok) {
              setError(data?.error?.message ?? messages.resetConfirm.resetError);
              return;
            }

            router.push("/login?reset=success");
            router.refresh();
          } catch {
            setError(messages.resetConfirm.resetError);
          }
        });
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
        {messages.resetConfirm.subtitle}
      </div>
      <h1 className="mt-4 font-[var(--font-title)] text-3xl tracking-tight text-[var(--color-text-main)]">
        {messages.resetConfirm.title}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
        {messages.resetConfirm.summary}
      </p>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {messages.resetConfirm.newPassword}
          </span>
          <input
            name="password"
            type="password"
            disabled={tokenMissing || isPending}
            required
            minLength={6}
            autoComplete="new-password"
            className="form-control"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {messages.resetConfirm.confirmPassword}
          </span>
          <input
            name="confirmPassword"
            type="password"
            disabled={tokenMissing || isPending}
            required
            minLength={6}
            autoComplete="new-password"
            className="form-control"
          />
        </label>
      </div>

      {displayError ? (
        <div role="alert" className="mt-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || tokenMissing}
        className="btn-primary mt-6 w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? messages.resetConfirm.updating : messages.resetConfirm.update}
      </button>

      <div className="mt-6 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <Link href="/forgot-password" className="font-medium hover:text-[var(--color-text-main)]">
          {messages.resetConfirm.requestAnother}
        </Link>
        <Link href="/login" className="font-medium hover:text-[var(--color-text-main)]">
          {messages.resetConfirm.backLogin}
        </Link>
      </div>
    </form>
  );
}
