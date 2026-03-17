"use client";

import { useDeferredValue, useState, useTransition } from "react";

import { AppDialog } from "~/components/app-dialog";
import { useI18n } from "~/components/locale-provider";
import { getDisplayErrorMessage } from "~/lib/client-errors";
import { readFormString } from "~/lib/forms";
import { type Messages } from "~/lib/i18n";
import { api } from "~/trpc/react";
import { PortalShell } from "~/components/portal-shell";

type View = "pairings" | "progress" | "signups";
type SignupFilter = "all" | "pending" | "approved" | "rejected";

const WEEK_NUMBERS = Array.from({ length: 20 }, (_, index) => index + 1);
const PAIRING_PAGE_SIZE = 20;

export function AdminDashboard() {
  const { locale, messages } = useI18n();
  const utils = api.useUtils();
  const [activeView, setActiveView] = useState<View>("pairings");
  const [pairingPage, setPairingPage] = useState(1);
  const [signupPage, setSignupPage] = useState(1);
  const [signupFilter, setSignupFilter] = useState<SignupFilter>("all");
  const [search, setSearch] = useState("");
  const [isPairingModalOpen, setPairingModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  const pairingsQuery = api.admin.listPairings.useQuery({
    page: pairingPage,
    pageSize: PAIRING_PAGE_SIZE,
    search: deferredSearch,
  });
  const progressReportQuery = api.admin.progressReport.useQuery(undefined, {
    enabled: activeView === "progress",
  });
  const signupsQuery = api.admin.listStudentSignups.useQuery({
    page: signupPage,
    pageSize: 20,
    status: signupFilter,
  }, {
    enabled: activeView === "signups",
  });

  const createPairing = api.admin.createPairing.useMutation({
    onSuccess: async () => {
      setPairingModalOpen(false);
      setError("");
      await Promise.all([
        utils.admin.listPairings.invalidate(),
        utils.admin.progressReport.invalidate(),
        utils.admin.listStudentSignups.invalidate(),
      ]);
    },
    onError: (mutationError) =>
      setError(getDisplayErrorMessage(mutationError, messages.admin.createPairingError)),
  });

  const deletePairing = api.admin.deletePairing.useMutation({
    onSuccess: async () => {
      setError("");
      await Promise.all([
        utils.admin.listPairings.invalidate(),
        utils.admin.progressReport.invalidate(),
      ]);
    },
    onError: (mutationError) =>
      setError(getDisplayErrorMessage(mutationError, messages.admin.deletePairingError)),
  });

  const reviewSignup = api.admin.reviewStudentSignup.useMutation({
    onSuccess: async () => {
      setRejectTargetId(null);
      setRejectReason("");
      await utils.admin.listStudentSignups.invalidate();
    },
    onError: (mutationError) =>
      setError(getDisplayErrorMessage(mutationError, messages.admin.reviewError)),
  });

  const visiblePairings = pairingsQuery.data?.pairings ?? [];
  const currentPairingPage = pairingsQuery.data?.pagination.page ?? pairingPage;
  const pairingTotalPages = pairingsQuery.data?.pagination.totalPages ?? 1;
  const progressRows = progressReportQuery.data?.pairings ?? [];
  const isLoading =
    activeView === "pairings"
      ? pairingsQuery.isLoading
      : activeView === "progress"
        ? progressReportQuery.isLoading
        : signupsQuery.isLoading;
  const loadError =
    activeView === "pairings"
      ? pairingsQuery.error
      : activeView === "progress"
        ? progressReportQuery.error
        : signupsQuery.error;
  const totalPairings =
    pairingsQuery.data?.pagination.overallTotal ??
    progressReportQuery.data?.totalPairings ??
    0;

  function exportCsv() {
    const rows = [
      [
        messages.admin.teacher,
        messages.admin.student,
        ...WEEK_NUMBERS.map((weekNumber) => formatWeekLabel(locale, weekNumber)),
        messages.admin.total,
      ].join(","),
      ...progressRows.map((pairing) => {
        const byWeek = new Map(pairing.progress.lessons.map((lesson) => [lesson.weekNumber, lesson.status]));
        return [
          csvCell(pairing.teacher?.name ?? ""),
          csvCell(pairing.student?.name ?? ""),
          ...WEEK_NUMBERS.map((weekNumber) =>
            csvCell(formatLessonStatus(messages, byWeek.get(weekNumber) ?? "pending")),
          ),
          csvCell(String(pairing.progress.taughtCount)),
        ].join(",");
      }),
    ];

    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "unique-hope-progress.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalShell
      title={messages.admin.title}
      subtitle={messages.admin.subtitle}
      badge={`${totalPairings} ${messages.admin.activePairings}`}
      navItems={[
        {
          label: messages.admin.pairings,
          active: activeView === "pairings",
          onClick: () => startTransition(() => setActiveView("pairings")),
        },
        {
          label: messages.admin.progress,
          active: activeView === "progress",
          onClick: () => startTransition(() => setActiveView("progress")),
        },
        {
          label: messages.admin.signups,
          active: activeView === "signups",
          onClick: () => startTransition(() => setActiveView("signups")),
        },
      ]}
      headerActions={
        activeView === "pairings" ? (
          <button
            type="button"
            onClick={() => setPairingModalOpen(true)}
            className="btn-primary px-4 py-2 text-sm font-semibold"
          >
            {messages.admin.newPairing}
          </button>
        ) : activeView === "progress" ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary px-4 py-2 text-sm"
            >
              {messages.admin.exportCsv}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary px-4 py-2 text-sm"
            >
              {messages.admin.print}
            </button>
          </div>
        ) : null
      }
    >
      {isLoading ? (
        <div role="status" aria-live="polite" className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-bg-secondary)] bg-white px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {messages.state.loading}
        </div>
      ) : null}
      {loadError ? (
        <div role="alert" className="mb-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {messages.state.loadError}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mb-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {activeView === "pairings" ? (
        <section className="space-y-6">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPairingPage(1);
            }}
            aria-label={messages.admin.search}
            placeholder={messages.admin.search}
            className="form-control"
          />

          <div className="overflow-x-auto dash-card">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.student}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.fields.username}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.teacher}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.fields.username}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-secondary)]">
                {visiblePairings.map((pairing) => (
                  <tr key={pairing.id} className="group hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-text-main)] transition-colors">{pairing.student?.name ?? "-"}</div>
                      <div className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">{pairing.student?.contact ?? ""}</div>
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)] font-medium">{pairing.student?.username ?? "-"}</td>
                    <td className="px-5 py-4 font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-text-main)] transition-colors">{pairing.teacher?.name ?? "-"}</td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)] font-medium">{pairing.teacher?.username ?? "-"}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        disabled={deletePairing.isPending}
                        className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 text-xs font-bold text-red-600 transition-all"
                        onClick={() => {
                          if (!window.confirm(messages.admin.deleteConfirm)) return;
                          void deletePairing.mutateAsync({ id: pairing.id });
                        }}
                      >
                        {messages.admin.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!visiblePairings.length ? (
              <div className="px-6 py-12 text-center text-sm font-medium text-[var(--color-text-secondary)]">
                {messages.admin.noPairings}
              </div>
            ) : null}
          </div>

          <Pagination
            page={currentPairingPage}
            totalPages={pairingTotalPages}
            onChange={(page) => setPairingPage(page)}
          />
        </section>
      ) : null}

      {activeView === "progress" ? (
        <section className="overflow-x-auto dash-card">
          <table className="min-w-[1050px] w-full text-left text-xs">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-5 py-4 font-semibold tracking-wide text-sm">{messages.admin.teacher}</th>
                <th className="px-5 py-4 font-semibold tracking-wide text-sm">{messages.admin.student}</th>
                {WEEK_NUMBERS.map((weekNumber) => (
                  <th key={weekNumber} className="px-3 py-4 text-center font-semibold">{weekNumber}</th>
                ))}
                <th className="px-5 py-4 font-semibold tracking-wide text-sm text-right">{messages.admin.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-secondary)]">
              {progressRows.map((pairing) => {
                const byWeek = new Map(pairing.progress.lessons.map((lesson) => [lesson.weekNumber, lesson.status]));
                return (
                  <tr key={pairing.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-bold text-[var(--color-text-main)] text-sm">{pairing.teacher?.name ?? "-"}</td>
                    <td className="px-5 py-4 font-medium text-sm">{pairing.student?.name ?? "-"}</td>
                    {WEEK_NUMBERS.map((weekNumber) => (
                      <td key={weekNumber} className="px-3 py-4 text-center">
                        <span
                          className="status-chip info cursor-help"
                          title={formatLessonStatus(messages, byWeek.get(weekNumber) ?? "pending")}
                        >
                          <span aria-hidden="true">
                            {statusAbbrev(byWeek.get(weekNumber) ?? "pending")}
                          </span>
                          <span className="sr-only">
                            {formatLessonStatus(messages, byWeek.get(weekNumber) ?? "pending")}
                          </span>
                        </span>
                      </td>
                    ))}
                    <td className="px-5 py-4 font-bold text-[var(--color-text-main)] text-sm text-right">
                      <span className="status-chip success">
                        {pairing.progress.taughtCount}/{pairing.progress.totalWeeks}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {activeView === "signups" ? (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-2.5">
            {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={signupFilter === filter}
                onClick={() => {
                  setSignupFilter(filter);
                  setSignupPage(1);
                }}
                className={`rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-bold transition-all ${
                  signupFilter === filter
                    ? "bg-[var(--color-text-main)] text-white"
                    : "border border-[var(--card-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-main)]"
                }`}
              >
                {filter === "all"
                  ? messages.admin.filterAll
                  : filter === "pending"
                    ? messages.admin.filterPending
                    : filter === "approved"
                      ? messages.admin.filterApproved
                      : messages.admin.filterRejected}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto dash-card">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.fields.name}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.fields.age}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.fields.phone}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.contact}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.status}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.submitted}</th>
                  <th className="px-5 py-4 font-semibold tracking-wide">{messages.admin.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-secondary)]">
                {(signupsQuery.data?.signups ?? []).map((signup) => (
                  <tr key={signup.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-4 font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-text-main)] transition-colors">{signup.childName}</td>
                    <td className="px-5 py-4 font-medium">{signup.age}</td>
                    <td className="px-5 py-4 font-medium">{signup.phone}</td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)] font-medium">{signup.contact ?? "-"}</td>
                    <td className="px-5 py-4">
                      <span className={`status-chip ${
                        signup.status === "approved"
                          ? "success"
                          : signup.status === "rejected"
                            ? "danger"
                            : "info"
                      }`}>
                        {formatSignupStatus(messages, signup.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)] font-medium">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(signup.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      {signup.status === "pending" ? (
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              void reviewSignup.mutateAsync({
                                id: signup.id,
                                action: "approve",
                                reason: "",
                              })
                            }
                            className="btn-primary px-4 py-2 text-xs font-bold"
                          >
                            {messages.admin.approve}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectTargetId(signup.id)}
                            className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 text-xs font-bold text-red-600 transition-all"
                          >
                            {messages.admin.reject}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-[var(--color-text-secondary)] max-w-[150px] inline-block truncate" title={signup.rejectReason ?? messages.admin.reviewed}>
                          {signup.rejectReason ?? messages.admin.reviewed}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={signupPage}
            totalPages={signupsQuery.data?.pagination.totalPages ?? 1}
            onChange={(page) => setSignupPage(page)}
          />
        </section>
      ) : null}

      {isPairingModalOpen ? (
        <Modal title={messages.admin.createPairing} onClose={() => setPairingModalOpen(false)}>
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void createPairing.mutateAsync({
                student: {
                  name: readFormString(form, "studentName"),
                  username: readFormString(form, "studentUsername"),
                  email: readFormString(form, "studentEmail"),
                  password: readFormString(form, "studentPassword"),
                  contact: readFormString(form, "studentContact"),
                },
                teacher: {
                  name: readFormString(form, "teacherName"),
                  username: readFormString(form, "teacherUsername"),
                  email: readFormString(form, "teacherEmail"),
                  password: readFormString(form, "teacherPassword"),
                  contact: readFormString(form, "teacherContact"),
                },
              });
            }}
          >
            <fieldset className="grid gap-3 dash-card p-5 bg-[var(--color-bg-secondary)]/30 border border-[var(--color-bg-secondary)]">
              <legend className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)] px-2 bg-white rounded-full mb-2 border border-[var(--color-bg-secondary)] inline-block w-fit">
                {messages.admin.student}
              </legend>
              <Field label={messages.admin.fields.name} name="studentName" />
              <Field label={messages.admin.fields.contact} name="studentContact" required={false} />
              <Field label={messages.admin.fields.username} name="studentUsername" />
              <Field label={messages.admin.fields.email} name="studentEmail" type="email" />
              <Field label={messages.admin.fields.password} name="studentPassword" type="password" />
            </fieldset>

            <fieldset className="grid gap-3 dash-card p-5 bg-[var(--color-bg-secondary)]/30 border border-[var(--color-bg-secondary)]">
              <legend className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)] px-2 bg-white rounded-full mb-2 border border-[var(--color-bg-secondary)] inline-block w-fit">
                {messages.admin.teacher}
              </legend>
              <Field label={messages.admin.fields.name} name="teacherName" />
              <Field label={messages.admin.fields.contact} name="teacherContact" required={false} />
              <Field label={messages.admin.fields.username} name="teacherUsername" />
              <Field label={messages.admin.fields.email} name="teacherEmail" type="email" />
              <Field label={messages.admin.fields.password} name="teacherPassword" type="password" />
            </fieldset>

            <button
              type="submit"
              disabled={createPairing.isPending}
              className="btn-primary px-5 py-3.5 text-sm font-bold w-full mt-2"
            >
              {createPairing.isPending ? messages.admin.creatingPairing : messages.admin.createPairingAction}
            </button>
          </form>
        </Modal>
      ) : null}

      {rejectTargetId ? (
        <Modal title={messages.admin.rejectSignup} onClose={() => setRejectTargetId(null)}>
          <div className="grid gap-5 dash-card p-4 bg-red-50/50 border border-red-100">
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              aria-label={messages.admin.rejectReasonLabel}
              rows={5}
              className="form-control resize-none"
              placeholder={messages.admin.rejectPlaceholder}
            />
            <button
              type="button"
              disabled={reviewSignup.isPending}
              onClick={() =>
                void reviewSignup.mutateAsync({
                  id: rejectTargetId,
                  action: "reject",
                  reason: rejectReason,
                })
              }
              className="btn-danger px-5 py-3.5 text-sm font-bold"
            >
              {reviewSignup.isPending ? messages.student.submitting : messages.admin.confirmReject}
            </button>
          </div>
        </Modal>
      ) : null}
    </PortalShell>
  );
}

function Field(props: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {props.label}
      </span>
      <input
        required={props.required ?? true}
        name={props.name}
        type={props.type ?? "text"}
        className="form-control"
      />
    </label>
  );
}

function Pagination(props: {
  onChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  const { messages } = useI18n();

  if (props.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <button
        type="button"
        disabled={props.page <= 1}
        onClick={() => props.onChange(props.page - 1)}
        className="btn-secondary rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-bold disabled:opacity-40"
      >
        {messages.admin.prev}
      </button>
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
        {messages.admin.page} <strong className="text-[var(--color-text-main)]">{props.page}</strong> / {props.totalPages}
      </span>
      <button
        type="button"
        disabled={props.page >= props.totalPages}
        onClick={() => props.onChange(props.page + 1)}
        className="btn-secondary rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-bold disabled:opacity-40"
      >
        {messages.admin.next}
      </button>
    </div>
  );
}

function Modal(props: { children: React.ReactNode; onClose: () => void; title: string }) {
  const { messages } = useI18n();

  return (
    <AppDialog title={props.title} closeLabel={messages.common.close} onClose={props.onClose}>
      {props.children}
    </AppDialog>
  );
}

function csvCell(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function statusAbbrev(status: string) {
  if (status === "taught") return "T";
  if (status === "teacher_leave") return "TL";
  if (status === "student_leave") return "SL";
  if (status === "sick") return "S";
  return "P";
}

function formatWeekLabel(locale: "en" | "zh", weekNumber: number) {
  return locale === "zh" ? `第${weekNumber}周` : `Week ${weekNumber}`;
}

function formatSignupStatus(
  messages: Messages,
  status: "pending" | "approved" | "rejected",
) {
  if (status === "approved") return messages.admin.approved;
  if (status === "rejected") return messages.admin.rejected;
  return messages.admin.pending;
}

function formatLessonStatus(messages: Messages, status: string) {
  if (status === "taught") return messages.teacher.statuses.taught;
  if (status === "teacher_leave") return messages.teacher.statuses.teacher_leave;
  if (status === "student_leave") return messages.teacher.statuses.student_leave;
  if (status === "sick") return messages.teacher.statuses.sick;
  return messages.teacher.statuses.pending;
}
