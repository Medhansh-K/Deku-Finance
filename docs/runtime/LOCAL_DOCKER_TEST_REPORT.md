# Local Docker test report

**Where these ran:** GitHub Actions, Ubuntu with Docker Engine, on a clean runner each time. **Not yet run on a developer's machine:** that run belongs to the developer handling Docker, and the "Developer machine" column is theirs to fill in.

**Commit:** `2e32342`. CI jobs `frontend`, `backend`, `sql` and `docker` all passed.

**Exact commands:** `.github/workflows/ci.yml`, job `docker`. Checks: `tests/e2e/stack.mjs` and `tests/e2e/workflows.mjs`.

| Stage | Result |
|---|---|
| Clean install (`fresh`) | 257 of 257 |
| Real Chromium: every page at desktop and phone width, all tutorials, keyboard, navigation, attachments (`browser.mjs`) | 121 of 121 |
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
| D-05 | Migrations complete and are tracked | PASS | NOT TESTED | 59 files; `migrate` exits 0; `wait.sh` fails on a non-zero exit |
| D-06 | PostgREST reaches the database | PASS | NOT TESTED | `D-06`, through the backend's `/ready` |
| D-07 | Backend health | PASS | NOT TESTED | `D-07` |
| D-08 | Frontend responds | PASS | NOT TESTED | `D-08` |
| D-09 | Signup, login, session, logout | PASS | NOT TESTED | `O-01`, `A-01` to `A-17`, `S-01`, `S-05`, `S-06` |
| D-10 | Clean onboarding without demo data | PASS | NOT TESTED | `O-01` to `O-09`, API level |
| D-11 | Demo mode | PASS | NOT TESTED | `D-11a`, `D-11b`, `S-02a`, `S-02b` |
| D-12 | Accounting workflow | PASS | NOT TESTED | `W-01a` to `W-01i`, `M-01` to `M-12`, `B-`, `R-` and `E-` checks |
| D-13 | Data survives recreation | PASS | NOT TESTED | `D-13a` to `D-13c` |
| D-14 | Documents survive recreation | PASS | NOT TESTED | `D-14`, byte for byte |
| D-15 | Missing credentials don't block startup | PASS | NOT TESTED | `D-15a`, `D-15b` |
| D-16 | Errors visible, secrets not leaked | NOT TESTED | NOT TESTED | Logs were read when failures occurred, but nothing scans them for secrets |
| D-17 | Backup restores | PASS | NOT TESTED | CI step "Backup restores into a new database" |
| D-18 | Repeatable clean install | PASS | NOT TESTED | Runs on a new runner on every push |

An application image update and recovery from a failed service haven't been tested separately.

## Not covered by these checks

- **Filling in forms through the screens.** Browser tests load every page and walk the tutorials, keyboard and navigation, while business flows are tested through the API behind those screens. The setup wizard and Day Book attachment are the two flows driven fully through the browser.
- **Other browsers.** Chromium only.
- **Phone layouts beyond loading.** Pages load at phone width and the guide card fits. Wide accounting tables can scroll sideways, and which pages do is written to `browser-screenshots/mobile-overflow.txt` in the CI artifact.
- **HR screens,** beyond loading, and **integrations against real providers.**

## Image scan

| Image | Size | High or critical findings |
|---|---|---|
| backend | 101 MB | 0 |
| frontend | 304 MB before removing npm | 0 |
| migrate | 295 MB | 26, all in Go's standard library, in a binary that comes with the official `postgres:16-alpine` image. It runs only during migrations. Check for an updated base image |

Scan: Trivy, unfixed findings ignored. SBOMs and full reports are in the CI artifact `browser-screenshots-and-image-reports`.

## Bugs this testing found and fixed

| Bug | Found by |
|---|---|
| Drafts and unbalanced vouchers counted in the Trial Balance and account balances | `W-01g` |
| Cash, COGS, DSO, DPO and working capital read zero | `W-01i` |
| Oversized uploads silently truncated and stored as corrupt files | `F-01i` |
| GSTINs with a wrong check digit accepted | `M-01-gstin` |
| The setup wizard flickered and couldn't be used after a new company's first sign-in: a hidden login page and the onboarding check kept redirecting each other | Browser run |
| The Consultant asked for its data before knowing the company, a 404 on every load | Browser run |
| The guide card could point at a hidden copy of an element, and a dialog on a hidden page disabled function keys | Browser run |
| A CFO couldn't undo a match, and undo reported success when refused | `B-03` |
| Every member could read all salaries and PAN | Agent review, then `employee_privacy_test.sql` |
