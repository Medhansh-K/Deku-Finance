#!/bin/sh
# For an administrator locked out with nobody in the app to ask: prints a one-time reset link, valid
# for 24 hours. Needs direct database access, so treat the output like a password.
# Usage: DATABASE_URL=... APP_URL=https://app.example sh db/issue_password_reset.sh person@company.com
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${APP_URL:?APP_URL is required, for example https://app.example}"
email="${1:?usage: issue_password_reset.sh person@company.com}"

# Same format and hash as the backend's: base64url of 32 random bytes, stored only as SHA-256 hex.
token=$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')
hash=$(printf '%s' "$token" | sha256sum | cut -d ' ' -f 1)

found=$(psql -X -q -At -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -v email="$email" -v hash="$hash" <<'SQL'
WITH target AS (
  SELECT id FROM auth.users WHERE email = lower(trim(:'email'))
), cleared AS (
  DELETE FROM auth.password_resets WHERE user_id IN (SELECT id FROM target) AND used_at IS NULL
)
INSERT INTO auth.password_resets (token_hash, user_id, expires_at)
SELECT :'hash', id, now() + interval '24 hours' FROM target
RETURNING 1;
SQL
)

if [ "$found" != "1" ]; then
  echo "No account for $email" >&2
  exit 1
fi
echo "${APP_URL%/}/reset-password?token=$token"
