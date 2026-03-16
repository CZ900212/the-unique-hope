import { redirect } from "next/navigation";

import { PasswordResetRequestForm } from "~/components/password-reset-request-form";
import { getActiveUserSession } from "~/server/auth/active-session";

export default async function ForgotPasswordPage() {
  const active = await getActiveUserSession();
  if (active?.profile.role) {
    redirect(`/${active.profile.role}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-main)] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-[var(--radius-lg)] p-8">
          <PasswordResetRequestForm />
        </div>
      </div>
    </main>
  );
}
