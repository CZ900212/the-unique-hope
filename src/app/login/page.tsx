import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "~/components/login-form";
import { getMessages } from "~/lib/i18n";
import { getActiveUserSession } from "~/server/auth/active-session";
import { getServerLocale } from "~/server/locale";

export default async function LoginPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const active = await getActiveUserSession();
  if (active?.profile.role) {
    redirect(`/${active.profile.role}`);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_40%,#fafaf9_100%)] px-6 py-12 overflow-hidden">
      {/* Decorative blob */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-[300px] w-[300px] rounded-full bg-[var(--color-primary-light)] opacity-40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-[200px] w-[200px] rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="glass-card rounded-[var(--radius-lg)] p-8">
          <LoginForm allowedRoles={["teacher", "student"]} />
        </div>
        <div className="mt-6 flex items-center justify-between text-sm font-semibold text-[var(--color-text-secondary)]">
          <Link href="/" className="font-medium hover:text-[var(--color-text-main)] transition-colors">
            {messages.common.backHome}
          </Link>
          <Link href="/signup" className="font-medium hover:text-[var(--color-text-main)] transition-colors">
            {messages.authPage.needStudent}
          </Link>
        </div>
      </div>
    </main>
  );
}
