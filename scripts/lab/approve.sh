#!/usr/bin/env bash
# Approves the pending "Deploy to PROD?" step of a Jenkins build. Usage: approve.sh <build-number> [job-path, default job/pushpad/job/main]
# Needs JENKINS_URL, JENKINS_USER, JENKINS_PASSWORD.
set -euo pipefail
N="${1:?build number}"; JOB="${2:-job/pushpad/job/main}"
winp() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
JAR="$(winp "$(mktemp)")"; trap 'rm -f "$JAR"' EXIT
A=(-u "$JENKINS_USER:$JENKINS_PASSWORD" -b "$JAR" -c "$JAR")
CRUMB="$(curl -fsS "${A[@]}" "$JENKINS_URL/crumbIssuer/api/json" | python -c 'import json,sys;d=json.load(sys.stdin);print(d["crumbRequestField"]+":"+d["crumb"])')"
ID="$(curl -fsS "${A[@]}" "$JENKINS_URL/$JOB/$N/wfapi/pendingInputActions" | python -c 'import json,sys;print(json.load(sys.stdin)[0]["id"])')"
curl -fsS "${A[@]}" -H "$CRUMB" -X POST "$JENKINS_URL/$JOB/$N/input/$ID/proceedEmpty" >/dev/null && echo "approved build $N"
