# Application runtime

One Deku Finance deployment serves one company. Five containers run it.

```
Browser ──> frontend (Next.js) ──> backend (Rust/Axum) ──> PostgREST ──> PostgreSQL
            :3000                  :8080                   :3000 internal  :5432 (host 5433)
                                                                             ▲
                                              migrate (runs once, then exits)┘
```

| Service | Image source | Responsibility | Health | Keeps data |
|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | Books, users, documents | `pg_isready` | Volume `pgdata` |
| `migrate` | `db/Dockerfile` | Applies `supabase/migrations`, sets the PostgREST password, optional demo seed | Exit code | `public.schema_migrations` |
| `postgrest` | `postgrest/postgrest:v12.2.3` | SQL access under the signed-in user's database role | Covered by the backend's `/ready` (the image has no shell) | None |
| `backend` | `backend/Dockerfile` | Auth, business routes, file checks, integrations | `GET /health`, `GET /ready` | None |
| `frontend` | `Dockerfile` | Pages, httpOnly session cookies, same-origin API proxy | `GET /login` | None |

Start order: `postgres` healthy, `migrate` finished, `postgrest`, `backend` healthy, `frontend`.

## Sign-in and sessions

1. The browser posts to `/api/auth/login`. The frontend calls the backend, which checks bcrypt through a service-role function.
2. The backend returns a 1-hour access token and a 30-day refresh token. The frontend stores them in httpOnly cookies; page scripts never see them.
3. Page requests go to `/api/backend/*`, which adds the token. PostgREST sets the database role and row-level security decides what comes back.
4. Middleware refreshes an expired access token. Refresh tokens rotate, and reusing an old one revokes all of that user's sessions. A brief backend outage doesn't sign anyone out.

Membership is enforced in the database. The active company in browser storage is only a display preference.

## Who can get in

- **First account:** only `DEKU_ADMIN_EMAIL`, once. Locally, with it unset, whoever signs up first.
- **Everyone else:** an invitation link from Departments & Members. The address alone isn't enough; signup needs the link's token.
- **One company per deployment:** a second is refused. Demo companies don't count.
- **Plan:** companies are on `single_org`, with no trial, end date or limits. The GO and PRO limit code is kept for a later hosted product.

## Files

Voucher documents live in `public.document_files` in Postgres: PDF, PNG, JPEG or WebP, up to 10 MB, typed from the file's bytes. Members can read them, accounting roles can attach them, and nobody can change or delete them once attached. One database backup covers them.

PDFs of invoices and documents are made by the browser's print function. CSV and Tally imports are parsed in the browser, and only the rows are sent.

## Background work

The only job is `POST /api/v1/internal/notifications/generate` with header `X-Deku-Cron-Secret`. It's safe to repeat. Nothing runs it locally unless you call it; on GCP it needs a Cloud Scheduler job. The app works without it, but notifications won't appear.

## Integrations

Razorpay, GSP (e-invoice, e-way bill, direct filing) and KYC are off until configured, and their routes answer 503. `GSP_PROVIDER=sandbox` and `KYC_PROVIDER=sandbox` give labelled demos that aren't legally valid, and production refuses them. No company data reaches a third party unless a company connects that integration.
