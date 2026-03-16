import { PasswordResetConfirmForm } from "~/components/password-reset-confirm-form";

export default async function ResetPasswordPage(props: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const searchParams = await props.searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-main)] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-[var(--radius-lg)] p-8">
          <PasswordResetConfirmForm token={searchParams?.token ?? ""} />
        </div>
      </div>
    </main>
  );
}
