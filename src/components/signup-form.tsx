"use client";

import { useState, useTransition } from "react";

import { useI18n } from "~/components/locale-provider";
import { getDisplayErrorMessage } from "~/lib/client-errors";
import { readFormString } from "~/lib/forms";
import { api } from "~/trpc/react";

type SignupRole = "student" | "teacher";
type SignupStep = "details" | "account";

export function SignupForm(props: { initialRole?: SignupRole }) {
  const { locale, messages } = useI18n();
  const [role, setRole] = useState<SignupRole>(props.initialRole ?? "student");
  const [step, setStep] = useState<SignupStep>("details");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [studentForm, setStudentForm] = useState({
    age: "",
    childName: "",
    contact: "",
    confirmPassword: "",
    password: "",
    phone: "",
    username: "",
  });
  const [teacherForm, setTeacherForm] = useState({
    confirmPassword: "",
    englishScore: "",
    gender: "",
    grade: "",
    name: "",
    password: "",
    school: "",
    username: "",
  });
  const [isPending, startTransition] = useTransition();
  const createStudentSignup = api.public.createStudentSignup.useMutation();
  const createTeacherSignup = api.public.createTeacherSignup.useMutation();

  const introZh =
    role === "student" ? messages.signup.studentIntroZh : messages.signup.teacherIntroZh;
  const introEn =
    role === "student" ? messages.signup.studentIntroEn : messages.signup.teacherIntroEn;
  const introText = locale === "zh" ? introZh : introEn;
  const headerTitle =
    step === "details"
      ? messages.signup.profileDetailsTitle
      : messages.signup.accountDetailsTitle;
  const headerDescription =
    step === "details" ? introText : messages.signup.accountDetailsBody;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (step !== "account") {
          return;
        }

        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        const password = readFormString(form, "password");
        const confirmPassword = readFormString(form, "confirmPassword");

        startTransition(async () => {
          setMessage("");
          setError("");

          if (password !== confirmPassword) {
            setError(messages.signup.confirmPasswordMismatch);
            return;
          }

          try {
            if (role === "student") {
              await createStudentSignup.mutateAsync({
                age: Number(studentForm.age),
                childName: studentForm.childName.trim(),
                contact: studentForm.contact.trim(),
                password,
                phone: studentForm.phone.trim(),
                username: studentForm.username.trim(),
              });
            } else {
              await createTeacherSignup.mutateAsync({
                englishScore: teacherForm.englishScore.trim(),
                gender: teacherForm.gender.trim(),
                grade: teacherForm.grade.trim(),
                name: teacherForm.name.trim(),
                password,
                school: teacherForm.school.trim(),
                username: teacherForm.username.trim(),
              });
            }

            setMessage(`${messages.signup.message} ${messages.signup.pendingMessage}`);
            formElement.reset();
            setStep("details");
            setStudentForm({
              age: "",
              childName: "",
              contact: "",
              confirmPassword: "",
              password: "",
              phone: "",
              username: "",
            });
            setTeacherForm({
              confirmPassword: "",
              englishScore: "",
              gender: "",
              grade: "",
              name: "",
              password: "",
              school: "",
              username: "",
            });
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
        {headerTitle}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
        {headerDescription}
      </p>

      {step === "details" ? (
        <div
          className="mt-8 grid gap-2 rounded-full bg-[var(--color-bg-secondary)] p-1"
          style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
        >
          {([
            { label: messages.signup.roleStudent, value: "student" },
            { label: messages.signup.roleTeacher, value: "teacher" },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={role === option.value}
              onClick={() => {
                setRole(option.value);
                setStep("details");
                setMessage("");
                setError("");
              }}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                role === option.value
                  ? "bg-white text-[var(--color-text-main)] border border-[var(--card-border)] shadow-sm"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {step === "details" ? (
        <div className="mt-6 space-y-5">
          {role === "student" ? (
            <>
              <Field
                label={messages.signup.childName}
                name="childName"
                onChange={(value) =>
                  setStudentForm((current) => ({ ...current, childName: value }))
                }
                type="text"
                value={studentForm.childName}
              />
              <Field
                label={messages.signup.age}
                max={18}
                min={3}
                name="age"
                onChange={(value) => setStudentForm((current) => ({ ...current, age: value }))}
                type="number"
                value={studentForm.age}
              />
              <Field
                label={messages.signup.phone}
                maxLength={20}
                minLength={6}
                name="phone"
                onChange={(value) => setStudentForm((current) => ({ ...current, phone: value }))}
                type="tel"
                value={studentForm.phone}
              />
              <Field
                label={messages.signup.contact}
                maxLength={255}
                name="contact"
                onChange={(value) =>
                  setStudentForm((current) => ({ ...current, contact: value }))
                }
                required={false}
                type="text"
                value={studentForm.contact}
              />
            </>
          ) : (
            <>
              <Field
                label={messages.signup.name}
                name="name"
                onChange={(value) => setTeacherForm((current) => ({ ...current, name: value }))}
                type="text"
                value={teacherForm.name}
              />
              <Field
                label={messages.signup.gender}
                maxLength={16}
                name="gender"
                onChange={(value) =>
                  setTeacherForm((current) => ({ ...current, gender: value }))
                }
                type="text"
                value={teacherForm.gender}
              />
              <Field
                label={messages.signup.school}
                maxLength={255}
                name="school"
                onChange={(value) =>
                  setTeacherForm((current) => ({ ...current, school: value }))
                }
                type="text"
                value={teacherForm.school}
              />
              <Field
                label={messages.signup.grade}
                maxLength={64}
                name="grade"
                onChange={(value) => setTeacherForm((current) => ({ ...current, grade: value }))}
                type="text"
                value={teacherForm.grade}
              />
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                  {messages.signup.englishScore}
                </span>
                <textarea
                  name="englishScore"
                  required
                  maxLength={2000}
                  className="form-control min-h-24 resize-none"
                  value={teacherForm.englishScore}
                  onChange={(event) =>
                    setTeacherForm((current) => ({
                      ...current,
                      englishScore: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          )}

          <button
            type="button"
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form && !form.reportValidity()) {
                return;
              }
              setError("");
              setMessage("");
              setStep("account");
            }}
            className="btn-primary mt-6 w-full px-5 py-3 text-sm font-semibold"
          >
            {messages.common.continue ?? "Continue"}
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <div className="space-y-5">
            <Field
              label={messages.signup.username}
              maxLength={32}
              minLength={3}
              name="username"
              onChange={(value) =>
                role === "student"
                  ? setStudentForm((current) => ({ ...current, username: value }))
                  : setTeacherForm((current) => ({ ...current, username: value }))
              }
              type="text"
              value={role === "student" ? studentForm.username : teacherForm.username}
            />
            <Field
              label={messages.signup.password}
              maxLength={128}
              minLength={6}
              name="password"
              onChange={(value) =>
                role === "student"
                  ? setStudentForm((current) => ({ ...current, password: value }))
                  : setTeacherForm((current) => ({ ...current, password: value }))
              }
              type="password"
              value={role === "student" ? studentForm.password : teacherForm.password}
            />
            <Field
              label={messages.signup.confirmPassword}
              maxLength={128}
              minLength={6}
              name="confirmPassword"
              onChange={(value) =>
                role === "student"
                  ? setStudentForm((current) => ({ ...current, confirmPassword: value }))
                  : setTeacherForm((current) => ({ ...current, confirmPassword: value }))
              }
              type="password"
              value={
                role === "student"
                  ? studentForm.confirmPassword
                  : teacherForm.confirmPassword
              }
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn-primary mt-6 w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? messages.signup.submitting : messages.signup.submit}
          </button>
          <div className="mt-4 flex justify-start">
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep("details");
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-main)]"
            >
              ← {messages.common.back ?? "Back"}
            </button>
          </div>
        </div>
      )}

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
    </form>
  );
}

function Field(props: {
  label: string;
  max?: number;
  maxLength?: number;
  min?: number;
  minLength?: number;
  name: string;
  onChange: (value: string) => void;
  required?: boolean;
  type: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {props.label}
      </span>
      <input
        name={props.name}
        type={props.type}
        required={props.required ?? true}
        max={props.max}
        maxLength={props.maxLength}
        min={props.min}
        minLength={props.minLength}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="form-control"
      />
    </label>
  );
}
