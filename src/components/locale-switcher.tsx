"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { getMessages, LOCALE_COOKIE_NAME, type Locale } from "~/lib/i18n";

export function LocaleSwitcher(props: { locale: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const messages = getMessages(props.locale);
  const nextLocale = props.locale === "en" ? "zh" : "en";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        });
      }}
      className="rounded-[var(--radius-md)] border border-[var(--card-border)] bg-[var(--color-white)] px-4 py-2 text-sm font-semibold text-[var(--color-text-main)] shadow-sm transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={
        props.locale === "en"
          ? messages.common.switchToChinese
          : messages.common.switchToEnglish
      }
    >
      {props.locale === "en" ? "中文" : "EN"}
    </button>
  );
}
