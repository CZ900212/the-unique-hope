import {
  DEFAULT_LOCALE,
  resolveLocale,
  resolveRequestLocale,
} from "~/lib/i18n";

export function getRequestLocale(headersLike: Pick<Headers, "get">) {
  return resolveRequestLocale(
    headersLike,
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? DEFAULT_LOCALE,
  );
}

export function getDefaultServerLocale() {
  return resolveLocale(
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? DEFAULT_LOCALE,
  );
}
