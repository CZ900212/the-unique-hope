"use client";

import { useEffect, useState, useTransition } from "react";

import { AppDialog } from "~/components/app-dialog";
import { useI18n } from "~/components/locale-provider";
import { getDisplayErrorMessage } from "~/lib/client-errors";
import { type Messages } from "~/lib/i18n";
import { api } from "~/trpc/react";
import { PortalShell } from "~/components/portal-shell";
import { type Visibility } from "~/lib/domain";

const WEEK_NUMBERS = Array.from({ length: 20 }, (_, index) => index + 1);

export function StudentDashboard() {
  const { locale, messages } = useI18n();
  const utils = api.useUtils();
  const dashboardQuery = api.student.dashboard.useQuery();
  const [currentWeek, setCurrentWeek] = useState(1);
  const matchedDashboard = dashboardQuery.data?.matchingStatus === "matched" ? dashboardQuery.data : null;
  const isMatched = Boolean(matchedDashboard);
  const lessonQuery = api.student.lesson.useQuery(currentWeek, {
    enabled: isMatched,
  });
  const saveFeedback = api.student.saveFeedback.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.student.lesson.invalidate(), utils.student.dashboard.invalidate()]);
    },
  });
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackVisibility, setFeedbackVisibility] = useState<Visibility>("private");
  const [message, setMessage] = useState("");
  const [isMeetingOpen, setMeetingOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentFeedback = lessonQuery.data?.feedback;
  const feedbackAllowed = isMatched && (lessonQuery.data?.lesson.feedbackAllowed ?? false);

  useEffect(() => {
    setFeedbackText(currentFeedback?.text ?? "");
    setFeedbackRating(String(currentFeedback?.rating ?? 5));
    setFeedbackVisibility(currentFeedback?.visibility ?? "private");
  }, [currentFeedback?.rating, currentFeedback?.text, currentFeedback?.visibility]);

  function saveCurrentFeedback() {
    startTransition(async () => {
      setMessage("");
      if (!feedbackAllowed) {
        setMessage(messages.student.feedbackLocked);
        return;
      }

      if (!feedbackText.trim()) {
        setMessage(messages.student.feedbackRequired);
        return;
      }

      try {
        await saveFeedback.mutateAsync({
          week: currentWeek,
          text: feedbackText.trim(),
          rating: Number(feedbackRating),
          visibility: feedbackVisibility,
        });
        setMessage(messages.student.feedbackSubmitted);
      } catch (error) {
        setMessage(getDisplayErrorMessage(error, messages.student.feedbackError));
      }
    });
  }

  const weeks = matchedDashboard?.progress.weeks ?? [];
  const taughtCount = weeks.filter((week) => week.status === "taught").length;
  const isLoading = dashboardQuery.isLoading || (isMatched && lessonQuery.isLoading);
  const loadError = dashboardQuery.error ?? (isMatched ? lessonQuery.error : null);

  return (
    <PortalShell
      title={
        dashboardQuery.data?.matchingStatus === "matched"
          ? messages.student.title
          : messages.student.pendingMatchTitle
      }
      subtitle={messages.student.subtitle}
      badge={
        dashboardQuery.data?.matchingStatus === "pending"
          ? messages.teacher.statuses.pending
          : dashboardQuery.data?.matchingStatus === "rejected"
            ? messages.admin.rejected
            : taughtCount >= currentWeek - 1
              ? messages.student.badgeOnTrack
              : messages.student.badgeInProgress
      }
      navItems={[
        { label: messages.student.myJourney, active: true },
        ...(isMatched ? [{ label: messages.student.meetingLink, onClick: () => setMeetingOpen(true) }] : []),
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
              ? messages.student.rejectedMatchTitle
              : messages.student.pendingMatchTitle}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">
            {dashboardQuery.data?.matchingStatus === "rejected"
              ? messages.student.rejectedMatchBody
              : messages.student.pendingMatchBody}
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
          <h2 className="border-l-3 border-[var(--color-primary)] pl-4 font-[var(--font-title)] text-3xl text-[var(--color-text-main)]">{messages.student.lesson}</h2>
          <div className="mt-6 grid h-72 place-items-center overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] border border-[var(--color-bg-secondary)]">
            {lessonQuery.data?.lesson.evidenceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lessonQuery.data.lesson.evidenceUrl}
                alt={messages.student.lesson}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-center text-sm text-[var(--color-text-secondary)]">
                {messages.student.pendingEvidence}
              </div>
            )}
          </div>

          {lessonQuery.data?.lesson.notes?.text ? (
            <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-5 py-5 text-sm leading-7 text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-main)]">{messages.student.notes}</strong>{" "}
              {lessonQuery.data.lesson.notes.text}
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="dash-card p-6 lg:p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-title)] text-2xl text-[var(--color-text-main)]">{messages.student.termProgress}</h2>
              <span className="text-sm font-bold text-[var(--color-text-main)]">{Math.round((taughtCount / 20) * 100)}%</span>
            </div>
            <div className="mt-6 grid grid-cols-5 gap-2.5">
              {weeks.map((week) => (
                <div
                  key={week.weekNumber}
                  className="h-4 rounded-full transition-all"
                  style={{
                    background:
                      week.status === "taught"
                        ? "var(--color-primary)"
                        : week.status === "pending"
                          ? "var(--color-bg-secondary)"
                          : "var(--status-warning)",
                    opacity: week.status === "taught" ? 1 : 0.6
                  }}
                />
              ))}
            </div>
          </div>

          <div className="dash-card p-6 lg:p-8">
            <h2 className="font-[var(--font-title)] text-2xl text-[var(--color-text-main)]">{messages.student.feedback}</h2>
            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              aria-label={messages.student.feedback}
              placeholder={messages.student.feedbackPlaceholder}
              disabled={!feedbackAllowed || isPending}
              className="form-control mt-5 min-h-32 resize-none"
            />
            {!feedbackAllowed ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                {messages.student.feedbackLocked}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <select
                value={feedbackRating}
                onChange={(event) => setFeedbackRating(event.target.value)}
                aria-label={messages.student.feedbackRatingLabel}
                disabled={!feedbackAllowed || isPending}
                className="form-control w-auto rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} ★
                  </option>
                ))}
              </select>
              <select
                value={feedbackVisibility}
                onChange={(event) => setFeedbackVisibility(toVisibility(event.target.value))}
                aria-label={messages.student.feedbackVisibilityLabel}
                disabled={!feedbackAllowed || isPending}
                className="form-control w-auto rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                <option value="shared">{messages.student.shared}</option>
                <option value="private">{messages.student.private}</option>
              </select>
              <button
                type="button"
                disabled={!feedbackAllowed || isPending}
                onClick={saveCurrentFeedback}
                className="btn-primary px-6 py-2.5 text-sm font-semibold"
              >
                {isPending ? messages.student.submitting : messages.student.submit}
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 dash-card p-6 lg:p-8">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">
          {messages.student.history}
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {WEEK_NUMBERS.map((weekNumber) => {
            const weekInfo = weeks.find((item) => item.weekNumber === weekNumber);
            const status = weekInfo?.status ?? "pending";
            const statusLabel = formatStatusLabel(messages, status);
            return (
              <button
                key={weekNumber}
                type="button"
                aria-pressed={currentWeek === weekNumber}
                onClick={() => setCurrentWeek(weekNumber)}
                className={`relative rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold transition-all ${
                  currentWeek === weekNumber
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-gray-200"
                }`}
              >
                {status === "taught" && currentWeek !== weekNumber ? (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)] ring-2 ring-white" />
                ) : null}
                {formatWeekLabel(locale, weekNumber)} ·{" "}
                <span aria-hidden="true">{statusBadge(status)}</span>
                <span className="sr-only"> {statusLabel}</span>
              </button>
            );
          })}
        </div>
      </section>

      {isMeetingOpen ? (
        <MeetingDialog
          meetingLink={dashboardQuery.data?.meetingLink ?? ""}
          onClose={() => setMeetingOpen(false)}
        />
      ) : null}
        </>
      )}
    </PortalShell>
  );
}

function toVisibility(value: string): Visibility {
  return value === "private" ? "private" : "shared";
}

function MeetingDialog(props: {
  meetingLink: string;
  onClose: () => void;
}) {
  const { messages } = useI18n();
  const hasMeetingLink = props.meetingLink.trim().length > 0;

  return (
    <AppDialog title={messages.student.meetingLink} closeLabel={messages.common.close} onClose={props.onClose}>
      {hasMeetingLink ? (
        <input
          readOnly
          value={props.meetingLink}
          aria-label={messages.student.meetingLink}
          className="form-control"
        />
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">{messages.student.meetingLinkEmpty}</p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={!hasMeetingLink}
          onClick={() => navigator.clipboard.writeText(props.meetingLink)}
          className="btn-secondary rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {messages.common.copyLink}
        </button>
      </div>
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

function formatWeekLabel(locale: "en" | "zh", weekNumber: number) {
  return locale === "zh" ? `第${weekNumber}周` : `Week ${weekNumber}`;
}

function formatStatusLabel(messages: Messages, status: string) {
  if (status === "taught") return messages.teacher.statuses.taught;
  if (status === "teacher_leave") return messages.teacher.statuses.teacher_leave;
  if (status === "student_leave") return messages.teacher.statuses.student_leave;
  if (status === "sick") return messages.teacher.statuses.sick;
  return messages.teacher.statuses.pending;
}
