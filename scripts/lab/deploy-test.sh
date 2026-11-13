#!/usr/bin/env bash
# Starts a deployment through the control plane API and follows it until it is live or failed. Usage: deploy-test.sh <repoUrl> <subdir|-> <accessCode> [base-url]
set -uo pipefail
REPO="$1"; SUB="$2"; CODE="$3"; B="${4:-http://32.199.10.180}"
BODY="{\"repoUrl\":\"$REPO\",\"branch\":\"main\"$([ "$SUB" != "-" ] && printf ',"subdir":"%s"' "$SUB"),\"accessCode\":\"$CODE\"}"
R="$(curl -s -X POST "$B/api/deployments" -H 'content-type: application/json' -d "$BODY")"
ID="$(echo "$R" | python -c 'import json,sys;d=json.load(sys.stdin);print(d.get("deployment",{}).get("id",""))')"
[ -n "$ID" ] || { echo "rejected: $R"; exit 2; }
echo "id=$ID token=$(echo "$R" | python -c 'import json,sys;print(json.load(sys.stdin)["manageToken"])')"
for _ in $(seq 1 60); do
  D="$(curl -s "$B/api/deployments/$ID")"
  S="$(echo "$D" | python -c 'import json,sys;d=json.load(sys.stdin);print(d["status"],d.get("stage") or "",d.get("error") or "")')"; echo "$S"
  case "$S" in live*|failed*) break;; esac; sleep 6
done
echo "$D" | python -c 'import json,sys;d=json.load(sys.stdin);print("url:",d.get("url"),"expires:",d.get("expiresAt"))'
