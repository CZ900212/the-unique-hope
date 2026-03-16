"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "~/components/locale-provider";
import { readFormString } from "~/lib/forms";
import { resolveSafeCallbackPath } from "~/lib/navigation";
import { type Role } from "~/lib/domain";

const PUBLIC_LOGIN_ROLES = ["teacher", "student"] as const satisfies readonly Role[];
const LOGIN_ROLE_ORDER = ["teacher", "student", "admin"] as const satisfies readonly Role[];

type LoginFormProps = {
  allowedRoles?: readonly Role[];
  defaultRole?: Role;
  roleHint?: string;
  showForgotPassword?: boolean;
  showRoleSelector?: boolean;
  subtitle?: string;
  title?: string;
  footerNote?: string;
};

export function LoginForm(props: LoginFormProps) {
  const { messages } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const allowedRoles = LOGIN_ROLE_ORDER.filter((role) =>
    (props.allowedRoles ?? PUBLIC_LOGIN_ROLES).includes(role),
  );
  const initialRole =
    props.defaultRole && allowedRoles.includes(props.defaultRole)
      ? props.defaultRole
      : (allowedRoles[0] ?? "teacher");
  const [role, setRole] = useState<Role>(initialRole);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const callbackUrl = searchParams.get("callbackUrl");
  const resetStatus = searchParams.get("reset");
  const showRoleSelector = props.showRoleSelector ?? allowedRoles.length > 1;
  const showForgotPassword = props.showForgotPassword ?? true;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);

        startTransition(async () => {
          setError("");
          const result = await signIn("credentials", {
            identifier: readFormString(form, "identifier").trim(),
            password: readFormString(form, "password"),
            role,
            redirect: false,
          });

          if (result?.error) {
            if (result.code === "rate_limited") {
              setError("Too many sign in attempts. Try again in 15 minutes.");
              return;
            }
            setError(result.error === "CredentialsSignin" ? messages.login.invalid : result.error);
            return;
          }

          router.push(resolveSafeCallbackPath(callbackUrl, `/${role}`));
          router.refresh();
        });
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
        {props.subtitle ?? messages.login.subtitle}
      </div>
      <h1 className="mt-4 font-[var(--font-title)] text-3xl tracking-tight text-[var(--color-text-main)]">
        {props.title ?? messages.login.title}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
        {props.roleHint ?? messages.login.roleHint}
      </p>

      {resetStatus === "success" ? (
        <div role="status" aria-live="polite" className="mt-5 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {messages.login.resetSuccess}
        </div>
      ) : null}

      {showRoleSelector ? (
        <div
          className="mt-8 grid gap-2 rounded-full bg-[var(--color-bg-secondary)] p-1"
          style={{ gridTemplateColumns: `repeat(${allowedRoles.length}, minmax(0, 1fr))` }}
        >
          {allowedRoles.map((option) => (
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
      ) : null}

      <div className="mt-6 space-y-5">
        <label className="block">
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

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {messages.login.password}
          </span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="form-control"
          />
        </label>

        {showForgotPassword ? (
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-[var(--color-primary)] transition hover:text-[var(--color-text-main)]"
            >
              {messages.login.forgotPassword}
            </Link>
          </div>
        ) : null}
      </div>

      {props.footerNote ? (
        <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
          {props.footerNote}
        </p>
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
        {isPending ? messages.login.signingIn : messages.login.openDashboard}
      </button>
    </form>
  );
}
