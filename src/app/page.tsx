import Link from "next/link";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { getMessages } from "~/lib/i18n";
import { getActiveUserSession } from "~/server/auth/active-session";
import { getServerLocale } from "~/server/locale";

export default async function HomePage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const session = await getActiveUserSession();
  const pillars = messages.landing.pillars;

  return (
    <main className="relative overflow-hidden">
      {/* Fixed Navbar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-[var(--card-border)] shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="font-[var(--font-title)] text-xl font-bold text-[var(--color-primary)]">
            {messages.common.appName}
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--color-text-secondary)] md:flex">
            <a href="#mission" className="hover:text-[var(--color-text-main)] transition-colors">{messages.landing.nav.mission}</a>
            <a href="#workflow" className="hover:text-[var(--color-text-main)] transition-colors">{messages.landing.nav.workflow}</a>
            <a href="#story" className="hover:text-[var(--color-text-main)] transition-colors">{messages.landing.nav.story}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} />
            <Link
              href="/signup"
              className="btn-outline px-5 py-2.5 text-sm font-semibold"
            >
              {messages.landing.headerSignup}
            </Link>
            <Link
              href={session?.profile ? `/${session.profile.role}` : "/login"}
              className="btn-primary px-5 py-2.5 text-sm font-semibold"
            >
              {session?.profile ? messages.landing.openDashboard : messages.landing.headerLogin}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 bg-[linear-gradient(135deg,#f0fdf4_0%,#d1fae5_30%,#ecfdf5_60%,#fafaf9_100%)]">
        {/* Decorative floating blob */}
        <div className="pointer-events-none absolute right-[-5%] top-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.15)_0%,rgba(16,185,129,0.05)_40%,transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute right-[10%] top-[60%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(209,250,229,0.6)_0%,transparent_70%)] blur-2xl" />
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-10 lg:pb-32 lg:pt-24">
          <div className="max-w-3xl">
            <div className="mb-6 inline-block rounded-full bg-[var(--color-primary-light)] px-4 py-1.5 text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-primary-dark)]">
              {messages.landing.tag}
            </div>
            <h1 className="display-1 text-gradient">
              {messages.landing.heading}
            </h1>
            <p className="mt-8 max-w-2xl font-[var(--font-body)] text-lg leading-relaxed text-[var(--color-text-secondary)] sm:text-xl">
              {messages.landing.subtitle}
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="btn-primary px-8 py-4 text-base font-semibold"
              >
                {messages.landing.ctaApply}
              </Link>
              <Link
                href="/login"
                className="btn-outline px-8 py-4 text-base font-semibold"
              >
                {messages.landing.ctaLogin}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="mission" className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        <div className="mb-12 text-center">
          <div className="mb-3 text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-primary)]">
            {messages.landing.nav.mission}
          </div>
          <div className="mx-auto h-1 w-12 rounded-full bg-[var(--color-primary)]" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.eyebrow} className="feature-card">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,var(--color-primary-50),var(--color-primary-light))] text-[var(--color-primary)] text-2xl font-bold shadow-sm">
                {pillar.eyebrow.charAt(0)}
              </div>
              <h3 className="font-[var(--font-title)] text-xl font-bold text-[var(--color-text-main)]">
                {pillar.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Decorative divider */}
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 lg:px-10">
        <div className="h-px flex-1 bg-[linear-gradient(to_right,transparent,var(--color-primary-light),transparent)]" />
      </div>

      {/* What Changed Section */}
      <section id="workflow" className="bg-[linear-gradient(180deg,var(--color-primary-50)_0%,var(--color-bg-secondary)_40%,var(--color-bg-secondary)_100%)] py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-primary)] mb-6">
              {messages.landing.whatChangedEyebrow}
            </div>
            <h2 className="font-[var(--font-title)] text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl text-[var(--color-text-main)]">
              {messages.landing.whatChangedTitle}
            </h2>
            <p className="mt-8 text-lg leading-relaxed text-[var(--color-text-secondary)] max-w-2xl mx-auto">
              {messages.landing.whatChangedBody}
            </p>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section id="story" className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
        <div className="glass-card relative overflow-hidden rounded-[var(--radius-lg)] p-10 text-center lg:p-16" style={{ borderImage: 'linear-gradient(135deg, var(--color-primary-light), var(--color-primary), var(--color-primary-light)) 1', borderTopWidth: '3px', borderTopStyle: 'solid' }}>
          <div className="pointer-events-none absolute left-6 top-4 text-[8rem] leading-none font-serif text-[var(--color-primary-light)] opacity-60 select-none" aria-hidden="true">
            &ldquo;
          </div>
          <p className="relative font-[var(--font-body)] text-3xl leading-relaxed text-[var(--color-text-main)] sm:text-4xl italic">
            &quot;{messages.landing.quote}&quot;
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <div className="h-px w-10 bg-[var(--color-primary)]" />
            <div className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-primary-dark)]">
              {messages.landing.quoteAuthor}
            </div>
            <div className="h-px w-10 bg-[var(--color-primary)]" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--color-primary-900)] py-16 mt-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div>
              <span className="font-[var(--font-title)] text-xl font-bold text-white">{messages.common.appName}</span>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-200/80">
                {messages.landing.subtitle}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <nav className="flex gap-6 text-sm font-medium text-emerald-200/80">
                <a href="#mission" className="transition-colors hover:text-white">{messages.landing.nav.mission}</a>
                <a href="#workflow" className="transition-colors hover:text-white">{messages.landing.nav.workflow}</a>
                <a href="#story" className="transition-colors hover:text-white">{messages.landing.nav.story}</a>
              </nav>
              <div className="flex gap-4">
                <Link href="/login" className="text-sm font-medium text-emerald-200/80 transition-colors hover:text-white">
                  {messages.landing.headerLogin}
                </Link>
                <Link href="/signup" className="text-sm font-medium text-emerald-200/80 transition-colors hover:text-white">
                  {messages.landing.headerSignup}
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-emerald-800 pt-6">
            <p className="text-sm text-emerald-300/60">
              &copy; {new Date().getFullYear()} {messages.common.appName}. {messages.common.growingTogether}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
