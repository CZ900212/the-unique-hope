"use client";

import { useDeferredValue, useState, useTransition } from "react";

import { AppDialog } from "~/components/app-dialog";
import { PortalShell } from "~/components/portal-shell";
import { useI18n } from "~/components/locale-provider";
import { getDisplayErrorMessage } from "~/lib/client-errors";
import { readFormString } from "~/lib/forms";
import { type Messages } from "~/lib/i18n";
import { api } from "~/trpc/react";

type View = "pairings" | "progress" | "waiting";
type RejectTarget =
  | {
      name: string;
      role: "student";
      signupId: string;
    }
  | {
      name: string;
      role: "teacher";
      signupId: string;
    };

const WEEK_NUMBERS = Array.from({ length: 20 }, (_, index) => index + 1);
const PAIRING_PAGE_SIZE = 20;

export function AdminDashboard() {
  const { locale, messages } = useI18n();
  const utils = api.useUtils();
  const [activeView, setActiveView] = useState<View>("pairings");
  const [pairingPage, setPairingPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isPairingModalOpen, setPairingModalOpen] = useState(false);
  const [selectedStudentProfileId, setSelectedStudentProfileId] = useState("");
  const [selectedTeacherProfileId, setSelectedTeacherProfileId] = useState("");
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
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
  const waitingPoolQuery = api.admin.waitingPool.useQuery();

  const createPairing = api.admin.createPairing.useMutation({
    onSuccess: async () => {
      setPairingModalOpen(false);
      setSelectedStudentProfileId("");
      setSelectedTeacherProfileId("");
      setError("");
      await Promise.all([
        utils.admin.listPairings.invalidate(),
        utils.admin.progressReport.invalidate(),
        utils.admin.waitingPool.invalidate(),
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
        utils.admin.waitingPool.invalidate(),
      ]);
    },
    onError: (mutationError) =>
      setError(getDisplayErrorMessage(mutationError, messages.admin.deletePairingError)),
  });

  const reviewStudentSignup = api.admin.reviewStudentSignup.useMutation({
    onSuccess: async () => {
      setRejectTarget(null);
      setRejectReason("");
      await utils.admin.waitingPool.invalidate();
    },
    onError: (mutationError) =>
      setError(getDisplayErrorMessage(mutationError, messages.admin.reviewError)),
  });

  const reviewTeacherSignup = api.admin.reviewTeacherSignup.useMutation({
    onSuccess: async () => {
      setRejectTarget(null);
      setRejectReason("");
      await utils.admin.waitingPool.invalidate();
    },
    onError: (mutationError) =>
      setError(getDisplayErrorMessage(mutationError, messages.admin.reviewError)),
  });

  const visiblePairings = pairingsQuery.data?.pairings ?? [];
  const currentPairingPage = pairingsQuery.data?.pagination.page ?? pairingPage;
  const pairingTotalPages = pairingsQuery.data?.pagination.totalPages ?? 1;
  const progressRows = progressReportQuery.data?.pairings ?? [];
  const waitingStudents = waitingPoolQuery.data?.students ?? [];
  const waitingTeachers = waitingPoolQuery.data?.teachers ?? [];
  const isLoading =
    activeView === "pairings"
      ? pairingsQuery.isLoading
      : activeView === "progress"
        ? progressReportQuery.isLoading
        : waitingPoolQuery.isLoading;
  const loadError =
    activeView === "pairings"
      ? pairingsQuery.error
      : activeView === "progress"
        ? progressReportQuery.error
        : waitingPoolQuery.error;
  const totalPairings =
    pairingsQuery.data?.pagination.overallTotal ??
    progressReportQuery.data?.totalPairings ??
    0;

  const pairingDisabled = waitingStudents.length === 0 || waitingTeachers.length === 0;
  const selectedStudent =
    waitingStudents.find((student) => student.profileId === selectedStudentProfileId) ?? null;
  const selectedTeacher =
    waitingTeachers.find((teacher) => teacher.profileId === selectedTeacherProfileId) ?? null;

  function openPairingModal(input?: {
    studentProfileId?: string;
    teacherProfileId?: string;
  }) {
    setSelectedStudentProfileId(input?.studentProfileId ?? "");
    setSelectedTeacherProfileId(input?.teacherProfileId ?? "");
    setPairingModalOpen(true);
    setError("");
  }

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
          active: activeView === "waiting",
          onClick: () => startTransition(() => setActiveView("waiting")),
        },
      ]}
      headerActions={
        activeView === "progress" ? (
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
        ) : (
          <button
            type="button"
            disabled={pairingDisabled}
            onClick={() => openPairingModal()}
            className="btn-primary px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {messages.admin.newPairing}
          </button>
        )
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
                      <div className="font-bold text-[var(--color-text-main)]">{pairing.student?.name ?? "-"}</div>
                      <div className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">{pairing.student?.contact ?? ""}</div>
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)] font-medium">{pairing.student?.username ?? "-"}</td>
                    <td className="px-5 py-4 font-bold text-[var(--color-text-main)]">{pairing.teacher?.name ?? "-"}</td>
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

      {activeView === "waiting" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <WaitingCard
            title={messages.admin.pendingStudents}
            emptyState={messages.admin.noPendingStudents}
          >
            {waitingStudents.length ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{messages.admin.fields.name}</th>
                    <th className="px-4 py-3 font-semibold">{messages.admin.fields.age}</th>
                    <th className="px-4 py-3 font-semibold">{messages.admin.fields.phone}</th>
                    <th className="px-4 py-3 font-semibold">{messages.admin.fields.username}</th>
                    <th className="px-4 py-3 font-semibold">{messages.admin.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-secondary)]">
                  {waitingStudents.map((student) => (
                    <tr key={student.profileId}>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--color-text-main)]">{student.childName}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{student.contact ?? "-"}</div>
                      </td>
                      <td className="px-4 py-4">{student.age}</td>
                      <td className="px-4 py-4">{student.phone}</td>
                      <td className="px-4 py-4">{student.username}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openPairingModal({ studentProfileId: student.profileId })}
                            className="btn-secondary px-3 py-2 text-xs font-bold"
                          >
                            {messages.admin.matchNow}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRejectTarget({
                                name: student.childName,
                                role: "student",
                                signupId: student.signupId,
                              })
                            }
                            className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                          >
                            {messages.admin.reject}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </WaitingCard>

          <WaitingCard
            title={messages.admin.pendingTeachers}
            emptyState={messages.admin.noPendingTeachers}
          >
            {waitingTeachers.length ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{messages.admin.fields.name}</th>
                    <th className="px-4 py-3 font-semibold">{messages.admin.fields.school}</th>
                    <th className="px-4 py-3 font-semibold">{messages.admin.fields.grade}</th>
                    <th className="px-4 py-3 font-semibold">{messages.admin.fields.username}</th>
                    <th className="px-4 py-3 font-semibold">{messages.admin.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-secondary)]">
                  {waitingTeachers.map((teacher) => (
                    <tr key={teacher.profileId}>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--color-text-main)]">{teacher.name}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {teacher.gender} · {teacher.englishScore}
                        </div>
                      </td>
                      <td className="px-4 py-4">{teacher.school}</td>
                      <td className="px-4 py-4">{teacher.grade}</td>
                      <td className="px-4 py-4">{teacher.username}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openPairingModal({ teacherProfileId: teacher.profileId })}
                            className="btn-secondary px-3 py-2 text-xs font-bold"
                          >
                            {messages.admin.matchNow}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRejectTarget({
                                name: teacher.name,
                                role: "teacher",
                                signupId: teacher.signupId,
                              })
                            }
                            className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                          >
                            {messages.admin.reject}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </WaitingCard>
        </section>
      ) : null}

      {isPairingModalOpen ? (
        <Modal
          title={messages.admin.createPairing}
          onClose={() => {
            setPairingModalOpen(false);
            setSelectedStudentProfileId("");
            setSelectedTeacherProfileId("");
          }}
        >
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void createPairing.mutateAsync({
                studentProfileId: readFormString(form, "studentProfileId"),
                teacherProfileId: readFormString(form, "teacherProfileId"),
              });
            }}
          >
            <SelectField
              label={messages.admin.student}
              name="studentProfileId"
              onChange={setSelectedStudentProfileId}
              options={waitingStudents.map((student) => ({
                label: `${student.childName} · ${student.username}`,
                value: student.profileId,
              }))}
              value={selectedStudentProfileId}
            />
            <SelectField
              label={messages.admin.teacher}
              name="teacherProfileId"
              onChange={setSelectedTeacherProfileId}
              options={waitingTeachers.map((teacher) => ({
                label: `${teacher.name} · ${teacher.username}`,
                value: teacher.profileId,
              }))}
              value={selectedTeacherProfileId}
            />

            {selectedStudent ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-main)]">{messages.admin.student}:</strong>{" "}
                {selectedStudent.childName} · {selectedStudent.phone}
              </div>
            ) : null}
            {selectedTeacher ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-main)]">{messages.admin.teacher}:</strong>{" "}
                {selectedTeacher.name} · {selectedTeacher.school}
              </div>
            ) : null}

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

      {rejectTarget ? (
        <Modal title={`${messages.admin.rejectSignup}: ${rejectTarget.name}`} onClose={() => setRejectTarget(null)}>
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
              disabled={reviewStudentSignup.isPending || reviewTeacherSignup.isPending}
              onClick={() => {
                if (!rejectTarget) return;
                if (rejectTarget.role === "student") {
                  void reviewStudentSignup.mutateAsync({
                    action: "reject",
                    id: rejectTarget.signupId,
                    reason: rejectReason,
                  });
                  return;
                }

                void reviewTeacherSignup.mutateAsync({
                  action: "reject",
                  id: rejectTarget.signupId,
                  reason: rejectReason,
                });
              }}
              className="btn-danger px-5 py-3.5 text-sm font-bold"
            >
              {reviewStudentSignup.isPending || reviewTeacherSignup.isPending
                ? messages.student.submitting
                : messages.admin.confirmReject}
            </button>
          </div>
        </Modal>
      ) : null}
    </PortalShell>
  );
}

function WaitingCard(props: {
  children: React.ReactNode;
  emptyState: string;
  title: string;
}) {
  return (
    <div className="overflow-hidden dash-card">
      <div className="border-b border-[var(--color-bg-secondary)] px-5 py-4">
        <h2 className="font-[var(--font-title)] text-2xl text-[var(--color-text-main)]">{props.title}</h2>
      </div>
      {props.children ?? null}
      {!props.children ? (
        <div className="px-6 py-12 text-center text-sm font-medium text-[var(--color-text-secondary)]">
          {props.emptyState}
        </div>
      ) : null}
    </div>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {props.label}
      </span>
      <select
        name={props.name}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        required
        className="form-control"
      >
        <option value="" disabled>
          Select...
        </option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

function formatLessonStatus(messages: Messages, status: string) {
  if (status === "taught") return messages.teacher.statuses.taught;
  if (status === "teacher_leave") return messages.teacher.statuses.teacher_leave;
  if (status === "student_leave") return messages.teacher.statuses.student_leave;
  if (status === "sick") return messages.teacher.statuses.sick;
  return messages.teacher.statuses.pending;
}
