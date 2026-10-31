# Build from the repo root: docker build -f db/Dockerfile .
FROM postgres:16-alpine
COPY supabase/migrations /migrations
COPY supabase/seed.sql /seed.sql
COPY db/migrate.sh /usr/local/bin/migrate.sh
USER postgres
ENTRYPOINT ["/bin/sh", "/usr/local/bin/migrate.sh"]
