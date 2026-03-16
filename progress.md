# The Unique Hope — Archived Progress Plan (Legacy Split Stack)

This document is kept as a historical roadmap for the older split frontend/backend prototype and is no longer the active release plan.

Current release status:
- The only supported shipping target is the root Next.js application in this repository.
- `frontend/` and `backend/` remain archived reference directories, not deployment units.
- Active release instructions now live in `README.md` and `DEPLOYMENT.md`.

The archived plan below breaks the old work into several phases to turn the original static/localStorage prototype into a real runnable production website with:
- a backend API,
- a real database,
- secure authentication,
- reliable file uploads,
- and a deployable setup.

It is written to stay compatible with the current product specs in `openspec/` (role-based auth, admin pairings, teacher lessons/notes, student portal/feedback, i18n).

---

## Phase 0 — Baseline & Decisions (1–2 days)

**Goal:** Decide the minimal production architecture and lock the “MVP definition” to avoid scope creep.

**Deliverables**
- Confirm hosting target (recommended: Render/Railway for API + Postgres; static frontend can be served by same server or via CDN)
- Choose database + ORM
  - Recommended: PostgreSQL + Prisma (or Sequelize)
- Choose file storage
  - Recommended: Cloudinary or S3-compatible storage
- Decide auth storage
  - Recommended: httpOnly cookie session with JWT or server sessions

**Acceptance checks**
- One written decision per item (DB/ORM, file storage, auth strategy, hosting)

---

## Phase 1 — Backend Skeleton (API server runnable) (2–4 days)

**Goal:** Stand up a backend you can run locally and deploy.

**Scope**
- Create backend service (Node.js + Express)
- Health endpoint
- Central error handler
- Request logging
- CORS configured for local dev + production
- Environment variable management (`.env.example`)

**Deliverables**
- Backend folder with `package.json`
- `GET /api/health` returns `{ ok: true }`
- Consistent API error format

**Acceptance checks**
- `npm run dev` starts the server
- `curl /api/health` succeeds

---

## Phase 2 — Database & Core Data Model (3–6 days)

**Goal:** Replace localStorage schema with a real database model.

**Data model (minimum)**
- Users
  - `role`: `admin | teacher | student`
  - `username`, `passwordHash`, `name`, `contact?`, `languagePreference?`, `passwordChanged?`
- Pairings
  - `teacherId`, `studentId`, optional schedule/timeSlots
- Lessons
  - `teacherId`, `weekNumber`, `status`, `evidenceUrl?`, `notesText?`, `notesVisibility`, `submittedAt?`
- Feedback
  - `studentId`, `weekNumber`, `text`, `rating?`, `visibility`, `timestamp`

**Deliverables**
- Migrations created and runnable
- Seed script for demo accounts + sample pairing

**Acceptance checks**
- DB migrates cleanly from empty state
- Seed creates at least 1 admin, 1 teacher, 1 student, 1 pairing

---

## Phase 3 — Authentication & Authorization (role-based) (3–6 days)

**Goal:** Implement the “real” version of the existing login flows.

**API endpoints (minimum)**
- `POST /api/auth/login` (role-aware login)
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

**Authorization rules**
- Admin-only: manage pairings, create users, export progress
- Teacher-only: update own lessons + notes, view assigned student, see shared feedback
- Student-only: view own progress + evidence, submit feedback, change password

**Deliverables**
- Password hashing (bcrypt)
- Auth middleware
- Role guards

**Acceptance checks**
- Teacher cannot access admin endpoints
- Student cannot modify teacher lessons
- Admin can manage pairings

---

## Phase 4 — Lesson Evidence Uploads (images) (2–5 days)

**Goal:** Replace base64-in-localStorage with real upload storage.

**Approach (recommended)**
- Upload image file from `teacher.html`
- Server stores it (Cloudinary/S3) and saves `evidenceUrl` in DB

**API endpoints (minimum)**
- `POST /api/teachers/me/lessons/:week/evidence` (multipart form upload)
- `PUT /api/teachers/me/lessons/:week` (status + notes)
- `GET /api/students/me/lessons/:week` (evidence URL + shared notes)

**Acceptance checks**
- Upload works locally and on deployed environment
- Student can view image via URL for taught weeks

---

## Phase 5 — Frontend Integration (replace localStorage with API) (4–8 days)

**Goal:** Keep current pages/UI but make them use the backend.

**Work items**
- Add a small `js/api.js` client wrapper (`fetch` + error handling)
- Update `login.html`
  - Call `POST /api/auth/login`
  - Redirect based on role (`teacher.html`, `student.html`, `admin.html`)
- Update `admin.html`
  - Pairings list from API
  - Create pairing calls API
  - Delete pairing calls API
  - Progress view from API
- Update `teacher.html`
  - Load teacher context from `/api/auth/me`
  - Load assigned student + lessons
  - Save lesson status + notes via API
  - Upload evidence via API
- Update `student.html`
  - Load student context from `/api/auth/me`
  - Load teacher/evidence/notes via API
  - Submit feedback with visibility via API
  - Change password via API

**Acceptance checks**
- Full flow works without localStorage dependency
- Data persists across browsers/devices

---

## Phase 6 — i18n (keep current design, ensure persistence) (1–3 days)

**Goal:** Keep the existing bilingual support and ensure preference persists.

**Work items**
- Keep `js/i18n.js` (already implemented)
- Ensure each page includes it and calls `I18nUtils.applyTranslations()` on load
- Decide where language preference lives
  - Option A: client-only localStorage (fast, simplest)
  - Option B: persist to server user profile (best UX across devices)

**Acceptance checks**
- Language toggle present on every page
- Preference persists after refresh and navigation

---

## Phase 7 — Security Hardening (2–5 days)

**Goal:** Make it safe enough for real users.

**Required items**
- httpOnly cookies (or secure token storage)
- CSRF strategy (if cookie-based auth)
- Input validation and sanitization
- Rate limiting on login
- Proper CORS allowlist
- Disable verbose error leakage in production

**Acceptance checks**
- Basic OWASP concerns addressed (XSS, auth, brute force)

---

## Phase 8 — Testing & QA (2–6 days)

**Goal:** Prevent regressions and verify specs.

**Minimum tests**
- API integration tests for login and role guards
- Admin pairing creation + duplicate username handling
- Teacher: upload evidence + set lesson status + shared notes
- Student: view evidence + submit shared feedback
- i18n toggle sanity checks (smoke)

**Acceptance checks**
- A short checklist run passes all scenarios from specs:
  - `openspec/changes/add-student-portal/specs/*/spec.md`

---

## Phase 9 — Deployment & Operations (2–6 days)

**Goal:** Deploy and keep it maintainable.

**Deliverables**
- Production build and deploy instructions
- DB migrations in CI/CD
- Logging + monitoring basics
- Backups (DB)

**Acceptance checks**
- Live URL works end-to-end
- Admin can create accounts and real users can login

---

## Phase 10 — Optional “Extras” (post-MVP)

Only after Phases 1–9 are stable.

**High-value extras**
- Admin: reset password flows
- Audit log (who changed what)
- CSV export improvements
- Better evidence management (multiple uploads per week)
- Email notifications (pairing created, password reset)

---

## Definition of Done (Project)

A build is considered done when:
- The site works end-to-end using API + DB (no localStorage dependency for core data)
- Role-based login works (Teacher/Student/Admin)
- Teacher can upload evidence, set status, add notes with visibility
- Student can view evidence + shared notes and submit feedback with visibility
- Admin can create pairings with student credentials and view progress
- i18n works across all pages with persistent preference
- Deployed environment is stable and secure enough for real users
