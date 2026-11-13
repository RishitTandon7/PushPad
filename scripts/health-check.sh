#!/usr/bin/env bash
# Usage: health-check.sh <base-url> <expected-build>
# Retries /health for up to 3 minutes, then confirms /version reports this build.
set -uo pipefail
url="${1:?base url}"
build="${2:?expected build}"

ok=0
for i in $(seq 1 36); do
  if curl -fsS --max-time 5 "$url/health" | grep -q '"status":"ok"'; then ok=1; break; fi
  echo "health attempt $i/36 failed, retrying in 5s..."
  sleep 5
done
[ "$ok" = 1 ] || { echo "ERROR: $url/health never became healthy"; exit 1; }

got="$(curl -fsS --max-time 5 "$url/version" | jq -r '.build')"
if [ "$got" != "$build" ]; then
  echo "ERROR: /version reports build '$got', expected '$build'"
  exit 1
fi
echo "Healthy: $url is serving build $build"
