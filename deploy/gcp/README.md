# Deploying Deku Finance on GCP

Cloud SQL (Postgres 16) + Cloud Run: `deku-frontend` (public), `deku-backend` (public, JWT-guarded),
`deku-postgrest` (internal ingress) and the `deku-migrate` Cloud Run Job. Architecture and contract:
[`docs/PLATFORM_ARCHITECTURE.md`](../../docs/PLATFORM_ARCHITECTURE.md).

Every command below is run once per project, except §8 (each release).

```bash
PROJECT_ID=your-project-id
REGION=asia-south1
REPO=deku
INSTANCE=deku-pg
CONN="$PROJECT_ID:$REGION:$INSTANCE"   # Cloud SQL instance connection name
gcloud config set project "$PROJECT_ID"
```

## 1. APIs and Artifact Registry

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com compute.googleapis.com \
  cloudscheduler.googleapis.com

gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION"
```

## 2. Cloud SQL

```bash
gcloud sql instances create "$INSTANCE" --database-version=POSTGRES_16 --edition=ENTERPRISE \
  --tier=db-custom-1-3840 --region="$REGION" \
  --backup-start-time=20:30 --enable-point-in-time-recovery
gcloud sql databases create deku --instance="$INSTANCE"

# The migrator owns the schema. Users created this way get cloudsqlsuperuser (CREATEROLE),
# which migration 000 needs to create anon/authenticated/service_role/authenticator.
MIGRATOR_PASSWORD=$(openssl rand -hex 24)
gcloud sql users create deku_migrator --instance="$INSTANCE" --password="$MIGRATOR_PASSWORD"
```

Cloud SQL may refuse `BYPASSRLS`; migration 000 then creates `service_role` without it and prints a
warning. That is fine: `service_role` only calls the `SECURITY DEFINER` `auth_*` functions.

Don't enable `log_statement=ddl` or `all` on the instance: the migrate job's `ALTER ROLE ... PASSWORD`
would be written to the logs.

## 3. Secrets

Hex passwords need no escaping inside URIs (otherwise percent-encode them).

```bash
JWT_SECRET=$(openssl rand -hex 32)
AUTHENTICATOR_PASSWORD=$(openssl rand -hex 24)
CRON_SECRET=$(openssl rand -hex 32)

printf %s "$JWT_SECRET" | gcloud secrets create JWT_SECRET --data-file=-
printf %s "$AUTHENTICATOR_PASSWORD" | gcloud secrets create AUTHENTICATOR_PASSWORD --data-file=-
printf %s "$CRON_SECRET" | gcloud secrets create CRON_SECRET --data-file=-
printf %s "postgresql://deku_migrator:$MIGRATOR_PASSWORD@/deku?host=/cloudsql/$CONN" \
  | gcloud secrets create MIGRATE_DATABASE_URL --data-file=-
printf %s "postgres://authenticator:$AUTHENTICATOR_PASSWORD@/deku?host=/cloudsql/$CONN" \
  | gcloud secrets create PGRST_DB_URI --data-file=-
```

### Cloud SQL socket URIs

With `--set-cloudsql-instances`, Cloud Run mounts the instance's Unix socket at
`/cloudsql/PROJECT:REGION:INSTANCE/.s.PGSQL.5432`. libpq (psql in the migrate job) and PostgREST
(libpq underneath) take the URI form; psql also takes key/value:

- URI: `postgresql://USER:PASSWORD@/DBNAME?host=/cloudsql/PROJECT:REGION:INSTANCE` (empty host part;
  the directory goes in the `host` query parameter);
- key/value: `host=/cloudsql/PROJECT:REGION:INSTANCE dbname=deku user=USER password=PASSWORD`. The secrets above use URIs for both.

No IP allow-listing or SSL settings are needed: the Cloud SQL connector encrypts and authorises the
connection with the service account's `roles/cloudsql.client`.

## 4. Service accounts (least privilege)

```bash
for sa in deku-migrate deku-postgrest deku-backend deku-frontend deku-build; do
  gcloud iam service-accounts create "$sa"
done
sa() { echo "serviceAccount:$1@$PROJECT_ID.iam.gserviceaccount.com"; }

# Only the two services that open database connections get Cloud SQL Client.
for s in deku-migrate deku-postgrest; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="$(sa $s)" --role=roles/cloudsql.client
done

# Each runtime reads only the secrets it uses.
grant() { gcloud secrets add-iam-policy-binding "$1" --member="$(sa "$2")" --role=roles/secretmanager.secretAccessor; }
grant MIGRATE_DATABASE_URL deku-migrate
grant AUTHENTICATOR_PASSWORD deku-migrate
grant PGRST_DB_URI deku-postgrest
grant JWT_SECRET deku-postgrest
grant JWT_SECRET deku-backend
grant CRON_SECRET deku-backend
grant JWT_SECRET deku-frontend

# Cloud Build: push images, deploy Cloud Run, act as the runtime accounts, write logs.
for r in roles/artifactregistry.writer roles/run.admin roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="$(sa deku-build)" --role="$r"
done
for s in deku-migrate deku-postgrest deku-backend deku-frontend; do
  gcloud iam service-accounts add-iam-policy-binding "$s@$PROJECT_ID.iam.gserviceaccount.com" \
    --member="$(sa deku-build)" --role=roles/iam.serviceAccountUser
done
```

## 5. Network for backend → PostgREST

`deku-postgrest` has internal ingress, so only traffic from the project's VPC reaches it. The backend
uses Direct VPC egress with `--vpc-egress=all-traffic`; Private Google Access on the subnet lets that
traffic reach the `*.run.app` URL privately.

```bash
gcloud compute networks subnets update default --region="$REGION" --enable-private-ip-google-access
```

With `all-traffic` the backend has no direct internet egress. Add Cloud NAT on `default` when an
integration (GSP, KYC, Razorpay) needs to call out: provider calls fail with a 502 until it exists.
GSPs usually allow-list caller IPs, so reserve a static address and give it to the provider:

```bash
gcloud compute addresses create deku-nat-ip --region="$REGION"
gcloud compute routers create deku-router --network=default --region="$REGION"
gcloud compute routers nats create deku-nat --router=deku-router --region="$REGION"   --nat-all-subnet-ip-ranges --nat-external-ip-pool=deku-nat-ip
```

Integrations stay off until configured (docs/INTEGRATIONS.md). The backend runs with `DEKU_ENV=production`,
which refuses `GSP_PROVIDER=sandbox` / `KYC_PROVIDER=sandbox` at startup. Storing GSP credentials also
needs `DATA_ENCRYPTION_KEY` from Secret Manager (`--set-secrets=...,DATA_ENCRYPTION_KEY=DATA_ENCRYPTION_KEY:latest`).

## 6. Cloud Run Job and services

`deploy/gcp/cloudbuild.yaml` holds the exact create-or-update commands, so the first release creates
everything and later releases update it:

- `gcloud run jobs deploy deku-migrate --set-cloudsql-instances=$CONN` with secrets `DATABASE_URL` and
  `AUTHENTICATOR_PASSWORD`, `DEKU_SEED_DEMO=false`, executed with `--execute-now --wait`;
- `gcloud run deploy deku-postgrest --ingress=internal --set-cloudsql-instances=$CONN` (image
  `postgrest/postgrest:v12.2.3`, `PGRST_DB_URI`/`PGRST_JWT_SECRET` from secrets, `PGRST_DB_SCHEMAS=public`,
  `PGRST_DB_ANON_ROLE=anon`, `PGRST_JWT_AUD=deku`, port 3000);
- `gcloud run deploy deku-backend --network=default --subnet=default --vpc-egress=all-traffic` with
  `POSTGREST_URL` = postgrest's `status.url`, and `JWT_SECRET` and `CRON_SECRET` from Secret Manager;
- `gcloud run deploy deku-frontend` with `BACKEND_URL` = backend's `status.url` and `JWT_SECRET`.

```bash
gcloud builds submit --config deploy/gcp/cloudbuild.yaml \
  --service-account="projects/$PROJECT_ID/serviceAccounts/deku-build@$PROJECT_ID.iam.gserviceaccount.com" \
  --substitutions=_REGION="$REGION",_REPO="$REPO",_INSTANCE="$INSTANCE"
```

To load the demo sandbox once (never on a tenant database you don't want demo accounts in):

```bash
gcloud run jobs execute deku-migrate --region="$REGION" --update-env-vars=DEKU_SEED_DEMO=true --wait
```

If an org policy blocks `allUsers` (domain-restricted sharing), `--allow-unauthenticated` fails; ask
for an exception for these services.

## 7. Custom domain

Put a global external Application Load Balancer with a serverless NEG in front of `deku-frontend`
(Cloud Run domain mappings are in preview and not available in every region):

```bash
gcloud compute network-endpoint-groups create deku-frontend-neg --region="$REGION" \
  --network-endpoint-type=serverless --cloud-run-service=deku-frontend
```

Then create the backend service, URL map, Google-managed certificate and HTTPS proxy, and point the
domain's A record at the LB address. Afterwards set `--ingress=internal-and-cloud-load-balancing` on
`deku-frontend`. Only the frontend needs the domain: the browser never talks to the backend directly.

## 8. Each release

Run the `gcloud builds submit` command from §6 (or attach `cloudbuild.yaml` to a trigger on `main`).
It builds and pushes the three images tagged with `$BUILD_ID`, runs the migrate job, and only deploys
the services if every pending migration succeeded. `db/migrate.sh` applies only files missing from
`public.schema_migrations` and stops if an applied file was edited, so fixes go in a new migration.
It ends with `NOTIFY pgrst, 'reload schema'` so running PostgREST instances see new tables.

Migrations run while the previous revision still serves traffic, so keep them backward compatible
(add first, remove in a later release).

## 9. Rollback

- Code: send traffic back to the previous revision.
  ```bash
  gcloud run revisions list --service=deku-backend --region="$REGION"
  gcloud run services update-traffic deku-backend --region="$REGION" --to-revisions=REVISION=100
  ```
  Same for `deku-frontend`.
- Schema: migrations are forward-only. Write a new migration that undoes the change. For data loss,
  restore with point-in-time recovery into a new instance and switch the secrets' URIs:
  ```bash
  gcloud sql instances clone "$INSTANCE" deku-pg-restore --point-in-time=2026-11-01T10:00:00Z
  ```

## 10. Scheduled notifications

`POST /api/v1/internal/notifications/generate` on `deku-backend` runs `generate_notifications()` (GST
due dates from `public.compliance_calendar`, overdue invoices, vouchers waiting over 24 hours for
approval, fiscal periods ending within 7 days). It is idempotent, so hourly runs and retries are safe.
It only answers when the `X-Deku-Cron-Secret` header matches `CRON_SECRET` (§3); without that env it
returns 404. Cloud Scheduler calls it hourly:

```bash
BACKEND_URL=$(gcloud run services describe deku-backend --region="$REGION" --format='value(status.url)')
gcloud scheduler jobs create http deku-notifications --location="$REGION" \
  --schedule="0 * * * *" --time-zone="Asia/Kolkata" \
  --uri="$BACKEND_URL/api/v1/internal/notifications/generate" --http-method=POST \
  --headers="X-Deku-Cron-Secret=$(gcloud secrets versions access latest --secret=CRON_SECRET)" \
  --attempt-deadline=120s --max-retry-attempts=2
```

Cloud Scheduler can't read Secret Manager at run time, so the header value is copied into the job when
it is created. After rotating `CRON_SECRET`, redeploy the backend (§8) and update the job with the same
`--headers` flag via `gcloud scheduler jobs update http deku-notifications`. Run it once by hand with
`gcloud scheduler jobs run deku-notifications --location="$REGION"`.

The GST due days in `compliance_calendar` (GSTR-1 on the 11th, GSTR-3B on the 20th, monthly filers)
are data: check them against the current CBIC notifications and change them with a migration.
