# Troubleshooting

Start with `docker compose ps -a` and `docker compose logs --tail 50 <service>`.

| Symptom | Likely cause | Fix |
|---|---|---|
| `migrate` exited non-zero | A migration failed, or a file changed after being applied | Read `docker compose logs migrate`, then see [DATABASE_AND_MIGRATIONS.md](DATABASE_AND_MIGRATIONS.md) |
| "was changed after it was applied" | Someone edited an applied migration, or changed line endings beyond CRLF | Restore the file with Git and add a new migration |
| Port already in use | Another service on 3000, 8080 or 5433 | Stop it, or change the port mapping in `docker-compose.yml` |
| `backend` restarts repeatedly, with a panic in its logs | `JWT_SECRET` under 32 bytes or a dev-only value in production, an unknown provider name, or a malformed `DATA_ENCRYPTION_KEY` | The message names the variable. See [ENVIRONMENT_CONFIGURATION.md](ENVIRONMENT_CONFIGURATION.md) |
| `backend` unhealthy, `/ready` says `postgrest_unreachable` | PostgREST can't reach the database, or its password doesn't match | `docker compose logs postgrest`. Check `AUTHENTICATOR_PASSWORD` |
| `frontend` exits: "can't start: set ..." | Missing `JWT_SECRET` or `BACKEND_URL` | Set them |
| Sign-in works, then the session is lost immediately | Plain HTTP on a hostname other than localhost; cookies are `Secure` in the image | Use HTTPS, or localhost |
| "Sign-ups are closed" | The first administrator already exists, or production has no `DEKU_ADMIN_EMAIL` | Use an invitation link. On a new production deployment, set `DEKU_ADMIN_EMAIL` |
| "Too many failed sign-ins" | 10 failures within 15 minutes for that address | Wait 15 minutes, or use a reset link, which also clears the lock |
| Forgotten password | | An owner or admin creates a link in Departments & Members |
| The only owner is locked out | | With database access: `DATABASE_URL=... APP_URL=https://your-app sh db/issue_password_reset.sh person@company.com`. The output works like a password |
| "This deployment is set up for one company" | A company exists already | Expected. One company per deployment |
| Upload refused | Over 10 MB, or not a real PDF, PNG, JPEG or WebP | The check reads the file's contents, so renaming doesn't help |
| GST return shows figures but won't export | Company GSTIN is missing | Add it in Settings |
| GSTIN refused | Wrong check digit | Check for a typing mistake |
| HSN search is empty | The list hasn't been loaded | See [HSN_IMPORT.md](../HSN_IMPORT.md) |
| No notifications | Nothing triggers the job | See [APPLICATION_RUNTIME.md](APPLICATION_RUNTIME.md) |
| Payments, GSP or KYC shows "not configured" | Switched off by design | See [INTEGRATIONS.md](../INTEGRATIONS.md) |
