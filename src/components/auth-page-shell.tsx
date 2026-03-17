import { LocaleSwitcher } from "~/components/locale-switcher";
import { type Locale } from "~/lib/i18n";

export function AuthPageShell(props: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  locale: Locale;
  variant?: "accent" | "plain";
}) {
  const isAccent = (props.variant ?? "accent") === "accent";

  return (
    <main
      className={
        isAccent
          ? "relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_40%,#fafaf9_100%)] px-6 py-12"
          : "relative flex min-h-screen items-center justify-center bg-[var(--color-bg-main)] px-6 py-12"
      }
    >
      {isAccent ? (
        <>
          <div className="pointer-events-none absolute -top-20 -right-20 h-[300px] w-[300px] rounded-full bg-[var(--color-primary-light)] opacity-40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-[200px] w-[200px] rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl" />
        </>
      ) : null}

      <div className="absolute right-6 top-6 z-10">
        <LocaleSwitcher locale={props.locale} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="glass-card rounded-[var(--radius-lg)] p-8">{props.children}</div>
        {props.footer ? (
          <div className="mt-6 flex items-center justify-between text-sm font-semibold text-[var(--color-text-secondary)]">
            {props.footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
