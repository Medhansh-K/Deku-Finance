# Local Docker setup

These commands run in CI on Ubuntu with Docker Engine. They haven't yet been recorded on a developer's Windows or macOS machine; see [LOCAL_DOCKER_TEST_REPORT.md](LOCAL_DOCKER_TEST_REPORT.md).

## Needs

- Docker Engine or Docker Desktop with Compose v2.
- Free ports on localhost: 3000, 8080 and 5433.
- PostgREST runs as `linux/amd64`, so Apple Silicon uses emulation.

## Start

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps -a
```

Open http://localhost:3000. The first build takes several minutes, mostly compiling the backend.

`migrate` should show `Exited (0)`. The others should be running, with `backend` and `frontend` healthy.

## First use

**Clean company (default):** go to `/signup`. The first account becomes the administrator. Everyone else joins through an invitation link from Departments & Members.

**Demo:** set `DEKU_SEED_DEMO=true` in `.env`, then `docker compose up -d`. The demo buttons appear on the login page. To try both, use a separate project and volume, and stop the first one, since they share ports:

```bash
docker compose down
DEKU_SEED_DEMO=true docker compose -p deku-demo up -d
```

## Everyday commands

| Task | Command |
|---|---|
| Logs | `docker compose logs -f backend` |
| Stop, keeping data | `docker compose down` |
| Start again | `docker compose up -d` |
| Update after pulling code | `docker compose up --build -d` |
| Database shell | `docker compose exec postgres psql -U postgres -d deku` |
| Generate notifications | `curl -X POST -H "X-Deku-Cron-Secret: dev-only-cron-secret" http://localhost:8080/api/v1/internal/notifications/generate` |

**`docker compose down -v` deletes the database and every document.** Don't run it on data you want to keep. Back up first ([BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md)).

Problems: see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Running the checks

With a clean stack running:

```bash
node tests/e2e/stack.mjs fresh
```

It creates a company and needs an empty database, because signup closes after the first administrator. Use a throwaway project, not your own data:

```bash
docker compose down
docker compose -p deku-e2e up --build -d
COMPOSE_PROJECT_NAME=deku-e2e bash tests/e2e/wait.sh
node tests/e2e/stack.mjs fresh
docker compose -p deku-e2e down -v
```
