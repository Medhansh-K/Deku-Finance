# Release and rollback

## Before a release

CI on the commit must be green: `frontend`, `backend`, `sql` and `docker`. The `docker` job runs the full stack, data persistence, backup and restore, demo mode and the startup refusals.

## Local update

```bash
# Back up first: see BACKUP_AND_RESTORE.md
git pull
docker compose up --build -d
docker compose ps -a
```

`migrate` applies only new files. Confirm that it exited 0 and sign in.

## Rollback

**Application only (no new migrations in the release):** check out the previous commit and run `docker compose up --build -d`.

**With new migrations:** migrations only move forward, and the runner has no "down" step. An older app may not work against a newer schema. Restore the backup taken before the upgrade, then run the previous commit. Anything entered since that backup is lost, so tell users first.

## Versions and images

Compose builds images locally and pins PostgreSQL to `16-alpine` and PostgREST to `v12.2.3`. Keep PostgREST the same in `docker-compose.yml` and `deploy/gcp/cloudbuild.yaml`.

Not done yet (checklist C-05): version tags on local images, image size records, SBOM and vulnerability scan.

## GCP

`deploy/gcp/cloudbuild.yaml` tags images with the build ID, runs the migration job, then deploys. Rollback steps are in `deploy/gcp/README.md`. Not yet executed; see [GCP_DEPLOYMENT_TEST_REPORT.md](GCP_DEPLOYMENT_TEST_REPORT.md).
