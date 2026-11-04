# GCP deployment test report

**No deployment has happened, so every test is `NOT TESTED`.** Owner: the developer handling GCP.

| ID | Test | Status | Evidence |
|---|---|---|---|
| G-01 | All services healthy | NOT TESTED | |
| G-02 | Valid HTTPS | NOT TESTED | |
| G-03 | Initial admin signs in | NOT TESTED | |
| G-04 | Exactly one organisation | NOT TESTED | |
| G-05 | Backend and PostgREST reach the database | NOT TESTED | |
| G-06 | Correct migration version recorded | NOT TESTED | |
| G-07 | Voucher workflow and reports | NOT TESTED | |
| G-08 | Upload, download, persistence | NOT TESTED | |
| G-09 | Restart without data loss | NOT TESTED | |
| G-10 | No public database or leaked secrets | NOT TESTED | |
| G-11 | Backup completes | NOT TESTED | |
| G-12 | Restore in a separate environment | NOT TESTED | |
| G-13 | Logs, health and alerts | NOT TESTED | |
| G-14 | Previous image can be restored | NOT TESTED | |
| G-15 | Monthly cost documented | NOT TESTED | |

`tests/e2e/stack.mjs` can check a deployment by setting `E2E_BASE` and `E2E_BACKEND`, but its `fresh` mode needs an empty database and creates test data. Run it on a throwaway environment, never on a customer's.
