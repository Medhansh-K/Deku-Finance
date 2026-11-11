# Backup and restore

One backup covers everything: ledger, users and attached documents all live in Postgres. Keep two things outside it:

- **`DATA_ENCRYPTION_KEY`.** Without it, stored integration credentials can't be read after a restore.
- **`roles.sql`** contains password hashes, so store it as carefully as the dump itself.

## Back up (Docker)

```bash
docker compose exec -T postgres pg_dumpall -U postgres --roles-only > roles.sql
docker compose exec -T postgres pg_dump -U postgres -Fc deku > deku.dump
```

Take one before every upgrade. Copy both files off the machine, or a lost disk takes the backup with it. Nothing schedules this for you locally.

## Restore into an empty database

CI runs these same commands on every push, then confirms that sign-in, the ledger and an attached file survived byte for byte.

```bash
docker compose -p deku-restore up -d postgres
until docker compose -p deku-restore exec -T postgres pg_isready -h 127.0.0.1 -U postgres -d deku; do sleep 2; done
docker compose -p deku-restore exec -T postgres psql -U postgres -d postgres -q < roles.sql
docker compose -p deku-restore exec -T postgres pg_restore -U postgres -d deku --exit-on-error < deku.dump
docker compose -p deku-restore up -d
```

Use the same `.env`, so the secrets match. The `psql` step reports that role `postgres` already exists; that's expected, and it doesn't stop the restore.

Stop the old stack first, since both use the same ports. When you've checked the restored data, `-p deku-restore` is your running deployment. Keep using that project name, or restore into the original project after confirming its old volume is no longer needed.

## Check a restore

1. Sign in as an existing user.
2. Trial Balance: debits equal credits, and the totals match what you expect.
3. Open a voucher with an attachment in Day Book and download it.

## GCP

Cloud SQL backups and restore belong to the deployment owner. See [GCP_SINGLE_ORG_DEPLOYMENT.md](GCP_SINGLE_ORG_DEPLOYMENT.md). They haven't been tested.
