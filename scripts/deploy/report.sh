#!/usr/bin/env bash
# Tell the control plane about progress. Usage: report.sh <stage|-> <running|done|failed|live|destroyed> [message] [url] [instance-id]
# The callback URL and secret come from SSM Parameter Store (via the Jenkins instance role), never from the repo.
# Reporting must never break a build, so this script always exits 0.
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
set +e

stage="${1:--}"; status="${2:?status}"; message="${3:-}"; url="${4:-}"; instance="${5:-}"
require_id

param() { aws ssm get-parameter --name "/pushpad/$1" --with-decryption --query Parameter.Value --output text 2>/dev/null; }
base="${CONTROL_PLANE_URL:-$(param public-base-url)}"
secret="${CALLBACK_SECRET:-$(param callback-secret)}"
if [ -z "$base" ] || [ -z "$secret" ]; then echo "report: control plane not configured, skipping"; exit 0; fi

app_type=""; [ -f "$WORK/app-type" ] && app_type="$(cat "$WORK/app-type")"
logs="[]"
if [ -s "$WORK/log.txt" ]; then
  logs="$(tail -n 15 "$WORK/log.txt" | jq -R . | jq -s .)"
  : > "$WORK/log.txt"
fi

payload="$(jq -n --arg id "$DEPLOY_ID" --arg stage "$stage" --arg status "$status" --arg message "$message" \
  --arg url "$url" --arg instance "$instance" --arg appType "$app_type" --argjson logs "$logs" \
  '{deployId: $id, status: $status, logs: $logs}
   + (if $stage != "-" then {stage: $stage} else {} end)
   + (if $message != "" then {message: $message} else {} end)
   + (if $url != "" then {url: $url} else {} end)
   + (if $instance != "" then {instanceId: $instance} else {} end)
   + (if $appType != "" then {appType: $appType} else {} end)')"

# Keep the secret out of the process list: pass the header from a private temp file.
hdr="$(mktemp)"; chmod 600 "$hdr"
printf 'X-PushPad-Secret: %s\n' "$secret" > "$hdr"
printf '%s' "$payload" | curl -fsS --max-time 10 -X POST -H 'Content-Type: application/json' -H "@$hdr" --data @- \
  "${base%/}/api/internal/jenkins/callback" > /dev/null || echo "report: callback failed (ignored)"
rm -f "$hdr"
exit 0
