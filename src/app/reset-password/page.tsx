import { AuthPageShell } from "~/components/auth-page-shell";
import { PasswordResetConfirmForm } from "~/components/password-reset-confirm-form";
import { getServerLocale } from "~/server/locale";

export default async function ResetPasswordPage(props: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const locale = await getServerLocale();
  const searchParams = await props.searchParams;

  return (
    <AuthPageShell locale={locale} variant="plain">
      <PasswordResetConfirmForm token={searchParams?.token ?? ""} />
    </AuthPageShell>
  );
}
