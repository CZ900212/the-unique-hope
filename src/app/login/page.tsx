import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPageShell } from "~/components/auth-page-shell";
import { LoginForm } from "~/components/login-form";
import { getMessages } from "~/lib/i18n";
import { getActiveUserSession } from "~/server/auth/active-session";
import { getServerLocale } from "~/server/server-locale";

export default async function LoginPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const active = await getActiveUserSession();
  if (active?.profile.role) {
    redirect(`/${active.profile.role}`);
  }

  return (
    <AuthPageShell
      locale={locale}
      footer={
        <>
          <Link
            href="/"
            className="font-medium transition-colors hover:text-[var(--color-text-main)]"
          >
            {messages.common.backHome}
          </Link>
          <Link
            href="/signup"
            className="font-medium transition-colors hover:text-[var(--color-text-main)]"
          >
            {messages.authPage.needStudent}
          </Link>
        </>
      }
      variant="accent"
    >
      <LoginForm allowedRoles={["teacher", "student"]} />
    </AuthPageShell>
  );
}
