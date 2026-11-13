#!/usr/bin/env bash
# Shared helpers for the deployment pipeline scripts. Source this file; do not run it.
# Rule for every script here: user input (repo URL, branch, folder) is validated, always double-quoted,
# and never used to run repo code on the Jenkins server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
WORK="${WORKSPACE:-$PWD}/.deploy"        # scratch folder for this build
mkdir -p "$WORK"

# Read one value from the single limits file shared with the app.
limit() { jq -r ".$1" "$ROOT/app/config/limits.json"; }

# Print a line to the build log and keep it for the next callback to the control plane.
say() { echo "$*"; echo "$*" >> "$WORK/log.txt"; }

# Stop with a plain-English message that is safe to show to users (the pipeline sends it to the UI).
fail() { printf '%s' "$1" > "$WORK/error.txt"; echo "ERROR: $1" >&2; exit 1; }

require_id() { [[ "${DEPLOY_ID:-}" =~ ^[a-f0-9]{10}$ ]] || fail "Invalid deployment id."; }

# Second line of defence: the control plane already validated these, but Jenkins can be triggered by anyone with access.
validate_inputs() {
  [[ "${REPO_URL:-}" =~ ^https://github\.com/[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$ ]] || fail "Only public https://github.com/<owner>/<repo> URLs are supported."
  [[ "${BRANCH:-}" =~ ^[A-Za-z0-9._/-]{1,100}$ && "$BRANCH" != -* && "$BRANCH" != /* && "$BRANCH" != */ && "$BRANCH" != *..* && "$BRANCH" != *//* ]] || fail "That branch name is not valid."
  if [ -n "${SUBDIR:-}" ]; then
    [[ "$SUBDIR" =~ ^[A-Za-z0-9._/-]{1,100}$ && "$SUBDIR" != -* && "$SUBDIR" != /* && "$SUBDIR" != *..* && "$SUBDIR" != *//* ]] || fail "That folder name is not valid."
  fi
}

# The folder that holds the project (the repo root, or SUBDIR inside it), checked to stay inside the clone.
project_dir() {
  local base="$WORK/src" dir="$WORK/src/${SUBDIR:-}"
  [ -d "$dir" ] || fail "The folder '${SUBDIR:-}' was not found in the repository."
  case "$(cd "$dir" && pwd -P)" in
    "$(cd "$base" && pwd -P)"*) echo "$dir" ;;
    *) fail "That folder is not valid." ;;
  esac
}

# Bucket names are derived from the AWS account, matching infra/bootstrap (no IDs hardcoded).
load_buckets() {
  local account
  account="$(aws sts get-caller-identity --query Account --output text)"
  export STATE_BUCKET="pushpad-tfstate-${account}"
  export ARTIFACTS_BUCKET="pushpad-artifacts-${account}"
}
