# Environment configuration

Copy `.env.example` to `.env` for local use. Its secret values are for local development only. Generate real values with `openssl rand -hex 32`, or `openssl rand -base64 32` for `DATA_ENCRYPTION_KEY`, and keep them in Secret Manager on GCP.

| Variable | Used by | Required | Secret | If unset | Must match |
|---|---|---|---|---|---|
| `POSTGRES_PASSWORD` | postgres, migrate | Compose default locally | Yes | Dev default | `DATABASE_URL` |
| `DATABASE_URL` | `db/migrate.sh`, `db/import_hsn.sh`, `db/issue_password_reset.sh` | Yes | Yes | Script exits | Database credentials |
| `AUTHENTICATOR_PASSWORD` | migrate, PostgREST URI | Yes | Yes | Dev default in Compose; a new database's role otherwise has no password | `PGRST_DB_URI` |
| `DEKU_SEED_DEMO` | migrate, frontend | No | No | `false` | Both services. Never `true` on a customer deployment |
| `JWT_SECRET` | backend, frontend, PostgREST | Yes, 32+ bytes | Yes | Backend and frontend stop at start | All three |
| `PGRST_DB_URI`, `PGRST_JWT_SECRET` | postgrest | Yes | Yes | Set by Compose or Cloud Build | See above |
| `PGRST_JWT_AUD`, `PGRST_DB_SCHEMAS`, `PGRST_DB_ANON_ROLE` | postgrest | Yes | No | Set by Compose or Cloud Build | `deku`, `public`, `anon` |
| `POSTGREST_URL` | backend | Yes | No | Backend stops | – |
| `BACKEND_URL` | frontend | Yes | No | Frontend stops | – |
| `PORT` | backend | No | No | 8080 | – |
| `DEKU_ENV` | backend | `production` on real deployments | No | Treated as development | – |
| `DEKU_ADMIN_EMAIL` | backend | In production | No | Production: nobody can create the first account. Otherwise: whoever signs up first | – |
| `CRON_SECRET` | backend | For notifications | Yes | Notification job returns 404 | Scheduler header |
| `DATA_ENCRYPTION_KEY` | backend | For integrations | Yes | Integrations off. A malformed value stops the backend | – |
| `RAZORPAY_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI`, `_WEBHOOK_SECRET` | backend | All four or none | Yes, except the URI | Payments return 503 | – |
| `GSP_PROVIDER`, `KYC_PROVIDER` | backend | No | No | Off. An unknown name stops the backend. `sandbox` is refused in production | – |
| `CORS_ALLOWED_ORIGINS` | backend | No | No | No origins allowed, which is correct behind the proxy | – |
| `RUST_LOG` | backend | No | No | `info` in production, `debug` otherwise | – |

## What production refuses

With `DEKU_ENV=production`, the backend won't start if `JWT_SECRET`, `CRON_SECRET` or `DATA_ENCRYPTION_KEY` still has its dev-only value, or if a sandbox provider is selected. The frontend won't start without `JWT_SECRET` and `BACKEND_URL`. CI checks these refusals.

Compose defaults `DEKU_ENV` to `development`, so setting it is part of a real deployment.

## Rotating secrets

| Secret | Effect of changing it |
|---|---|
| `JWT_SECRET` | Everyone is signed out. Update backend, frontend and PostgREST together |
| `AUTHENTICATOR_PASSWORD` | Rerun migrate with the new value, then update `PGRST_DB_URI` and restart PostgREST |
| `CRON_SECRET` | Update the scheduler header at the same time |
| `DATA_ENCRYPTION_KEY` | **Stored Razorpay and GSP or KYC credentials become unreadable.** There's no re-encryption tool, so each company would reconnect. Back this key up separately from the database |
