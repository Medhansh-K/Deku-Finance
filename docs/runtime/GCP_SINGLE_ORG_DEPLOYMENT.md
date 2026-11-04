# GCP single-organisation deployment

Owner: the developer handling GCP. Procedure: [`deploy/gcp/README.md`](../../deploy/gcp/README.md). **Nothing here has been run on GCP.**

The plan (§16) requires an architecture decision before deploying. The current config assumes Cloud Run, Cloud SQL and Secret Manager. The deployer should confirm or change that.

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
| Restore steps | The README omits redeploying services against a cloned instance |
| No Cloud Run health probes | `/ready` exists and is unused there |
| Secrets use `:latest`, and Artifact Registry isn't immutable | Plan §18 asks for immutable releases |
| README | Has a duplicated line and two conflicting NAT recipes |
| Scheduler | The hourly notifications job is created by hand |
| Documents | Stored in Postgres, so Cloud SQL backups cover them. Size the disk with that in mind |
