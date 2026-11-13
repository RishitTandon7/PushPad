#!/usr/bin/env bash
# Stage 2: static detection by looking at files only (no code is run).
#   node   = package.json with a "start" script
#   static = index.html
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
require_id
dir="$(project_dir)"

if [ -f "$dir/package.json" ] && jq -e '.scripts.start | strings | length > 0' "$dir/package.json" > /dev/null 2>&1; then
  echo node > "$WORK/app-type"
  say "Found package.json with a start script"
elif [ -f "$dir/index.html" ]; then
  echo static > "$WORK/app-type"
  say "Found index.html"
else
  fail "No index.html or package.json with a start script was found, so PushPad cannot tell how to run this project."
fi
say "Project type: $(cat "$WORK/app-type")"
