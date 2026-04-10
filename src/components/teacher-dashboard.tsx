"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { AppDialog } from "~/components/app-dialog";
import { useI18n } from "~/components/locale-provider";
import { getDisplayErrorMessage } from "~/lib/client-errors";
import { type Messages } from "~/lib/i18n";
import { PortalShell } from "~/components/portal-shell";
import { type LessonStatus, type Visibility } from "~/lib/domain";
import { api } from "~/trpc/react";

const WEEK_NUMBERS = Array.from({ length: 20 }, (_, index) => index + 1);
const LESSON_STATUS_VALUES: LessonStatus[] = [
  "pending",
  "taught",
  "teacher_leave",
  "student_leave",
  "sick",
];

export function TeacherDashboard() {
  const { locale, messages } = useI18n();
  const utils = api.useUtils();
  const dashboardQuery = api.teacher.dashboard.useQuery();
  const updateMeetingLink = api.teacher.updateMeetingLink.useMutation({
    onSuccess: async () => {
      await utils.teacher.dashboard.invalidate();
    },
  });

  const [currentWeek, setCurrentWeek] = useState(1);
  const [status, setStatus] = useState<LessonStatus>("pending");
  const [notesText, setNotesText] = useState("");
  const [notesVisibility, setNotesVisibility] = useState<Visibility>("shared");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState("");
  const [message, setMessage] = useState("");
  const [isGuidelinesOpen, setGuidelinesOpen] = useState(false);
  const [isMeetingOpen, setMeetingOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const uploadHelpId = useId();

  const matchedDashboard = dashboardQuery.data?.matchingStatus === "matched" ? dashboardQuery.data : null;
  const isMatched = Boolean(matchedDashboard);
  const lessons = matchedDashboard?.progress.lessons ?? [];
  const currentLesson = lessons.find((lesson) => lesson.week_number === currentWeek) ?? null;
  const isLoading = dashboardQuery.isLoading;
  const loadError = dashboardQuery.error;

  useEffect(() => {
    setStatus(currentLesson?.status ?? "pending");
    setNotesText(currentLesson?.notes?.text ?? "");
    setNotesVisibility(currentLesson?.notes?.visibility ?? "shared");
    setSelectedFile(null);
    setSelectedFileUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }, [
    currentLesson?.id,
    currentLesson?.notes?.text,
    currentLesson?.notes?.visibility,
    currentLesson?.status,
    currentWeek,
  ]);

  useEffect(() => {
    return () => {
      if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    };
  }, [selectedFileUrl]);

  async function saveCurrentWeek() {
    startTransition(async () => {
      setMessage("");

      try {
        const form = new FormData();
        form.set("week", String(currentWeek));
        form.set("status", status);
        form.set("notesText", notesText);
        form.set("notesVisibility", notesVisibility);

        if (selectedFile) {
          form.set("file", selectedFile);
        }

        const response = await fetch("/api/uploads/lesson-evidence", {
          method: "POST",
          body: form,
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: { message?: string } };
          throw new Error(payload.error?.message ?? messages.teacher.lessonSaveError);
        }

        await utils.teacher.dashboard.invalidate();
        setMessage(messages.teacher.lessonSaved);
      } catch (error) {
        setMessage(getDisplayErrorMessage(error, messages.teacher.lessonSaveError));
      }
    });
  }

  function persistMeetingLink() {
    startTransition(async () => {
      setMessage("");

      try {
        await updateMeetingLink.mutateAsync({
          meetingLink,
        });
        setMeetingOpen(false);
      } catch (error) {
        setMessage(getDisplayErrorMessage(error, messages.teacher.meetingLinkSaveError));
      }
    });
  }

  const taughtCount = lessons.filter((lesson) => lesson.status === "taught").length;

  return (
    <PortalShell
      title={
        dashboardQuery.data?.matchingStatus === "matched"
          ? formatWeekLabel(locale, currentWeek, true)
          : messages.teacher.pendingMatchTitle
      }
      subtitle={messages.teacher.subtitle}
      badge={
        dashboardQuery.data?.matchingStatus === "pending"
          ? messages.teacher.statuses.pending
          : dashboardQuery.data?.matchingStatus === "rejected"
            ? messages.admin.rejected
            : messages.teacher.statuses[status] ?? status.replaceAll("_", " ")
      }
      navItems={[
        { label: messages.teacher.weeklyLessons, active: true },
        ...(isMatched
          ? [
              { label: messages.teacher.badgeGuidelines, onClick: () => setGuidelinesOpen(true) },
              {
                label: messages.teacher.badgeMeetingLink,
                onClick: () => {
                  setMeetingLink(dashboardQuery.data?.meetingLink ?? "");
                  setMeetingOpen(true);
                },
              },
            ]
          : []),
      ]}
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
      {message ? (
        <div role="status" aria-live="polite" className="mb-5 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[var(--color-primary)]">
          {message}
        </div>
      ) : null}

      {!isLoading && dashboardQuery.data?.matchingStatus !== "matched" ? (
        <section className="dash-card p-6 lg:p-8">
          <h2 className="font-[var(--font-title)] text-2xl text-[var(--color-text-main)]">
            {dashboardQuery.data?.matchingStatus === "rejected"
              ? messages.teacher.rejectedMatchTitle
              : messages.teacher.pendingMatchTitle}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">
            {dashboardQuery.data?.matchingStatus === "rejected"
              ? messages.teacher.rejectedMatchBody
              : messages.teacher.pendingMatchBody}
          </p>
          {dashboardQuery.data?.matchingStatus === "rejected" && dashboardQuery.data.rejectReason ? (
            <div className="mt-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {dashboardQuery.data.rejectReason}
            </div>
          ) : null}
        </section>
      ) : null}

      {dashboardQuery.data?.matchingStatus !== "matched" ? null : (
        <>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="dash-card p-6 lg:p-8">
          <h2 className="border-l-3 border-[var(--color-primary)] pl-4 font-[var(--font-title)] text-3xl text-[var(--color-text-main)]">{messages.teacher.lessonEvidence}</h2>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {LESSON_STATUS_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                  status === value
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-gray-200"
                }`}
              >
                {messages.teacher.statuses[value]}
              </button>
            ))}
          </div>

          <label
            htmlFor="teacher-file-input"
            className="mt-6 grid h-72 w-full cursor-pointer place-items-center overflow-hidden rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-50)]/50 hover:bg-[var(--color-primary-50)] transition-colors group"
          >
            {selectedFileUrl || currentLesson?.evidenceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedFileUrl ?? currentLesson?.evidenceUrl ?? ""}
                alt={messages.teacher.lessonEvidence}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="text-center text-sm text-[var(--color-primary-dark)]">
                <div className="mx-auto mb-2 text-3xl text-[var(--color-primary)]">+</div>
                {messages.teacher.clickUpload}
              </div>
            )}
          </label>
          <input
            id="teacher-file-input"
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby={uploadHelpId}
            aria-label={messages.teacher.clickUpload}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setSelectedFile(file);
              setSelectedFileUrl((previous) => {
                if (previous) URL.revokeObjectURL(previous);
                return URL.createObjectURL(file);
              });
            }}
          />
          <p id={uploadHelpId} className="mt-3 text-xs text-[var(--color-text-secondary)]">
            {messages.teacher.uploadFormatsHelp}
          </p>

          <textarea
            value={notesText}
            onChange={(event) => setNotesText(event.target.value)}
            aria-label={messages.teacher.notesLabel}
            placeholder={messages.teacher.notesPlaceholder}
            className="form-control mt-6 min-h-32 resize-none"
          />
          <select
            value={notesVisibility}
            onChange={(event) => setNotesVisibility(toVisibility(event.target.value))}
            aria-label={messages.teacher.notesVisibilityLabel}
            className="form-control mt-4 w-auto rounded-full px-4 py-2.5 text-sm font-semibold"
          >
            <option value="shared">{messages.teacher.shareWithStudent}</option>
            <option value="private">{messages.teacher.private}</option>
          </select>

          <div className="mt-6">
            <button
              type="button"
              disabled={isPending}
              onClick={() => void saveCurrentWeek()}
              className="btn-primary px-6 py-3 text-sm font-semibold w-auto"
            >
              {isPending ? messages.teacher.saving : messages.teacher.saveLesson}
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="dash-card p-6 lg:p-8">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">
              {messages.teacher.myStudent}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-lg font-bold text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20">
                {(dashboardQuery.data?.student?.name ?? "?").charAt(0)}
              </div>
              <span className="font-[var(--font-title)] text-3xl text-[var(--color-text-main)]">
                {dashboardQuery.data?.student?.name ?? messages.teacher.noStudent}
              </span>
            </div>
            <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {dashboardQuery.data?.student?.contact ?? messages.teacher.noContact}
            </div>
            <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-5 py-5 text-sm text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-main)]">{messages.teacher.latestFeedback}</strong> <br className="mb-2" />
              {dashboardQuery.data?.latestSharedFeedback?.text ?? messages.teacher.feedbackEmpty}
            </div>
          </div>

          <div className="dash-card p-6 lg:p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-title)] text-2xl text-[var(--color-text-main)]">{messages.teacher.certificate}</h2>
              <span className="text-sm font-bold text-[var(--color-text-main)]">
                {formatLessonCount(locale, taughtCount, 20)}
              </span>
            </div>
            <div className="mt-5 relative h-5 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary),#059669)] transition-all duration-1000"
                style={{ width: `${Math.round((taughtCount / 20) * 100)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--color-text-main)]">
                {Math.round((taughtCount / 20) * 100)}%
              </span>
            </div>
          </div>

          <div className="dash-card p-6 lg:p-8">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">
              {messages.teacher.weekSelector}
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {WEEK_NUMBERS.map((weekNumber) => {
                const lesson = lessons.find((item) => item.week_number === weekNumber);
                const status = lesson?.status ?? "pending";
                const statusLabel = formatStatusLabel(messages, status);
                return (
                  <button
                    key={weekNumber}
                    type="button"
                    aria-pressed={currentWeek === weekNumber}
                    onClick={() => setCurrentWeek(weekNumber)}
                    className={`rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold transition-all ${
                      currentWeek === weekNumber
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-gray-200"
                    }`}
                  >
                    {formatWeekLabel(locale, weekNumber)} ·{" "}
                    <span aria-hidden="true">{statusBadge(status)}</span>
                    <span className="sr-only"> {statusLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {isGuidelinesOpen ? (
        <DashboardDialog title={messages.teacher.guidelinesTitle} onClose={() => setGuidelinesOpen(false)}>
          <ul className="space-y-3 text-sm leading-7 text-[var(--color-text-secondary)]">
            {messages.teacher.guidelines.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DashboardDialog>
      ) : null}

      {isMeetingOpen ? (
        <DashboardDialog title={messages.teacher.meetingLink} onClose={() => setMeetingOpen(false)}>
          <div className="grid gap-4">
            <input
              value={meetingLink}
              onChange={(event) => setMeetingLink(event.target.value)}
              aria-label={messages.teacher.meetingLinkInputLabel}
              placeholder="https://meeting.tencent.com/..."
              className="form-control"
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isPending || updateMeetingLink.isPending}
                onClick={persistMeetingLink}
                className="btn-primary rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold"
              >
                {messages.common.save}
              </button>
              <button
                type="button"
                disabled={!meetingLink.trim()}
                onClick={() => navigator.clipboard.writeText(meetingLink.trim())}
                className="btn-secondary rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                {messages.common.copyLink}
              </button>
            </div>
          </div>
        </DashboardDialog>
      ) : null}
        </>
      )}
    </PortalShell>
  );
}

function toVisibility(value: string): Visibility {
  return value === "private" ? "private" : "shared";
}

function DashboardDialog(props: { children: React.ReactNode; onClose: () => void; title: string }) {
  const { messages } = useI18n();

  return (
    <AppDialog title={props.title} closeLabel={messages.common.close} onClose={props.onClose}>
      {props.children}
    </AppDialog>
  );
}

function statusBadge(status: string) {
  if (status === "taught") return "T";
  if (status === "teacher_leave") return "TL";
  if (status === "student_leave") return "SL";
  if (status === "sick") return "S";
  return "P";
}

function formatLessonCount(locale: "en" | "zh", taughtCount: number, totalWeeks: number) {
  return locale === "zh"
    ? `${taughtCount}/${totalWeeks} 节课`
    : `${taughtCount}/${totalWeeks} lessons`;
}

function formatWeekLabel(locale: "en" | "zh", weekNumber: number, padded = false) {
  if (locale === "zh") {
    return `第${weekNumber}周`;
  }

  return `Week ${padded ? String(weekNumber).padStart(2, "0") : weekNumber}`;
}

function formatStatusLabel(messages: Messages, status: string) {
  if (status === "taught") return messages.teacher.statuses.taught;
  if (status === "teacher_leave") return messages.teacher.statuses.teacher_leave;
  if (status === "student_leave") return messages.teacher.statuses.student_leave;
  if (status === "sick") return messages.teacher.statuses.sick;
  return messages.teacher.statuses.pending;
}
