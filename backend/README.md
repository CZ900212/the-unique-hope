# The Unique Hope Backend

Express + InstantDB backend for the Wednesday MVP go-live.

## 1. Quick Start

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Health check:

```bash
curl http://localhost:8080/api/health
```

## 2. Required Environment Variables

See `.env.example`.

Minimum required:
- `INSTANT_APP_ID`
- `INSTANT_ADMIN_TOKEN`

Optional:
- `AUTH_LOCAL_EMAIL_DOMAIN` (default `auth.uniquehope.local`) for generated canonical emails when admin creates users without explicit email.
- `TRUST_PROXY` (default `1` in production, `false` in development) for correct client IP handling behind reverse proxies.
- `CORS_ORIGIN` (default `http://localhost:5173`) for frontend dev server origin.
- `CSRF_TRUSTED_ORIGINS` (comma-separated, defaults to `CORS_ORIGIN`) for trusted browser origins on login.

## 3. InstantDB Setup

1. Create an Instant app.
2. Set `INSTANT_APP_ID` and `INSTANT_ADMIN_TOKEN` in `.env`.
3. Apply schema updates from `instant.schema.ts`.

## 4. Bootstrap First Admin

Set the bootstrap values in your shell or `.env`, then run:

```bash
cd backend
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_PASSWORD='change-me-now' \
BOOTSTRAP_ADMIN_NAME='Initial Admin' \
node scripts/bootstrap-admin.js
```

Optional bootstrap env:
- `BOOTSTRAP_ADMIN_EMAIL` (defaults to `<username>.admin@AUTH_LOCAL_EMAIL_DOMAIN`)
- `BOOTSTRAP_ADMIN_CONTACT` (defaults to the bootstrap email)

Behavior:
- Creates or updates the matching `admin` profile and links an Instant auth user.
- If a different admin already exists, the script exits without creating a second bootstrap admin.

## 5. API Endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Security note:
- `POST /api/auth/login` now validates `Origin` for cookie-based browser logins and returns `403 ORIGIN_INVALID` if origin is not trusted.
- Requests authenticated via `Authorization: Bearer <token>` bypass origin check for non-browser clients.

`POST /api/auth/login` now accepts:
- `identifier` (email or username)
- `password`
- `role`

### Admin
- `POST /api/admin/pairings`
- `GET /api/admin/pairings`
- `DELETE /api/admin/pairings/:id`
- `POST /api/admin/users/cleanup` (retry failed auth-user cleanup by user IDs)
- `GET /api/admin/student-signups?page=1&pageSize=20&status=all` — 报名列表
  - Response: `{ signups: [...], pagination: { page, pageSize, total, totalPages } }`
- `PATCH /api/admin/student-signups/:id/review` — 审核报名（需 CSRF）
  - Body: `{ action: "approve"|"reject", reason?: string }`
  - Response: `{ signup: { id, childName, age, phone, contact, status, rejectReason, createdAt, reviewedAt } }`

### Teacher
- `GET /api/teacher/me/dashboard`
- `PUT /api/teacher/me/lessons/:week`
- `POST /api/teacher/me/lessons/:week/evidence` (`multipart/form-data`, field = `file`)

### Student
- `GET /api/student/me/dashboard`
- `GET /api/student/me/lessons/:week`
- `PUT /api/student/me/feedback/:week`

### Public (无需登录)
- `POST /api/public/student-signups` — 提交报名（限流：5次/15分钟/IP）
  - Body: `{ childName, age, phone, contact? }`
  - Response: `{ signup: { id, status, createdAt } }`

## 6. Notes

- Week range is fixed to `1..20`.
- Accepted upload types: `jpg/png/webp`.
- Max upload size defaults to `5MB`.
- API auth token is stored in an `httpOnly` cookie.
- If `INSTANT_APP_ID` / `INSTANT_ADMIN_TOKEN` are missing in development, server starts in degraded mode and only `GET /api/health` is available.
