# Deku Finance runtime: master checklist

Tracks [`Deku_Finance_Runtime_Completion_and_Deployment_Plan.md`](../Deku_Finance_Runtime_Completion_and_Deployment_Plan.md) §25. Audit findings and evidence for "Not Started" items are in §3A of that plan.

Status values: Not Started, In Progress, Blocked, Passed. Passed needs a recorded command result. Owner is Parth unless noted.

## Phase 0: inventory

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| R-01 | Audit | Repository and runtime inventory | Passed | Plan §3A, commit `8b1a1ed` | Plan, this file | Code reading only |

## Phase 1: single-organisation runtime

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| A-01 | Honest data | Cash Flow reads the real SQL keys; shows "–" on failure | Not Started | | | Blocker 3 |
| A-02 | Honest data | Remove invented Consultant figures and chat histories | Not Started | | | Blocker 4 |
| A-03 | Honest data | Remove fake proof: no random references, no `verified: true`, no hardcoded approver | Not Started | | | Blocker 2 |
| A-04 | Honest data | FP&A verdicts computed or removed; show load errors | Not Started | | | |
| A-05 | Honest data | Server-issued sequential voucher numbers | Not Started | | | Random today, can collide |
| A-06 | Honest data | Sample bills can't be posted to a real company | Not Started | | | |
| A-07 | Honest data | Fix "Liquid" total, Sec 22 threshold, hardcoded FY labels, unconditional status labels | Not Started | | | |
| A-08 | Honest data | Remove or qualify marketing claims with no feature behind them | Not Started | | | |
| F-01 | Files | Store and serve uploaded documents with size, type and access checks | Not Started | | | Blocker 1 |
| S-01 | Security | Switch to close public signup; first admin bootstrap | Not Started | | | Blocker 5 |
| S-02 | Security | Demo credentials and buttons only in demo mode | Not Started | | | Blocker 7 |
| S-03 | Security | Production refuses dev secrets; frontend fails fast without `JWT_SECRET` | Not Started | | | |
| S-04 | Security | Origin check on cookie-authenticated writes and auth routes | Not Started | | | |
| S-05 | Security | Login rate limit | Not Started | | | |
| S-06 | Security | Password change and admin-driven reset | Not Started | | | No email provider |
| S-07 | Security | Keep session on transient refresh failure; handle multi-instance refresh | Not Started | | | |
| S-08 | Security | Production log level; keep query strings out of logs | Not Started | | | |
| S-09 | Security | Block `api/v1/auth/*` through the proxy | Not Started | | | |
| S-10 | Security | Remove the seeded vendor superadmin row | Not Started | | | New migration |
| S-11 | Security | Trace membership checks on service-token paths | Not Started | | | |
| S-12 | Security | Close invited-address squatting | Not Started | | | |
| O-01 | Single org | Remove trial lockout for a single-customer deployment | Not Started | | | Blocker 6 |
| O-02 | Single org | Chart of accounts created exactly once with the company | Not Started | | | |
| O-03 | Single org | Limit a deployment to one organisation | Not Started | | | |
| O-04 | Single org | Invite link and `?next=` survive login | Not Started | | | |
| N-01 | Navigation | Menu entries for `/inventory`, `/marketplace`, `/import`, `/export`; remove `/logs` duplicate and dead `AppSidebar` | Not Started | | | |
| N-02 | Navigation | Fix missing `/gst/sales-invoices` link and wrong key labels | Not Started | | | |
| N-03 | Navigation | One path for switching company; stale state after switching | Not Started | | | |
| K-01 | Keyboard | Fix F5/F1/F11 in fields, modifier keys, unsaved check, voucher F-keys while typing | Not Started | | | |
| M-01 | Migrations | Advisory lock in `migrate.sh` | Not Started | | | |
| M-02 | Migrations | Decide per-file transaction handling; document repair | Not Started | | | 016 can't run in one transaction |
| W-01 | Workflows | Scripted critical proof: voucher → Day Book → ledger → Trial Balance → debits equal credits | Not Started | | | §10 |
| W-02 | Workflows | Scripted: auth matrix from §8 (no token, permitted, forbidden, no membership, low role, expired, logout) | Not Started | | | |
| W-03 | Workflows | Scripted: clean onboarding with demo seed off | Not Started | | | §7 |
| W-04 | Workflows | Sales, purchases, reports and remaining modules from §10 | Not Started | | | |

## Phases 2–4: persistence, images, local acceptance

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| C-01 | Docker | Pin PostgREST to the same version as GCP | Not Started | | | |
| C-02 | Docker | `DEKU_SEED_DEMO` configurable, off by default | Not Started | | | |
| C-03 | Docker | Health checks, restart policies, health-based start order | Not Started | | | |
| C-04 | Docker | Root `.dockerignore` excludes nested `.env` files | Not Started | | | |
| C-05 | Docker | Image sizes, tags, SBOM and scan | Not Started | | | §13 |
| C-06 | Docker | CI job runs the full stack and the W scripts | Not Started | | | No local Docker on the audit machine |
| B-01 | Backup | Database and file backup and restore, tested | Not Started | | | D-17 |
| D-01 to D-18 | Local acceptance | Plan §15 | Not Started | | | Results go in `LOCAL_DOCKER_TEST_REPORT.md` |

## Phases 5–7: GCP

Gated on local acceptance. Needs a GCP project, billing and Parth's approval before anything is created.

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| G-A | GCP | Architecture decision record | Not Started | | | §16 |
| G-B | GCP | Fix `cloudbuild.yaml:94`, private DB, restore steps, probes, immutable tags, README errors | Not Started | | | Plan §3A.10 |
| G-01 to G-15 | GCP acceptance | Plan §19 | Not Started | | | |

## Phases 8–9: tutorials and handover

| ID | Workstream | Task | Status | Evidence | Files changed | Notes |
|---|---|---|---|---|---|---|
| T-01 | Tutorials | Tutorial centre, paths 1–9, acceptance from §23 | Not Started | | | Paths 5 and 7 depend on real features |
| X-01 | Docs | The 12 documents in §24 | Not Started | | | |
| X-02 | Docs | Restore or repoint references to deleted docs | Not Started | | | `.env.example`, `db/import_hsn.sh`, `deploy/gcp/README.md` |
