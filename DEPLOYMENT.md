# Deployment Guide

## Shipping Target

The only supported production shipping target is the root Next.js application in this repository.

## Runtime Requirements

- Node.js 24 LTS
- A reachable Postgres database via `DATABASE_URL`
- Environment variables from `.env.example`, with these required in practice:
  - `AUTH_URL`
  - `AUTH_SECRET`
  - `AUTH_TRUST_HOST`
  - `DATABASE_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_APP_NAME`
  - `NEXT_PUBLIC_DEFAULT_LOCALE`
  - `RATE_LIMIT_HASH_KEY`

Optional production integrations:

- `BLOB_READ_WRITE_TOKEN` for evidence uploads (`VERCEL_BLOB_READ_WRITE_TOKEN` is accepted temporarily as a compatibility fallback)
- `LESSON_EVIDENCE_STORAGE=local` plus optional `LESSON_EVIDENCE_LOCAL_DIR` to store lesson evidence on the host filesystem instead of Vercel Blob
- `MAX_UPLOAD_MB` if you need to raise or lower the lesson evidence upload cap; keep any proxy or platform request-body limit aligned with the same value
- `RESEND_API_KEY` and `PASSWORD_RESET_FROM_EMAIL` for password reset email delivery
- `WEB_PUSH_ENABLED=true` plus VAPID keys to enable background browser alerts
- `RATE_LIMIT_TRUST_FORWARD_HEADERS=true` only when the app sits behind a trusted reverse proxy that overwrites `X-Forwarded-For` / `X-Real-IP`
- `TRPC_TIMING_LOGS=true` only when you intentionally need temporary tRPC timing logs outside local development

Web Push production variables:

- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`: public VAPID key used by the browser when subscribing
- `WEB_PUSH_PRIVATE_KEY`: private VAPID key, server only
- `WEB_PUSH_SUBJECT`: VAPID contact, usually `mailto:ops@example.com` or an HTTPS contact URL
- `WEB_PUSH_ENABLED=true`: enables subscription saving and delivery enqueueing
- `WEB_PUSH_DRAIN_SECRET`: long random secret used by the protected drain endpoint

Generate the VAPID pair and drain secret locally, then copy only the resulting values into the server environment:

```bash
npm run web-push:prepare -- --subject mailto:admin@theuniquehope.org
```

Keep `WEB_PUSH_ENABLED=false` until the schema, drain endpoint, and real browser subscription flow have all been checked.

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
npm run build
npm run test:e2e
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
- Set `AUTH_URL` to the final site origin so Auth.js always generates the correct login and logout callback URLs.
- Set `NEXT_PUBLIC_APP_URL` to the final site origin.
- If you run behind a proxy or platform router, preserve host/proto forwarding so Auth.js can generate correct callback URLs.
- Keep the proxy or platform upload body limit aligned with `MAX_UPLOAD_MB`, or the request may be rejected before the app can apply its own lesson-evidence checks.
- Apply schema changes before switching traffic to a new release.

## Tencent Cloud CVM Notes

Deploy to Tencent Cloud manually. Do not use `npm run deploy:tencent` or `scripts/deploy-tencent-cloud.sh`.

Default production target:

- Host: `175.24.177.186`
- User: `ubuntu`
- Deploy path: `/home/ubuntu/the-unique-hope`
- Service: `the-unique-hope.service`
- SSH key: `key/Mar18th.pem`

Manual release flow:

1. Run local release checks that fit the change.
2. Create a deploy archive from the root Next.js app files only.
3. Upload the archive with `scp`.
4. SSH into the server and extract into `/home/ubuntu/the-unique-hope`, preserving server-only files such as `.env` and `.env.local`.
5. Run `npm ci` on the server.
6. Run schema updates only when intentionally required.
7. Run `npm run build` on the server.
8. Restart `the-unique-hope.service`.
9. Verify `http://127.0.0.1:3000/api/health` on the server and `https://uniquehopeclub.com/api/health` publicly.

Required Tencent Cloud production environment variables include:

- `AUTH_URL=https://uniquehopeclub.com`
- `NEXT_PUBLIC_APP_URL=https://uniquehopeclub.com`
- `AUTH_TRUST_HOST=true`

Recommended Tencent Cloud upload storage settings:

```bash
LESSON_EVIDENCE_STORAGE=local
LESSON_EVIDENCE_LOCAL_DIR=/home/ubuntu/the-unique-hope/storage/lesson-evidence
```

Tencent Cloud Web Push drain example:

```bash
* * * * * curl -fsS -X POST http://127.0.0.1:3000/api/notifications/push/drain -H "Authorization: Bearer $WEB_PUSH_DRAIN_SECRET" >/dev/null
```

Prefer the checked-in systemd timer template over cron on the Tencent Cloud host:

```bash
sudo cp ops/systemd/the-unique-hope-web-push-drain.service /etc/systemd/system/
sudo cp ops/systemd/the-unique-hope-web-push-drain.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now the-unique-hope-web-push-drain.timer
sudo systemctl status the-unique-hope-web-push-drain.timer
```

Keep the secret in the server environment, never in the browser bundle or repository.

Before enabling background browser alerts, run the production readiness check on the server:

```bash
npm run web-push:check:production
```

If the database tables are missing, back up the production database first, then apply only the notification-related migrations needed for Web Push (`drizzle/0005_real_calendar_notifications.sql` and `drizzle/0006_web_push_delivery_outbox.sql`). Do not use a broad schema push as a shortcut for this prep step.

## Vercel Notes

- Framework preset: `Next.js`
- Root directory: repository root
- Install command: `npm install`
- Build command: `npm run build`
- No custom output directory is needed.

Recommended Vercel environment variables:

- `AUTH_URL`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DEFAULT_LOCALE`
- `NEXT_PUBLIC_APP_URL`
- `RATE_LIMIT_HASH_KEY`
- `RATE_LIMIT_TRUST_FORWARD_HEADERS=true`

Feature-specific Vercel environment variables:

- `BLOB_READ_WRITE_TOKEN` to enable teacher evidence uploads and student/admin evidence viewing
- `RESEND_API_KEY` plus `PASSWORD_RESET_FROM_EMAIL` to enable self-serve password reset emails in production
- Web Push variables listed above if background browser alerts are enabled

Important Vercel-specific behavior:

- `AUTH_URL` and `NEXT_PUBLIC_APP_URL` should both match the actual deployed origin for each environment.
- Vercel Functions enforce a 4.5 MB request-body limit, so keep `MAX_UPLOAD_MB` at or below that value on Vercel deployments.
- If `BLOB_READ_WRITE_TOKEN` is missing, teacher evidence upload endpoints will return `503` and lesson screenshots will not work.
- On a long-running Node host such as Tencent Cloud CVM, you can instead set `LESSON_EVIDENCE_STORAGE=local` and keep uploads on the server filesystem.
- If `RESEND_API_KEY` or `PASSWORD_RESET_FROM_EMAIL` is missing in production, password reset requests will return `503` for accounts that cannot use the local preview flow.
- Seeded demo accounts use `@theuniquehope.local` addresses for non-production convenience and are not suitable for production password-reset email delivery.

## Pre-Go-Live Checklist

- Root `npm run build` completes successfully
- Required production env vars are set
- Database connectivity works and schema is applied
- Deployed `/api/health` returns `200`
- First admin can sign in
- Teacher can upload evidence when either blob storage or local lesson evidence storage is configured
- Student can view evidence and submit feedback
- Admin can review signups and manage the core workflow
- Web Push readiness check passes with `WEB_PUSH_ENABLED=false`
- If Web Push is enabled, browser subscriptions save successfully and `/api/notifications/push/drain` can move queued deliveries to sent or retry states
