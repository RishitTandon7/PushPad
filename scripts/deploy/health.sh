#!/usr/bin/env bash
# Stage 6: wait until the new site answers on port 80 (any non-5xx response counts as alive).
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
require_id
url="$(cat "$WORK/url.txt")"

timeout_s="$(limit healthTimeoutSeconds)"
deadline=$((SECONDS + timeout_s))
say "Waiting for the site to answer on port 80"
while [ "$SECONDS" -lt "$deadline" ]; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url/" || true)"
  if [ "${code:-000}" != "000" ] && [ "$code" -lt 500 ]; then
    say "GET / returned ${code}"
    exit 0
  fi
  sleep 5
done
fail "The site did not respond within $((timeout_s / 60)) minutes."
