import { LocaleSwitcher } from "~/components/locale-switcher";
import { type Locale } from "~/lib/i18n";

export function AuthPageShell(props: {
  children: React.ReactNode;
  chrome?: "card" | "none";
  footer?: React.ReactNode;
  locale: Locale;
  size?: "md" | "xl";
  variant?: "accent" | "plain";
}) {
  const isAccent = (props.variant ?? "accent") === "accent";
  const widthClass = props.size === "xl" ? "max-w-[760px]" : "max-w-md";
  const useCardChrome = (props.chrome ?? "card") === "card";

  return (
    <main
      className={
        isAccent
          ? "relative flex min-h-screen items-start justify-center overflow-hidden bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_40%,#fafaf9_100%)] px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-12"
          : "relative flex min-h-screen items-start justify-center bg-[var(--color-bg-main)] px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-12"
      }
    >
      {isAccent ? (
        <>
          <div className="pointer-events-none absolute -top-20 -right-20 h-[300px] w-[300px] rounded-full bg-[var(--color-primary-light)] opacity-40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-[200px] w-[200px] rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl" />
        </>
      ) : null}

      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6 lg:right-8 lg:top-8">
        <LocaleSwitcher locale={props.locale} />
      </div>

      <div className={`relative w-full ${widthClass}`}>
        {useCardChrome ? (
          <div className="glass-card rounded-[var(--radius-lg)] p-6 sm:p-7 lg:p-8">{props.children}</div>
        ) : (
          props.children
        )}
        {props.footer ? (
          <div className="mt-3 flex items-center justify-between text-sm font-semibold text-[var(--color-text-secondary)]">
            {props.footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
