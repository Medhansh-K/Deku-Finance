# Local Docker test report

**Where these ran:** GitHub Actions, Ubuntu with Docker Engine, on a clean runner each time. **Not yet run on a developer's machine:** that run belongs to the developer handling Docker, and the "Developer machine" column is theirs to fill in.

**Commit:** `d76ec6a`. CI jobs `frontend`, `backend`, `sql` and `docker` all passed.

**Exact commands:** `.github/workflows/ci.yml`, job `docker`. Checks: `tests/e2e/stack.mjs` and `tests/e2e/workflows.mjs`.

| Stage | Result |
|---|---|
| Clean install (`fresh`) | 130 of 130 |
| Containers removed and recreated on the same volume (`persisted`) | 4 of 4 |
| Backup restored into an empty database (`persisted`) | 4 of 4 |
| Demo mode in its own project and volume (`demo`) | 2 of 2 |
| Misconfigured services refuse to start | Passed |

## Acceptance tests (plan §15)

| ID | Test | CI | Developer machine | Evidence |
|---|---|---|---|---|
| D-01 | Compose config resolves | PASS | NOT TESTED | `docker compose config -q` |
| D-02 | Images build | PASS | NOT TESTED | `docker compose build` |
| D-03 | Services start in order | PASS | NOT TESTED | `tests/e2e/wait.sh` |
| D-04 | PostgreSQL health | PASS | NOT TESTED | Compose health check |
| D-05 | Migrations complete and are tracked | PASS | NOT TESTED | 54 files; `migrate` exits 0; `wait.sh` fails on a non-zero exit |
| D-06 | PostgREST reaches the database | PASS | NOT TESTED | `D-06`, through the backend's `/ready` |
| D-07 | Backend health | PASS | NOT TESTED | `D-07` |
| D-08 | Frontend responds | PASS | NOT TESTED | `D-08` |
| D-09 | Signup, login, session, logout | PASS | NOT TESTED | `O-01`, `A-01` to `A-17`, `S-01`, `S-05`, `S-06` |
| D-10 | Clean onboarding without demo data | PASS | NOT TESTED | `O-01` to `O-09`, API level |
| D-11 | Demo mode | PASS | NOT TESTED | `D-11a`, `D-11b`, `S-02a`, `S-02b` |
| D-12 | Accounting workflow | PASS | NOT TESTED | `W-01a` to `W-01i`, `M-01` to `M-12` |
| D-13 | Data survives recreation | PASS | NOT TESTED | `D-13a` to `D-13c` |
| D-14 | Documents survive recreation | PASS | NOT TESTED | `D-14`, byte for byte |
| D-15 | Missing credentials don't block startup | PASS | NOT TESTED | `D-15a`, `D-15b` |
| D-16 | Errors visible, secrets not leaked | NOT TESTED | NOT TESTED | Logs were read when failures occurred, but nothing scans them for secrets |
| D-17 | Backup restores | PASS | NOT TESTED | CI step "Backup restores into a new database" |
| D-18 | Repeatable clean install | PASS | NOT TESTED | Runs on a new runner on every push |

An application image update and recovery from a failed service haven't been tested separately.

## Not covered by these checks

- **Screens.** These checks use the same API as the browser, through the real frontend proxy, but nothing clicks through pages. That includes tutorials, uploads, keyboard behaviour and responsive layout.
- **Modules without an end-to-end test:** bank reconciliation, payroll, marketplace settlements, HR.
- **Integrations against real providers.**
- **Image sizes, SBOM and vulnerability scan** (checklist C-05).

## Bugs this testing found and fixed

| Bug | Found by |
|---|---|
| Drafts and unbalanced vouchers counted in the Trial Balance and account balances | `W-01g` |
| Cash, COGS, DSO, DPO and working capital read zero | `W-01i` |
| Oversized uploads silently truncated and stored as corrupt files | `F-01i` |
| GSTINs with a wrong check digit accepted | `M-01-gstin` |
