"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

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
  const [isNavOpen, setIsNavOpen] = useState(false);
  const pathname = usePathname();
  const burgerRef = useRef<HTMLButtonElement | null>(null);
  const firstNavRef = useRef<HTMLElement | null>(null);
  const wasOpenedRef = useRef(false);

  useEffect(() => {
    setIsNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isNavOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsNavOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isNavOpen]);

  useEffect(() => {
    if (!isNavOpen) {
      if (wasOpenedRef.current) burgerRef.current?.focus();
      return;
    }
    wasOpenedRef.current = true;
    firstNavRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isNavOpen]);

  const closeNav = () => setIsNavOpen(false);

  const navClass = (active?: boolean) =>
    `flex rounded-[var(--radius-md)] px-5 py-3.5 text-sm font-medium transition-all ${
      active
        ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] border-l-3 border-[var(--color-primary)]"
        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-main)]"
    }`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--color-bg-secondary)]">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--card-border)] bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link
          href="/"
          className="text-sm font-[var(--font-title)] font-bold tracking-[0.2em] text-[var(--color-primary)] uppercase"
        >
          {messages.common.appName}
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher locale={locale} />
          <button
            ref={burgerRef}
            type="button"
            aria-label={messages.common.openMenu}
            aria-expanded={isNavOpen}
            aria-controls="portal-shell-nav"
            onClick={() => setIsNavOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white text-[var(--color-text-main)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isNavOpen ? (
        <div
          aria-hidden="true"
          onClick={closeNav}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <div className="px-3 py-4 sm:px-4 sm:py-6 md:px-6">
        <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1500px] gap-6 overflow-x-hidden lg:grid-cols-[clamp(19rem,22vw,21rem)_minmax(0,1fr)] xl:gap-8">
          <aside
            id="portal-shell-nav"
            aria-label={messages.portal.title}
            className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] transform flex-col overflow-y-auto border-r border-[var(--card-border)] bg-[var(--color-white)] p-6 transition-transform duration-300 ease-out lg:static lg:sticky lg:inset-auto lg:top-6 lg:z-auto lg:min-h-[calc(100vh-3rem)] lg:w-auto lg:translate-x-0 lg:overflow-hidden lg:rounded-[var(--radius-lg)] lg:border lg:p-8 ${
              isNavOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="relative">
              <div className="pointer-events-none absolute -top-8 -right-8 -left-8 h-24 bg-[linear-gradient(135deg,var(--color-primary-50),var(--color-primary-light))] opacity-60 blur-xl" />
              <div className="relative flex items-start justify-between gap-3">
                <Link
                  href="/"
                  className="inline-block text-sm font-[var(--font-title)] font-bold tracking-[0.24em] text-[var(--color-primary)] uppercase transition-opacity hover:opacity-80"
                >
                  {messages.common.appName}
                </Link>
                <button
                  type="button"
                  aria-label={messages.common.closeMenu}
                  onClick={closeNav}
                  className="-mt-1 -mr-1 inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] lg:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative mt-6 text-2xl font-[var(--font-title)] tracking-tight text-[var(--color-text-main)] lg:text-3xl">
                {messages.portal.title}
              </div>
              <p className="relative mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {messages.portal.subtitle}
              </p>
            </div>

            <div className="mt-10 flex-1 space-y-2">
              {props.navItems.map((item, index) => {
                const assignFirstRef = (element: HTMLElement | null) => {
                  if (index === 0) firstNavRef.current = element;
                };
                return item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    ref={assignFirstRef}
                    aria-current={item.active ? "page" : undefined}
                    onClick={closeNav}
                    className={navClass(item.active)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    ref={assignFirstRef}
                    type="button"
                    aria-pressed={item.active}
                    onClick={() => {
                      item.onClick?.();
                      closeNav();
                    }}
                    className={`${navClass(item.active)} w-full text-left`}
                  >
                    {item.label}
                  </button>
                );
              })}
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

          <section className="glass-card flex min-w-0 flex-col overflow-x-hidden rounded-[var(--radius-lg)] p-4 sm:p-6 lg:p-10">
            <div className="flex flex-col gap-4 border-b border-[var(--card-border)] pb-6 sm:gap-6 sm:pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-bold tracking-[0.24em] text-[var(--color-primary)] uppercase">
                  {props.subtitle}
                </div>
                <h1 className="mt-3 text-3xl leading-tight font-[var(--font-title)] tracking-tight text-[var(--color-text-main)] sm:text-4xl lg:text-5xl">
                  {props.title}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden lg:block">
                  <LocaleSwitcher locale={locale} />
                </div>
                {props.badge ? (
                  <span className="rounded-full bg-[linear-gradient(135deg,var(--color-primary-light),var(--color-primary-50))] px-4 py-2 text-sm font-bold text-[var(--color-primary-dark)] sm:px-5 sm:py-2.5">
                    {props.badge}
                  </span>
                ) : null}
                {props.headerActions}
              </div>
            </div>

            <div className="flex-1 pt-6 sm:pt-8">{props.children}</div>
          </section>
        </div>
      </div>
    </main>
  );
}
