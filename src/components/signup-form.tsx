"use client";

import { useState, useTransition } from "react";

import { useI18n } from "~/components/locale-provider";
import { getDisplayErrorMessage } from "~/lib/client-errors";
import { readFormString } from "~/lib/forms";
import { api } from "~/trpc/react";

export function SignupForm() {
  const { messages } = useI18n();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const signupMutation = api.public.createStudentSignup.useMutation();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);

        startTransition(async () => {
          setMessage("");
          setError("");

          try {
            await signupMutation.mutateAsync({
              childName: readFormString(form, "childName").trim(),
              age: Number(form.get("age")),
              phone: readFormString(form, "phone").trim(),
              contact: readFormString(form, "contact").trim(),
            });
            setMessage(messages.signup.message);
            formElement.reset();
          } catch (mutationError) {
            setError(getDisplayErrorMessage(mutationError, messages.signup.error));
          }
        });
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
        {messages.signup.subtitle}
      </div>
      <h1 className="mt-4 font-[var(--font-title)] text-3xl tracking-tight text-[var(--color-text-main)]">
        {messages.signup.title}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
        {messages.signup.summary}
      </p>

      <div className="mt-6 grid gap-5">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {messages.signup.childName}
          </span>
          <input
            name="childName"
            type="text"
            required
            maxLength={120}
            className="form-control"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {messages.signup.age}
          </span>
          <input
            name="age"
            type="number"
            min={3}
            max={18}
            required
            className="form-control"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {messages.signup.phone}
          </span>
          <input
            name="phone"
            type="tel"
            required
            minLength={6}
            maxLength={20}
            className="form-control"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {messages.signup.contact}
          </span>
          <input
            name="contact"
            type="text"
            maxLength={255}
            className="form-control"
          />
        </label>
      </div>

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
        {isPending ? messages.signup.submitting : messages.signup.submit}
      </button>
    </form>
  );
}
