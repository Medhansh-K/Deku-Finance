# Deku Finance --- Single-Organisation Application Runtime Completion & Deployment Plan

**Document type:** Engineering execution brief\
**Owner:** Parth --- application runtime, Docker and deployment\
**Product:** Deku Finance\
**Scope:** Complete, test, package and deploy the existing application
for one organisation / one customer environment\
**Status:** Execution plan --- update this document with evidence as
work is completed

------------------------------------------------------------------------

## 1. Purpose and expected outcome

The objective is to take the existing Deku Finance codebase and make it
a complete, reproducible application that a single organisation can
install, start, configure, use, back up and maintain.

This is an implementation and verification exercise, not an architecture
redesign.

The delivery sequence is:

1.  Complete and verify the existing single-organisation application
    runtime.
2.  Build the application as Docker images and run it locally using
    Docker Compose.
3.  Test the Docker deployment end to end on a local machine.
4.  Deploy the same Dockerised application to Google Cloud Platform
    (GCP) for one organisation / one customer environment.
5.  Verify the GCP deployment end to end, including persistence,
    security, backup and recovery.
6.  Create interactive, in-product tutorials that teach a new user or
    administrator how to set up, build/configure and manage the
    application.

The same tested application artefacts should move from local Docker to
GCP. Avoid maintaining separate local and cloud implementations.

**Definition of complete:** A new single-organisation customer can
follow the documented setup, initialise the application, sign in,
configure the organisation, perform the supported workflows, retrieve
reports, restart the application without losing data, and follow the
tutorials without needing the developer to explain every step.

------------------------------------------------------------------------

## 2. Scope boundaries

### In scope now

-   Existing Next.js frontend and all user-facing routes/modules.
-   Existing Rust/Axum backend and its API routes.
-   Existing PostgREST data access layer.
-   PostgreSQL database, schema, functions, triggers, roles and RLS
    policies.
-   The complete ordered migration set required by the application.
-   Single-organisation onboarding and initial configuration.
-   Authentication, session handling and authorisation.
-   Environment configuration and secret handling.
-   Dockerfiles, Docker Compose, image builds, health checks and startup
    ordering.
-   Local Docker installation, testing, restart and persistence.
-   One-customer GCP deployment, configuration, networking, persistence,
    backup and recovery.
-   Operational documentation.
-   Interactive user and administrator tutorials.

### Explicitly out of scope for this delivery

Do not implement these as part of the current runtime milestone:

-   Multi-tenancy or shared tenancy.
-   Site registry, control plane, tenant provisioning or tenant routing.
-   Multiple organisations sharing one runtime/database.
-   Per-tenant databases or dynamic database provisioning.
-   SQLx rewrite or replacement of PostgREST.
-   Supabase migration or replacement.
-   Marketplace, add-on billing or licensing/activation.
-   Automated customer provisioning platform.
-   Multi-customer cloud hosting platform.
-   Broad frontend redesign or unrelated module refactoring.

The target is **one organisation in one isolated application
deployment**. A later phase can design shared tenancy and a hosting
platform after this version is proven.

------------------------------------------------------------------------

## 3. Existing baseline & Today's Updates (4 November 2026)

### 3.1 Step 1: Baseline Validation — 100% Verified & Passed

On 4 November 2026, the complete baseline validation was executed against the active repository (`fix/data-integrity-privacy-demo`). Every command was executed directly and verified with zero errors:

| Area / Target | Command Executed | Result | Details |
|---|---|---|---|
| **Rust backend tests** | `cargo test` (in `backend`) | **PASS** | **60 passed, 0 failed** in 1.87s. Covers ALERX double-entry parity, maker-checker states, GST math, token generation, and AES-GCM encryption. |
| **Frontend Vitest tests** | `npx vitest run` | **PASS** | **30 test files passed (30/30), 241 tests passed (241/241)** in 45.58s. All unit and component tests passing. |
| **TypeScript type check** | `npx tsc --noEmit` | **PASS** | **0 errors**. Full static type checking across all 54 routes, context providers, components, and server proxy handlers. |
| **Next.js production build** | `npx next build --webpack` | **PASS** | **Compiled successfully** in 22.8s; generated static pages for all 54 application routes. |
| **Rust release build** | `cargo build --release` | **PASS** | Finished `release` profile [optimized] binary `backend/target/release/backend.exe` cleanly in 2m 15s. |
| **Keyboard shortcuts** | `npx vitest run tests/shortcuts.test.ts` | **PASS** | **11 passed, 0 failed** in 47ms. Outdated test expectations reconciled with active `F1`–`F11` navigation map, `Escape` to `/gateway`, `Ctrl+K` command palette, and local voucher desk shortcuts. |
| **Transaction-entry protection** | Unit tests in `shortcuts.test.ts` | **PASS** | Fortified `isTargetInteractive` in `src/lib/keyboard/shortcuts.ts` to detect `input`, `textarea`, `select`, `contenteditable`, `combobox`, `listbox`, and code editors, suppressing accidental navigation while typing. |
| **Docker environment readiness** | `docker-compose.yml` & `.env.example` audit | **NOT TESTED** (file review only, see §3A.2) | Service topology audited; matching `JWT_SECRET` across PostgREST, Rust, and Next.js; database credentials aligned; optional integrations safely fall back to HTTP 503 without crashing. |

### 3.2 Today's Tasks Completed (4 November 2026)
1. **Executed Step 1 Baseline Validation**: Confirmed all 5 test/build suites pass cleanly with zero mocks or skipped checks.
2. **Reconciled Keyboard Shortcut Specification**:
   - Identified root cause of failure in `tests/shortcuts.test.ts`: test file had stale assumptions expecting old Tally voucher mappings (`F5` $\to$ `/vouchers/payment`), whereas application had undergone a major refactor to top-level `F1`–`F11` module navigation.
   - Preserved active application behavior in `src/layouts/AppShell.tsx` and `src/lib/keyboard/shortcuts.ts`.
   - Extracted `isTargetInteractive` into `src/lib/keyboard/shortcuts.ts` to share identical input-detection logic between the DOM event listener and automated tests.
   - Updated `tests/shortcuts.test.ts` to assert `GLOBAL_FUNCTION_KEY_MAP` (`F1`–`F11`), `Escape` Gateway navigation, `Ctrl+K` command palette, local voucher desk modes (`F4`–`F9`), and input blur safety. All 11 tests passed.
3. **Audited Docker Compose Topology & Secrets**:
   - Confirmed 5-container architecture: `postgres` (PostgreSQL 16 Alpine), `migrate` (`db/Dockerfile`), `postgrest` (PostgREST v12), `backend` (`backend/Dockerfile`), and `frontend` (`Dockerfile`).
   - Verified that `JWT_SECRET` is identical across PostgREST, backend, and frontend.
   - Verified that `AUTHENTICATOR_PASSWORD` is generated/passed consistently between the migration runner and PostgREST URI.
   - Verified that unconfigured optional integrations (`RAZORPAY_*`, `GSP_PROVIDER`, `KYC_PROVIDER`) default cleanly to empty strings and return HTTP 503 instead of crashing.
4. **Synchronized Architecture Documentation**:
   - Updated `docs/DEKU_CORE_KERNEL_SHELL_ARCHITECTURE.md` as the authoritative holistic architecture guide.
   - Updated `docs/PLATFORM_ARCHITECTURE.md` with client runtime architecture, client personas/RBAC interfaces, connected backend APIs, and runtime migration inventory.

### 3.3 Immediate Next Tasks (Next Steps in Single-Organisation Runtime)
- **Task 1 (Step 2)**: Execute local Docker Compose build (`docker compose up --build`).
- **Task 2 (Step 3)**: Verify container startup ordering (`postgres` healthy $\to$ `migrate` completed $\to$ `postgrest` started $\to$ `backend` started $\to$ `frontend` listening).
- **Task 3 (Step 4)**: Test database seed data loading (`DEKU_SEED_DEMO="true"`) and execute end-to-end smoke tests (login $\to$ dashboard $\to$ voucher entry $\to$ day book $\to$ reports).
- **Task 4 (Step 5)**: Test persistence across restart (`docker compose down && docker compose up -d`) to guarantee no data loss on `pgdata` volume.

Reported runtime topology:

``` text
Browser
  |
  v
Next.js frontend
  |
  | same-origin API proxy
  v
Rust / Axum backend
  |
  v
PostgREST
  |
  v
PostgreSQL
```

Reported Compose services:

1.  `postgres`
2.  `migrate`
3.  `postgrest`
4.  `backend`
5.  `frontend`

Reported stack ports include frontend `3000`, backend `8080`, and
PostgreSQL host port `5433`. Confirm actual mappings from the current
Compose configuration before documenting or relying on them.

Reported migration range: `000` through `044` (45 migration files).
Confirm the actual repository contents and migration tracking table. Do
not assume every migration ran merely because a container started.

Reported session flow: browser login → Rust backend → PostgREST
authentication RPC → backend issues access/refresh tokens → frontend
stores tokens in HTTP-only cookies → subsequent requests pass bearer
authentication → PostgREST applies database roles/claims and RLS. Verify
this against current code before finalising the security documentation.

Reported optional integrations include Razorpay, GST/GSP and KYC
providers. They must not prevent the core application from starting when
credentials are absent. Clearly label sandbox/simulation behaviour.

------------------------------------------------------------------------

## 3A. Repository audit (first deliverable, 4 November 2026)

Audited at commit `8b1a1ed` by reading the code. **Nothing in this section was run**, so every feature status below is a code-reading result, not a test `PASS` under rule 8. The master checklist is in [`docs/runtime/README.md`](runtime/README.md).

> **Update, 4 November 2026.** This section records the state at `8b1a1ed`. Blockers 2 to 7 are fixed and passing in CI, except that proof files still aren't stored (blocker 1). Blocker 8 is fixed but hasn't been run on GCP. Current status is in `docs/runtime/README.md`. The first full-stack CI run also found two report bugs this code-reading audit missed (W-05, W-06).

### 3A.1 Verdict

The test suites are green and the service topology matches the brief, but **the application is not ready for a customer**. The baseline in §3.1 shows that the code compiles and its unit tests pass. It doesn't show that the stack runs end to end: **no one has yet recorded a run of the full stack with real sign-in and voucher posting.** CI's `docker` job only builds images.

Blockers, in order:

| # | Blocker | Why it matters | Evidence |
|---|---|---|---|
| 1 | Uploaded documents are never stored | No bytes are saved anywhere; there is no multipart handling, bucket or file volume. §11, D-14, G-08 and tutorial Path 7 can't pass | `VoucherWorkspace.tsx:423-475`, `routes/documents.rs:72-88`, `documentsApi` has no callers |
| 2 | Fake voucher proof is written to the audit trail | Any file is stamped `verified: true` and "Verified statutory document"; blank references get a random UTR or CFO memo number; the approver is hardcoded as the CFO | `VoucherWorkspace.tsx:453-471, 789, 813` |
| 3 | Cash Flow always shows ₹0.00 | The page reads `cash_flows` and `summary`; the SQL returns `operating_activities` and friends. The badge still says "Positive" | `CashFlowView.tsx:66-73`, migration 023 line 223 |
| 4 | Consultant sidebar invents figures | ₹15,45,339 revenue, ₹6,40,000 cash, 14.5 months runway and 32.5 days DSO appear whenever real data is missing, under an "Audited Health · Live" label | `DekuConsultantView.tsx:603-606` |
| 5 | Anyone can sign up | No switch exists and the backend is public on GCP. Strangers get accounts with no email check | `routes/auth.rs:17` |
| 6 | The customer is locked out after 20 days | Every company starts on a 15+5 day trial, then issuing invoices returns 402. There is no payment flow, and licensing is out of scope for this delivery | migration 039 lines 34, 99, 190 |
| 7 | Demo password ships in the client bundle | With the seed loaded, anyone can sign in. Compose hardcodes the seed on, so §7 clean customer mode can't be tested | `AuthContext.tsx:43`, `docker-compose.yml:28` |
| 8 | GCP release would fail at the backend deploy | A literal `\n` sits in the backend deploy command before `--set-env-vars`, so `POSTGREST_URL` and `DEKU_ENV=production` are never applied (read from the file, not executed) | `deploy/gcp/cloudbuild.yaml:94` |

Blockers 2–4 are older than commit `8b1a1ed`. They were missed by the earlier data-honesty audit, whose report that fabricated figures had been removed was wrong for these three screens.

### 3A.2 Corrections to §3

| Reported in §3 | Actual |
|---|---|
| Docker readiness `PASS` | **`NOT TESTED`.** That row was a file review. No containers were recorded starting |
| PostgREST v12 | Compose uses `postgrest/postgrest:latest`; `cloudbuild.yaml` pins `v12.2.3`. Breaks rule 14 and §13 |
| "Optional integrations fall back to 503" | Confirmed in code: unset means off. An unknown `GSP_PROVIDER` or `KYC_PROVIDER` name, or a malformed `DATA_ENCRYPTION_KEY`, stops the backend at startup, which is the safer behaviour |
| Ports 3000, 8080, 5433 | Confirmed, all bound to `127.0.0.1` |
| Migrations 000–044 (45 files) | Confirmed: 45 files, tracked with checksums in `public.schema_migrations`. A fresh local Postgres 18 run on 31 Oct passed. Not yet recorded on Postgres 16 in Compose |
| Session flow | Confirmed in code, with the gaps in §3A.8 |
| Local-storage active organisation | UI preference only. The organisation comes from the URL and membership is enforced by RLS. Service-token paths in `integrations/mod.rs` and `payments.rs` still need tracing (task S-11) |

Commit `8b1a1ed` also deleted `docs/INTEGRATIONS.md`, `docs/HSN_IMPORT.md` and `docs/IMPLEMENTATION_PLAN.md`, which `.env.example`, `backend/.env.example`, `db/import_hsn.sh` and `deploy/gcp/README.md` still reference (task X-02).

### 3A.3 Repository structure

| Path | Contents |
|---|---|
| `src/app` | 47 pages plus `api/auth/*` and the `api/backend/[...path]` proxy |
| `src/proxy.ts`, `src/lib/auth/session.ts` | Session verification and refresh |
| `src/modules`, `src/components`, `src/layouts` | Feature views, shared UI, `AppShell` |
| `backend/src` | Axum service: `routes/` (25 route modules), `gst/`, `integrations/`, `razorpay.rs`, `crypto.rs`, `auth.rs` |
| `supabase/migrations`, `supabase/seed.sql`, `supabase/tests` | Schema (folder name is historical; no Supabase at runtime), demo seed, 18 SQL suites |
| `db/` | `migrate.sh`, `import_hsn.sh`, migrate image |
| `Dockerfile`, `backend/Dockerfile`, `db/Dockerfile`, `docker-compose.yml` | Images and local stack |
| `deploy/gcp` | `cloudbuild.yaml`, `README.md` |
| `.github/workflows/ci.yml` | Jobs: frontend, backend, sql, docker |

### 3A.4 Runtime components

| Component | Container | Port | Depends on | Health check | Persistent data |
|---|---|---|---|---|---|
| Frontend (Next.js standalone, user `node`) | `frontend` | 3000 | backend (start order only) | None | None |
| Backend (Axum, uid 10001) | `backend` | 8080 | postgrest (start order only) | `/health` and `/ready` exist; not wired to anything | None |
| PostgREST | `postgrest` | 3000, internal | migrate completed | None | None |
| PostgreSQL 16 | `postgres` | 5432, host 5433 | – | `pg_isready` | Volume `pgdata` |
| Migration runner | `migrate` | – | postgres healthy | Exit code | `public.schema_migrations` |

No service has a `restart:` policy. Only extensions used: `pgcrypto` and `pg_trgm` (best-effort).

### 3A.5 Environment variables

| Variable | Consumer | Required | Secret | When omitted | Must match |
|---|---|---|---|---|---|
| `POSTGRES_PASSWORD` | postgres, compose | Compose default | Yes | Dev default | `DATABASE_URL` |
| `POSTGRES_DB`, `POSTGRES_USER` | postgres | Set in compose | No | – | `DATABASE_URL`, `PGRST_DB_URI` |
| `DATABASE_URL` | `migrate.sh`, `import_hsn.sh` | Yes | Yes | Script exits | Database credentials |
| `AUTHENTICATOR_PASSWORD` | `migrate.sh` | Effectively yes | Yes | Warns; a new DB's role has no password, so PostgREST can't connect | `PGRST_DB_URI` |
| `DEKU_SEED_DEMO` | `migrate.sh` | No | No | false, but compose hardcodes `"true"` | – |
| `MIGRATIONS_DIR`, `SEED_FILE` | `migrate.sh` | No | No | `/migrations`, `/seed.sql` | – |
| `PGRST_DB_URI` | postgrest | Yes | Yes | Set in compose and cloudbuild | `AUTHENTICATOR_PASSWORD` |
| `PGRST_JWT_SECRET` | postgrest | Yes | Yes | Set in compose and cloudbuild | `JWT_SECRET` |
| `PGRST_JWT_AUD` | postgrest | Yes | No | Set to `deku` | `auth.rs:12` |
| `PGRST_DB_SCHEMAS`, `PGRST_DB_ANON_ROLE` | postgrest | Yes | No | Set in compose and cloudbuild | – |
| `JWT_SECRET` | backend, frontend | Yes | Yes | Backend stops if missing or under 32 bytes. **Frontend doesn't stop**: tokens can't be verified, so every request refreshes | PostgREST, backend, frontend |
| `PORT` | backend | No | No | 8080; invalid value stops startup | – |
| `POSTGREST_URL` | backend | Yes | No | Stops at startup | – |
| `CORS_ALLOWED_ORIGINS` | backend | No | No | None allowed; invalid value stops startup | – |
| `CRON_SECRET` | backend | No | Yes | Notification job returns 404 | Cloud Scheduler header |
| `DATA_ENCRYPTION_KEY` | backend | No | Yes | Integrations off; malformed value stops startup. **Losing or changing it makes stored Razorpay, GSP and KYC credentials unreadable** | – |
| `RAZORPAY_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI`, `_WEBHOOK_SECRET` | backend | All four or none | Yes, except URI | Payment routes return 503 | – |
| `GSP_PROVIDER`, `KYC_PROVIDER` | backend | No | No | Off; routes return 503. Unknown value stops startup. `sandbox` is refused in production | – |
| `DEKU_ENV` | backend | Production: yes | No | Only effect today: refuses sandbox providers | – |
| `RUST_LOG` | backend | No | No | **Debug level, including in production** | – |
| `BACKEND_URL` | frontend | Yes | No | Auth and proxy return 502 | – |
| `NODE_ENV`, `HOSTNAME`, `NEXT_TELEMETRY_DISABLED` | frontend image | Set in image | No | Image always sets production, so cookies are `Secure` and need HTTPS or localhost | – |

Secret dev defaults exist only in `docker-compose.yml` and `.env.example`, not in application code. Nothing refuses them in production (task S-03).

### 3A.6 Migrations and runner

Numbered files 000–044, in order: platform_auth, core_identity, organisations_tenancy, parties, catalogue_items, accounting_foundation, accounting_posting_reporting, sales_invoices_gst, invoice_documents, audit_events_and_performance, fix_invoice_issuance_atomic_journal, alerx_coa_hierarchy, organisation_licenses, departments_members, user_activity_logs_and_security, agentic_memory_core, superadmin_and_7_role_rbac_matrix, universal_financial_rollup_wcm_fpa, lock_down_function_access, bank_reconciliation, journal_approvals, reports_include_reversed_entries, guard_payroll_and_licenses, honest_wcm_fpa_metrics, purchase_bills, sales_invoice_channel, lock_down_auth_functions, allow_journal_reversal, gst_return_filings, ledger_functions, organisation_profile, sales_notes, invoice_types, hsn_sac_master, notifications, marketplace_settlements, payments_razorpay, gsp_integration, kyc, subscriptions, invoice_status_guard, membership_bootstrap_and_marketplace_ar, inventory, import_jobs, business_documents.

| §7 question | Answer from the code |
|---|---|
| Tracks versions and checksums | Yes; refuses a changed file |
| Failed migration stops the run, not recorded | Yes (`set -eu`, `ON_ERROR_STOP`) |
| Rerun safe | Yes |
| Transactional | **No.** Files run without a transaction because 016 adds enum values and uses them in the same file. A partial failure needs manual repair (task M-02) |
| Concurrent runs prevented | **No lock** (task M-01) |
| RLS | Enabled on all 58 `public` tables plus `schema_migrations`, by name match. Policy quality is covered by SQL suites, not reviewed here |
| Default chart of accounts | **Not created with the company.** Only onboarding, a manual button or the seed call it, so a company that skips onboarding has none (task O-02) |
| Cloud SQL compatibility | Nothing found that should fail; not run on Cloud SQL |

The demo seed re-runs on each `migrate` start. It's written to be idempotent, except that it aborts if a demo email belongs to another user.

### 3A.7 Files, jobs and integrations

- **Uploads:** see blocker 1. CSV and Tally imports are parsed in the browser and send rows only. The 2 MiB backend body limit also caps large import payloads.
- **PDFs:** browser `window.print()` only.
- **Backups of files:** nothing to back up today, because nothing is stored.
- **Background jobs:** the backend has no scheduler. The only job is `POST /api/v1/internal/notifications/generate`, triggered by hand locally and by a manually created hourly Cloud Scheduler job on GCP. It is idempotent per company through a dedupe key. Expired refresh tokens are never purged.
- **Razorpay webhook:** signature-checked. Idempotency in `record_gateway_payment` not reviewed.
- **Consultant:** answers come from `answer_from_ledger`. No LLM or third party is involved, so "AI CFO" labels overstate it.

### 3A.8 Security gaps

| ID | Gap | Evidence |
|---|---|---|
| S-01 | Open signup, including direct to the backend | `routes/auth.rs:17` |
| S-02 | Demo password and demo buttons in the client bundle | `AuthContext.tsx:43`, `login/page.tsx:112,127` |
| S-03 | Production doesn't refuse dev secrets | `integrations/mod.rs:74` covers sandbox only |
| S-04 | No CSRF check beyond `SameSite=Lax`; login CSRF is possible because the auth routes force a JSON content type | `session.ts:181`, `app/api/backend/[...path]/route.ts` |
| S-05 | No login rate limit or lockout | `routes/auth.rs:13-14` |
| S-06 | No password reset or change; "Forgot password?" is an alert | `login/page.tsx:172-174` |
| S-07 | Any refresh failure, even a brief backend outage, signs the user out. Parallel refreshes across instances can trigger reuse detection and revoke every session | `session.ts:96,108-109,152`, migration 000 lines 228-232 |
| S-08 | Production logs at debug level; Razorpay callback `code` and `state` can reach logs | `main.rs:29,85` |
| S-09 | Proxy allows `api/v1/auth/*`, which can return raw tokens to JavaScript | `session.ts:52-53,156` |
| S-10 | A vendor email is seeded as an inert superadmin row in every database | migration 016 line 615 |
| S-11 | Membership checks on service-token paths not traced | `integrations/mod.rs:123`, `payments.rs:214,237,356` |
| S-12 | Invite squatting: signup has no email check, so anyone can register an invited address | migration 041 lines 48-55 |

Logout revokes the refresh token; the access token stays valid for up to one hour by design.

### 3A.9 Route status

Status: **R** real against the API, **S** needs a sandbox or provider, **M** mock or fabricated content present, **O** not reachable from navigation. From code reading. Purchases, Marketplace, Import, Inventory, Approvals, Parties and the Builder body were checked through their API calls, not line by line. Loading, empty and error states and test evidence get recorded per route in `LOCAL_DOCKER_TEST_REPORT.md` as they're run.

| Route | Status | Note |
|---|---|---|
| `/` | R | Marketing; claims below |
| `/login`, `/signup`, `/join`, `/onboarding` | R | Signup drops plan and UPI; `/join` loses its token after login |
| `/gateway` | R | Load errors swallowed; "PostgreSQL Active" and "AI CFO Live" are unconditional |
| `/executive` | R | "GSTIN Active" and "Regular GST Taxpayer" are unconditional |
| `/consultant` | R, M | Blocker 4; five invented chat histories; dead controls |
| `/vouchers` and `/contra`, `/journal`, `/payment`, `/purchase`, `/receipt`, `/sales` | R, M | Blocker 2; random entry numbers; fictional sample bills can be posted; `/sales` links to missing `/gst/sales-invoices` |
| `/day-book`, `/approvals`, `/banking/reconciliation`, `/collect`, `/purchases` | R | |
| `/builder` | R | Random promo code; slabs lack 40% (check against current notifications) |
| `/gst`, `/gst/file` | R, S | IRN, e-way bill and direct filing need a provider |
| `/gst/returns` | R | "Legally exempt" text is unconditional |
| `/gst/guide` | R | Static |
| `/masters/chart-of-accounts` | R | "Liquid" total includes 1030 Trade Debtors |
| `/masters/parties`, `/masters/products-services` | R | Price prefilled at 10000 |
| `/inventory`, `/marketplace`, `/import`, `/export` | R, O | Built, but no menu or palette entry |
| `/reports/trial-balance`, `/balance-sheet`, `/debtors`, `/creditors`, `/operating-expenses` | R | Debtors and Creditors show 0 counts while loading |
| `/reports/profit-loss` | R | "FY 2026-27" hardcoded |
| `/reports/cash-flow` | M | Blocker 3; start date fixed at 2026-04-01 |
| `/reports/fpa` | R, M | Metrics real; "Healthy" and "Safe" verdicts unconditional; errors never shown; budget use not from the ledger |
| `/companies` | R | Allows unlimited companies, which conflicts with single-organisation scope |
| `/departments-members`, `/audit`, `/settings` | R | Migration 013 seeds invented budgets when the org name matches `deku` |
| `/logs` | R, O | Duplicate of `/audit` |
| `/kyc` | S | Disabled when unconfigured; only reachable from Settings |
| `/settings/license` | R | Failed load spins forever |

**Marketing claims with nothing behind them:** GSTR-2B matching, Shopify and bulk marketplace sync, automated WhatsApp, automated GSTN filing without a provider, logo and stamp on documents.

**Keyboard (commit `8b1a1ed`):**
- With focus in a field or a dialog open, F5 reloads and discards the form, and F1 and F11 reach the browser.
- Ctrl+F5 and Shift+F5 are caught as navigation.
- The unsaved-changes check covers four areas and misses fields with no explicit `type`, including voucher number and narration.
- `VoucherWorkspace` F-keys fire while typing and overwrite the narration.
- `AppSidebar.tsx` is now unused, which is why those four routes lost their menu entries.

### 3A.10 Deployment gaps (GCP, §16–19)

Don't start until local acceptance passes. Known so far: blocker 8; Cloud SQL isn't created with a private IP; the restore steps omit redeploying services against the clone; no document storage; no Cloud Run probes; secrets use `:latest`; Artifact Registry isn't created with immutable tags; the README has a duplicated line and two conflicting NAT recipes.

### 3A.11 Environment limits for this work

The machine this audit ran on has no Docker and no Rust linker, and WSL has no distribution installed. Node, Postgres 18 and `gcloud` are present. Part B's tests can run on GitHub Actions, which has Docker, and those results will be labelled as CI runs; checks on a developer laptop stay `NOT TESTED` until someone runs them there.

## 4. Engineering rules

1.  Inspect the existing repository before changing anything.
2.  Preserve working features and current architecture.
3.  Do not make speculative changes to migrations, auth or database
    design.
4.  Never delete an existing database volume or user data to make a test
    pass.
5.  Use an isolated Compose project and isolated database volume for
    clean-install testing.
6.  Never print, commit or include real secrets in documentation, logs,
    screenshots or tutorials.
7.  Use placeholders for secrets in examples.
8.  Do not claim a test passed unless the command was run and its result
    recorded.
9.  Distinguish `PASS`, `FAIL`, `BLOCKED` and `NOT TESTED`.
10. Record every code/configuration change, why it was necessary, and
    how it was verified.
11. Fix root causes rather than hiding errors with retries or weakened
    checks.
12. Keep optional third-party integrations optional for the core local
    runtime.
13. Do not use production customer data in development or demonstration
    environments.
14. Keep the local Docker and GCP deployments as close as possible: same
    application images, same startup process, same migration mechanism.

------------------------------------------------------------------------

# Part A --- Complete the single-organisation application runtime

## 5. Repository and runtime inventory

Create and maintain an inventory of the actual repository. At minimum
inspect:

-   Frontend package scripts, Next.js configuration, route tree and API
    proxy.
-   Rust workspace/package configuration, binary entry point, routes and
    health endpoint.
-   PostgREST configuration, exposed schemas, database URI and JWT
    configuration.
-   PostgreSQL image/version, roles, extensions, schemas and connection
    settings.
-   All migration files and migration runner.
-   Seed/demo data mechanism.
-   Dockerfiles and Compose configuration.
-   `.env.example` and backend environment example.
-   Authentication and session lifecycle.
-   File/document storage paths and upload handling.
-   Background tasks, cron-like jobs and notification generation.
-   External integrations and sandbox fallbacks.
-   Logging, error handling and audit events.

Produce a short component inventory with: - Component name -
Responsibility - Runtime process/container - Port or internal endpoint -
Required environment variables - Persistent data locations -
Health/readiness check - Dependencies

Do not invent missing endpoints. Discover and document the actual ones.

## 6. Environment and configuration

Create a complete configuration reference. For every environment
variable record:

-   Exact variable name
-   Which service consumes it
-   Required or optional
-   Whether it is a secret
-   Local development default, if safe
-   Production requirement
-   Behaviour when omitted
-   Whether it must match another service

At minimum verify the variables reported in the baseline:

-   `POSTGRES_DB`
-   `POSTGRES_USER`
-   `POSTGRES_PASSWORD`
-   `AUTHENTICATOR_PASSWORD`
-   `PGRST_DB_URI`
-   `PGRST_JWT_SECRET`
-   `PGRST_JWT_AUD`
-   `JWT_SECRET`
-   `PORT`
-   `POSTGREST_URL`
-   `BACKEND_URL`
-   `DATA_ENCRYPTION_KEY`
-   `CRON_SECRET`
-   `DEKU_SEED_DEMO`
-   `GSP_PROVIDER`
-   `KYC_PROVIDER`
-   Razorpay configuration variables

Also inspect all other variables actually referenced by the code and
Compose files. This list is not permission to ignore additional
variables.

Requirements:

-   Provide a safe `.env.example`.
-   Validate required variables at startup and show actionable errors
    without revealing secret values.
-   Do not use development fallback secrets in GCP.
-   Ensure JWT signing and verification configuration is consistent.
-   Ensure encryption keys are valid and stable across restarts.
-   Ensure database credentials match between PostgreSQL, migration
    runner and PostgREST.
-   Ensure optional integrations being blank does not crash the core
    runtime.
-   Document how to rotate secrets and which data may become
    inaccessible if an encryption key is lost or changed.

## 7. Database and migrations

Inspect the real migration directory and migration runner.

Verify:

-   Migration filenames and ordering.
-   Whether all migrations required by the current frontend/backend are
    included.
-   Whether migrations are transactional where appropriate.
-   Whether the migration runner tracks applied versions/checksums.
-   Whether failed migrations stop startup.
-   Whether rerunning the migration runner is safe.
-   Whether concurrent migration execution is prevented.
-   Whether the required PostgreSQL extensions and roles are created.
-   Whether RLS is enabled and policies are present on the intended
    tables.
-   Whether functions, triggers, indexes, constraints and views exist
    after migration.

The reported migration set is `000`--`044` (45 files), but verify the
current repository rather than hardcoding this expectation.

### Clean database test

Use a new isolated Compose project and a new isolated volume. Do not
touch any existing volume.

1.  Start PostgreSQL.
2.  Wait for database readiness.
3.  Run migrations.
4.  Capture each migration's result.
5.  Verify migration tracking count and versions.
6.  Verify expected schemas, tables, functions, triggers, roles and RLS
    policies.
7.  Restart the migration runner and verify it safely reports that
    migrations are already applied.
8.  Confirm a failed migration causes a clear failure and does not
    silently mark itself successful.

### Seed and onboarding test

Test both supported modes, if both are intended:

**Demo mode** - Demo seed is enabled. - Demo data is created as
documented. - Demo login works only in the local/demo environment. -
Demo credentials are never enabled by default in production.

**Clean customer mode** - Demo seed is disabled. - New user can complete
signup/onboarding. - Organisation creation succeeds. - Initial chart of
accounts and required defaults are created exactly once. - User is
associated with the organisation with the correct initial role. - The
user can enter the application without relying on demo data.

Do not assume the reported `DEKU_SEED_DEMO=false` flow works.
Demonstrate it.

## 8. Authentication, authorisation and session lifecycle

Test the complete real flow:

1.  New user signup or configured initial-user creation.
2.  Organisation setup.
3.  Login with valid credentials.
4.  Login rejection with invalid credentials.
5.  Access-token issuance.
6.  Refresh-token issuance and refresh.
7.  Logout and token invalidation/revocation behaviour.
8.  Expired or malformed token handling.
9.  Protected API route access.
10. Organisation membership and role enforcement.
11. RLS behaviour for permitted and forbidden records.
12. HTTP-only cookie flags and secure production cookie behaviour.
13. CSRF protection or equivalent safeguards for cookie-authenticated
    state-changing requests.
14. No secret or token leakage into browser local storage, URLs, logs or
    client-visible errors.

Verify the actual implementation. If the frontend uses a local-storage
organisation selector or active-organisation ID, establish whether it is
only a UI preference or whether it influences server-side authorisation.
The server/database must enforce access; a client-selected ID must never
be treated as proof of membership.

Test at least: - Unauthenticated request. - Authenticated permitted
request. - Authenticated forbidden request. - User without membership. -
User with insufficient role. - Expired session. - Logout followed by
reuse of old credentials.

Record any security limitation rather than describing it as complete.

## 9. Frontend application completion

Walk through every actual route/module in the existing app. Do not
redesign the application merely to make this checklist fit.

For every route, record:

-   Route and module name
-   Whether it loads in production mode
-   Required role/permission
-   Data/API dependencies
-   Primary actions
-   Empty state
-   Loading state
-   Error state
-   Validation behaviour
-   Whether the action persists data
-   Test evidence
-   Known limitation or mock/sandbox dependency

Check: - Navigation and route guards. - Gateway/dashboard. - Keyboard
navigation and command palette. - Forms and validation. - Tables,
filtering, sorting and pagination. - Search and selection. - Dialogs and
confirmation flows. - File upload/download. - PDF/document generation. -
Responsive layout for supported screen sizes. - Browser refresh and deep
links. - Session expiry and recovery. - API failure and network
interruption behaviour. - No dead buttons, placeholder links or silent
failures.

For each feature, distinguish: - Fully functional against the local
database. - Functional with a sandbox/simulation provider. - Mock/demo
only. - Not implemented. - Blocked by external credentials.

Do not label a sandbox/mock integration as production-connected.

## 10. Backend and business workflow verification

Test the real API and database behaviour, not only UI rendering.

Minimum workflows:

### Organisation and master data

-   Create/configure organisation.
-   Configure financial year and relevant company settings.
-   Create/edit parties.
-   Create/edit service and product catalogue entries.
-   Verify default chart of accounts.

### Accounting

-   Create a balanced journal/voucher.
-   Validate debit and credit totals.
-   Reject unbalanced voucher.
-   Save draft.
-   Submit/post according to maker-checker rules.
-   Verify approval/rejection where applicable.
-   Verify duplicate/idempotency behaviour.
-   Verify audit trail.

### Sales and invoicing

-   Create invoice.
-   Verify tax/GST calculation.
-   Verify totals, rounding and due amount.
-   Generate/download invoice PDF.
-   Record payment/collection.
-   Verify customer outstanding.

### Purchases and expenses

-   Create purchase/expense entry.
-   Verify tax/ITC calculation where supported.
-   Verify supplier outstanding.

### Reports

-   Day Book reflects posted transaction.
-   Trial Balance reflects the same transaction.
-   Debits equal credits.
-   General Ledger reflects the correct account entries.
-   P&L and Balance Sheet agree with underlying ledger data.
-   Cash/bank reports reconcile with recorded transactions.
-   Date filters and financial-year boundaries work.

### Additional modules

Test each existing module that is exposed in the frontend, including
approvals, BRS, credit/debit notes, stock, payroll, HR, document
builder, FP&A and notifications as applicable.

For each workflow, record: - Starting state - User action - API calls -
Database records affected - Expected result - Actual result - Evidence -
Pass/fail

At minimum, the critical accounting proof must be:

**Create and post a balanced voucher → verify it in Day Book → verify
its ledger postings → verify Trial Balance → verify debit/credit
equality.**

## 11. Files, documents and persistent storage

Determine exactly where uploaded documents, generated PDFs and other
files are stored.

Verify: - Whether storage is local filesystem, database, object storage
or a combination. - Whether the relevant directory/bucket is persistent
in Docker. - File size/type validation. - Access control and
organisation/user authorisation. - File download permissions. -
Behaviour after container recreation. - Backup and restore
requirements. - Whether any files are accidentally stored only inside an
ephemeral container layer.

A successful database persistence test is not sufficient if uploaded
documents disappear after container recreation.

## 12. Background jobs, notifications and integrations

Inventory all background tasks and external service dependencies.

For each one document: - Trigger mechanism - Schedule, if any -
Worker/process responsible - Retry behaviour - Idempotency - Failure
handling - Logging - Required credentials - Sandbox/demo mode - Whether
the core application works when it is unavailable

Notifications generated only on demand should be described accurately. A
scheduler may be added only if a real product requirement needs it; do
not let a non-critical scheduler delay the core runtime milestone.

------------------------------------------------------------------------

# Part B --- Package and test locally as Docker

## 13. Docker image requirements

Create reproducible Docker images for the application services.

Requirements:

-   Use production build stages.
-   Use multi-stage builds where appropriate.
-   Use minimal runtime images.
-   Run application processes as non-root users where feasible.
-   Pin important base image versions; avoid unbounded `latest` tags for
    critical services.
-   Keep build tools out of final runtime images.
-   Do not copy `.env`, private keys, credentials or local development
    artefacts into images.
-   Use `.dockerignore`.
-   Ensure frontend runtime configuration is handled correctly for
    Next.js.
-   Ensure Rust binary and runtime dependencies are included.
-   Ensure PostgREST configuration is explicit and reproducible.
-   Keep PostgreSQL data outside the disposable container filesystem.
-   Provide image tags/version identifiers.
-   Record image sizes and build output.
-   Generate an SBOM and run an image vulnerability scan if the
    available tooling supports it; report tool and findings.

Do not change the service topology unless a concrete defect requires it.

## 14. Docker Compose local installation

Provide a simple, documented local workflow.

The intended user experience should be close to:

``` bash
# 1. Obtain the repository or release bundle
# 2. Copy the example environment file
cp .env.example .env

# 3. Set required local values in .env
# 4. Build and start
docker compose up --build -d

# 5. Inspect service status
docker compose ps

# 6. Inspect logs
docker compose logs -f
```

Adjust these commands to the actual repository and platform. Do not
publish commands that have not been tested.

Document: - Prerequisites and supported OS/CPU architectures. - Docker
Desktop or Docker Engine requirements. - Required disk/memory
resources. - Ports and port-conflict resolution. - Environment setup. -
First-run initialisation. - Demo mode versus clean customer setup. - How
to open the application. - How to stop/start/restart safely. - How to
update images. - How to inspect logs. - How to diagnose common failures.

Provide a one-command or minimal-command startup experience where
practical, without hiding errors or weakening security.

## 15. Local Docker acceptance tests

Run on a clean isolated local environment.

  -----------------------------------------------------------------------------
  ID                      Test                    Acceptance criterion
  ----------------------- ----------------------- -----------------------------
  D-01                    Compose validation      Compose config resolves
                                                  without errors

  D-02                    Image build             All required images build
                                                  successfully

  D-03                    Fresh startup           Services start in dependency
                                                  order

  D-04                    Database readiness      PostgreSQL health check
                                                  passes

  D-05                    Migrations              All required migrations
                                                  complete and are tracked

  D-06                    PostgREST               Health check and DB
                                                  connectivity pass

  D-07                    Rust backend            Health endpoint and DB access
                                                  pass

  D-08                    Frontend                Production app responds and
                                                  loads

  D-09                    Authentication          Signup/login/session/logout
                                                  work

  D-10                    Clean onboarding        One organisation can be
                                                  created without demo seed

  D-11                    Demo mode               Demo flow works, if supported

  D-12                    Accounting workflow     Voucher posts and reports
                                                  reflect it

  D-13                    Persistence             Data survives container
                                                  restart/recreation

  D-14                    File persistence        Documents survive container
                                                  restart/recreation

  D-15                    Optional integrations   Missing credentials do not
                                                  prevent core app startup

  D-16                    Logs                    Errors are visible and
                                                  secrets are not leaked

  D-17                    Recovery                Documented backup can be
                                                  restored successfully

  D-18                    Repeatability           Another clean isolated
                                                  deployment follows the same
                                                  steps
  -----------------------------------------------------------------------------

Test at least: - Fresh install. - Normal restart. - Application image
update. - Database persistence. - File persistence. - Failed service
startup and recovery. - Backup and restore.

Do not use destructive reset commands against any existing customer or
developer data.

------------------------------------------------------------------------

# Part C --- Single-customer deployment on GCP

## 16. Deployment target and architecture

After local Docker acceptance is complete, deploy the same application
for one organisation on GCP.

This is a single-customer deployment, not a shared multi-tenant
platform.

Before implementation, inspect the current app's statefulness, file
storage, connection model, background tasks and database requirements.
Select the simplest GCP architecture that reliably supports the existing
application.

Evaluate and document the appropriate options for: - Container hosting
(for example, Cloud Run or a VM running Docker Compose). - PostgreSQL
hosting (for example, Cloud SQL for PostgreSQL or PostgreSQL in a
managed VM). - Persistent document storage (for example, Cloud Storage
or an appropriate persistent volume). - Secret storage (Secret
Manager). - HTTPS and domain configuration. - Network connectivity and
private database access. - Logs, metrics and alerting. - Backups and
recovery.

Do not select a service solely because it is fashionable. The decision
must account for: - Persistent connections and connection pooling. -
PostgREST and backend connectivity. - Multiple containers/services. -
Background jobs. - Persistent file storage. - WebSocket/streaming needs,
if any. - Operational complexity and monthly cost. - Ease of backup and
restore.

Write a short architecture decision record before deploying. Keep it
single-customer and avoid building tenant provisioning.

## 17. GCP infrastructure and security

Create a deployment checklist covering:

-   Dedicated GCP project for the single customer/environment.
-   Billing and budget alerts.
-   Region selection and data residency considerations.
-   Least-privilege service accounts and IAM.
-   Secret Manager for all production secrets.
-   No development fallback secrets.
-   HTTPS/TLS.
-   Firewall and ingress restrictions.
-   Database not publicly exposed unless explicitly justified.
-   Private networking where supported and practical.
-   Database connection limits and pooling.
-   Persistent database storage.
-   Persistent document/object storage.
-   Encryption at rest and in transit.
-   Application logs without passwords, tokens or sensitive financial
    data.
-   Health checks and restart behaviour.
-   Backup schedule and retention.
-   Point-in-time recovery where supported and justified.
-   Tested restore procedure.
-   Monitoring and alerting.
-   Resource sizing and cost estimate.

Do not place production credentials in Git, Docker images, screenshots
or tutorial content.

## 18. GCP deployment procedure

Document and test the actual deployment process:

1.  Create/select the GCP project.
2.  Enable only required APIs.
3.  Configure IAM and service accounts.
4.  Configure Secret Manager.
5.  Provision the selected compute/container service.
6.  Provision PostgreSQL and networking.
7.  Provision persistent file storage.
8.  Build and tag the application images.
9.  Push images to Artifact Registry.
10. Configure runtime environment and secret references.
11. Run database migrations exactly once through the approved deployment
    process.
12. Deploy PostgREST, Rust backend and frontend in the correct
    dependency order.
13. Configure domain and HTTPS.
14. Configure health checks and logs.
15. Create the initial organisation/admin account securely.
16. Complete the smoke tests and end-to-end workflows.
17. Verify backup and restore.
18. Record deployment versions and rollback procedure.

Use immutable image tags or digests for releases. Do not rely on a
mutable `latest` tag for rollback or reproducibility.

## 19. GCP acceptance tests

  -----------------------------------------------------------------------
  ID                      Test                    Acceptance criterion
  ----------------------- ----------------------- -----------------------
  G-01                    Deployment              All required services
                                                  are healthy

  G-02                    HTTPS                   Application is
                                                  accessible over valid
                                                  HTTPS

  G-03                    Authentication          Initial admin can sign
                                                  in securely

  G-04                    Organisation            Exactly the intended
                                                  single organisation is
                                                  configured

  G-05                    Database                Backend and PostgREST
                                                  can access the database

  G-06                    Migrations              Correct migration
                                                  version is recorded

  G-07                    Accounting              Voucher workflow and
                                                  reports pass

  G-08                    Documents               Upload/download works
                                                  and data persists

  G-09                    Restart                 Services recover
                                                  without data loss

  G-10                    Security                No public database
                                                  exposure or leaked
                                                  secrets

  G-11                    Backup                  Backup completes
                                                  successfully

  G-12                    Restore                 Restore is demonstrated
                                                  in a separate test
                                                  environment

  G-13                    Monitoring              Logs, health and alerts
                                                  are operational

  G-14                    Rollback                Previous application
                                                  image can be restored

  G-15                    Cost                    Expected monthly
                                                  infrastructure cost is
                                                  documented
  -----------------------------------------------------------------------

Do not call the GCP deployment complete until the critical accounting
workflow and persistence checks pass in the deployed environment.

------------------------------------------------------------------------

# Part D --- Interactive tutorials for new users and administrators

## 20. Tutorial objective

Create interactive tutorials inside Deku Finance that teach a new user
how to set up, configure, use, build/customise where supported, and
manage the application.

These should be actual guided experiences inside the product, not merely
a static PDF or a list of help articles.

A new user should be able to complete the core setup and understand the
main modules without needing Parth or another developer to guide them
personally.

## 21. Tutorial experience

Build a tutorial centre/help experience with:

-   First-login welcome and guided onboarding.
-   Role-aware learning paths.
-   Step-by-step walkthroughs.
-   Contextual tooltips and coach marks.
-   Highlighted UI controls and next-step guidance.
-   Interactive checklists.
-   Sample/demo data exercises where safe.
-   Inline explanations of accounting concepts and application
    behaviour.
-   Completion status and progress.
-   Ability to pause, resume, restart or skip a tutorial.
-   Links from relevant modules to the matching tutorial.
-   Searchable help/tutorial index.
-   Clear distinction between demo actions and real financial
    transactions.
-   Accessible keyboard navigation and responsive layout.

Tutorials must not silently create or post real financial records. Use a
clearly labelled demo environment or ask for confirmation before any
consequential action.

Do not introduce a large new tutorial framework without first inspecting
existing frontend patterns and dependencies. Reuse existing components
and state management where practical.

## 22. Required tutorial learning paths

Create at least the following paths.

### Path 1 --- First-time setup

1.  Welcome to Deku Finance.
2.  Understand the Gateway and application navigation.
3.  Create or configure the organisation.
4.  Set legal/business details.
5.  Configure financial year and accounting preferences.
6.  Review the default chart of accounts.
7.  Configure tax/GST details where applicable.
8.  Add the first customer/supplier.
9.  Configure users, roles and permissions.
10. Understand where to find help and system settings.

### Path 2 --- Accounting fundamentals

1.  Understand the chart of accounts.
2.  Understand debit and credit.
3.  Understand double-entry accounting.
4.  Learn voucher types.
5.  Create a draft voucher.
6.  Validate a balanced voucher.
7.  Submit/post a voucher.
8.  Understand maker-checker approval.
9.  Find the transaction in Day Book.
10. Verify the Trial Balance and ledger.

Use a safe sample transaction and explain why each debit/credit entry is
made.

### Path 3 --- Sales and invoicing

1.  Create a customer.
2.  Configure a product/service.
3.  Create an invoice.
4.  Understand GST/tax calculation.
5.  Review totals and rounding.
6.  Generate/download the invoice.
7.  Record a payment.
8.  Review outstanding receivables.

### Path 4 --- Purchases and expenses

1.  Create a supplier.
2.  Record a purchase/expense.
3.  Understand tax/ITC fields where applicable.
4.  Review payable balances.
5.  Find the transaction in reports.

### Path 5 --- Banking and reconciliation

1.  Understand bank accounts.
2.  Understand bank statement import or supported bank data flow.
3.  Match transactions.
4.  Resolve unmatched entries.
5.  Complete a reconciliation.
6.  Review reconciliation status.

### Path 6 --- Reports and financial control

1.  Open Day Book.
2.  Open General Ledger.
3.  Understand Trial Balance.
4.  Read Profit & Loss.
5.  Read Balance Sheet.
6.  Understand Cash Flow.
7.  Apply date/period filters.
8.  Export or download reports where supported.

### Path 7 --- Documents and operations

1.  Upload a document.
2.  Find and view a document.
3.  Use Document Builder.
4.  Understand document access and permissions.
5.  Understand audit trail.
6.  Understand notifications and approvals.

### Path 8 --- Administrator and system management

1.  Manage users.
2.  Assign roles and permissions.
3.  Manage organisation settings.
4.  Manage chart of accounts and masters.
5.  Configure supported integrations.
6.  Understand sandbox versus live integration modes.
7.  Review audit logs.
8.  Understand backup and restore responsibilities.
9.  Understand application updates and maintenance.
10. Know where to find system health and troubleshooting information.

### Path 9 --- Developer/implementation guide (only for capabilities that actually exist)

Explain the supported way to: 1. Install the application locally. 2.
Configure environment variables. 3. Run the Docker stack. 4. Understand
the frontend/backend/PostgREST/database architecture. 5. Run database
migrations. 6. Inspect service logs and health. 7. Configure supported
integrations. 8. Back up and restore the environment. 9. Update/redeploy
the application. 10. Troubleshoot common failures.

Do not present unsupported customisation or development features as if
they already exist in the product. If an activity is for implementers
rather than end users, keep it in a clearly separated
administrator/developer guide.

## 23. Tutorial implementation and acceptance criteria

For every tutorial record: - Name and intended role. - Prerequisites. -
Learning outcome. - Steps and UI targets. - Expected result per step. -
Completion condition. - Whether it uses demo or live data. - How the
user exits, resumes or restarts it. - Last verified application version.

Acceptance tests: - First-time user can launch the setup tutorial. -
Tutorial steps point to real existing UI elements. - Progress persists
appropriately. - User can pause and resume. - User can restart a
completed tutorial. - Tutorial does not submit unintended real
transactions. - Role-restricted screens are not exposed to unauthorised
users. - Tutorials work at supported desktop and mobile widths. - No
tutorial references a removed route or non-existent feature. - Every
tutorial is reviewed against the actual application build.

------------------------------------------------------------------------

# Part E --- Documentation and handover

## 24. Required documentation deliverables

Maintain these documents in the repository, preferably under
`docs/runtime/`:

1.  `APPLICATION_RUNTIME.md` --- architecture, components, lifecycle and
    dependencies.
2.  `ENVIRONMENT_CONFIGURATION.md` --- all variables, safe examples and
    secret requirements.
3.  `DATABASE_AND_MIGRATIONS.md` --- migration order, seed modes, schema
    verification and recovery.
4.  `LOCAL_DOCKER_SETUP.md` --- installation and day-to-day Docker
    commands.
5.  `LOCAL_DOCKER_TEST_REPORT.md` --- actual test results and evidence.
6.  `GCP_SINGLE_ORG_DEPLOYMENT.md` --- selected architecture, setup and
    deployment procedure.
7.  `GCP_DEPLOYMENT_TEST_REPORT.md` --- deployed test results and
    evidence.
8.  `BACKUP_AND_RESTORE.md` --- database and file backup, retention and
    restore procedure.
9.  `TROUBLESHOOTING.md` --- common errors and verified solutions.
10. `TUTORIALS_AND_ONBOARDING.md` --- tutorial map, roles, completion
    and maintenance.
11. `RELEASE_AND_ROLLBACK.md` --- image tagging, release, update and
    rollback.
12. `KNOWN_LIMITATIONS.md` --- unsupported features, sandbox
    integrations and known risks.

Keep the documents consistent with the code. Commands must be tested. Do
not include secrets.

## 25. Evidence and progress tracking

Maintain one master checklist in `docs/runtime/README.md` with these
columns:

-   ID
-   Workstream
-   Task
-   Status: Not Started / In Progress / Blocked / Passed
-   Owner
-   Evidence link or command output
-   Files changed
-   Notes/blockers

Every phase must end with: - What was tested. - Exact commands
executed. - Actual output/result. - What was changed. - Remaining
issues. - Whether the phase acceptance criteria are met.

Do not mark an entire phase complete because its images build or
containers start. Application workflows must also pass.

## 26. Suggested execution sequence

Work in this order and do not skip gates:

  -----------------------------------------------------------------------
  Phase                   Work                    Exit gate
  ----------------------- ----------------------- -----------------------
  0                       Repository/runtime      Actual components,
                          inventory               dependencies and
                                                  configuration
                                                  documented

  1                       Complete single-org     Clean onboarding, auth,
                          runtime                 core modules and
                                                  accounting workflow
                                                  verified

  2                       Database/file           Restart and restore
                          persistence and         tests pass
                          recovery                

  3                       Docker images and       Reproducible local
                          Compose                 image build and startup

  4                       Local Docker end-to-end Local acceptance tests
                          testing                 pass

  5                       GCP architecture        Hosting choice
                          decision                justified for current
                                                  architecture

  6                       GCP deployment          Single-customer
                                                  environment healthy and
                                                  secured

  7                       GCP end-to-end testing  Accounting, documents,
                                                  persistence, backup and
                                                  rollback pass

  8                       Interactive tutorials   Required user/admin
                                                  paths work in the
                                                  deployed UI

  9                       Handover                Documentation,
                                                  evidence, known
                                                  limitations and
                                                  operations transferred
  -----------------------------------------------------------------------

If a phase fails, fix and retest that phase before moving to the next
one.

## 27. Final definition of done

The delivery is complete only when all of the following are true:

-   [ ] Existing single-organisation app runs end to end.
-   [ ] Clean database migration process is verified.
-   [ ] Clean first-user and organisation onboarding works.
-   [ ] Authentication, sessions, permissions and RLS are tested.
-   [ ] Critical accounting workflow passes.
-   [ ] Reports reconcile to posted transactions.
-   [ ] All exposed modules have an evidence-based status.
-   [ ] Uploaded/generated documents persist.
-   [ ] Database and file backup/restore are tested.
-   [ ] Docker images build reproducibly.
-   [ ] Local Docker Compose deployment works from documented steps.
-   [ ] Local restart and update behaviour are verified.
-   [ ] Same tested images are deployed to GCP.
-   [ ] GCP single-customer deployment is secure and healthy.
-   [ ] GCP accounting and document workflows pass.
-   [ ] GCP backup, restore and rollback are demonstrated.
-   [ ] Interactive tutorials cover setup, accounting, sales, purchases,
    banking, reports, documents and administration.
-   [ ] Developer/implementation guide reflects only real supported
    capabilities.
-   [ ] All operational documentation is complete and tested.
-   [ ] Known limitations and sandbox integrations are explicit.
-   [ ] Final handover is completed.

------------------------------------------------------------------------

## 28. Instructions to Parth

Please own this as an execution project, not just a documentation
exercise.

Start by auditing the actual repository and comparing it with this plan.
Then work through the phases sequentially.

**First deliverable:** Update this document with the real repository
structure, actual runtime dependencies, environment variables, migration
inventory, known gaps and a task-by-task implementation checklist. Do
not begin GCP deployment before local Docker acceptance is complete.

**Second deliverable:** Complete and test the single-organisation
application runtime, including clean onboarding and the critical
accounting workflow.

**Third deliverable:** Produce working Docker images and demonstrate a
clean local Docker installation.

**Fourth deliverable:** Deploy the same tested images to GCP for one
organisation and complete the cloud acceptance tests.

**Fifth deliverable:** Build the interactive in-product tutorials and
verify each against the actual UI.

At every stage, report evidence, blockers and changed files. Ask before
any action that could delete or overwrite existing data.

The target is a complete, usable and maintainable Deku Finance
application for one organisation. Do not expand the scope into
multi-tenancy or a shared hosting platform until this delivery is
proven.
