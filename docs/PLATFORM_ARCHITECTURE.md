# Deku Finance: Platform Architecture (self-hosted, GCP)

Decided 31 Oct 2026: **no Supabase**. Postgres on Cloud SQL, login handled by the Rust backend, and open-source PostgREST as an internal data-access container. Everything is containerised and runs on GCP.

```
Browser ──HTTPS──> frontend (Next.js, Cloud Run, public)
                     │  httpOnly cookies: deku_at (access JWT), deku_rt (refresh token)
                     │  /api/auth/*        → login/signup/refresh/logout (sets cookies)
                     │  /api/backend/*     → proxy, adds Authorization: Bearer <deku_at>
                     ▼
                   backend (Rust/Axum, Cloud Run)
                     │  /api/v1/auth/*     → issues/rotates JWTs, bcrypt passwords
                     │  /api/v1/...        → business routes, forward the user's JWT
                     ▼
                   postgrest (PostgREST v12, Cloud Run, internal ingress only)
                     │  verifies JWT (HS256, shared secret), SET ROLE + request.jwt.claims
                     ▼
                   Cloud SQL Postgres 16  ← migrate job (Cloud Run Job) applies supabase/migrations/*.sql
```

## Contract (all components must match exactly)

### JWT
- HS256, secret from env `JWT_SECRET` (at least 32 random bytes, Secret Manager in GCP). The same value is used by the backend (signing), PostgREST (`PGRST_JWT_SECRET`) and the frontend server (middleware verification).
- **Access token** claims: `{ sub: <user uuid>, role: "authenticated", email, aud: "deku", iat, exp: iat + 3600 }`.
- **Service token** (backend-internal only, never leaves the backend): `{ role: "service_role", aud: "deku", iat, exp: iat + 60 }`. Used only to call the `auth_*` functions below.
- PostgREST: `PGRST_JWT_AUD=deku`, `PGRST_DB_ANON_ROLE=anon`, `PGRST_DB_SCHEMAS=public`.
- In SQL, `auth.uid()` = `(current_setting('request.jwt.claims', true)::json->>'sub')::uuid`; `auth.jwt()` = the claims as `jsonb`; `auth.role()` = the `role` claim (default `current_user`). Both fall back to the legacy `request.jwt.claim.sub` / `.role` settings, which SQL tests use to impersonate.

### Database identity layer (migration `20261018000000_platform_auth.sql`, runs before 001)
- Roles: `anon`, `authenticated`, `service_role` (BYPASSRLS where the server allows it; Cloud SQL may not, which is harmless because service_role only calls the SECURITY DEFINER `auth_*` functions), all NOLOGIN; `authenticator` LOGIN NOINHERIT granted the three. The password is set by the migrate job from env `AUTHENTICATOR_PASSWORD`, never in SQL files.
- Schema `auth`:
  - `auth.users` (columns compatible with `supabase/seed.sql`: id, email unique, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, plus legacy columns the seed fills);
  - `auth.identities` (kept for seed compatibility);
  - `auth.refresh_tokens` (id, user_id, token_hash unique, expires_at, revoked_at, created_at).
- Schema `storage`: `buckets` and `objects` (metadata only, needed by migration 008; file bytes go to GCS later).
- Grants: table privileges on `public` for `anon` (none), `authenticated` (SELECT/INSERT/UPDATE/DELETE) and `service_role` (ALL), plus matching `ALTER DEFAULT PRIVILEGES`. RLS policies remain the real gate.
- Functions callable **only by `service_role`** (`REVOKE ... FROM PUBLIC, anon, authenticated`; migration 026 re-revokes after migration 018's `GRANT EXECUTE ON ALL FUNCTIONS`, so no later migration may grant on all functions again):
  - `public.auth_register(p_email text, p_password_hash text, p_meta jsonb) returns uuid`: inserts into auth.users with email lowercased and trimmed, raising exactly `RAISE EXCEPTION 'email_taken'` (PostgREST error body `message`) if it exists. `is_demo` is stripped from `p_meta`; only the seed creates demo users.
  - `public.auth_credentials(p_email text) returns table(id uuid, password_hash text, email text, meta jsonb)`.
  - `public.auth_user(p_id uuid) returns table(id uuid, email text, meta jsonb)`.
  - `public.auth_store_refresh(p_user uuid, p_token_hash text, p_expires timestamptz) returns void`.
  - `public.auth_rotate_refresh(p_old_hash text, p_new_hash text, p_expires timestamptz) returns uuid`: revokes the old token, inserts the new one and returns the user id. It **returns NULL** (never raises) if the old token is unknown, revoked or expired; the backend maps NULL to `401 invalid_refresh`. Reuse of a revoked token revokes all of that user's tokens (raising would roll that back).
  - `public.auth_revoke_refresh(p_token_hash text) returns void`.
- Refresh tokens: 32 random bytes, base64url; only their SHA-256 hex is stored. Lifetime 30 days, rotated on every refresh.
- Passwords: **bcrypt** (cost 12). `$2a$`/`$2b$` hashes from pgcrypto `crypt(.., gen_salt('bf'))` in `seed.sql` verify with the same code.

### Backend auth API (Rust, no JWT required)
| Method & path | Body | Response |
|---|---|---|
| `POST /api/v1/auth/signup` | `{email, password, full_name, business_name?, operating_mode?, state?}` | `200 {access_token, refresh_token, expires_in, user}` · `409 email_taken` · `400` (password at least 10 chars, valid email) |
| `POST /api/v1/auth/login` | `{email, password}` | `200 {access_token, refresh_token, expires_in, user}` · `401 invalid_credentials` (same message for unknown email or wrong password) |
| `POST /api/v1/auth/refresh` | `{refresh_token}` | `200 {access_token, refresh_token, expires_in, user}` · `401 invalid_refresh` |
| `POST /api/v1/auth/logout` | `{refresh_token}` | `204` |
| `GET /api/v1/auth/me` | Bearer access token | `200 {user}` · `401` |

`user` = `{id, email, full_name, is_demo}` from `raw_user_meta_data` (`full_name`, `is_demo`; signup stores `business_name`, `operating_mode` and `state` too).

### Backend → PostgREST
- Env `POSTGREST_URL` (e.g. `http://postgrest:3000`). Paths: `/{table}` and `/rpc/{fn}` (no `/rest/v1` prefix, no `apikey` header).
- Every business request forwards the user's `Authorization: Bearer <access JWT>`; there's no fallback.

### Frontend
- Server env: `BACKEND_URL` (backend base URL) and `JWT_SECRET`. No `NEXT_PUBLIC_SUPABASE_*`.
- Cookies (httpOnly, `SameSite=Lax`, `Secure` in production, `Path=/`):
  - `deku_at`: access JWT, max-age 3600;
  - `deku_rt`: refresh token, max-age 30 days.
- Route handlers:
  - `POST /api/auth/login|signup` call the backend and set both cookies;
  - `POST /api/auth/logout` revokes the refresh token and clears the cookies;
  - `GET /api/auth/me` returns the user.
- `ALL /api/backend/[...path]` forwards to `${BACKEND_URL}/[...path]` with `Authorization: Bearer <deku_at>`. Same-origin, so no CORS and no token in JS.
- Middleware verifies `deku_at` (HS256 via Web Crypto). If it's expired and `deku_rt` exists, it refreshes through the backend and resets the cookies; otherwise it redirects non-public paths to `/login?next=…`.
- The browser `apiClient` base is `/api/backend`; it never reads tokens.

### Containers
| Image | Source | Notes |
|---|---|---|
| `deku-frontend` | `Dockerfile` (repo root) | Next `output: "standalone"`, node:22-alpine, port 3000 |
| `deku-backend` | `backend/Dockerfile` | multi-stage rust → debian bookworm-slim, port 8080 |
| `deku-migrate` | `db/Dockerfile` | postgres:16-alpine + `db/migrate.sh`; applies `supabase/migrations/*.sql` in order (one psql run per file, no single transaction), records them with a SHA-256 in `public.schema_migrations` (RLS on, no policies) and refuses to run if an applied file changed; sets the authenticator password; optional demo seed (`DEKU_SEED_DEMO=true`); ends with `NOTIFY pgrst, 'reload schema'` |
| PostgREST | `postgrest/postgrest:v12.2.3` | configured purely by env |

Local: `docker compose up --build` (postgres, migrate, postgrest, backend, frontend).
GCP: Artifact Registry images, Cloud SQL Postgres 16, Secret Manager (`JWT_SECRET`, `AUTHENTICATOR_PASSWORD`, DB URLs), Cloud Run services (frontend public; backend public, JWT-guarded; postgrest internal ingress), and a Cloud Run Job for migrations. See `deploy/gcp/README.md`.

### Third-party integrations
These are switched off until configured (GSP, KYC, Razorpay). Each has a `*_connections` table and an adapter in Rust behind a config flag, and the UI shows "not connected" honestly.
