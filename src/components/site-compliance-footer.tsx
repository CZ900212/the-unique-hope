import { getMessages, type Locale } from "~/lib/i18n";

export function SiteComplianceFooter(props: { locale: Locale }) {
  const messages = getMessages(props.locale);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs text-[var(--color-text-secondary)]">
      <span>{messages.common.icpLabel}</span>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-[var(--color-primary-dark)] underline decoration-[var(--color-primary)] underline-offset-4 hover:text-[var(--color-primary)]"
      >
        浙ICP备2026020488号
      </a>
    </div>
  );
}
