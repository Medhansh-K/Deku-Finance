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
| A-02 | Honest data | Remove invented Consultant figures and chat histories | In Progress | tsc and vitest, CI `2381911`; not exercised in a browser | `DekuConsultantView.tsx` | Some dead sidebar controls remain |
| A-03 | Honest data | Remove fake proof: no random references, no `verified: true`, no hardcoded approver | In Progress | tsc and vitest, CI `2381911`; not exercised in a browser | `VoucherWorkspace.tsx` | Fabrication removed. Proof stays session-only until F-01 |
| A-04 | Honest data | FP&A verdicts computed or removed; show load errors | Not Started | | | |
| A-05 | Honest data | Server-issued sequential voucher numbers | Not Started | | | Random today, can collide |
| A-06 | Honest data | Sample bills can't be posted to a real company | Not Started | | | |
| A-07 | Honest data | Fix "Liquid" total, Sec 22 threshold, hardcoded FY labels, unconditional status labels | Not Started | | | |
| A-08 | Honest data | Remove or qualify marketing claims with no feature behind them | Not Started | | | |
| F-01 | Files | Store and serve uploaded documents with size, type and access checks | In Progress | `document_files_test.sql`; CI `8840a96` pending | Migration 048, `routes/files.rs`, voucher and Day Book views | Postgres, 10 MB limit, immutable once attached |
| S-01 | Security | Switch to close public signup; first admin bootstrap | Passed | CI `bd36cdd`, docker job: S-01, S-01b; `single_customer_test.sql` | Migration 047, `routes/auth.rs`, `auth.rs`, `config.rs` | Only the first administrator and invited addresses can register |
| S-02 | Security | Demo credentials and buttons only in demo mode | Passed | CI `bd36cdd`, docker job: S-02a, S-02b, D-11a | `api/auth/demo/route.ts`, `AuthContext.tsx`, login page | Blocker 7 |
| S-03 | Security | Production refuses dev secrets; frontend fails fast without `JWT_SECRET` | In Progress | Backend unit test, CI `bd36cdd` | `config.rs` | Backend half only. Frontend still doesn't stop without `JWT_SECRET` |
| S-04 | Security | Origin check on cookie-authenticated writes and auth routes | In Progress | `tests/session.test.ts`; CI pending | `session.ts` | Checks Sec-Fetch-Site, then Origin, on every `/api/` write |
| S-05 | Security | Login rate limit | In Progress | `single_customer_test.sql`; CI pending | Migration 049, `routes/auth.rs`, `error.rs` | 10 failures locks an address for 15 minutes. Someone guessing can keep an account locked; add IP limits at the load balancer if that happens |
| S-06 | Security | Password change and admin-driven reset | Not Started | | | No email provider |
| S-07 | Security | Keep session on transient refresh failure; handle multi-instance refresh | In Progress | `tests/session.test.ts`; CI pending | `session.ts`, `cloudbuild.yaml` | Outages no longer sign users out. One frontend instance on Cloud Run avoids the refresh race |
| S-08 | Security | Production log level; keep query strings out of logs | In Progress | Compiles, CI `bd36cdd`; not observed on a deployed service | `main.rs` | Production default is now info level. Not observed on a deployed service |
| S-09 | Security | Block `api/v1/auth/*` through the proxy | In Progress | `tests/session.test.ts`; CI pending | `session.ts` |  |
| S-10 | Security | Remove the seeded vendor superadmin row | In Progress | `single_customer_test.sql`; CI pending | Migration 049 |  |
| S-11 | Security | Trace membership checks on service-token paths | Passed | Code trace; see notes | None | Read only. GSP and payments check role with the caller's token before service-token use. KYC authorises before acting; DigiLocker completion reads the request first only to learn its subject, and stays scoped to the company |
| S-12 | Security | Close invited-address squatting | In Progress | `single_customer_test.sql`; CI pending | Migration 049, `routes/auth.rs`, signup page | Invited signup now needs the link's token |
| O-01 | Single org | Remove trial lockout for a single-customer deployment | Passed | CI `bd36cdd`, docker job: O-09; `single_customer_test.sql` | Migration 047, license page | GO and PRO limits kept for a later hosted product |
| O-02 | Single org | Chart of accounts created exactly once with the company | Not Started | | | |
| O-03 | Single org | Limit a deployment to one organisation | Passed | CI `bd36cdd`, docker job: O-08; `single_customer_test.sql` | Migration 047, `routes/organisations.rs` | `/companies` still offers Add; the server refuses it |
| O-04 | Single org | Invite link and `?next=` survive login | In Progress | tsc only; not exercised in a browser | Login and signup pages, `next-path.ts` |  |
| N-01 | Navigation | Menu entries for `/inventory`, `/marketplace`, `/import`, `/export`; remove `/logs` duplicate and dead `AppSidebar` | In Progress | tsc, vitest and build; not exercised in a browser |  | Palette and Gateway entries added, `/logs` removed. `AppSidebar` left in place, unused |
| N-02 | Navigation | Fix missing `/gst/sales-invoices` link and wrong key labels | In Progress | tsc, vitest and build; not exercised in a browser |  | Sales link and key labels fixed |
| N-03 | Navigation | One path for switching company; stale state after switching | Not Started | | | |
| K-01 | Keyboard | Fix F5/F1/F11 in fields, modifier keys, unsaved check, voucher F-keys while typing | In Progress | `tests/shortcuts.test.ts`, tsc and build; not exercised in a browser |  | Fixed: F5, F1, F11 in fields, modifier keys, unsaved check, voucher F-keys while typing. Open: header links skip the unsaved check; Gateway and Executive keys ignore the preference |
| M-01 | Migrations | Advisory lock in `migrate.sh` | Not Started | | | |
| M-02 | Migrations | Decide per-file transaction handling; document repair | Not Started | | | 016 can't run in one transaction |
| W-01 | Workflows | Scripted critical proof: voucher → Day Book → ledger → Trial Balance → debits equal credits | Passed | CI `2381911`, docker job: W-01a to W-01i | `tests/e2e/stack.mjs` | Found both report bugs below |
| W-02 | Workflows | Scripted: auth matrix from §8 (no token, permitted, forbidden, no membership, low role, expired, logout) | In Progress | CI `2381911`, docker job: A-01 to A-17 | `tests/e2e/stack.mjs` | Expired access token is simulated with a refresh cookie, not a real expired JWT |
| W-03 | Workflows | Scripted: clean onboarding with demo seed off | Passed | CI `2381911`, docker job: O-01 to O-07 | `tests/e2e/stack.mjs` | API level, not through the onboarding page |
| W-05 | Workflows | Fix found by W-01: drafts and unbalanced vouchers counted in Trial Balance and account balances | Passed | CI `2381911`; `report_views_test.sql` failed before the fix | Migration 045 | Open since migration 017 |
| W-06 | Workflows | Fix found by W-01: cash, COGS, DSO, DPO and working capital read zero in Cash Flow, FP&A and the Consultant | Passed | CI `2381911`; `report_views_test.sql` | Migration 046 | Migration 023 compared the wrong chart columns |
| W-04 | Workflows | Sales, purchases, reports and remaining modules from §10 | Not Started | | | |

## Phases 2–4: persistence, images, local acceptance

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| C-01 | Docker | Pin PostgREST to the same version as GCP | Passed | CI `2381911`, docker job | `docker-compose.yml` |  |
| C-02 | Docker | `DEKU_SEED_DEMO` configurable, off by default | Passed | CI `2381911`, docker job: fresh and demo stages | `docker-compose.yml`, `.env.example` |  |
| C-03 | Docker | Health checks, restart policies, health-based start order | In Progress | CI `2381911`, docker job: containers report healthy | `docker-compose.yml`, `backend/Dockerfile` | PostgREST has no check of its own (its image has no shell); the backend's `/ready` covers it |
| C-04 | Docker | Root `.dockerignore` excludes nested `.env` files | In Progress | Not separately tested | `.dockerignore` |  |
| C-05 | Docker | Image sizes, tags, SBOM and scan | Not Started | | | §13 |
| C-06 | Docker | CI job runs the full stack and the W scripts | Passed | CI `2381911`, docker job: 47 of 47 | `.github/workflows/ci.yml`, `tests/e2e/` | CI runner, not a developer machine |
| B-01 | Backup | Database and file backup and restore, tested | Not Started | | | D-17 |
| D-01 to D-18 | Local acceptance | Plan §15 | Not Started | | | Results go in `LOCAL_DOCKER_TEST_REPORT.md` |

## Phases 5–7: GCP

Gated on local acceptance. Needs a GCP project, billing and Parth's approval before anything is created.

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| G-A | GCP | Architecture decision record | Not Started | | | §16 |
| G-B | GCP | Fix `cloudbuild.yaml:94`, private DB, restore steps, probes, immutable tags, README errors | In Progress | Not executed | `deploy/gcp/cloudbuild.yaml` | `\n` typo fixed, `_ADMIN_EMAIL` added. Other items open |
| G-01 to G-15 | GCP acceptance | Plan §19 | Not Started | | | |

## Phases 8–9: tutorials and handover

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| T-01 | Tutorials | Tutorial centre, paths 1–9, acceptance from §23 | Not Started | | | Paths 5 and 7 depend on real features |
| X-01 | Docs | The 12 documents in §24 | Not Started | | | |
| X-02 | Docs | Restore or repoint references to deleted docs | Not Started | | | `.env.example`, `db/import_hsn.sh`, `deploy/gcp/README.md` |
