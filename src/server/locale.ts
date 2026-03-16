import { env } from "~/env";
import { DEFAULT_LOCALE, resolveLocale } from "~/lib/i18n";

export async function getServerLocale() {
  return resolveLocale(env.NEXT_PUBLIC_DEFAULT_LOCALE ?? DEFAULT_LOCALE);
}
