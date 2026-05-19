"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";

import { AdminPairingDetails } from "~/components/admin-pairing-details";
import { AppDialog } from "~/components/app-dialog";
import { PortalShell } from "~/components/portal-shell";
import { useI18n } from "~/components/locale-provider";
import { getDisplayErrorMessage } from "~/lib/client-errors";
import { formatAppDateTime } from "~/lib/date-format";
import { readFormString } from "~/lib/forms";
import { type Messages } from "~/lib/i18n";
import { api, type RouterOutputs } from "~/trpc/react";

type View = "signups" | "progress" | "appointments" | "recovery" | "reviewed";
type ReviewedFilter = "all" | "approved" | "rejected";
type WaitingPoolOutput = RouterOutputs["admin"]["waitingPool"];
type WaitingStudent = WaitingPoolOutput["students"][number];
type WaitingTeacher = WaitingPoolOutput["teachers"][number];
type PairingDetailsOutput = RouterOutputs["admin"]["pairingDetails"];
type RecoveryRequest = RouterOutputs["admin"]["listRecoveryRequests"][number];
type RecoveryCandidate = RecoveryRequest["candidates"][number];
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
type SignupDetailsTarget =
  | {
      role: "student";
      signup: WaitingStudent;
    }
  | {
      role: "teacher";
      signup: WaitingTeacher;
    };

const WEEK_NUMBERS = Array.from({ length: 20 }, (_, index) => index + 1);
const PAIRING_PAGE_SIZE = 20;

export function AdminDashboard() {
  const { locale, messages } = useI18n();
  const utils = api.useUtils();
  const [activeView, setActiveView] = useState<View>("signups");
  const [pairingPage, setPairingPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isPairingModalOpen, setPairingModalOpen] = useState(false);
  const [selectedStudentProfileId, setSelectedStudentProfileId] = useState("");
  const [selectedTeacherProfileId, setSelectedTeacherProfileId] = useState("");
  const [signupDetailsTarget, setSignupDetailsTarget] =
    useState<SignupDetailsTarget | null>(null);
  const [detailPairingId, setDetailPairingId] = useState<string | null>(null);
  const [selectedDetailWeek, setSelectedDetailWeek] = useState(1);
  const [manualDetailWeek, setManualDetailWeek] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [reviewedFilter, setReviewedFilter] = useState<ReviewedFilter>("all");
  const [recoveryResetUrl, setRecoveryResetUrl] = useState("");
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
    enabled: activeView === "progress" || activeView === "appointments",
  });
  const waitingPoolQuery = api.admin.waitingPool.useQuery();
  const reviewedSignupsQuery = api.admin.listReviewedSignups.useQuery(
    {
      role: "all",
      status: reviewedFilter,
    },
    {
      enabled: activeView === "reviewed",
    },
  );
  const recoveryRequestsQuery = api.admin.listRecoveryRequests.useQuery(
    undefined,
    {
      enabled: activeView === "recovery",
    },
  );
  const pairingDetailsQuery = api.admin.pairingDetails.useQuery(
    detailPairingId ? { id: detailPairingId } : (undefined as never),
    {
      enabled: Boolean(detailPairingId),
    },
  );

  const createPairing = api.admin.createPairing.useMutation({
    onSuccess: async () => {
      setPairingModalOpen(false);
      setSignupDetailsTarget(null);
      setSelectedStudentProfileId("");
      setSelectedTeacherProfileId("");
      setError("");
      await Promise.all([
        utils.admin.listPairings.invalidate(),
        utils.admin.listReviewedSignups.invalidate(),
        utils.admin.progressReport.invalidate(),
        utils.admin.waitingPool.invalidate(),
      ]);
    },
    onError: (mutationError) =>
      setError(
        getDisplayErrorMessage(
          mutationError,
          messages.admin.createPairingError,
        ),
      ),
  });

  const deletePairing = api.admin.deletePairing.useMutation({
    onSuccess: async () => {
      setDetailPairingId((current) =>
        current === deletePairing.variables?.id ? null : current,
      );
      setError("");
      await Promise.all([
        utils.admin.listPairings.invalidate(),
        utils.admin.listReviewedSignups.invalidate(),
        utils.admin.progressReport.invalidate(),
        utils.admin.waitingPool.invalidate(),
      ]);
    },
    onError: (mutationError) =>
      setError(
        getDisplayErrorMessage(
          mutationError,
          messages.admin.deletePairingError,
        ),
      ),
  });

  const reviewStudentSignup = api.admin.reviewStudentSignup.useMutation({
    onSuccess: async () => {
      setSignupDetailsTarget(null);
      setRejectTarget(null);
      setRejectReason("");
      await Promise.all([
        utils.admin.listReviewedSignups.invalidate(),
        utils.admin.waitingPool.invalidate(),
      ]);
    },
    onError: (mutationError) =>
      setError(
        getDisplayErrorMessage(mutationError, messages.admin.reviewError),
      ),
  });

  const reviewTeacherSignup = api.admin.reviewTeacherSignup.useMutation({
    onSuccess: async () => {
      setSignupDetailsTarget(null);
      setRejectTarget(null);
      setRejectReason("");
      await Promise.all([
        utils.admin.listReviewedSignups.invalidate(),
        utils.admin.waitingPool.invalidate(),
      ]);
    },
    onError: (mutationError) =>
      setError(
        getDisplayErrorMessage(mutationError, messages.admin.reviewError),
      ),
  });
  const markRecoveryRequest = api.admin.markRecoveryRequest.useMutation({
    onSuccess: async () => {
      await utils.admin.listRecoveryRequests.invalidate();
    },
    onError: (mutationError) =>
      setError(
        getDisplayErrorMessage(mutationError, messages.admin.recoveryError),
      ),
  });
  const createRecoveryResetLink = api.admin.createRecoveryResetLink.useMutation(
    {
      onSuccess: (data) => {
        setRecoveryResetUrl(data.resetUrl);
      },
      onError: (mutationError) =>
        setError(
          getDisplayErrorMessage(mutationError, messages.admin.recoveryError),
        ),
    },
  );

  const visiblePairings = pairingsQuery.data?.pairings ?? [];
  const currentPairingPage = pairingsQuery.data?.pagination.page ?? pairingPage;
  const pairingTotalPages = pairingsQuery.data?.pagination.totalPages ?? 1;
  const progressRows = progressReportQuery.data?.pairings ?? [];
  const appointmentRows = progressRows
    .flatMap((pairing) =>
      pairing.appointments.map((appointment) => ({
        appointment,
        pairing,
      })),
    )
    .sort(
      (left, right) =>
        new Date(left.appointment.scheduledStart).getTime() -
        new Date(right.appointment.scheduledStart).getTime(),
    );
  const reviewedSignups = reviewedSignupsQuery.data ?? [];
  const recoveryRequests = recoveryRequestsQuery.data ?? [];
  const waitingStudents = waitingPoolQuery.data?.students ?? [];
  const waitingTeachers = waitingPoolQuery.data?.teachers ?? [];
  const approvedWaitingStudents = waitingStudents.filter(
    (student) => student.status === "approved",
  );
  const approvedWaitingTeachers = waitingTeachers.filter(
    (teacher) => teacher.status === "approved",
  );
  const pendingStudents = waitingStudents.filter(
    (student) => student.status === "pending",
  );
  const pendingTeachers = waitingTeachers.filter(
    (teacher) => teacher.status === "pending",
  );
  const isLoading =
    activeView === "signups"
      ? pairingsQuery.isLoading || waitingPoolQuery.isLoading
      : activeView === "progress"
        ? progressReportQuery.isLoading
        : activeView === "reviewed"
          ? reviewedSignupsQuery.isLoading
          : activeView === "recovery"
            ? recoveryRequestsQuery.isLoading
            : progressReportQuery.isLoading;
  const loadError =
    activeView === "signups"
      ? (pairingsQuery.error ?? waitingPoolQuery.error)
      : activeView === "progress"
        ? progressReportQuery.error
        : activeView === "reviewed"
          ? reviewedSignupsQuery.error
          : activeView === "recovery"
            ? recoveryRequestsQuery.error
            : progressReportQuery.error;
  const totalPairings =
    pairingsQuery.data?.pagination.overallTotal ??
    progressReportQuery.data?.totalPairings ??
    0;
  const detailData = detailPairingId ? pairingDetailsQuery.data : null;
  const detailPairingKey = detailData?.pairing.id ?? null;
  const preferredDetailWeek = detailData
    ? getPreferredDetailWeek(detailData)
    : null;

  const pairingDisabled =
    approvedWaitingStudents.length === 0 ||
    approvedWaitingTeachers.length === 0;
  const selectedStudent =
    approvedWaitingStudents.find(
      (student) => student.profileId === selectedStudentProfileId,
    ) ?? null;
  const selectedTeacher =
    approvedWaitingTeachers.find(
      (teacher) => teacher.profileId === selectedTeacherProfileId,
    ) ?? null;

  useEffect(() => {
    if (!detailPairingKey || preferredDetailWeek === null || manualDetailWeek) {
      return;
    }

    setSelectedDetailWeek(preferredDetailWeek);
  }, [detailPairingKey, manualDetailWeek, preferredDetailWeek]);

  function getMatchAvailability(
    role: "student" | "teacher",
    status: "pending" | "approved" | "rejected",
  ) {
    if (status !== "approved") {
      return {
        canMatch: false,
        reason: null,
      };
    }

    if (role === "student") {
      return {
        canMatch: approvedWaitingTeachers.length > 0,
        reason:
          approvedWaitingTeachers.length > 0
            ? null
            : messages.admin.matchRequiresApprovedTeacher,
      };
    }

    return {
      canMatch: approvedWaitingStudents.length > 0,
      reason:
        approvedWaitingStudents.length > 0
          ? null
          : messages.admin.matchRequiresApprovedStudent,
    };
  }

  function openPairingModal(input?: {
    studentProfileId?: string;
    teacherProfileId?: string;
  }) {
    if (input?.studentProfileId && approvedWaitingTeachers.length === 0) {
      setError(messages.admin.matchRequiresApprovedTeacher);
      return;
    }

    if (input?.teacherProfileId && approvedWaitingStudents.length === 0) {
      setError(messages.admin.matchRequiresApprovedStudent);
      return;
    }

    setSelectedStudentProfileId(input?.studentProfileId ?? "");
    setSelectedTeacherProfileId(input?.teacherProfileId ?? "");
    setPairingModalOpen(true);
    setError("");
  }

  function openSignupDetails(target: SignupDetailsTarget) {
    setSignupDetailsTarget(target);
    setError("");
  }

  function openPairingDetails(pairingId: string) {
    setDetailPairingId(pairingId);
    setSelectedDetailWeek(1);
    setManualDetailWeek(false);
    setError("");
  }

  function handleApprove(target: {
    role: "student" | "teacher";
    signupId: string;
    status: "pending" | "approved" | "rejected";
  }) {
    if (target.status !== "pending") {
      return;
    }

    if (!window.confirm(messages.admin.approveConfirm)) {
      return;
    }

    if (target.role === "student") {
      void reviewStudentSignup.mutateAsync({
        action: "approve",
        id: target.signupId,
        reason: "",
      });
      return;
    }

    void reviewTeacherSignup.mutateAsync({
      action: "approve",
      id: target.signupId,
      reason: "",
    });
  }

  function exportProgressCsv() {
    const rows = [
      [
        messages.admin.teacher,
        messages.admin.student,
        ...WEEK_NUMBERS.map((weekNumber) =>
          formatWeekLabel(locale, weekNumber),
        ),
        messages.admin.total,
      ].join(","),
      ...progressRows.map((pairing) => {
        const byWeek = new Map(
          pairing.progress.lessons.map((lesson) => [
            lesson.weekNumber,
            lesson.status,
          ]),
        );
        return [
          csvCell(pairing.teacher?.name ?? ""),
          csvCell(pairing.student?.name ?? ""),
          ...WEEK_NUMBERS.map((weekNumber) =>
            csvCell(
              formatLessonStatus(messages, byWeek.get(weekNumber) ?? "pending"),
            ),
          ),
          csvCell(String(pairing.progress.taughtCount)),
        ].join(",");
      }),
    ];

    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/csv" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "unique-hope-progress.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportReviewedCsv() {
    const rows = [
      [
        messages.admin.fields.name,
        messages.admin.fields.username,
        messages.admin.role,
        messages.admin.status,
        messages.admin.submitted,
        messages.admin.reviewed,
        messages.admin.reason,
      ]
        .map(csvCell)
        .join(","),
      ...reviewedSignups.map((signup) =>
        [
          signup.name,
          `@${signup.username}`,
          formatSignupRole(messages, signup.role),
          formatSignupStatus(messages, signup.status),
          formatAdminDate(locale, signup.createdAt),
          formatAdminDate(locale, signup.reviewedAt),
          signup.rejectReason ?? "",
        ]
          .map(csvCell)
          .join(","),
      ),
    ];

    const today = new Date();
    const filenameDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("");
    const url = URL.createObjectURL(
      new Blob([`\ufeff${rows.join("\n")}`], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reviewed-signups-${filenameDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalShell
      title={
        detailData
          ? `${detailData.pairing.student?.name ?? "-"} · ${detailData.pairing.teacher?.name ?? "-"}`
          : messages.admin.title
      }
      subtitle={
        detailPairingId
          ? messages.admin.pairingDetailsSubtitle
          : messages.admin.subtitle
      }
      badge={
        detailData
          ? `${detailData.summary.taughtCount}/${detailData.summary.totalWeeks} ${messages.admin.total}`
          : `${totalPairings} ${messages.admin.activePairings}`
      }
      navItems={[
        {
          label: messages.admin.signupManagement,
          active: activeView === "signups",
          onClick: () =>
            startTransition(() => {
              setActiveView("signups");
              setDetailPairingId(null);
            }),
        },
        {
          label: messages.admin.progress,
          active: activeView === "progress",
          onClick: () =>
            startTransition(() => {
              setActiveView("progress");
              setDetailPairingId(null);
            }),
        },
        {
          label: messages.admin.bookingManagement,
          active: activeView === "appointments",
          onClick: () =>
            startTransition(() => {
              setActiveView("appointments");
              setDetailPairingId(null);
            }),
        },
        {
          label: messages.admin.accountRecovery,
          active: activeView === "recovery",
          onClick: () =>
            startTransition(() => {
              setActiveView("recovery");
              setDetailPairingId(null);
              setRecoveryResetUrl("");
            }),
        },
        {
          label: messages.admin.reviewedHistory,
          active: activeView === "reviewed",
          onClick: () =>
            startTransition(() => {
              setActiveView("reviewed");
              setDetailPairingId(null);
            }),
        },
      ]}
      headerActions={
        detailPairingId ? (
          <button
            type="button"
            onClick={() => setDetailPairingId(null)}
            className="btn-secondary px-4 py-2 text-sm"
          >
            {messages.admin.backToDashboard}
          </button>
        ) : activeView === "progress" ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={exportProgressCsv}
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
        ) : activeView === "signups" ? (
          <button
            type="button"
            disabled={pairingDisabled}
            onClick={() => openPairingModal()}
            className="btn-primary px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {messages.admin.newPairing}
          </button>
        ) : null
      }
    >
      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-bg-secondary)] bg-white px-4 py-3 text-sm text-[var(--color-text-secondary)]"
        >
          {messages.state.loading}
        </div>
      ) : null}
      {loadError ? (
        <div
          role="alert"
          className="mb-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {messages.state.loadError}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {detailPairingId ? (
        pairingDetailsQuery.isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-bg-secondary)] bg-white px-4 py-3 text-sm text-[var(--color-text-secondary)]"
          >
            {messages.state.loading}
          </div>
        ) : pairingDetailsQuery.error ? (
          <div
            role="alert"
            className="mb-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {messages.state.loadError}
          </div>
        ) : detailData ? (
          <AdminPairingDetails
            data={detailData}
            selectedWeek={selectedDetailWeek}
            onSelectWeek={(weekNumber) => {
              setManualDetailWeek(true);
              setSelectedDetailWeek(weekNumber);
            }}
          />
        ) : null
      ) : null}

      {!detailPairingId && activeView === "recovery" ? (
        <section className="space-y-5">
          {recoveryResetUrl ? (
            <div
              role="status"
              className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <div className="font-semibold">
                {messages.admin.resetLinkReady}
              </div>
              <input
                readOnly
                value={recoveryResetUrl}
                className="form-control mt-2 bg-white"
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
          ) : null}

          <section className="dash-card overflow-hidden">
            <div className="border-b border-[var(--color-bg-secondary)] px-5 py-4">
              <h2 className="text-base font-bold text-[var(--color-text-main)]">
                {messages.admin.accountRecovery}
              </h2>
            </div>
            {recoveryRequests.length ? (
              <div className="divide-y divide-[var(--color-bg-secondary)]">
                {recoveryRequests.map((request) => (
                  <div key={request.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--color-text-main)]">
                          {request.applicantName}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                          <span>
                            {formatSignupRole(messages, request.applicantRole)}
                          </span>
                          <span>{request.applicantContact}</span>
                          <span>
                            {messages.admin.candidateAccounts}:{" "}
                            {request.candidates.length}
                          </span>
                          <span className={statusChipClass(request.status)}>
                            {formatRecoveryStatus(messages, request.status)}
                          </span>
                        </div>
                        {request.applicantNote ? (
                          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                            {request.applicantNote}
                          </p>
                        ) : null}
                        <div className="mt-3 grid gap-2">
                          {request.candidates.map((candidate) => (
                            <button
                              key={candidate.userId}
                              type="button"
                              disabled={
                                createRecoveryResetLink.isPending ||
                                request.status !== "pending"
                              }
                              onClick={() =>
                                createRecoveryResetLink.mutate({
                                  requestId: request.id,
                                  userId: candidate.userId,
                                })
                              }
                              className="btn-secondary justify-start px-3 py-2 text-left text-xs"
                            >
                              <span className="block font-semibold">
                                {messages.admin.createResetLink}:{" "}
                                {candidate.name} @{candidate.username}
                              </span>
                              <span className="mt-1 block font-normal text-[var(--color-text-secondary)]">
                                {formatRecoveryCandidateDetails(
                                  messages,
                                  candidate,
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      {request.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={markRecoveryRequest.isPending}
                            onClick={() =>
                              markRecoveryRequest.mutate({
                                id: request.id,
                                status: "rejected",
                              })
                            }
                            className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
                          >
                            {messages.admin.reject}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-sm text-[var(--color-text-secondary)]">
                {messages.admin.noRecoveryRequests}
              </div>
            )}
          </section>
        </section>
      ) : null}

      {!detailPairingId && activeView === "signups" ? (
        <section className="space-y-8">
          {/* ── Block A: Pending Review ── */}
          <div>
            <h2 className="mb-4 text-base font-bold text-[var(--color-text-main)]">
              {messages.admin.pendingReview}
            </h2>
            <div className="grid gap-6 xl:grid-cols-2">
              <WaitingCard
                title={messages.admin.pendingStudents}
                count={pendingStudents.length}
                emptyState={messages.admin.noPendingStudents}
              >
                {pendingStudents.length ? (
                  <div className="divide-y divide-[var(--color-bg-secondary)]">
                    {pendingStudents.map((student) => {
                      const isReviewing =
                        reviewStudentSignup.isPending &&
                        reviewStudentSignup.variables?.id === student.signupId;
                      return (
                        <div
                          key={student.profileId}
                          className="px-5 py-4 transition-colors hover:bg-gray-50/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-bold text-[var(--color-text-main)]">
                                  {student.childName}
                                </span>
                                <span
                                  className={statusChipClass(student.status)}
                                >
                                  {formatSignupStatus(messages, student.status)}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-secondary)]">
                                <span>
                                  {messages.admin.fields.age}: {student.age}
                                </span>
                                <span>{student.phone}</span>
                                <span className="text-[var(--color-text-light)]">
                                  @{student.username}
                                </span>
                                <span className="text-[var(--color-text-light)]">
                                  {messages.admin.submitted}:{" "}
                                  {formatAdminDate(locale, student.createdAt)}
                                </span>
                              </div>
                            </div>

                            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                              <button
                                type="button"
                                onClick={() =>
                                  openSignupDetails({
                                    role: "student",
                                    signup: student,
                                  })
                                }
                                className="btn-secondary px-3.5 py-2 text-xs font-semibold sm:py-1.5"
                              >
                                {messages.admin.view}
                              </button>
                              <button
                                type="button"
                                aria-label={`${messages.admin.approve} ${student.childName}`}
                                disabled={isReviewing}
                                onClick={() =>
                                  handleApprove({
                                    role: "student",
                                    signupId: student.signupId,
                                    status: student.status,
                                  })
                                }
                                className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 sm:py-1.5"
                              >
                                {isReviewing ? "…" : messages.admin.approve}
                              </button>
                              <button
                                type="button"
                                aria-label={`${messages.admin.reject} ${student.childName}`}
                                onClick={() =>
                                  setRejectTarget({
                                    name: student.childName,
                                    role: "student",
                                    signupId: student.signupId,
                                  })
                                }
                                className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 sm:py-1.5"
                              >
                                {messages.admin.reject}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </WaitingCard>

              <WaitingCard
                title={messages.admin.pendingTeachers}
                count={pendingTeachers.length}
                emptyState={messages.admin.noPendingTeachers}
              >
                {pendingTeachers.length ? (
                  <div className="divide-y divide-[var(--color-bg-secondary)]">
                    {pendingTeachers.map((teacher) => {
                      const isReviewing =
                        reviewTeacherSignup.isPending &&
                        reviewTeacherSignup.variables?.id === teacher.signupId;
                      return (
                        <div
                          key={teacher.profileId}
                          className="px-5 py-4 transition-colors hover:bg-gray-50/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-bold text-[var(--color-text-main)]">
                                  {teacher.name}
                                </span>
                                <span
                                  className={statusChipClass(teacher.status)}
                                >
                                  {formatSignupStatus(messages, teacher.status)}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-secondary)]">
                                <span>{teacher.school}</span>
                                <span>{teacher.grade}</span>
                                <span className="text-[var(--color-text-light)]">
                                  @{teacher.username}
                                </span>
                                <span className="text-[var(--color-text-light)]">
                                  {messages.admin.submitted}:{" "}
                                  {formatAdminDate(locale, teacher.createdAt)}
                                </span>
                              </div>
                            </div>

                            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                              <button
                                type="button"
                                onClick={() =>
                                  openSignupDetails({
                                    role: "teacher",
                                    signup: teacher,
                                  })
                                }
                                className="btn-secondary px-3.5 py-2 text-xs font-semibold sm:py-1.5"
                              >
                                {messages.admin.view}
                              </button>
                              <button
                                type="button"
                                aria-label={`${messages.admin.approve} ${teacher.name}`}
                                disabled={isReviewing}
                                onClick={() =>
                                  handleApprove({
                                    role: "teacher",
                                    signupId: teacher.signupId,
                                    status: teacher.status,
                                  })
                                }
                                className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 sm:py-1.5"
                              >
                                {isReviewing ? "…" : messages.admin.approve}
                              </button>
                              <button
                                type="button"
                                aria-label={`${messages.admin.reject} ${teacher.name}`}
                                onClick={() =>
                                  setRejectTarget({
                                    name: teacher.name,
                                    role: "teacher",
                                    signupId: teacher.signupId,
                                  })
                                }
                                className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 sm:py-1.5"
                              >
                                {messages.admin.reject}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </WaitingCard>
            </div>
          </div>

          {/* ── Block B: Ready to Pair ── */}
          <div>
            <h2 className="mb-4 text-base font-bold text-[var(--color-text-main)]">
              {messages.admin.readyToPair}
            </h2>
            <div className="grid gap-6 xl:grid-cols-2">
              <WaitingCard
                title={messages.admin.student}
                count={approvedWaitingStudents.length}
                emptyState={messages.admin.noPendingStudents}
              >
                {approvedWaitingStudents.length ? (
                  <div className="divide-y divide-[var(--color-bg-secondary)]">
                    {approvedWaitingStudents.map((student) => {
                      const matchState = getMatchAvailability(
                        "student",
                        student.status,
                      );
                      return (
                        <div
                          key={student.profileId}
                          className="px-5 py-4 transition-colors hover:bg-gray-50/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-bold text-[var(--color-text-main)]">
                                  {student.childName}
                                </span>
                                <span
                                  className={statusChipClass(student.status)}
                                >
                                  {formatSignupStatus(messages, student.status)}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-secondary)]">
                                <span>
                                  {messages.admin.fields.age}: {student.age}
                                </span>
                                <span>{student.phone}</span>
                                <span className="text-[var(--color-text-light)]">
                                  @{student.username}
                                </span>
                                <span className="text-[var(--color-text-light)]">
                                  {messages.admin.submitted}:{" "}
                                  {formatAdminDate(locale, student.createdAt)}
                                </span>
                              </div>
                            </div>

                            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                              <button
                                type="button"
                                onClick={() =>
                                  openSignupDetails({
                                    role: "student",
                                    signup: student,
                                  })
                                }
                                className="btn-secondary px-3.5 py-2 text-xs font-semibold sm:py-1.5"
                              >
                                {messages.admin.view}
                              </button>
                              <button
                                type="button"
                                disabled={!matchState.canMatch}
                                onClick={() =>
                                  openPairingModal({
                                    studentProfileId: student.profileId,
                                  })
                                }
                                title={matchState.reason ?? undefined}
                                className="btn-primary px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:py-1.5"
                              >
                                {messages.admin.matchNow}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </WaitingCard>

              <WaitingCard
                title={messages.admin.teacher}
                count={approvedWaitingTeachers.length}
                emptyState={messages.admin.noPendingTeachers}
              >
                {approvedWaitingTeachers.length ? (
                  <div className="divide-y divide-[var(--color-bg-secondary)]">
                    {approvedWaitingTeachers.map((teacher) => {
                      const matchState = getMatchAvailability(
                        "teacher",
                        teacher.status,
                      );
                      return (
                        <div
                          key={teacher.profileId}
                          className="px-5 py-4 transition-colors hover:bg-gray-50/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-bold text-[var(--color-text-main)]">
                                  {teacher.name}
                                </span>
                                <span
                                  className={statusChipClass(teacher.status)}
                                >
                                  {formatSignupStatus(messages, teacher.status)}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-secondary)]">
                                <span>{teacher.school}</span>
                                <span>{teacher.grade}</span>
                                <span className="text-[var(--color-text-light)]">
                                  @{teacher.username}
                                </span>
                                <span className="text-[var(--color-text-light)]">
                                  {messages.admin.submitted}:{" "}
                                  {formatAdminDate(locale, teacher.createdAt)}
                                </span>
                              </div>
                            </div>

                            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                              <button
                                type="button"
                                onClick={() =>
                                  openSignupDetails({
                                    role: "teacher",
                                    signup: teacher,
                                  })
                                }
                                className="btn-secondary px-3.5 py-2 text-xs font-semibold sm:py-1.5"
                              >
                                {messages.admin.view}
                              </button>
                              <button
                                type="button"
                                disabled={!matchState.canMatch}
                                onClick={() =>
                                  openPairingModal({
                                    teacherProfileId: teacher.profileId,
                                  })
                                }
                                title={matchState.reason ?? undefined}
                                className="btn-primary px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:py-1.5"
                              >
                                {messages.admin.matchNow}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </WaitingCard>
            </div>
          </div>

          {/* ── Block C: Paired ── */}
          <div>
            <h2 className="mb-4 text-base font-bold text-[var(--color-text-main)]">
              {messages.admin.pairedSection}
            </h2>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPairingPage(1);
              }}
              aria-label={messages.admin.search}
              placeholder={messages.admin.search}
              className="form-control mb-4"
            />

            <div className="dash-card overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-5 py-4 font-semibold tracking-wide">
                      {messages.admin.student}
                    </th>
                    <th className="px-5 py-4 font-semibold tracking-wide">
                      {messages.admin.fields.username}
                    </th>
                    <th className="px-5 py-4 font-semibold tracking-wide">
                      {messages.admin.teacher}
                    </th>
                    <th className="px-5 py-4 font-semibold tracking-wide">
                      {messages.admin.fields.username}
                    </th>
                    <th className="px-5 py-4 font-semibold tracking-wide">
                      {messages.admin.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-secondary)]">
                  {visiblePairings.map((pairing) => {
                    const hasSavedHistory = pairing.progress.lessons.length > 0;

                    return (
                      <tr
                        key={pairing.id}
                        className="group transition-colors hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="font-bold text-[var(--color-text-main)]">
                            {pairing.student?.name ?? "-"}
                          </div>
                          <div className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">
                            {pairing.student?.contact ?? ""}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-medium text-[var(--color-text-secondary)]">
                          {pairing.student?.username ?? "-"}
                        </td>
                        <td className="px-5 py-4 font-bold text-[var(--color-text-main)]">
                          {pairing.teacher?.name ?? "-"}
                        </td>
                        <td className="px-5 py-4 font-medium text-[var(--color-text-secondary)]">
                          {pairing.teacher?.username ?? "-"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openPairingDetails(pairing.id)}
                              className="btn-secondary px-4 py-2 text-xs font-bold"
                            >
                              {messages.admin.viewDetails}
                            </button>
                            <button
                              type="button"
                              disabled={
                                deletePairing.isPending || hasSavedHistory
                              }
                              title={
                                hasSavedHistory
                                  ? messages.admin.deleteDisabledHistory
                                  : undefined
                              }
                              className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => {
                                if (hasSavedHistory) return;
                                if (
                                  !window.confirm(messages.admin.deleteConfirm)
                                )
                                  return;
                                void deletePairing.mutateAsync({
                                  id: pairing.id,
                                });
                              }}
                            >
                              {deletePairing.isPending &&
                              deletePairing.variables?.id === pairing.id
                                ? "…"
                                : messages.admin.delete}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
          </div>
        </section>
      ) : null}

      {!detailPairingId && activeView === "progress" ? (
        <section className="dash-card overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-5 py-4 text-sm font-semibold tracking-wide">
                  {messages.admin.teacher}
                </th>
                <th className="px-5 py-4 text-sm font-semibold tracking-wide">
                  {messages.admin.student}
                </th>
                {WEEK_NUMBERS.map((weekNumber) => (
                  <th
                    key={weekNumber}
                    className="px-3 py-4 text-center font-semibold"
                  >
                    {weekNumber}
                  </th>
                ))}
                <th className="px-5 py-4 text-right text-sm font-semibold tracking-wide">
                  {messages.admin.total}
                </th>
                <th className="px-5 py-4 text-right text-sm font-semibold tracking-wide">
                  {messages.admin.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-secondary)]">
              {progressRows.map((pairing) => {
                const byWeek = new Map(
                  pairing.progress.lessons.map((lesson) => [
                    lesson.weekNumber,
                    lesson.status,
                  ]),
                );
                return (
                  <tr
                    key={pairing.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-5 py-4 text-sm font-bold text-[var(--color-text-main)]">
                      {pairing.teacher?.name ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium">
                      {pairing.student?.name ?? "-"}
                    </td>
                    {WEEK_NUMBERS.map((weekNumber) => (
                      <td key={weekNumber} className="px-3 py-4 text-center">
                        <span
                          className="status-chip info cursor-help"
                          title={formatLessonStatus(
                            messages,
                            byWeek.get(weekNumber) ?? "pending",
                          )}
                        >
                          <span aria-hidden="true">
                            {statusAbbrev(byWeek.get(weekNumber) ?? "pending")}
                          </span>
                          <span className="sr-only">
                            {formatLessonStatus(
                              messages,
                              byWeek.get(weekNumber) ?? "pending",
                            )}
                          </span>
                        </span>
                      </td>
                    ))}
                    <td className="px-5 py-4 text-right text-sm font-bold text-[var(--color-text-main)]">
                      <span className="status-chip success">
                        {pairing.progress.taughtCount}/
                        {pairing.progress.totalWeeks}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openPairingDetails(pairing.id)}
                        className="btn-secondary px-3 py-2 text-xs font-semibold"
                      >
                        {messages.admin.viewDetails}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {!detailPairingId && activeView === "appointments" ? (
        <section className="dash-card overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-5 py-4 font-semibold tracking-wide">
                  {messages.admin.student}
                </th>
                <th className="px-5 py-4 font-semibold tracking-wide">
                  {messages.admin.teacher}
                </th>
                <th className="px-5 py-4 font-semibold tracking-wide">
                  {messages.booking.dateTimeLabel}
                </th>
                <th className="px-5 py-4 font-semibold tracking-wide">
                  {messages.booking.durationLabel}
                </th>
                <th className="px-5 py-4 font-semibold tracking-wide">
                  {messages.admin.status}
                </th>
                <th className="px-5 py-4 font-semibold tracking-wide">
                  {messages.booking.requestedBy}
                </th>
                <th className="px-5 py-4 font-semibold tracking-wide">
                  {messages.booking.reasonLabel}
                </th>
                <th className="px-5 py-4 text-right font-semibold tracking-wide">
                  {messages.admin.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-secondary)]">
              {appointmentRows.map(({ appointment, pairing }) => (
                <tr
                  key={appointment.id}
                  className="transition-colors hover:bg-gray-50"
                >
                  <td className="px-5 py-4 font-bold text-[var(--color-text-main)]">
                    {pairing.student?.name ?? "-"}
                  </td>
                  <td className="px-5 py-4 font-medium text-[var(--color-text-secondary)]">
                    {pairing.teacher?.name ?? "-"}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {formatAdminDate(
                      locale,
                      new Date(appointment.scheduledStart),
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {formatBookingMinutes(
                      messages,
                      appointment.durationMinutes,
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={appointmentStatusChipClass(appointment.status)}
                    >
                      {formatAppointmentStatus(messages, appointment.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {formatRequestedBy(messages, appointment.requestedBy)}
                  </td>
                  <td className="max-w-xs px-5 py-4 text-[var(--color-text-secondary)]">
                    {formatAppointmentReason(messages, appointment)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openPairingDetails(pairing.id)}
                      className="btn-secondary px-3 py-2 text-xs font-semibold"
                    >
                      {messages.admin.viewDetails}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {appointmentRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm font-medium text-[var(--color-text-secondary)]">
              {messages.admin.noAppointments}
            </div>
          ) : null}
        </section>
      ) : null}

      {!detailPairingId && activeView === "reviewed" ? (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-fit items-center gap-1 rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] p-1">
              {(
                [
                  ["all", messages.admin.filterAll],
                  ["approved", messages.admin.filterApproved],
                  ["rejected", messages.admin.filterRejected],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReviewedFilter(value)}
                  className={`rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold transition-all ${
                    reviewedFilter === value
                      ? "bg-white text-[var(--color-text-main)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportReviewedCsv}
              disabled={
                reviewedSignupsQuery.isLoading || reviewedSignups.length === 0
              }
              className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {messages.admin.exportCsv}
            </button>
          </div>

          {reviewedSignupsQuery.isLoading ? (
            <div className="dash-card">
              <div className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]">
                {messages.state.loading}
              </div>
            </div>
          ) : (
            <div className="dash-card overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-[var(--color-bg-secondary)]">
                    <th className="px-4 py-3 text-xs font-bold tracking-wider text-[var(--color-text-secondary)] uppercase">
                      {messages.admin.fields.name}
                    </th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wider text-[var(--color-text-secondary)] uppercase">
                      {messages.admin.role}
                    </th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wider text-[var(--color-text-secondary)] uppercase">
                      {messages.admin.status}
                    </th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wider text-[var(--color-text-secondary)] uppercase">
                      {messages.admin.submitted}
                    </th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wider text-[var(--color-text-secondary)] uppercase">
                      {messages.admin.reviewed}
                    </th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wider text-[var(--color-text-secondary)] uppercase">
                      {messages.admin.reason}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-secondary)]">
                  {reviewedSignups.map((signup) => (
                    <tr
                      key={`${signup.role}-${signup.signupId}`}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--color-text-main)]">
                          {signup.name}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-text-light)]">
                          @{signup.username}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="status-chip info">
                          {formatSignupRole(messages, signup.role)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={statusChipClass(signup.status)}>
                          {formatSignupStatus(messages, signup.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs whitespace-nowrap text-[var(--color-text-secondary)]">
                        {formatAdminDate(locale, signup.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-xs whitespace-nowrap text-[var(--color-text-secondary)]">
                        {formatAdminDate(locale, signup.reviewedAt)}
                      </td>
                      <td
                        className="max-w-[200px] truncate px-4 py-4 text-sm text-[var(--color-text-secondary)]"
                        title={signup.rejectReason ?? ""}
                      >
                        {signup.rejectReason ?? (
                          <span className="text-[var(--color-text-light)]">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!reviewedSignups.length ? (
                <div className="px-6 py-12 text-center text-sm font-medium text-[var(--color-text-secondary)]">
                  {messages.admin.noReviewedSignups}
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {signupDetailsTarget ? (
        signupDetailsTarget.role === "student" ? (
          <SignupDetailsModal
            canMatch={
              getMatchAvailability("student", signupDetailsTarget.signup.status)
                .canMatch
            }
            matchDisabledReason={
              getMatchAvailability("student", signupDetailsTarget.signup.status)
                .reason
            }
            signup={signupDetailsTarget.signup}
            role="student"
            onApprove={() =>
              handleApprove({
                role: "student",
                signupId: signupDetailsTarget.signup.signupId,
                status: signupDetailsTarget.signup.status,
              })
            }
            onClose={() => setSignupDetailsTarget(null)}
            onMatch={() => {
              setSignupDetailsTarget(null);
              openPairingModal({
                studentProfileId: signupDetailsTarget.signup.profileId,
              });
            }}
            onReject={() => {
              if (signupDetailsTarget.signup.status !== "pending") {
                return;
              }

              setSignupDetailsTarget(null);
              setRejectTarget({
                name: signupDetailsTarget.signup.childName,
                role: "student",
                signupId: signupDetailsTarget.signup.signupId,
              });
            }}
          />
        ) : (
          <SignupDetailsModal
            canMatch={
              getMatchAvailability("teacher", signupDetailsTarget.signup.status)
                .canMatch
            }
            matchDisabledReason={
              getMatchAvailability("teacher", signupDetailsTarget.signup.status)
                .reason
            }
            signup={signupDetailsTarget.signup}
            role="teacher"
            onApprove={() =>
              handleApprove({
                role: "teacher",
                signupId: signupDetailsTarget.signup.signupId,
                status: signupDetailsTarget.signup.status,
              })
            }
            onClose={() => setSignupDetailsTarget(null)}
            onMatch={() => {
              setSignupDetailsTarget(null);
              openPairingModal({
                teacherProfileId: signupDetailsTarget.signup.profileId,
              });
            }}
            onReject={() => {
              if (signupDetailsTarget.signup.status !== "pending") {
                return;
              }

              setSignupDetailsTarget(null);
              setRejectTarget({
                name: signupDetailsTarget.signup.name,
                role: "teacher",
                signupId: signupDetailsTarget.signup.signupId,
              });
            }}
          />
        )
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
              options={approvedWaitingStudents.map((student) => ({
                label: `${student.childName} · ${student.username}`,
                value: student.profileId,
              }))}
              value={selectedStudentProfileId}
            />
            <SelectField
              label={messages.admin.teacher}
              name="teacherProfileId"
              onChange={setSelectedTeacherProfileId}
              options={approvedWaitingTeachers.map((teacher) => ({
                label: `${teacher.name} · ${teacher.username}`,
                value: teacher.profileId,
              }))}
              value={selectedTeacherProfileId}
            />

            {selectedStudent ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-main)]">
                  {messages.admin.student}:
                </strong>{" "}
                {selectedStudent.childName} · {selectedStudent.phone}
              </div>
            ) : null}
            {selectedTeacher ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-main)]">
                  {messages.admin.teacher}:
                </strong>{" "}
                {selectedTeacher.name} · {selectedTeacher.school}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={createPairing.isPending}
              className="btn-primary mt-1 w-full px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createPairing.isPending
                ? messages.admin.creatingPairing
                : messages.admin.createPairingAction}
            </button>
          </form>
        </Modal>
      ) : null}

      {rejectTarget ? (
        <Modal
          title={`${messages.admin.rejectSignup}: ${rejectTarget.name}`}
          onClose={() => setRejectTarget(null)}
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-bold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
                {messages.admin.rejectReasonLabel}
              </span>
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                aria-label={messages.admin.rejectReasonLabel}
                rows={4}
                className="form-control resize-none"
                placeholder={messages.admin.rejectPlaceholder}
              />
            </label>
            <div className="flex items-center gap-3 border-t border-[var(--color-bg-secondary)] pt-4">
              <button
                type="button"
                disabled={
                  reviewStudentSignup.isPending || reviewTeacherSignup.isPending
                }
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
                className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reviewStudentSignup.isPending || reviewTeacherSignup.isPending
                  ? messages.student.submitting
                  : messages.admin.confirmReject}
              </button>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="btn-secondary px-5 py-2.5 text-sm font-semibold"
              >
                {messages.common.close}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </PortalShell>
  );
}

function WaitingCard(props: {
  children: React.ReactNode;
  count: number;
  emptyState: string;
  title: string;
}) {
  return (
    <div className="dash-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-bg-secondary)] px-5 py-4">
        <h2 className="text-lg font-[var(--font-title)] font-bold text-[var(--color-text-main)]">
          {props.title}
        </h2>
        <span className="status-chip info text-xs tabular-nums">
          {props.count}
        </span>
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
      <span className="text-xs font-bold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
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
          —
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

function SignupDetailsModal(
  props:
    | {
        canMatch: boolean;
        matchDisabledReason: string | null;
        onApprove: () => void;
        onClose: () => void;
        onMatch: () => void;
        onReject: () => void;
        role: "student";
        signup: WaitingStudent;
      }
    | {
        canMatch: boolean;
        matchDisabledReason: string | null;
        onApprove: () => void;
        onClose: () => void;
        onMatch: () => void;
        onReject: () => void;
        role: "teacher";
        signup: WaitingTeacher;
      },
) {
  const { locale, messages } = useI18n();
  const title =
    props.role === "student" ? props.signup.childName : props.signup.name;
  const canReview = props.signup.status === "pending";
  const canMatch = props.signup.status === "approved" && props.canMatch;

  return (
    <Modal title={title} onClose={props.onClose}>
      <div className="grid gap-5">
        {/* Status banner */}
        <div
          className={`flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium ${
            props.signup.status === "approved"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : props.signup.status === "rejected"
                ? "border border-red-200 bg-red-50 text-red-800"
                : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span className={statusChipClass(props.signup.status)}>
            {formatSignupStatus(messages, props.signup.status)}
          </span>
          {!canReview ? (
            <span className="text-xs opacity-75">
              {messages.admin.reviewedStatus}
            </span>
          ) : null}
        </div>

        {/* Identity section */}
        <fieldset className="rounded-[var(--radius-md)] border border-[var(--color-bg-secondary)] p-4">
          <legend className="px-2 text-xs font-bold tracking-widest text-[var(--color-text-secondary)] uppercase">
            {messages.admin.detailsIdentity}
          </legend>
          <div className="grid gap-3 text-sm">
            {props.role === "student" ? (
              <>
                <DetailRow
                  label={messages.admin.fields.name}
                  value={props.signup.childName}
                />
                <DetailRow
                  label={messages.admin.fields.age}
                  value={String(props.signup.age)}
                />
                <DetailRow
                  label={messages.admin.fields.username}
                  value={props.signup.username}
                />
              </>
            ) : (
              <>
                <DetailRow
                  label={messages.admin.fields.name}
                  value={props.signup.name}
                />
                <DetailRow
                  label={messages.admin.fields.gender}
                  value={props.signup.gender}
                />
                <DetailRow
                  label={messages.admin.fields.username}
                  value={props.signup.username}
                />
              </>
            )}
            <DetailRow
              label={messages.admin.submitted}
              value={formatAdminDate(locale, props.signup.createdAt)}
            />
          </div>
        </fieldset>

        {/* Contact / Academic section */}
        <fieldset className="rounded-[var(--radius-md)] border border-[var(--color-bg-secondary)] p-4">
          <legend className="px-2 text-xs font-bold tracking-widest text-[var(--color-text-secondary)] uppercase">
            {props.role === "student"
              ? messages.admin.detailsContact
              : messages.admin.detailsAcademic}
          </legend>
          <div className="grid gap-3 text-sm">
            {props.role === "student" ? (
              <>
                <DetailRow
                  label={messages.admin.fields.phone}
                  value={props.signup.phone}
                />
                <DetailRow
                  label={messages.admin.fields.contact}
                  value={props.signup.contact ?? "—"}
                />
              </>
            ) : (
              <>
                <DetailRow
                  label={messages.admin.fields.school}
                  value={props.signup.school}
                />
                <DetailRow
                  label={messages.admin.fields.grade}
                  value={props.signup.grade}
                />
                <DetailRow
                  label={messages.admin.fields.englishScore}
                  value={props.signup.englishScore}
                />
              </>
            )}
          </div>
        </fieldset>

        {/* Actions - hierarchy based on status */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-bg-secondary)] pt-4">
          {canReview ? (
            <>
              <button
                type="button"
                onClick={props.onApprove}
                className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                {messages.admin.approve}
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={props.onReject}
                className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
              >
                {messages.admin.reject}
              </button>
            </>
          ) : props.signup.status === "approved" ? (
            <div className="grid gap-2">
              <button
                type="button"
                disabled={!canMatch}
                onClick={props.onMatch}
                title={props.matchDisabledReason ?? undefined}
                className="btn-primary px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {messages.admin.matchNow}
              </button>
              {props.matchDisabledReason ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {props.matchDisabledReason}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function DetailRow(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-bold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
        {props.label}
      </span>
      <div className="text-[var(--color-text-main)]">{props.value}</div>
    </div>
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
        {messages.admin.page}{" "}
        <strong className="text-[var(--color-text-main)]">{props.page}</strong>{" "}
        / {props.totalPages}
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

function Modal(props: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  const { messages } = useI18n();

  return (
    <AppDialog
      title={props.title}
      closeLabel={messages.common.close}
      onClose={props.onClose}
    >
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
  if (status === "teacher_leave")
    return messages.teacher.statuses.teacher_leave;
  if (status === "student_leave")
    return messages.teacher.statuses.student_leave;
  if (status === "sick") return messages.teacher.statuses.sick;
  return messages.teacher.statuses.pending;
}

function formatSignupStatus(
  messages: Messages,
  status: "pending" | "approved" | "rejected",
) {
  if (status === "approved") return messages.admin.approved;
  if (status === "rejected") return messages.admin.rejected;
  return messages.admin.pending;
}

function formatSignupRole(messages: Messages, role: "student" | "teacher") {
  return role === "student" ? messages.admin.student : messages.admin.teacher;
}

function formatRecoveryStatus(
  messages: Messages,
  status: "pending" | "approved" | "rejected" | "expired" | "completed",
) {
  if (status === "approved") return messages.admin.approved;
  if (status === "completed") return messages.admin.completed;
  if (status === "rejected") return messages.admin.rejected;
  return messages.admin.pending;
}

function formatRecoveryCandidateDetails(
  messages: Messages,
  candidate: RecoveryCandidate,
) {
  const details = [
    candidate.contact,
    candidate.email,
    candidate.student?.phone,
    candidate.student?.age
      ? `${messages.admin.fields.age}: ${candidate.student.age}`
      : null,
    candidate.teacher?.school,
    candidate.teacher?.grade,
  ].filter(Boolean);

  return details.length > 0 ? details.join(" · ") : messages.teacher.noContact;
}

function statusChipClass(
  status: "pending" | "approved" | "rejected" | "expired" | "completed",
) {
  if (status === "approved") return "status-chip success";
  if (status === "completed") return "status-chip success";
  if (status === "rejected") return "status-chip danger";
  if (status === "expired") return "status-chip danger";
  return "status-chip warning";
}

function appointmentStatusChipClass(status: string) {
  if (status === "confirmed") return "status-chip success";
  if (status === "declined") return "status-chip danger";
  if (status === "cancelled") return "status-chip danger";
  return "status-chip warning";
}

function formatAppointmentStatus(messages: Messages, status: string) {
  if (status === "confirmed") return messages.booking.confirmed;
  if (status === "declined") return messages.booking.declined;
  if (status === "cancelled") return messages.booking.cancelled;
  if (status === "cancellation_pending") return messages.booking.cancelPending;
  return messages.booking.pending;
}

function formatRequestedBy(
  messages: Messages,
  requestedBy: "student" | "teacher",
) {
  return requestedBy === "student"
    ? messages.booking.requestedByStudent
    : messages.booking.requestedByTeacher;
}

function formatAppointmentReason(
  messages: Messages,
  appointment: {
    cancellationReason?: string | null;
    cancellationResponseReason?: string | null;
    responseReason?: string | null;
  },
) {
  const entries = [
    [messages.booking.responseReason, appointment.responseReason],
    [messages.booking.cancellationReason, appointment.cancellationReason],
    [
      messages.booking.cancellationResponseReason,
      appointment.cancellationResponseReason,
    ],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));

  if (entries.length === 0) return "-";

  return entries.map(([label, value]) => `${label}: ${value}`).join(" · ");
}

function formatBookingMinutes(messages: Messages, minutes: number) {
  return messages.booking.minutes.replace("{minutes}", String(minutes));
}

function formatAdminDate(locale: "en" | "zh", value: Date | null) {
  if (!value) {
    return "-";
  }

  return formatAppDateTime(locale, value);
}

function getPreferredDetailWeek(data: PairingDetailsOutput) {
  return (
    data.summary.latestFeedback?.weekNumber ??
    data.summary.latestLessonUpdate?.weekNumber ??
    data.weeks.find((week) => week.lessonStatus !== "pending")?.weekNumber ??
    1
  );
}
