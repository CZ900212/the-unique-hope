"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { useI18n } from "~/components/locale-provider";

type PortalItem = {
  active?: boolean;
  href?: string;
  label: string;
  onClick?: () => void;
};

export function PortalShell(props: {
  badge?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  navItems: PortalItem[];
  subtitle: string;
  title: string;
}) {
  const { locale, messages } = useI18n();

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--color-bg-secondary)] px-4 py-6 md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1500px] gap-6 overflow-x-hidden lg:grid-cols-[clamp(19rem,22vw,21rem)_minmax(0,1fr)] xl:gap-8">
        <aside className="rounded-[var(--radius-lg)] bg-[var(--color-white)] border border-[var(--card-border)] p-8 flex flex-col overflow-hidden lg:sticky lg:top-6 lg:min-h-[calc(100vh-3rem)]">
          <div className="relative">
            <div className="pointer-events-none absolute -top-8 -left-8 -right-8 h-24 bg-[linear-gradient(135deg,var(--color-primary-50),var(--color-primary-light))] opacity-60 blur-xl" />
            <Link href="/" className="relative inline-block font-[var(--font-title)] text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-primary)] transition-opacity hover:opacity-80">
              {messages.common.appName}
            </Link>
            <div className="mt-6 font-[var(--font-title)] text-3xl tracking-tight text-[var(--color-text-main)]">
              {messages.portal.title}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {messages.portal.subtitle}
            </p>
          </div>

          <div className="mt-10 flex-1 space-y-2">
            {props.navItems.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={`flex rounded-[var(--radius-md)] px-5 py-3.5 text-sm font-medium transition-all ${
                    item.active ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] border-l-3 border-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-main)]"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={item.active}
                  onClick={item.onClick}
                  className={`flex w-full rounded-[var(--radius-md)] px-5 py-3.5 text-left text-sm font-medium transition-all ${
                    item.active ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] border-l-3 border-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-main)]"
                  }`}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-[var(--radius-md)] border border-[var(--card-border)] px-5 py-3.5 text-sm font-medium text-[var(--status-error)] transition-all hover:bg-[var(--color-bg-secondary)]"
          >
            <LogOut className="h-4 w-4" />
            {messages.portal.logout}
          </button>
        </aside>

        <section className="glass-card min-w-0 overflow-x-hidden rounded-[var(--radius-lg)] p-6 lg:p-10 flex flex-col">
          <div className="flex flex-col gap-6 border-b border-[var(--card-border)] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--color-primary)]">
                {props.subtitle}
              </div>
              <h1 className="mt-3 font-[var(--font-title)] text-4xl leading-tight tracking-tight text-[var(--color-text-main)] sm:text-5xl">
                {props.title}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LocaleSwitcher locale={locale} />
              {props.badge ? (
                <span className="rounded-full bg-[linear-gradient(135deg,var(--color-primary-light),var(--color-primary-50))] px-5 py-2.5 text-sm font-bold text-[var(--color-primary-dark)]">
                  {props.badge}
                </span>
              ) : null}
              {props.headerActions}
            </div>
          </div>

          <div className="pt-8 flex-1">{props.children}</div>
        </section>
      </div>
    </main>
  );
}
