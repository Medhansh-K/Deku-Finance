#!/usr/bin/env bash
# Waits for the frontend container's health check, which needs the backend, PostgREST and migrations.
# Fails at once if the migrate job failed, so a broken migration doesn't look like a slow start.
set -u
for _ in $(seq 1 90); do
  migrate=$(docker compose ps -a --format '{{.Service}} {{.State}} {{.ExitCode}}' | awk '$1=="migrate"')
  case "$migrate" in
    *exited*) [ "${migrate##* }" = 0 ] || { echo "migrate failed: $migrate"; exit 1; } ;;
  esac
  if docker compose ps --format '{{.Service}} {{.Health}}' | grep -q '^frontend healthy$'; then
    docker compose ps -a
    exit 0
  fi
  sleep 2
done
echo "stack not healthy after 3 minutes"
exit 1
