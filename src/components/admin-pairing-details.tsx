"use client";

import { useI18n } from "~/components/locale-provider";
import { formatAppDateTime } from "~/lib/date-format";
import { type Messages } from "~/lib/i18n";
import { type RouterOutputs } from "~/trpc/react";

type PairingDetailsOutput = RouterOutputs["admin"]["pairingDetails"];

export function AdminPairingDetails(props: {
  data: PairingDetailsOutput;
  onSelectWeek: (weekNumber: number) => void;
  selectedWeek: number;
}) {
  const { locale, messages } = useI18n();
  const selectedWeek =
    props.data.weekDetails.find(
      (week) => week.weekNumber === props.selectedWeek,
    ) ?? props.data.weekDetails[0];

  if (!selectedWeek) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="dash-card p-4 sm:p-6 lg:p-8">
          <div className="text-xs font-bold tracking-[0.2em] text-[var(--color-primary)] uppercase">
            {messages.admin.pairingDetails}
          </div>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <ProfileCard
              contact={props.data.pairing.student?.contact ?? null}
              label={messages.admin.student}
              name={props.data.pairing.student?.name ?? "-"}
              username={props.data.pairing.student?.username ?? "-"}
            />
            <ProfileCard
              contact={props.data.pairing.teacher?.contact ?? null}
              label={messages.admin.teacher}
              name={props.data.pairing.teacher?.name ?? "-"}
              username={props.data.pairing.teacher?.username ?? "-"}
            />
          </div>

          <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-5 py-5 text-sm">
            <div className="text-xs font-bold tracking-[0.16em] text-[var(--color-text-secondary)] uppercase">
              {messages.admin.meetingLink}
            </div>
            {props.data.pairing.meetingLink.trim() ? (
              <div className="mt-3 break-words whitespace-pre-wrap text-[var(--color-text-main)]">
                {toOpenableUrl(props.data.pairing.meetingLink) ? (
                  <a
                    href={toOpenableUrl(props.data.pairing.meetingLink) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--color-primary)] underline decoration-[0.08em] underline-offset-3"
                  >
                    {props.data.pairing.meetingLink}
                  </a>
                ) : (
                  props.data.pairing.meetingLink
                )}
              </div>
            ) : (
              <div className="mt-3 text-[var(--color-text-secondary)]">
                {messages.admin.noMeetingLink}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <SummaryCard
              label={messages.admin.summaryProgress}
              value={`${props.data.summary.taughtCount}/${props.data.summary.totalWeeks}`}
              caption={messages.admin.total}
            />
            <SummaryCard
              label={messages.admin.feedbackStatus}
              value={String(props.data.summary.feedbackCount)}
              caption={messages.admin.feedbackCount}
            />
          </div>

          <div className="dash-card p-4 sm:p-6 lg:p-8">
            <div className="text-xs font-bold tracking-[0.2em] text-[var(--color-primary)] uppercase">
              {messages.admin.recentUpdates}
            </div>
            <div className="mt-5 grid gap-4">
              <ActivityRow
                label={messages.admin.latestFeedback}
                value={
                  props.data.summary.latestFeedback
                    ? `${formatWeekLabel(locale, props.data.summary.latestFeedback.weekNumber)} · ${formatAdminDate(locale, props.data.summary.latestFeedback.updatedAt)}`
                    : messages.admin.noFeedback
                }
                meta={
                  props.data.summary.latestFeedback
                    ? formatVisibility(
                        messages,
                        props.data.summary.latestFeedback.visibility,
                      )
                    : null
                }
              />
              <ActivityRow
                label={messages.admin.latestLessonUpdate}
                value={
                  props.data.summary.latestLessonUpdate
                    ? `${formatWeekLabel(locale, props.data.summary.latestLessonUpdate.weekNumber)} · ${formatAdminDate(locale, props.data.summary.latestLessonUpdate.updatedAt)}`
                    : "-"
                }
                meta={
                  props.data.summary.latestLessonUpdate
                    ? formatLessonStatus(
                        messages,
                        props.data.summary.latestLessonUpdate.lessonStatus,
                      )
                    : null
                }
              />
              <ActivityRow
                label={messages.admin.fields.createdAt}
                value={formatAdminDate(locale, props.data.pairing.createdAt)}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="dash-card p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-[var(--color-primary)] uppercase">
              {messages.admin.weekOverview}
            </div>
            <h2 className="mt-2 text-2xl font-[var(--font-title)] text-[var(--color-text-main)]">
              {messages.admin.feedbackStatus}
            </h2>
          </div>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {messages.admin.currentWeek}:{" "}
            <strong className="text-[var(--color-text-main)]">
              {formatWeekLabel(locale, selectedWeek.weekNumber)}
            </strong>
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {props.data.weeks.map((week) => (
            <button
              key={week.weekNumber}
              type="button"
              aria-pressed={week.weekNumber === selectedWeek.weekNumber}
              onClick={() => props.onSelectWeek(week.weekNumber)}
              className={`rounded-[var(--radius-md)] border px-4 py-4 text-left transition-all ${
                week.weekNumber === selectedWeek.weekNumber
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-50)] shadow-sm"
                  : "border-[var(--color-bg-secondary)] bg-white hover:border-[var(--color-primary)]/40 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[var(--color-text-main)]">
                    {formatWeekLabel(locale, week.weekNumber)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {formatLessonStatus(messages, week.lessonStatus)}
                  </div>
                </div>
                <span className={lessonStatusChipClass(week.lessonStatus)}>
                  {statusAbbrev(week.lessonStatus)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <WeekIndicator
                  active={week.hasEvidence}
                  label={messages.admin.lessonImage}
                />
                <WeekIndicator
                  active={week.hasTeacherNote}
                  label={messages.admin.teacherNotes}
                />
                <WeekIndicator
                  active={week.hasFeedback}
                  label={messages.admin.studentFeedback}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="dash-card p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-[var(--color-primary)] uppercase">
              {messages.booking.title}
            </div>
            <h2 className="mt-2 text-2xl font-[var(--font-title)] text-[var(--color-text-main)]">
              {messages.booking.calendarTitle}
            </h2>
          </div>
          <span className="status-chip info">
            {props.data.appointments.length}
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {props.data.appointments.length > 0 ? (
            props.data.appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--color-text-main)]">
                      {formatAdminDate(locale, appointment.scheduledStart)}
                    </div>
                    <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {formatBookingMinutes(
                        messages,
                        appointment.durationMinutes,
                      )}{" "}
                      · {formatRequestedBy(messages, appointment.requestedBy)}
                    </div>
                  </div>
                  <span
                    className={appointmentStatusChipClass(appointment.status)}
                  >
                    {formatAppointmentStatus(messages, appointment.status)}
                  </span>
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {formatAppointmentReason(messages, appointment)}
                </div>
              </div>
            ))
          ) : (
            <EmptyPanel message={messages.admin.noAppointments} />
          )}
        </div>
      </section>

      <section className="dash-card p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-[var(--color-primary)] uppercase">
              {messages.admin.weekDetails}
            </div>
            <h2 className="mt-2 text-3xl font-[var(--font-title)] text-[var(--color-text-main)]">
              {formatWeekLabel(locale, selectedWeek.weekNumber)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={lessonStatusChipClass(selectedWeek.lessonStatus)}>
              {formatLessonStatus(messages, selectedWeek.lessonStatus)}
            </span>
            {selectedWeek.feedbackVisibility ? (
              <span className="status-chip info">
                {formatVisibility(messages, selectedWeek.feedbackVisibility)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div>
              <SectionLabel label={messages.admin.lessonImage} />
              <div className="mt-3 grid h-80 place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-bg-secondary)] bg-[var(--color-bg-secondary)]">
                {selectedWeek.evidenceUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedWeek.evidenceUrl}
                    alt={messages.admin.lessonImage}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <EmptyPanel message={messages.admin.noLessonImage} />
                )}
              </div>
            </div>

            <ReadonlyPanel
              body={
                selectedWeek.teacherNote?.text ? (
                  <div className="space-y-3">
                    <MetaLine
                      label={messages.admin.visibility}
                      value={formatVisibility(
                        messages,
                        selectedWeek.teacherNote.visibility,
                      )}
                    />
                    <MetaLine
                      label={messages.admin.updatedAt}
                      value={formatAdminDate(
                        locale,
                        selectedWeek.teacherNote.updatedAt,
                      )}
                    />
                    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-5 py-4 text-sm leading-7 whitespace-pre-wrap text-[var(--color-text-main)]">
                      {selectedWeek.teacherNote.text}
                    </div>
                  </div>
                ) : (
                  <EmptyPanel message={messages.admin.noTeacherNote} />
                )
              }
              title={messages.admin.teacherNotes}
            />
          </div>

          <ReadonlyPanel
            body={
              selectedWeek.studentFeedback?.text ? (
                <div className="space-y-3">
                  <MetaLine
                    label={messages.admin.visibility}
                    value={formatVisibility(
                      messages,
                      selectedWeek.studentFeedback.visibility,
                    )}
                  />
                  <MetaLine
                    label={messages.admin.updatedAt}
                    value={formatAdminDate(
                      locale,
                      selectedWeek.studentFeedback.updatedAt,
                    )}
                  />
                  <MetaLine
                    label={messages.admin.rating}
                    value={
                      selectedWeek.studentFeedback.rating
                        ? `${selectedWeek.studentFeedback.rating} / 5`
                        : "-"
                    }
                  />
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-5 py-4 text-sm leading-7 whitespace-pre-wrap text-[var(--color-text-main)]">
                    {selectedWeek.studentFeedback.text}
                  </div>
                </div>
              ) : (
                <EmptyPanel message={messages.admin.noFeedback} />
              )
            }
            title={messages.admin.studentFeedback}
          />
        </div>
      </section>
    </div>
  );
}

function ProfileCard(props: {
  contact: string | null;
  label: string;
  name: string;
  username: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-bg-secondary)] px-5 py-5">
      <div className="text-xs font-bold tracking-[0.16em] text-[var(--color-primary)] uppercase">
        {props.label}
      </div>
      <div className="mt-3 text-2xl font-[var(--font-title)] text-[var(--color-text-main)]">
        {props.name}
      </div>
      <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
        @{props.username}
      </div>
      <div className="mt-4 text-sm break-words text-[var(--color-text-secondary)]">
        {props.contact ?? "-"}
      </div>
    </div>
  );
}

function SummaryCard(props: { caption: string; label: string; value: string }) {
  return (
    <div className="dash-card p-6">
      <div className="text-xs font-bold tracking-[0.16em] text-[var(--color-primary)] uppercase">
        {props.label}
      </div>
      <div className="mt-3 text-4xl font-[var(--font-title)] text-[var(--color-text-main)]">
        {props.value}
      </div>
      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {props.caption}
      </div>
    </div>
  );
}

function ActivityRow(props: {
  label: string;
  meta?: string | null;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-bg-secondary)] px-4 py-4">
      <div className="text-xs font-bold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
        {props.label}
      </div>
      <div className="mt-2 text-sm font-medium text-[var(--color-text-main)]">
        {props.value}
      </div>
      {props.meta ? (
        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {props.meta}
        </div>
      ) : null}
    </div>
  );
}

function ReadonlyPanel(props: { body: React.ReactNode; title: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-bg-secondary)] p-5">
      <SectionLabel label={props.title} />
      <div className="mt-3">{props.body}</div>
    </div>
  );
}

function SectionLabel(props: { label: string }) {
  return (
    <div className="text-xs font-bold tracking-[0.16em] text-[var(--color-primary)] uppercase">
      {props.label}
    </div>
  );
}

function EmptyPanel(props: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-bg-secondary)] px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
      {props.message}
    </div>
  );
}

function MetaLine(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm">
      <span className="font-medium text-[var(--color-text-secondary)]">
        {props.label}
      </span>
      <span className="text-right text-[var(--color-text-main)]">
        {props.value}
      </span>
    </div>
  );
}

function WeekIndicator(props: { active: boolean; label: string }) {
  return (
    <span
      title={props.label}
      className={`inline-flex h-2.5 w-2.5 rounded-full ${
        props.active ? "bg-[var(--color-primary)]" : "bg-gray-200"
      }`}
    >
      <span className="sr-only">{props.label}</span>
    </span>
  );
}

function formatVisibility(
  messages: Messages,
  visibility: "private" | "shared",
) {
  return visibility === "private"
    ? messages.admin.privateFeedback
    : messages.admin.sharedFeedback;
}

function statusAbbrev(status: string) {
  if (status === "taught") return "T";
  if (status === "teacher_leave") return "TL";
  if (status === "student_leave") return "SL";
  if (status === "sick") return "S";
  return "P";
}

function lessonStatusChipClass(status: string) {
  if (status === "taught") return "status-chip success";
  if (status === "pending") return "status-chip info";
  return "status-chip warning";
}

function appointmentStatusChipClass(status: string) {
  if (status === "confirmed") return "status-chip success";
  if (status === "declined") return "status-chip danger";
  if (status === "cancelled") return "status-chip danger";
  return "status-chip warning";
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

function formatAppointmentStatus(messages: Messages, status: string) {
  if (status === "confirmed") return messages.booking.confirmed;
  if (status === "declined") return messages.booking.declined;
  if (status === "cancelled") return messages.booking.cancelled;
  if (status === "cancellation_pending") return messages.booking.cancelPending;
  return messages.booking.pending;
}

function formatBookingMinutes(messages: Messages, minutes: number) {
  return messages.booking.minutes.replace("{minutes}", String(minutes));
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

function formatAdminDate(locale: "en" | "zh", value: Date | null) {
  if (!value) {
    return "-";
  }

  return formatAppDateTime(locale, value);
}

function toOpenableUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}
