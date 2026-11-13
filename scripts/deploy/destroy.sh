#!/usr/bin/env bash
# Destroy one deployment: terraform destroy, delete its workspace, delete its S3 objects. Safe to run twice.
# Usage: DEPLOY_ID=<id> destroy.sh
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
require_id
load_buckets

tf_dir="$ROOT/${DEPLOY_TF_DIR:-infra/deployment}"
ws="d-${DEPLOY_ID}"

terraform -chdir="$tf_dir" init -input=false -no-color -backend-config="bucket=${STATE_BUCKET}" > /dev/null || fail "Could not initialise Terraform."

if terraform -chdir="$tf_dir" workspace list | tr -d '* ' | grep -qx "$ws"; then
  terraform -chdir="$tf_dir" workspace select "$ws" > /dev/null
  # Variables are required by Terraform but unused by destroy, so dummy values are fine.
  terraform -chdir="$tf_dir" destroy -auto-approve -input=false -no-color -lock-timeout=60s \
    -var "deploy_id=${DEPLOY_ID}" -var "artifact_url=s3://${ARTIFACTS_BUCKET}/deployments/${DEPLOY_ID}/app.zip" \
    -var "app_type=static" -var "ttl_minutes=10" > "$WORK/destroy.log" 2>&1 || { tail -n 5 "$WORK/destroy.log" || true; fail "Could not destroy the server."; }
  terraform -chdir="$tf_dir" workspace select default > /dev/null
  terraform -chdir="$tf_dir" workspace delete "$ws" > /dev/null
fi

aws s3 rm "s3://${ARTIFACTS_BUCKET}/deployments/${DEPLOY_ID}/" --recursive --only-show-errors || true
say "Destroyed deployment ${DEPLOY_ID}"
