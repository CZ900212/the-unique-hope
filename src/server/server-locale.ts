import { headers } from "next/headers";

import { DEFAULT_LOCALE, resolveRequestLocale } from "~/lib/i18n";

export async function getServerLocale() {
  return resolveRequestLocale(
    await headers(),
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? DEFAULT_LOCALE,
  );
}
