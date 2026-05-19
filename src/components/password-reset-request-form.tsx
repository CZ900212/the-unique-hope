"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { useI18n } from "~/components/locale-provider";
import { readFormString } from "~/lib/forms";

type RecoveryRole = "student" | "teacher";

export function PasswordResetRequestForm() {
  return <PasswordResetEmailRequestForm />;
}

export function PasswordResetEmailRequestForm() {
  const { messages } = useI18n();
  const [isQueued, setQueued] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitEmailRequest(form: FormData) {
    const role = readFormString(form, "role") as RecoveryRole;
    startTransition(async () => {
      setMessage("");
      setError("");

      try {
        const response = await fetch("/api/password-reset/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryMode: "email",
            role,
            identifier: readFormString(form, "identifier").trim(),
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          error?: { message?: string };
          message?: string;
        } | null;

        if (!response.ok) {
          setError(data?.error?.message ?? messages.resetRequest.requestError);
          return;
        }

        setMessage(data?.message ?? messages.resetRequest.emailQueued);
        setQueued(true);
      } catch {
        setError(messages.resetRequest.requestError);
      }
    });
  }

  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        submitEmailRequest(new FormData(event.currentTarget));
      }}
    >
      <div className="text-xs font-semibold tracking-[0.24em] text-[var(--color-primary)] uppercase">
        {messages.resetRequest.subtitle}
      </div>
      <h1 className="mt-4 text-3xl font-[var(--font-title)] tracking-tight text-[var(--color-text-main)]">
        {messages.resetRequest.emailTitle}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
        {messages.resetRequest.emailSummary}
      </p>

      {!isQueued ? (
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
              {messages.resetRequest.accountType}
            </span>
            <select
              name="role"
              required
              defaultValue="student"
              className="form-control"
            >
              <option value="student">{messages.admin.student}</option>
              <option value="teacher">{messages.admin.teacher}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
              {messages.resetRequest.emailIdentifier}
            </span>
            <input
              name="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder={messages.resetRequest.emailIdentifierPlaceholder}
              className="form-control"
            />
          </label>
        </div>
      ) : null}

      <PasswordResetRequestMessage message={message} error={error} />

      {!isQueued ? (
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary mt-6 w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? messages.resetRequest.sending
            : messages.resetRequest.emailSubmit}
        </button>
      ) : null}

      <PasswordResetRequestLinks manual />
    </form>
  );
}

export function PasswordResetManualRequestForm() {
  const { messages } = useI18n();
  const [isQueued, setQueued] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitManualRequest(form: FormData) {
    const applicantRole = readFormString(form, "applicantRole") as RecoveryRole;
    startTransition(async () => {
      setMessage("");
      setError("");

      try {
        const response = await fetch("/api/password-reset/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryMode: "manual",
            applicantRole,
            applicantName: readFormString(form, "applicantName").trim(),
            applicantContact: readFormString(form, "applicantContact").trim(),
            applicantNote: readFormString(form, "applicantNote").trim(),
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          error?: { message?: string };
          message?: string;
        } | null;

        if (!response.ok) {
          setError(data?.error?.message ?? messages.resetRequest.requestError);
          return;
        }

        setMessage(data?.message ?? messages.resetRequest.manualQueued);
        setQueued(true);
      } catch {
        setError(messages.resetRequest.requestError);
      }
    });
  }

  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        submitManualRequest(new FormData(event.currentTarget));
      }}
    >
      <div className="text-xs font-semibold tracking-[0.24em] text-[var(--color-primary)] uppercase">
        {messages.resetRequest.subtitle}
      </div>
      <h1 className="mt-4 text-3xl font-[var(--font-title)] tracking-tight text-[var(--color-text-main)]">
        {messages.resetRequest.manualTitle}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
        {messages.resetRequest.manualSummary}
      </p>

      {!isQueued ? (
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
              {messages.resetRequest.accountType}
            </span>
            <select
              name="applicantRole"
              required
              defaultValue="student"
              className="form-control"
            >
              <option value="student">{messages.admin.student}</option>
              <option value="teacher">{messages.admin.teacher}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
              {messages.resetRequest.manualName}
            </span>
            <input
              name="applicantName"
              type="text"
              required
              autoComplete="name"
              className="form-control"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
              {messages.resetRequest.manualContact}
            </span>
            <input
              name="applicantContact"
              type="text"
              required
              autoComplete="off"
              className="form-control"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
              {messages.resetRequest.manualNote}
            </span>
            <textarea
              name="applicantNote"
              maxLength={1000}
              placeholder={messages.resetRequest.manualNotePlaceholder}
              className="form-control min-h-24 resize-none"
            />
          </label>
        </div>
      ) : null}

      <PasswordResetRequestMessage message={message} error={error} />

      {!isQueued ? (
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary mt-6 w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? messages.resetRequest.sending
            : messages.resetRequest.manualSubmit}
        </button>
      ) : null}

      <PasswordResetRequestLinks />
    </form>
  );
}

function PasswordResetRequestMessage(props: {
  error: string;
  message: string;
}) {
  if (props.message) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-5 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      >
        {props.message}
      </div>
    );
  }

  if (props.error) {
    return (
      <div
        role="alert"
        className="mt-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {props.error}
      </div>
    );
  }

  return null;
}

function PasswordResetRequestLinks(props: { manual?: boolean }) {
  const { messages } = useI18n();
  const recoveryLink = props.manual ? (
    <Link
      href="/forgot-password/manual"
      className="font-medium hover:text-[var(--color-text-main)]"
    >
      {messages.resetRequest.manualLink}
    </Link>
  ) : (
    <Link
      href="/forgot-password"
      className="font-medium hover:text-[var(--color-text-main)]"
    >
      {messages.resetRequest.emailLink}
    </Link>
  );

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-secondary)]">
      <Link
        href="/login"
        className="font-medium hover:text-[var(--color-text-main)]"
      >
        {messages.resetConfirm.backLogin}
      </Link>
      {recoveryLink}
      <Link
        href="/signup"
        className="font-medium hover:text-[var(--color-text-main)]"
      >
        {messages.resetRequest.needSignup}
      </Link>
    </div>
  );
}
