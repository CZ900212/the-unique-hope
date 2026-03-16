# Deployment Guide

## Shipping Target

The only supported production shipping target is the root Next.js application in this repository.

Archived directories such as `frontend/` and `backend/` are kept for migration reference and QA history only. Do not treat them as independent deployment units.

## Runtime Requirements

- Node.js 20+
- A reachable Postgres database via `DATABASE_URL`
- Environment variables from `.env.example`, with these required in practice:
  - `AUTH_SECRET`
  - `AUTH_TRUST_HOST`
  - `DATABASE_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_APP_NAME`
  - `NEXT_PUBLIC_DEFAULT_LOCALE`

Optional production integrations:

- `BLOB_READ_WRITE_TOKEN` for evidence uploads (`VERCEL_BLOB_READ_WRITE_TOKEN` is accepted temporarily as a compatibility fallback)
- `RESEND_API_KEY` and `PASSWORD_RESET_FROM_EMAIL` for password reset email delivery
- `INSTANT_APP_ID` and `INSTANT_ADMIN_TOKEN` if InstantDB-backed flows are enabled in your environment
- `RATE_LIMIT_TRUST_FORWARD_HEADERS=true` only when the app sits behind a trusted reverse proxy that overwrites `X-Forwarded-For` / `X-Real-IP`

## Release Flow

1. Install dependencies at the repository root.

```bash
npm install
```

2. Configure production environment variables.

```bash
cp .env.example .env
```

3. Apply the database schema before promotion.

```bash
npm run db:push
```

4. Seed an initial admin or demo data if your release process needs it.

```bash
npm run seed
```

Notes:
- Set a unique `SEED_ADMIN_PASSWORD` before running the seed script.
- `SEED_DEMO_DATA` should stay `false` for production releases.
- Existing passwords are left unchanged unless `SEED_RESET_EXISTING_PASSWORDS=true`.
- Admin sign-in is no longer exposed on `/login`; operators must use `/admin/login`.
- Admin password recovery is manual via `npm run admin:reset-password -- --identifier <email|username>`.

5. Run the root application quality gates.

```bash
npm run lint
npm run typecheck
npm run test
```

Run `npm run test:e2e` when browser coverage is part of the release gate.

6. Build the production bundle from the repository root.

```bash
npm run build
```

7. Start the shipped app from the repository root.

```bash
npm run start
```

## Hosting Notes

- Deploy the repository root to a Next.js-compatible host such as Vercel, or to a Node host that can run `npm run build` followed by `npm run start`.
- The production health endpoint is `/api/health`.
- Set `NEXT_PUBLIC_APP_URL` to the final site origin.
- If you run behind a proxy or platform router, preserve host/proto forwarding so Auth.js can generate correct callback URLs.
- Apply schema changes before switching traffic to a new release.

## Vercel Notes

- Framework preset: `Next.js`
- Root directory: repository root
- Install command: `npm install`
- Build command: `npm run build`
- No custom output directory is needed.

Recommended Vercel environment variables:

- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DEFAULT_LOCALE`
- `NEXT_PUBLIC_APP_URL`
- `RATE_LIMIT_TRUST_FORWARD_HEADERS=true`

Feature-specific Vercel environment variables:

- `BLOB_READ_WRITE_TOKEN` to enable teacher evidence uploads and student/admin evidence viewing
- `RESEND_API_KEY` plus `PASSWORD_RESET_FROM_EMAIL` to enable self-serve password reset emails in production

Important Vercel-specific behavior:

- `NEXT_PUBLIC_APP_URL` should match the actual deployed origin for each environment. Use the preview deployment URL for Preview and the custom domain / production URL for Production.
- If `BLOB_READ_WRITE_TOKEN` is missing, teacher evidence upload endpoints will return `503` and lesson screenshots will not work.
- If `RESEND_API_KEY` or `PASSWORD_RESET_FROM_EMAIL` is missing in production, password reset requests will return `503` for accounts that cannot use the local preview flow.
- Seeded demo accounts use `@theuniquehope.local` addresses for non-production convenience and are not suitable for production password-reset email delivery.

## Archived Release Surface

- `frontend/dist` is not the current publish directory.
- `backend/render.yaml` is not the active deployment contract.
- The legacy local delivery harness is archival QA only and is not the production release path.

## Pre-Go-Live Checklist

- Root `npm run build` completes successfully
- Required production env vars are set
- Database connectivity works and schema is applied
- Deployed `/api/health` returns `200`
- First admin can sign in
- Teacher can upload evidence when blob storage is configured
- Student can view evidence and submit feedback
- Admin can review signups and manage the core workflow
