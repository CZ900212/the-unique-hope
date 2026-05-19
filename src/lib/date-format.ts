import { type Locale } from "./i18n";

type AppDateTimeOptions = {
  timeZone?: string;
};

function intlLocale(locale: Locale) {
  return locale === "zh" ? "zh-CN" : "en-US";
}

export function formatAppDate(
  locale: Locale,
  date: Date,
  dateStyle: Intl.DateTimeFormatOptions["dateStyle"] = "medium",
) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle,
  }).format(date);
}

export function formatAppTime(
  locale: Locale,
  date: Date,
  options: AppDateTimeOptions = {},
) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour12: false,
    timeStyle: "short",
    timeZone: options.timeZone,
  }).format(date);
}

export function formatAppDateTime(
  locale: Locale,
  date: Date,
  dateStyle: Intl.DateTimeFormatOptions["dateStyle"] = "medium",
  options: AppDateTimeOptions = {},
) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle,
    hour12: false,
    timeStyle: "short",
    timeZone: options.timeZone,
  }).format(date);
}
