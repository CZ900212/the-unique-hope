import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6 py-16">
      <section className="w-full max-w-xl text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--color-primary)] uppercase">
          404
        </p>
        <h1 className="mt-4 text-4xl font-[var(--font-title)] font-bold text-[var(--color-text-main)]">
          Page not found
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="btn-primary px-6 py-3 text-sm font-semibold"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
