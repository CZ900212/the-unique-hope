"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useI18n } from "~/components/locale-provider";
import {
  type AppointmentRequestedBy,
  type AppointmentStatus,
} from "~/lib/domain";
import {
  formatAppDate,
  formatAppDateTime,
  formatAppTime,
} from "~/lib/date-format";
import { type Messages } from "~/lib/i18n";

type BookingAppointment = {
  id: string;
  weekNumber: number | null;
  scheduledStart: Date | string;
  durationMinutes: number;
  status: AppointmentStatus;
  requestedBy: AppointmentRequestedBy;
  cancellationRequestedBy?: AppointmentRequestedBy | null;
  responseReason?: string | null;
  cancellationReason?: string | null;
  cancellationResponseReason?: string | null;
};

const DURATION_OPTIONS = [30, 45, 60, 90];

export function BookingPanel(props: {
  actorRole: AppointmentRequestedBy | "admin";
  appointments: BookingAppointment[];
  isPending?: boolean;
  onRequest?: (input: {
    id?: string;
    durationMinutes: number;
    scheduledStart: Date;
  }) => void;
  onRespond?: (input: {
    action: "confirm" | "decline" | "request_cancel";
    id: string;
    reason?: string;
  }) => void;
  readOnly?: boolean;
}) {
  const { locale, messages } = useI18n();
  const defaultDate = defaultBookingDate();
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(defaultDate),
  );
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(defaultDate),
  );
  const [timeValue, setTimeValue] = useState(() => toTimeValue(defaultDate));
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [now, setNow] = useState(() => new Date());

  const parsedAppointments = useMemo(
    () =>
      props.appointments
        .map((appointment) => ({
          ...appointment,
          scheduledDate: parseDateValue(appointment.scheduledStart),
        }))
        .filter((appointment) => appointment.scheduledDate !== null)
        .sort(
          (left, right) =>
            left.scheduledDate!.getTime() - right.scheduledDate!.getTime(),
        ),
    [props.appointments],
  );
  const appointmentsByDay = useMemo(() => {
    const byDay = new Map<string, typeof parsedAppointments>();

    for (const appointment of parsedAppointments) {
      const key = toDateKey(appointment.scheduledDate!);
      byDay.set(key, [...(byDay.get(key) ?? []), appointment]);
    }

    return byDay;
  }, [parsedAppointments]);
  const selectedAppointments = appointmentsByDay.get(selectedDateKey) ?? [];
  const selectedAppointment =
    selectedAppointments.find(
      (appointment) => appointment.id === selectedAppointmentId,
    ) ??
    selectedAppointments[0] ??
    null;
  const readOnly = props.actorRole === "admin" ? true : props.readOnly === true;
  const monthDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth],
  );
  const selectedDate = fromDateKey(selectedDateKey);
  const selectedDateTime = buildSelectedDateTime(selectedDateKey, timeValue);
  const isSelectedTimeElapsed =
    selectedDateTime !== null && selectedDateTime.getTime() <= now.getTime();
  const canRequestBase =
    !readOnly &&
    (!selectedAppointment ||
      selectedAppointment.status === "pending" ||
      selectedAppointment.status === "declined" ||
      selectedAppointment.status === "cancelled");
  const showRequestControls = canRequestBase;
  const canSubmitRequest = canRequestBase && !isSelectedTimeElapsed;
  const canRespond =
    selectedAppointment?.status === "pending" &&
    props.actorRole !== "admin" &&
    selectedAppointment.requestedBy !== props.actorRole;
  const canRequestCancellation =
    selectedAppointment?.status === "confirmed" &&
    props.actorRole !== "admin" &&
    !readOnly;
  const canRespondToCancellation =
    selectedAppointment?.status === "cancellation_pending" &&
    props.actorRole !== "admin" &&
    Boolean(selectedAppointment.cancellationRequestedBy) &&
    selectedAppointment.cancellationRequestedBy !== props.actorRole;
  const showReasonInput =
    canRespond || canRequestCancellation || canRespondToCancellation;

  useEffect(() => {
    if (!selectedAppointment) return;
    const appointmentDate = parseDateValue(selectedAppointment.scheduledStart);
    if (!appointmentDate) return;

    setTimeValue(toTimeValue(appointmentDate));
    setDurationMinutes(selectedAppointment.durationMinutes);
  }, [selectedAppointment]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  function selectDay(day: Date) {
    const nextKey = toDateKey(day);
    setSelectedDateKey(nextKey);
    setVisibleMonth(startOfMonth(day));
    const firstAppointment = appointmentsByDay.get(nextKey)?.[0] ?? null;
    selectAppointment(firstAppointment);
  }

  function selectAppointment(appointment: BookingAppointment | null) {
    setSelectedAppointmentId(appointment?.id ?? null);
    setReason("");
    setReasonError("");

    const appointmentDate = appointment
      ? parseDateValue(appointment.scheduledStart)
      : null;
    if (appointment && appointmentDate) {
      setSelectedDateKey(toDateKey(appointmentDate));
      setTimeValue(toTimeValue(appointmentDate));
      setDurationMinutes(appointment.durationMinutes);
    }
  }

  function submitRequest() {
    const scheduledStart = buildSelectedDateTime(selectedDateKey, timeValue);

    if (!scheduledStart) return;
    if (scheduledStart.getTime() <= Date.now()) return;

    props.onRequest?.({
      id: selectedAppointment ? selectedAppointment.id : undefined,
      durationMinutes,
      scheduledStart,
    });
  }

  function respond(
    action: "confirm" | "decline" | "request_cancel",
    appointment: BookingAppointment,
  ) {
    const reasonRequired = action === "decline" || action === "request_cancel";
    const cleanReason = reason.trim();

    if (reasonRequired && !cleanReason) {
      setReasonError(messages.booking.reasonRequired);
      return;
    }

    setReasonError("");
    props.onRespond?.({
      action,
      id: appointment.id,
      reason: cleanReason || undefined,
    });
  }

  return (
    <div className="dash-card p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.2em] text-[var(--color-primary)] uppercase">
            {messages.booking.title}
          </div>
          <h2 className="mt-2 text-2xl font-[var(--font-title)] text-[var(--color-text-main)]">
            {formatMonthTitle(locale, visibleMonth)}
          </h2>
        </div>
        <span className={bookingStatusClass(selectedAppointment?.status)}>
          {formatBookingStatus(messages, selectedAppointment, props.actorRole)}
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.9fr)]">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--color-text-main)]">
              {messages.booking.calendarTitle}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={messages.booking.previousMonth}
                onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white text-[var(--color-text-main)] transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setVisibleMonth(startOfMonth(today));
                  setSelectedDateKey(toDateKey(today));
                  selectAppointment(
                    appointmentsByDay.get(toDateKey(today))?.[0] ?? null,
                  );
                }}
                className="btn-secondary px-3 py-2 text-xs"
              >
                {messages.booking.today}
              </button>
              <button
                type="button"
                aria-label={messages.booking.nextMonth}
                onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white text-[var(--color-text-main)] transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] p-2.5 sm:p-3">
            <div className="grid grid-cols-7 gap-1.5 px-1 pb-2 text-center text-[0.68rem] font-bold tracking-wide text-[var(--color-text-secondary)] uppercase">
              {messages.booking.weekdays.map((weekday) => (
                <div key={weekday}>{weekday}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {monthDays.map((day) => {
                const key = toDateKey(day.date);
                const dayAppointments = appointmentsByDay.get(key) ?? [];
                const status = getDayStatus(dayAppointments);
                const isSelected = key === selectedDateKey;
                const isToday = key === toDateKey(now);
                const isPastEmptyDay =
                  isDateBeforeToday(day.date, now) &&
                  dayAppointments.length === 0;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isPastEmptyDay}
                    aria-disabled={isPastEmptyDay}
                    onClick={() => selectDay(day.date)}
                    className={`relative flex aspect-square min-h-12 flex-col items-center justify-center rounded-[var(--radius-md)] text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-16 ${
                      day.isCurrentMonth
                        ? "text-[var(--color-text-main)]"
                        : "text-[var(--color-text-light)]"
                    } ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "bg-white hover:bg-[var(--color-primary-50)] disabled:hover:bg-white"
                    }`}
                  >
                    <span>{day.date.getDate()}</span>
                    {isToday ? (
                      <span
                        className={`mt-1 h-1 w-4 rounded-full ${
                          isSelected ? "bg-white" : "bg-[var(--color-primary)]"
                        }`}
                      />
                    ) : null}
                    {status ? (
                      <span
                        className={`absolute right-1.5 bottom-1.5 h-2 w-2 rounded-full ${dayStatusClass(
                          status,
                          isSelected,
                        )}`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white px-5 py-4">
            <div className="text-xs font-bold tracking-[0.18em] text-[var(--color-primary)] uppercase">
              {messages.booking.selectedDate}
            </div>
            <div className="mt-2 text-lg font-bold text-[var(--color-text-main)]">
              {formatDate(locale, selectedDate)}
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-5 py-4">
            <div className="text-sm font-bold text-[var(--color-text-main)]">
              {messages.booking.appointmentsForDay}
            </div>
            <div className="mt-3 space-y-2">
              {selectedAppointments.length > 0 ? (
                selectedAppointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => selectAppointment(appointment)}
                    className={`w-full rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors ${
                      selectedAppointment?.id === appointment.id
                        ? "border-[var(--color-primary)] bg-white"
                        : "border-transparent bg-white/70 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-[var(--color-text-main)]">
                          {formatTime(locale, appointment.scheduledDate!)}
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {formatMinutes(messages, appointment.durationMinutes)}
                        </div>
                      </div>
                      <span className={bookingStatusClass(appointment.status)}>
                        {formatBookingStatus(
                          messages,
                          appointment,
                          props.actorRole,
                        )}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-[var(--color-text-secondary)]">
                  {messages.booking.noAppointmentsForDay}
                </div>
              )}
            </div>
          </div>

          {selectedAppointment ? (
            <AppointmentDetails
              appointment={selectedAppointment}
              locale={locale}
              messages={messages}
            />
          ) : null}

          {!readOnly ? (
            <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white px-5 py-4">
              {showRequestControls ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-[var(--color-text-main)]">
                      {messages.booking.timeLabel}
                      <input
                        type="time"
                        value={timeValue}
                        onChange={(event) => setTimeValue(event.target.value)}
                        className="form-control"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[var(--color-text-main)]">
                      {messages.booking.durationLabel}
                      <select
                        value={durationMinutes}
                        onChange={(event) =>
                          setDurationMinutes(Number(event.target.value))
                        }
                        className="form-control"
                      >
                        {DURATION_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {formatMinutes(messages, minutes)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={props.isPending === true || !canSubmitRequest}
                    onClick={submitRequest}
                    className="btn-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {selectedAppointment?.status === "pending"
                      ? messages.booking.counterPropose
                      : selectedAppointment
                        ? messages.booking.requestAgain
                        : messages.booking.propose}
                  </button>
                  {isSelectedTimeElapsed ? (
                    <div
                      role="alert"
                      className="text-sm font-medium text-red-600"
                    >
                      {messages.booking.pastTimeError}
                    </div>
                  ) : null}
                </>
              ) : null}

              {showReasonInput ? (
                <label className="grid gap-2 text-sm font-semibold text-[var(--color-text-main)]">
                  {messages.booking.reasonLabel}
                  <textarea
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setReasonError("");
                    }}
                    placeholder={messages.booking.reasonPlaceholder}
                    className="form-control min-h-24 resize-none"
                  />
                </label>
              ) : null}
              {reasonError ? (
                <div role="alert" className="text-sm font-medium text-red-600">
                  {reasonError}
                </div>
              ) : null}

              {selectedAppointment ? (
                <div className="flex flex-wrap gap-3">
                  {canRequestCancellation ? (
                    <button
                      type="button"
                      disabled={props.isPending}
                      onClick={() =>
                        respond("request_cancel", selectedAppointment)
                      }
                      className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      {messages.booking.requestCancel}
                    </button>
                  ) : null}
                  {canRespond ? (
                    <>
                      <button
                        type="button"
                        disabled={props.isPending}
                        onClick={() => respond("confirm", selectedAppointment)}
                        className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {messages.booking.confirm}
                      </button>
                      <button
                        type="button"
                        disabled={props.isPending}
                        onClick={() => respond("decline", selectedAppointment)}
                        className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        {messages.booking.decline}
                      </button>
                    </>
                  ) : null}
                  {canRespondToCancellation ? (
                    <>
                      <button
                        type="button"
                        disabled={props.isPending}
                        onClick={() => respond("confirm", selectedAppointment)}
                        className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        {messages.booking.confirmCancel}
                      </button>
                      <button
                        type="button"
                        disabled={props.isPending}
                        onClick={() => respond("decline", selectedAppointment)}
                        className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {messages.booking.keepLesson}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AppointmentDetails(props: {
  appointment: BookingAppointment & { scheduledDate?: Date | null };
  locale: "en" | "zh";
  messages: Messages;
}) {
  const appointmentDate = parseDateValue(props.appointment.scheduledStart);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white px-5 py-4 text-sm">
      <div className="space-y-2">
        <div className="font-semibold text-[var(--color-text-main)]">
          {appointmentDate
            ? formatAppointmentDate(props.locale, appointmentDate)
            : "-"}
        </div>
        <div className="text-[var(--color-text-secondary)]">
          {formatMinutes(props.messages, props.appointment.durationMinutes)}
        </div>
        <div className="text-[var(--color-text-light)]">
          {formatRequestedBy(props.messages, props.appointment.requestedBy)}
        </div>
        <ReasonLine
          label={props.messages.booking.responseReason}
          value={props.appointment.responseReason}
        />
        <ReasonLine
          label={props.messages.booking.cancellationReason}
          value={props.appointment.cancellationReason}
        />
        <ReasonLine
          label={props.messages.booking.cancellationResponseReason}
          value={props.appointment.cancellationResponseReason}
        />
      </div>
    </div>
  );
}

function ReasonLine(props: { label: string; value?: string | null }) {
  if (!props.value?.trim()) return null;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[var(--color-text-secondary)]">
      <span className="font-semibold text-[var(--color-text-main)]">
        {props.label}:{" "}
      </span>
      {props.value}
    </div>
  );
}

function defaultBookingDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return date;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function buildCalendarDays(anchor: Date) {
  const safeAnchor = isValidDate(anchor) ? anchor : defaultBookingDate();
  const year = safeAnchor.getFullYear();
  const month = safeAnchor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

function parseDateValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return isValidDate(date) ? date : null;
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function toTimeValue(date: Date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
}

function buildSelectedDateTime(dateKey: string, timeValue: string) {
  const date = new Date(`${dateKey}T${timeValue}`);
  return isValidDate(date) ? date : null;
}

function isDateBeforeToday(date: Date, today: Date) {
  return startOfDay(date).getTime() < startOfDay(today).getTime();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayStatus(
  appointments: Array<BookingAppointment & { scheduledDate?: Date | null }>,
) {
  if (
    appointments.some(
      (appointment) => appointment.status === "cancellation_pending",
    )
  ) {
    return "cancellation_pending";
  }
  if (appointments.some((appointment) => appointment.status === "pending")) {
    return "pending";
  }
  if (appointments.some((appointment) => appointment.status === "confirmed")) {
    return "confirmed";
  }
  if (
    appointments.some(
      (appointment) =>
        appointment.status === "cancelled" || appointment.status === "declined",
    )
  ) {
    return "inactive";
  }
  return null;
}

function dayStatusClass(status: string, isSelected: boolean) {
  if (isSelected) return "bg-white";
  if (status === "confirmed") return "bg-emerald-500";
  if (status === "pending" || status === "cancellation_pending") {
    return "bg-amber-500";
  }
  return "bg-red-400";
}

function formatMonthTitle(locale: "en" | "zh", date: Date) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDate(locale: "en" | "zh", date: Date) {
  return formatAppDate(locale, date, "full");
}

function formatTime(locale: "en" | "zh", date: Date) {
  return formatAppTime(locale, date);
}

function formatMinutes(messages: Messages, minutes: number) {
  return messages.booking.minutes.replace("{minutes}", String(minutes));
}

function formatAppointmentDate(locale: "en" | "zh", date: Date) {
  return formatAppDateTime(locale, date);
}

function formatRequestedBy(
  messages: Messages,
  requestedBy: AppointmentRequestedBy,
) {
  return requestedBy === "student"
    ? messages.booking.requestedByStudent
    : messages.booking.requestedByTeacher;
}

function formatBookingStatus(
  messages: Messages,
  appointment: BookingAppointment | null | undefined,
  actorRole: AppointmentRequestedBy | "admin",
) {
  if (!appointment) return messages.booking.empty;
  if (appointment.status === "confirmed") return messages.booking.confirmed;
  if (appointment.status === "declined") return messages.booking.declined;
  if (appointment.status === "cancelled") return messages.booking.cancelled;
  if (appointment.status === "cancellation_pending") {
    if (
      actorRole !== "admin" &&
      appointment.cancellationRequestedBy !== actorRole
    ) {
      return messages.booking.cancelPendingForYou;
    }
    if (
      actorRole !== "admin" &&
      appointment.cancellationRequestedBy === actorRole
    ) {
      return messages.booking.cancelPendingForOther;
    }
    return messages.booking.cancelPending;
  }
  if (actorRole !== "admin" && appointment.requestedBy !== actorRole) {
    return messages.booking.pendingForYou;
  }
  if (actorRole !== "admin" && appointment.requestedBy === actorRole) {
    return messages.booking.pendingForOther;
  }
  return messages.booking.pending;
}

function bookingStatusClass(status: AppointmentStatus | undefined) {
  if (status === "confirmed") return "status-chip success";
  if (status === "declined") return "status-chip danger";
  if (status === "cancelled") return "status-chip danger";
  if (status === "pending") return "status-chip warning";
  if (status === "cancellation_pending") return "status-chip warning";
  return "status-chip info";
}
