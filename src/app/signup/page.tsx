import Link from "next/link";

import { AuthPageShell } from "~/components/auth-page-shell";
import { SignupForm } from "~/components/signup-form";
import { getMessages } from "~/lib/i18n";
import { getServerLocale } from "~/server/server-locale";

export default async function SignupPage(props: {
  searchParams?: Promise<{ role?: string }>;
}) {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const searchParams = await props.searchParams;
  const initialRole = searchParams?.role === "teacher" ? "teacher" : "student";

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
            href="/login"
            className="font-medium transition-colors hover:text-[var(--color-text-main)]"
          >
            {messages.landing.headerLogin}
          </Link>
        </>
      }
      variant="accent"
    >
      <SignupForm initialRole={initialRole} />
    </AuthPageShell>
  );
}
