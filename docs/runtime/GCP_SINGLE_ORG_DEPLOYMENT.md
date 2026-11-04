# GCP single-organisation deployment

Owner: the developer handling GCP. Procedure: [`deploy/gcp/README.md`](../../deploy/gcp/README.md). **Nothing here has been run on GCP.**

## Architecture decision (proposed; the deployer confirms it before deploying)

**Recommendation: Cloud Run, Cloud SQL and Secret Manager, as `deploy/gcp` is already written.**

| Need | Cloud Run + Cloud SQL | VM with Docker Compose |
|---|---|---|
| Same images as local | Yes | Yes, and the same startup too |
| Backups and restore | Managed, with point-in-time recovery | You build and monitor them |
| Patching and restarts | Managed | You run them |
| Cost for one customer | Higher: always-on database plus services | Lower: one VM |
| Connections and pooling | PostgREST pools; backend is stateless | Same |
| Documents | In Postgres, so no bucket either way | Same |
| Background job | Needs Cloud Scheduler | Needs cron |

There's no streaming or WebSocket need, and no state outside Postgres. The VM is the fallback if cost matters more than managed backups. Costs haven't been estimated.

## Must be set for a customer

| Setting | Why |
|---|---|
| `_ADMIN_EMAIL` substitution | Without it, nobody can create the first account |
| `DEKU_ENV=production` | Set by `cloudbuild.yaml`. Refuses dev secrets and sandbox providers |
| `DEKU_SEED_DEMO=false` | Set for the migrate job. Don't set it to true on the frontend either |

## Changed since the audit

- Fixed a literal `\n` in the backend deploy step, which dropped `POSTGREST_URL` and `DEKU_ENV`.
- The frontend runs with `--max-instances=1`. Refresh de-duplication is per process, so parallel refreshes across instances could revoke a user's sessions.
- The backend's request limit rose to about 10 MB for uploads. Cloud Run's 32 MB limit doesn't get in the way.

## Known gaps to close

| Gap | Note |
|---|---|
| Cloud SQL is created without a private IP | `--no-assign-ip` and networking still to add. Access is via the connector and password |
| Backend is public | Needed for the Razorpay webhook. Login has a per-address lockout, but no IP rate limit |
| No Cloud Run health probes | `/ready` exists and is unused there |
| Secrets use `:latest` | Plan §18 asks for immutable releases. Pin versions at release time |
| Scheduler | The hourly notifications job is created by hand |
| Documents | Stored in Postgres, so Cloud SQL backups cover them. Size the disk with that in mind |
