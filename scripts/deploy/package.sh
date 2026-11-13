#!/usr/bin/env bash
# Stage 3: zip the SOURCE only. No npm install, no build, no repo code runs on the Jenkins server.
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
require_id
dir="$(project_dir)"

rm -f "$WORK/app.zip"
say "Zipping source only (no install, no code run)"
(cd "$dir" && zip -qr -y "$WORK/app.zip" . -x '.git/*' 'node_modules/*') || fail "Could not package the project."

max_mb="$(limit maxZipMb)"
size_bytes="$(stat -c %s "$WORK/app.zip")"
if [ "$size_bytes" -gt $((max_mb * 1024 * 1024)) ]; then
  fail "The project is larger than the ${max_mb} MB limit."
fi
say "Package size $((size_bytes / 1024)) KB"
