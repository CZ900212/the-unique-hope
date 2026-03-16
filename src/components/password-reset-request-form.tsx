"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { useI18n } from "~/components/locale-provider";
import { readFormString } from "~/lib/forms";
import { type Role } from "~/lib/domain";

const roles = ["teacher", "student"] as const satisfies readonly Role[];

export function PasswordResetRequestForm() {
  const { messages } = useI18n();
  const [role, setRole] = useState<Role>("teacher");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);

        startTransition(async () => {
          setMessage("");
          setError("");

          try {
            const response = await fetch("/api/password-reset/request", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                identifier: readFormString(form, "identifier").trim(),
                role,
              }),
            });

            const data = (await response.json().catch(() => null)) as
              | {
                  error?: { message?: string };
                }
              | null;

            if (!response.ok) {
              setError(data?.error?.message ?? messages.resetRequest.requestError);
              return;
            }

            setMessage(messages.resetRequest.sent);
          } catch {
            setError(messages.resetRequest.requestError);
          }
        });
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
        {messages.resetRequest.subtitle}
      </div>
      <h1 className="mt-4 font-[var(--font-title)] text-3xl tracking-tight text-[var(--color-text-main)]">
        {messages.resetRequest.title}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
        {messages.resetRequest.summary}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-2 rounded-full bg-[var(--color-bg-secondary)] p-1">
        {roles.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={role === option}
            onClick={() => setRole(option)}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
              role === option
                ? "bg-white text-[var(--color-text-main)] border border-[var(--card-border)] shadow-sm"
                : "text-[var(--color-text-secondary)]"
            }`}
          >
            {messages.login.roles[option]}
          </button>
        ))}
      </div>

      <label className="mt-6 block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          {messages.login.username}
        </span>
        <input
          name="identifier"
          type="text"
          required
          autoComplete="username"
          className="form-control"
        />
      </label>

      <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
        {messages.resetRequest.internalAccounts}
      </p>

      {message ? (
        <div role="status" aria-live="polite" className="mt-5 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary mt-6 w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? messages.resetRequest.sending : messages.resetRequest.send}
      </button>

      <div className="mt-6 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <Link href="/login" className="font-medium hover:text-[var(--color-text-main)]">
          {messages.resetConfirm.backLogin}
        </Link>
        <Link href="/signup" className="font-medium hover:text-[var(--color-text-main)]">
          {messages.resetRequest.needSignup}
        </Link>
      </div>
    </form>
  );
}
