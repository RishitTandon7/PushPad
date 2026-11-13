#!/usr/bin/env bash
# Destroys preview environments whose Git branch is gone, or that are older than MAX_AGE_HOURS.
# Run from the repo root (Jenkinsfile.cleanup does this). Never touches "default" or "prod".
set -euo pipefail

MAX_AGE_HOURS="${MAX_AGE_HOURS:-24}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/aws-env.sh
. "$ROOT/scripts/aws-env.sh"

# 1. Which branches still exist on the remote? Abort if we cannot tell (never wipe on a failed lookup).
branches="$(git ls-remote --heads origin | sed 's|.*refs/heads/||')"
[ -n "$branches" ] || { echo "ERROR: no remote branches found, aborting cleanup"; exit 1; }

# 2. Convert them to workspace names with the same sanitizer the pipeline uses.
live_workspaces=""
while IFS= read -r b; do
  live_workspaces="$live_workspaces $("$ROOT/scripts/workspace-name.sh" "$b")"
done <<< "$branches"

cd "$ROOT/infra"
terraform init -input=false -backend-config="bucket=$STATE_BUCKET" > /dev/null

# Destroy one workspace, delete it, and delete its zips. Args: workspace reason
destroy_ws() {
  local ws="$1" reason="$2" branch
  terraform workspace select "$ws" > /dev/null
  branch="$(terraform show -json | jq -r '[.values.root_module.resources[]? | select(.type=="aws_instance") | .values.tags.Branch][0] // empty')"
  # Variables are required by Terraform but unused by destroy, so dummy values are fine.
  if terraform destroy -auto-approve -input=false \
      -var "app_version=destroy" -var "branch=${branch:-$ws}" -var "env=preview" \
      -var "artifacts_bucket=$ARTIFACTS_BUCKET" > /dev/null; then
    terraform workspace select default > /dev/null
    terraform workspace delete "$ws" > /dev/null
    aws s3 rm "s3://$ARTIFACTS_BUCKET/builds/$ws/" --recursive > /dev/null
    echo "Destroyed environment for $reason ${branch:-$ws}"
  else
    echo "WARNING: could not destroy $ws (locked or failed); will retry next run"
    terraform workspace select default > /dev/null
  fi
}

# 3. Walk every preview workspace.
for ws in $(terraform workspace list | tr -d '* ' | grep -vE '^(default|prod)$' || true); do
  if ! grep -qw -- "$ws" <<< "$live_workspaces"; then
    destroy_ws "$ws" "deleted branch"
    continue
  fi
  # Cost guard: branch still exists, but destroy previews older than MAX_AGE_HOURS.
  terraform workspace select "$ws" > /dev/null
  created="$(terraform show -json | jq -r '[.values.root_module.resources[]? | select(.type=="aws_instance") | .values.tags.CreatedAt][0] // empty')"
  terraform workspace select default > /dev/null
  if [ -n "$created" ]; then
    age_hours=$(( ( $(date +%s) - $(date -d "$created" +%s) ) / 3600 ))
    if [ "$age_hours" -ge "$MAX_AGE_HOURS" ]; then
      destroy_ws "$ws" "expired (${age_hours}h old) preview"
    fi
  fi
done
echo "Cleanup finished."
