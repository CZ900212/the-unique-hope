"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { useI18n } from "~/components/locale-provider";

type LandingSession = { profile: { role: string } } | null;

export function LandingHeader(props: { session: LandingSession }) {
  const { locale, messages } = useI18n();
  const { session } = props;
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const dashboardHref = session?.profile
    ? `/${session.profile.role}`
    : "/login";
  const dashboardLabel = session?.profile
    ? messages.landing.openDashboard
    : messages.landing.headerLogin;

  return (
    <header className="fixed top-0 left-0 z-50 w-full border-b border-[var(--card-border)] bg-white/80 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
        <Link
          href="/"
          className="text-lg font-[var(--font-title)] font-bold text-[var(--color-primary)] sm:text-xl"
        >
          {messages.common.appName}
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--color-text-secondary)] md:flex">
          <a
            href="#mission"
            className="transition-colors hover:text-[var(--color-text-main)]"
          >
            {messages.landing.nav.mission}
          </a>
          <a
            href="#workflow"
            className="transition-colors hover:text-[var(--color-text-main)]"
          >
            {messages.landing.nav.workflow}
          </a>
          <a
            href="#story"
            className="transition-colors hover:text-[var(--color-text-main)]"
          >
            {messages.landing.nav.story}
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher locale={locale} />
          <Link
            href="/signup?role=student"
            className="btn-outline hidden px-5 py-2.5 text-sm font-semibold md:inline-flex"
          >
            {messages.landing.headerSignup}
          </Link>
          <Link
            href={dashboardHref}
            className="btn-primary px-4 py-2 text-sm font-semibold sm:px-5 sm:py-2.5"
          >
            {dashboardLabel}
          </Link>
          <button
            type="button"
            aria-label={
              isOpen ? messages.common.closeMenu : messages.common.openMenu
            }
            aria-expanded={isOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setIsOpen((previous) => !previous)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white text-[var(--color-text-main)] transition-colors hover:bg-[var(--color-bg-secondary)] md:hidden"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {isOpen ? (
        <div
          id="landing-mobile-menu"
          className="border-t border-[var(--card-border)] bg-white md:hidden"
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">
            <a
              href="#mission"
              onClick={() => setIsOpen(false)}
              className="rounded-[var(--radius-md)] px-3 py-3 hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-main)]"
            >
              {messages.landing.nav.mission}
            </a>
            <a
              href="#workflow"
              onClick={() => setIsOpen(false)}
              className="rounded-[var(--radius-md)] px-3 py-3 hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-main)]"
            >
              {messages.landing.nav.workflow}
            </a>
            <a
              href="#story"
              onClick={() => setIsOpen(false)}
              className="rounded-[var(--radius-md)] px-3 py-3 hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-main)]"
            >
              {messages.landing.nav.story}
            </a>
            <Link
              href="/signup?role=student"
              onClick={() => setIsOpen(false)}
              className="rounded-[var(--radius-md)] px-3 py-3 font-semibold text-[var(--color-primary-dark)] hover:bg-[var(--color-bg-secondary)]"
            >
              {messages.landing.headerSignup}
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
