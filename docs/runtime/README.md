# Deku Finance runtime: master checklist

Tracks [`Deku_Finance_Runtime_Completion_and_Deployment_Plan.md`](../Deku_Finance_Runtime_Completion_and_Deployment_Plan.md) §25. Audit findings and evidence for "Not Started" items are in §3A of that plan.

Status values: Not Started, In Progress, Blocked, Passed. Passed needs a recorded command result. Owner is Parth unless noted.

**Split of work:** Parth's side writes the code. Another developer runs the local Docker install test (D-01 to D-18 on a real machine) and handles GCP (project, billing, deployment and G-01 to G-15).

## Phase 0: inventory

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| R-01 | Audit | Repository and runtime inventory | Passed | Plan §3A, commit `8b1a1ed` | Plan, this file | Code reading only |

## Phase 1: single-organisation runtime

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| A-01 | Honest data | Cash Flow reads the real SQL keys; shows "–" on failure | Passed | CI `2381911`, docker job: W-01i; `report_views_test.sql` | `CashFlowView.tsx`, migrations 045, 046 | Page and SQL both fixed. Date picker still missing |
| A-02 | Honest data | Remove invented Consultant figures and chat histories | Passed | CI `2e32342`: page loads with no API or script errors; wording reviewed in code | `DekuConsultantView.tsx` | Some dead sidebar controls remain |
| A-03 | Honest data | Remove fake proof: no random references, no `verified: true`, no hardcoded approver | Passed | CI `2e32342`: `F-01`, `U-07` | `VoucherWorkspace.tsx` | Documents are stored. Nothing checks what they say |
| A-04 | Honest data | FP&A verdicts computed or removed; show load errors | Passed | CI `2e32342`: page loads; verdicts removed in code | `FpaExecutiveView.tsx` | Verdicts and unsourced benchmarks removed, load errors shown. Department burn still reads a manual field, not the ledger |
| A-05 | Honest data | Server-issued sequential voucher numbers | Passed | CI `20d9d8e`, docker job: W-00b; `report_views_test.sql` | Migration 050, `routes/accounting.rs`, `VoucherWorkspace.tsx` | Blank instead of an invented number if the server can't issue one |
| A-06 | Honest data | Sample bills can't be posted to a real company | Passed | CI `2e32342`; samples removed from the code | `document-extractor.ts`, `VoucherWorkspace.tsx` | Sample bills removed entirely |
| A-07 | Honest data | Fix "Liquid" total, Sec 22 threshold, hardcoded FY labels, unconditional status labels | Passed | CI `2e32342`: pages load; wording reviewed in code | Chart of accounts, KPI service, returns, P&L, Gateway, Executive, Settings, Products | Done: Liquid total, goods and services limits, hardcoded FY and dates, unconditional status labels. A company's own limit still isn't computed |
| A-08 | Honest data | Remove or qualify marketing claims with no feature behind them | Passed | CI `2e32342`; copy reviewed | `PricingPlansSection.tsx`, `src/app/page.tsx`, signup page | GO and PRO pricing stays: a product decision |
| F-01 | Files | Store and serve uploaded documents with size, type and access checks | Passed | CI `ceab44e`, docker job: F-01a to F-01j, D-14; `document_files_test.sql` | Migration 048, `routes/files.rs`, voucher and Day Book views | Postgres, 10 MB limit, immutable once attached. Found and fixed: Next silently truncated bodies over 10 MB. Upload screens not exercised in a browser |
| S-01 | Security | Switch to close public signup; first admin bootstrap | Passed | CI `bd36cdd`, docker job: S-01, S-01b; `single_customer_test.sql` | Migration 047, `routes/auth.rs`, `auth.rs`, `config.rs` | Only the first administrator and invited addresses can register |
| S-02 | Security | Demo credentials and buttons only in demo mode | Passed | CI `bd36cdd`, docker job: S-02a, S-02b, D-11a | `api/auth/demo/route.ts`, `AuthContext.tsx`, login page | Blocker 7 |
| S-03 | Security | Production refuses dev secrets; frontend fails fast without `JWT_SECRET` | Passed | CI `d8a7840`, docker job: step "Misconfigured services refuse to start" | `config.rs`, `src/instrumentation.ts`, `ci.yml` | Backend refuses dev secrets in production; frontend refuses to start without `JWT_SECRET` or `BACKEND_URL` |
| S-04 | Security | Origin check on cookie-authenticated writes and auth routes | Passed | CI `ceab44e`, docker job: S-04a, S-04b; `tests/session.test.ts` | `session.ts` | Checks Sec-Fetch-Site, then Origin, on every `/api/` write |
| S-05 | Security | Login rate limit | Passed | CI `ceab44e`, docker job: S-05a to S-05c; `single_customer_test.sql` | Migration 049, `routes/auth.rs`, `error.rs` | 10 failures locks an address for 15 minutes. Someone guessing can keep an account locked; add IP limits at the load balancer if that happens |
| S-06 | Security | Password change and admin-driven reset | Passed | CI `d8a7840`, docker job: S-06a to S-06j; `password_reset_test.sql`; recovery script run locally | Migration 051, `routes/auth.rs`, `routes/organisations.rs`, `/reset-password`, Settings, Departments & Members, `db/issue_password_reset.sh` | Pages not checked in a browser |
| S-07 | Security | Keep session on transient refresh failure; handle multi-instance refresh | In Progress | `tests/session.test.ts`, CI `ceab44e`, docker job; not tested on GCP | `session.ts`, `cloudbuild.yaml` | Outages no longer sign users out. One frontend instance on Cloud Run avoids the refresh race |
| S-08 | Security | Production log level; keep query strings out of logs | In Progress | Compiles, CI `bd36cdd`; not observed on a deployed service | `main.rs` | Production default is now info level. Not observed on a deployed service |
| S-09 | Security | Block `api/v1/auth/*` through the proxy | Passed | CI `ceab44e`, docker job: S-09; `tests/session.test.ts` | `session.ts` |  |
| S-10 | Security | Remove the seeded vendor superadmin row | Passed | CI `ceab44e`, docker job; `single_customer_test.sql` | Migration 049 |  |
| S-11 | Security | Trace membership checks on service-token paths | Passed | Code trace; see notes | None | Read only. GSP and payments check role with the caller's token before service-token use. KYC authorises before acting; DigiLocker completion reads the request first only to learn its subject, and stays scoped to the company |
| S-12 | Security | Close invited-address squatting | Passed | CI `ceab44e`, docker job: S-12; `single_customer_test.sql` | Migration 049, `routes/auth.rs`, signup page | Invited signup now needs the link's token |
| O-01 | Single org | Remove trial lockout for a single-customer deployment | Passed | CI `bd36cdd`, docker job: O-09; `single_customer_test.sql` | Migration 047, license page | GO and PRO limits kept for a later hosted product |
| O-02 | Single org | Chart of accounts created exactly once with the company | Passed | CI `20d9d8e`, docker job: O-04; `single_customer_test.sql` | Migration 050, onboarding page |  |
| O-03 | Single org | Limit a deployment to one organisation | Passed | CI `bd36cdd`, docker job: O-08; `single_customer_test.sql` | Migration 047, `routes/organisations.rs` | `/companies` still offers Add; the server refuses it |
| O-04 | Single org | Invite link and `?next=` survive login | In Progress | tsc only; invite link not driven in a browser | Login and signup pages, `next-path.ts` |  |
| N-01 | Navigation | Menu entries for `/inventory`, `/marketplace`, `/import`, `/export`; remove `/logs` duplicate and dead `AppSidebar` | Passed | CI `2e32342`: `U-01` to `U-06` |  | `AppSidebar` left in place, unused |
| N-02 | Navigation | Fix missing `/gst/sales-invoices` link and wrong key labels | Passed | CI `2e32342`: pages load; labels reviewed in code |  | Sales link and key labels fixed |
| N-03 | Navigation | One path for switching company; stale state after switching | Passed | CI `2e32342`; `tests/company-switch.test.tsx` | `src/lib/organisation/active-org.ts`, `AuthContext.tsx`, `client.ts` | One path for switching; add-company hidden when a company exists |
| K-01 | Keyboard | Fix F5/F1/F11 in fields, modifier keys, unsaved check, voucher F-keys while typing | Passed | CI `2e32342`: `K-01` to `K-05` |  | Open: header links skip the unsaved check; Gateway and Executive keys ignore the preference |
| M-01 | Migrations | Advisory lock in `migrate.sh` | Passed | Local: two concurrent runners on Postgres 18, second applied 0 of 51, no locks left. Not run in Compose | `db/migrate.sh` |  |
| M-02 | Migrations | Decide per-file transaction handling; document repair | Passed | Decision recorded in `DATABASE_AND_MIGRATIONS.md` | None | Files can't all share a transaction. Recovery is restoring the pre-upgrade backup |
| W-01 | Workflows | Scripted critical proof: voucher → Day Book → ledger → Trial Balance → debits equal credits | Passed | CI `2381911`, docker job: W-01a to W-01i | `tests/e2e/stack.mjs` | Found both report bugs below |
| W-02 | Workflows | Scripted: auth matrix from §8 (no token, permitted, forbidden, no membership, low role, expired, logout) | Passed | CI `d8a7840`, docker job: A-01 to A-17, S-06 | `tests/e2e/stack.mjs` | Expired access token still simulated with a refresh cookie |
| W-03 | Workflows | Scripted: clean onboarding with demo seed off | Passed | CI `2381911`, docker job: O-01 to O-07 | `tests/e2e/stack.mjs` | API level, not through the onboarding page |
| W-05 | Workflows | Fix found by W-01: drafts and unbalanced vouchers counted in Trial Balance and account balances | Passed | CI `2381911`; `report_views_test.sql` failed before the fix | Migration 045 | Open since migration 017 |
| W-06 | Workflows | Fix found by W-01: cash, COGS, DSO, DPO and working capital read zero in Cash Flow, FP&A and the Consultant | Passed | CI `2381911`; `report_views_test.sql` | Migration 046 | Migration 023 compared the wrong chart columns |
| W-07 | Workflows | Fixes found reading the screens: receipts shown as journals, drafts stuck with approvals on, voucher period by date, invented Mumbai city, Day Book account filter, audit trail hiding database events, reconciliation listing non-bank accounts | Passed | CI `2e32342`: 388 of 388 | Migration 052, Day Book, vouchers, parties, reconciliation, `routes/audit.rs` | Not checked in a browser |
| W-08 | Workflows | General Ledger screen; dated Trial Balance, P&L and Balance Sheet; CSV exports; draft editing; catalogue items on invoices; completing a reconciliation | Passed | CI `2e32342`: `R-`, `E-`, `B-` checks | Migrations 054 to 056 | Found: a CFO couldn't undo a match, and undo reported success when refused |
| S-13 | Security | Pay details visible only to those who run payroll, and the employee | Passed | CI `2e32342`; `employee_privacy_test.sql` | Migration 057 | Every member could read salaries and PAN |
| W-09 | Workflows | Payroll posting to the ledger | Passed | CI `2e32342`: `B-12`, `B-13`; `payroll_posting_test.sql` | Migration 058, `routes/departments.rs`, Departments & Members | Accounts 2091, 2092 and 2093 need an accountant's review |
| W-04 | Workflows | Sales, purchases, reports and remaining modules from §10 | Passed | CI `d8a7840`, docker job: M-01 to M-12 | `tests/e2e/workflows.mjs` | Bank reconciliation, payroll and marketplace not covered. Found: wrong-check-digit GSTINs were accepted |

## Phases 2–4: persistence, images, local acceptance

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| C-01 | Docker | Pin PostgREST to the same version as GCP | Passed | Re-pinned to `v12.2.3` after commit `507c421` moved it back to `latest` | `docker-compose.yml` | `platform: linux/amd64` from that commit kept |
| C-02 | Docker | `DEKU_SEED_DEMO` configurable, off by default | Passed | CI `2381911`, docker job: fresh and demo stages | `docker-compose.yml`, `.env.example` |  |
| C-03 | Docker | Health checks, restart policies, health-based start order | Passed | CI `d8a7840`, docker job | `docker-compose.yml`, `backend/Dockerfile` | PostgREST has no check of its own (its image has no shell); the backend's `/ready` covers it |
| C-04 | Docker | Root `.dockerignore` excludes nested `.env` files | Passed | `.dockerignore` reviewed; `backend/.env.example` is the only nested env file | `.dockerignore` |  |
| C-05 | Docker | Image sizes, tags, SBOM and scan | Passed | CI `2e32342`: see the test report's image scan | `.github/workflows/ci.yml` | Reports only, doesn't block. Migrate image has 26 findings from the Postgres base. No version tags on local images |
| C-06 | Docker | CI job runs the full stack and the W scripts | Passed | CI `2381911`, docker job: 47 of 47 | `.github/workflows/ci.yml`, `tests/e2e/` | CI runner, not a developer machine |
| B-01 | Backup | Database and file backup and restore, tested | Passed | CI `d8a7840`, docker job: step "Backup restores into a new database" then 4 of 4 persistence checks | `.github/workflows/ci.yml`, `BACKUP_AND_RESTORE.md` | Database and files together; restored on a CI runner |
| D-01 to D-18 | Local acceptance | Plan §15 | In Progress | [Test report](LOCAL_DOCKER_TEST_REPORT.md): CI passes all except D-16 | CI, `tests/e2e` | Owner: other developer, for the run on a real machine |

## Phases 5–7: GCP

Gated on local acceptance. Needs a GCP project, billing and Parth's approval before anything is created.

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| G-A | GCP | Architecture decision record | In Progress | Proposed in `GCP_SINGLE_ORG_DEPLOYMENT.md` | `docs/runtime/GCP_SINGLE_ORG_DEPLOYMENT.md` | Deployer confirms it |
| G-B | GCP | Fix `cloudbuild.yaml:94`, private DB, restore steps, probes, immutable tags, README errors | In Progress | Not executed | `deploy/gcp/cloudbuild.yaml` | `\n` typo fixed, `_ADMIN_EMAIL` added. Other items open |
| G-01 to G-15 | GCP acceptance | Plan §19 | Not Started | | | |

## Phases 8–9: tutorials and handover

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| T-01 | Tutorials | Tutorial centre, paths 1–9, acceptance from §23 | Passed | CI `2e32342`: `T-01` to `T-09`, every step of every path in Chromium | `src/lib/tutorials`, `TutorialCoach.tsx`, `HelpCentreView.tsx`, `/help` | Text still needs a human read |
| X-01 | Docs | The 12 documents in §24 | In Progress | All 12 written in `docs/runtime` | `docs/runtime/*` | Local commands ran in CI, not on a developer machine; GCP documents can't be finished until deployment |
| X-02 | Docs | Restore or repoint references to deleted docs | Passed | Files restored from `a6bd216` | `docs/INTEGRATIONS.md`, `docs/HSN_IMPORT.md`, `gsp.rs`, `kyc.rs` | Migrations 037 and 038 still mention the removed plan in comments; applied files can't change |
