# Database and migrations

`db/migrate.sh` applies `supabase/migrations/*.sql` in filename order. The folder name is historical; there's no Supabase at runtime.

## What the runner guarantees

| Behaviour | How |
|---|---|
| Records each file | `public.schema_migrations`, with a SHA-256 |
| Refuses a file changed after it was applied | Compares checksums and stops. Add a new migration instead |
| Stops on the first error, and doesn't record that file | `set -eu`, `ON_ERROR_STOP` |
| Safe to rerun | Applied files are skipped |
| One runner at a time | Advisory lock; a second runner waits, then finds nothing to do |

## A migration that fails partway

Files don't run in one transaction, because migration 016 adds enum values and uses them in the same file. A failed file can therefore leave part of its work behind. It isn't recorded, so the next run tries it again and may fail on what's already there.

Recovery:
1. Stop. Read the error in the `migrate` logs.
2. On a deployment with data, restore the backup taken before the upgrade ([BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md)), fix the migration, and run again. This is the safe default.
3. If restoring isn't possible, undo the partial objects by hand and rerun. Have someone who knows the file do this.

Never edit an applied migration or insert into `schema_migrations` by hand to get past an error.

## Adding a migration

- Name it `YYYYMMDD` followed by the next six-digit number, then a description.
- Every new function: `SET search_path`, and `REVOKE EXECUTE ... FROM PUBLIC, anon`, plus `authenticated` if only the backend calls it. Never `GRANT ... ON ALL FUNCTIONS`.
- Every new table: enable row-level security with policies using `is_org_member` or `has_role`.
- Add a test in `supabase/tests`. `bash supabase/tests/run_local.sh` runs everything, and CI runs the same script.

## Seed modes

| Mode | Setting | Result |
|---|---|---|
| Clean customer | `DEKU_SEED_DEMO=false` (default) | Empty database. The first administrator signs up and creates the company, which starts with its chart of accounts |
| Demo | `DEKU_SEED_DEMO=true` | Adds three demo users with fictional companies and a published password, and turns on the demo sign-in. Local and demonstrations only |

The seed reruns each time `migrate` starts and is written to be repeatable. It aborts if a demo address already belongs to someone else.

## Reference data

`db/import_hsn.sh` loads an official HSN/SAC list; see [HSN_IMPORT.md](../HSN_IMPORT.md). Without it, HSN search returns nothing.
