import { redirect } from "next/navigation";

import { AuthPageShell } from "~/components/auth-page-shell";
import { PasswordResetEmailRequestForm } from "~/components/password-reset-request-form";
import { getActiveUserSession } from "~/server/auth/active-session";
import { getServerLocale } from "~/server/server-locale";

export default async function ForgotPasswordPage() {
  const locale = await getServerLocale();
  const active = await getActiveUserSession();
  if (active?.profile.role) {
    redirect(`/${active.profile.role}`);
  }

  return (
    <AuthPageShell locale={locale} variant="plain">
      <PasswordResetEmailRequestForm />
    </AuthPageShell>
  );
}
