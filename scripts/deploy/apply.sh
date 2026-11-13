#!/usr/bin/env bash
# Stage 5: Terraform apply in its own workspace (d-<id>), one small EC2 instance per deployment.
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
require_id
load_buckets

tf_dir="$ROOT/${DEPLOY_TF_DIR:-infra/deployment}"     # swap this folder to use another cloud provider
app_type="$(cat "$WORK/app-type")"

say "terraform workspace d-${DEPLOY_ID}"
terraform -chdir="$tf_dir" init -input=false -no-color -backend-config="bucket=${STATE_BUCKET}" > /dev/null || fail "Could not initialise Terraform."
terraform -chdir="$tf_dir" workspace select -or-create "d-${DEPLOY_ID}" > /dev/null

say "Creating 1 small EC2 instance"
if ! timeout "$(limit applyTimeoutMinutes)m" terraform -chdir="$tf_dir" apply -auto-approve -input=false -no-color -lock-timeout=60s \
     -var "deploy_id=${DEPLOY_ID}" \
     -var "artifact_url=s3://${ARTIFACTS_BUCKET}/deployments/${DEPLOY_ID}/app.zip" \
     -var "app_type=${app_type}" \
     -var "ttl_minutes=$(limit ttlMinutes)" \
     -var "instance_type=$(limit instanceType)" > "$WORK/apply.log" 2>&1; then
  tail -n 5 "$WORK/apply.log" || true
  fail "Could not create the server."
fi

terraform -chdir="$tf_dir" output -raw url > "$WORK/url.txt"
terraform -chdir="$tf_dir" output -raw instance_id > "$WORK/instance-id.txt"
say "Apply complete: $(tail -n 1 "$WORK/apply.log")"
