import Link from "next/link";
import { redirect } from "next/navigation";
import { type Metadata } from "next";

import { AuthPageShell } from "~/components/auth-page-shell";
import { LoginForm } from "~/components/login-form";
import { getMessages } from "~/lib/i18n";
import { getActiveUserSession } from "~/server/auth/active-session";
import { getServerLocale } from "~/server/server-locale";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminLoginPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const active = await getActiveUserSession();

  if (active?.profile.role === "admin") {
    redirect("/admin");
  }

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
          <span>{messages.adminLogin.staffOnly}</span>
        </>
      }
      variant="plain"
    >
      <LoginForm
        allowedRoles={["admin"]}
        defaultRole="admin"
        footerNote={messages.adminLogin.manualReset}
        roleHint={messages.adminLogin.summary}
        showForgotPassword={false}
        showRoleSelector={false}
        subtitle={messages.adminLogin.subtitle}
        title={messages.adminLogin.title}
      />
    </AuthPageShell>
  );
}
