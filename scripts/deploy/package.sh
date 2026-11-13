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
# Human-readable size that never rounds a non-empty zip down to 0.
if [ "$size_bytes" -lt 1024 ]; then pretty="${size_bytes} bytes"
elif [ "$size_bytes" -lt $((1024 * 1024)) ]; then pretty="$(awk -v b="$size_bytes" 'BEGIN { printf "%.1f KB", b / 1024 }')"
else pretty="$(awk -v b="$size_bytes" 'BEGIN { printf "%.1f MB", b / 1048576 }')"; fi
files="$(unzip -Z1 "$WORK/app.zip" | grep -vc '/$' || true)"
[ "${files:-0}" -gt 0 ] || fail "The project folder has no files to deploy."
if [ "$size_bytes" -lt 1024 ]; then say "Package size ${pretty}, ${files} files"; else say "Package size ${pretty} (${size_bytes} bytes), ${files} files"; fi
