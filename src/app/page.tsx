import Link from "next/link";

import { LandingHeader } from "~/components/landing-header";
import { SiteComplianceFooter } from "~/components/site-compliance-footer";
import { getMessages } from "~/lib/i18n";
import { getActiveUserSession } from "~/server/auth/active-session";
import { getServerLocale } from "~/server/server-locale";

export default async function HomePage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const session = await getActiveUserSession();
  const pillars = messages.landing.pillars;

  return (
    <main className="relative overflow-hidden">
      {/* Fixed Navbar */}
      <LandingHeader session={session} />

      {/* Hero Section */}
      <section className="relative flex min-h-[calc(100vh-4rem)] items-center bg-[linear-gradient(135deg,#f0fdf4_0%,#d1fae5_30%,#ecfdf5_60%,#fafaf9_100%)] pt-16 sm:min-h-screen sm:pt-20">
        {/* Decorative floating blob */}
        <div className="pointer-events-none absolute top-1/4 right-[-5%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.15)_0%,rgba(16,185,129,0.05)_40%,transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute top-[60%] right-[10%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(209,250,229,0.6)_0%,transparent_70%)] blur-2xl" />
        <div className="mx-auto max-w-7xl px-4 pt-12 pb-12 sm:px-6 sm:pt-16 sm:pb-20 lg:px-10 lg:pt-24 lg:pb-32">
          <div className="max-w-3xl">
            <div className="mb-5 inline-block rounded-full bg-[var(--color-primary-light)] px-4 py-1.5 text-xs font-bold tracking-[0.1em] text-[var(--color-primary-dark)] uppercase sm:mb-6 sm:text-sm">
              {messages.landing.tag}
            </div>
            <h1 className="display-1 text-gradient">
              {messages.landing.heading}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed font-[var(--font-body)] text-[var(--color-text-secondary)] sm:mt-8 sm:text-lg md:text-xl">
              {messages.landing.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 sm:mt-12 sm:gap-4">
              <Link
                href="/signup?role=student"
                className="btn-primary px-6 py-3 text-sm font-semibold sm:px-8 sm:py-4 sm:text-base"
              >
                {messages.landing.ctaApply}
              </Link>
              <Link
                href="/login"
                className="btn-outline px-6 py-3 text-sm font-semibold sm:px-8 sm:py-4 sm:text-base"
              >
                {messages.landing.ctaLogin}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="mission"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-10 lg:py-32"
      >
        <div className="mb-10 text-center sm:mb-12">
          <div className="mb-3 text-xs font-bold tracking-[0.24em] text-[var(--color-primary)] uppercase sm:text-sm">
            {messages.landing.nav.mission}
          </div>
          <div className="mx-auto h-1 w-12 rounded-full bg-[var(--color-primary)]" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.eyebrow} className="feature-card">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,var(--color-primary-50),var(--color-primary-light))] text-2xl font-bold text-[var(--color-primary)] shadow-sm">
                {pillar.eyebrow.replace(/^0+/, "") || pillar.eyebrow}
              </div>
              <h3 className="text-xl font-[var(--font-title)] font-bold text-[var(--color-text-main)]">
                {pillar.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
                {pillar.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Decorative divider */}
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-10">
        <div className="h-px flex-1 bg-[linear-gradient(to_right,transparent,var(--color-primary-light),transparent)]" />
      </div>

      {/* What Changed Section */}
      <section
        id="workflow"
        className="bg-[linear-gradient(180deg,var(--color-primary-50)_0%,var(--color-bg-secondary)_40%,var(--color-bg-secondary)_100%)] py-16 sm:py-20 lg:py-32"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 text-xs font-bold tracking-[0.24em] text-[var(--color-primary)] uppercase sm:mb-6 sm:text-sm">
              {messages.landing.whatChangedEyebrow}
            </div>
            <h2 className="text-3xl leading-tight font-[var(--font-title)] tracking-tight text-[var(--color-text-main)] sm:text-4xl md:text-5xl lg:text-6xl">
              {messages.landing.whatChangedTitle}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-text-secondary)] sm:mt-8 sm:text-lg">
              {messages.landing.whatChangedBody}
            </p>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section
        id="story"
        className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-10 lg:py-32"
      >
        <div
          className="glass-card relative overflow-hidden rounded-[var(--radius-lg)] p-6 text-center sm:p-10 lg:p-16"
          style={{
            borderImage:
              "linear-gradient(135deg, var(--color-primary-light), var(--color-primary), var(--color-primary-light)) 1",
            borderTopWidth: "3px",
            borderTopStyle: "solid",
          }}
        >
          <div
            className="pointer-events-none absolute top-2 left-4 font-serif text-[6rem] leading-none text-[var(--color-primary-light)] opacity-60 select-none sm:top-4 sm:left-6 sm:text-[8rem]"
            aria-hidden="true"
          >
            &ldquo;
          </div>
          <p className="relative text-xl leading-relaxed font-[var(--font-body)] text-[var(--color-text-main)] italic sm:text-2xl md:text-3xl lg:text-4xl">
            &quot;{messages.landing.quote}&quot;
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 sm:mt-10">
            <div className="h-px w-8 bg-[var(--color-primary)] sm:w-10" />
            <div className="text-xs font-bold tracking-[0.24em] text-[var(--color-primary-dark)] uppercase sm:text-sm">
              {messages.landing.quoteAuthor}
            </div>
            <div className="h-px w-8 bg-[var(--color-primary)] sm:w-10" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 bg-[linear-gradient(135deg,#f0fdf4_0%,#dff6ea_32%,#eefbf4_68%,#fafaf9_100%)] py-12 sm:mt-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
            <div>
              <span className="text-xl font-[var(--font-title)] font-bold text-[var(--color-primary-dark)]">
                {messages.common.appName}
              </span>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[color:rgba(6,78,59,0.72)]">
                {messages.landing.subtitle}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <nav className="flex gap-6 text-sm font-medium text-[color:rgba(6,78,59,0.72)]">
                <a
                  href="#mission"
                  className="transition-colors hover:text-[var(--color-primary-dark)]"
                >
                  {messages.landing.nav.mission}
                </a>
                <a
                  href="#workflow"
                  className="transition-colors hover:text-[var(--color-primary-dark)]"
                >
                  {messages.landing.nav.workflow}
                </a>
                <a
                  href="#story"
                  className="transition-colors hover:text-[var(--color-primary-dark)]"
                >
                  {messages.landing.nav.story}
                </a>
              </nav>
              <div className="flex gap-4">
                <Link
                  href="/login"
                  className="text-sm font-medium text-[color:rgba(6,78,59,0.72)] transition-colors hover:text-[var(--color-primary-dark)]"
                >
                  {messages.landing.headerLogin}
                </Link>
                <Link
                  href="/signup?role=student"
                  className="text-sm font-medium text-[color:rgba(6,78,59,0.72)] transition-colors hover:text-[var(--color-primary-dark)]"
                >
                  {messages.landing.headerSignup}
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-[rgba(16,185,129,0.2)] pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-[color:rgba(6,78,59,0.55)]">
                &copy; {new Date().getFullYear()} {messages.common.appName}.{" "}
                {messages.common.growingTogether}
              </p>
              <div className="[&_a]:text-[var(--color-primary-dark)] [&_a:hover]:text-[var(--color-primary)] [&>div]:text-[color:rgba(6,78,59,0.6)]">
                <SiteComplianceFooter locale={locale} />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
