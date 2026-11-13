#!/usr/bin/env bash
# Destroys EVERY PushPad environment (all previews and prod). Run after the project review.
# Does not delete the buckets or the Jenkins server; see docs/SETUP.md for those.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/aws-env.sh
. "$ROOT/scripts/aws-env.sh"
cd "$ROOT/infra"
terraform init -input=false -backend-config="bucket=$STATE_BUCKET" > /dev/null

workspaces="$(terraform workspace list | tr -d '* ' | grep -v '^default$' || true)"
echo "This will DESTROY these environments in $AWS_DEFAULT_REGION:"
echo "${workspaces:-  (none)}"
read -r -p "Type 'destroy' to continue: " answer
[ "$answer" = "destroy" ] || { echo "Aborted."; exit 1; }

destroyed=(); failed=()
for ws in $workspaces; do
  env_type=preview; [ "$ws" = "prod" ] && env_type=prod
  terraform workspace select "$ws" > /dev/null
  if terraform destroy -auto-approve -input=false -var "app_version=destroy" -var "branch=$ws" \
       -var "env=$env_type" -var "artifacts_bucket=$ARTIFACTS_BUCKET" > /dev/null; then
    terraform workspace select default > /dev/null
    terraform workspace delete "$ws" > /dev/null
    destroyed+=("$ws")
  else
    failed+=("$ws"); terraform workspace select default > /dev/null
  fi
done
# Remove the build zips and rollback pointers so nothing is left behind.
aws s3 rm "s3://$ARTIFACTS_BUCKET/" --recursive > /dev/null || true

echo "Destroyed: ${destroyed[*]:-none}"
echo "Failed:    ${failed[*]:-none}"
[ "${#failed[@]}" -eq 0 ]
