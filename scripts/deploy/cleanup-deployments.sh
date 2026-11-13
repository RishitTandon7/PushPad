#!/usr/bin/env bash
# Cron job helper: destroy deployments whose ExpiresAt tag has passed, plus leftovers whose server is already gone.
# Works from EC2 tags and S3 only, so it still cleans up if the control plane is down.
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
load_buckets

now="$(date +%s)"
ttl_s=$(( $(limit ttlMinutes) * 60 ))
tf_dir="$ROOT/${DEPLOY_TF_DIR:-infra/deployment}"

destroy_one() {
  local id="$1" reason="$2"
  ( export DEPLOY_ID="$id"
    if "$ROOT/scripts/deploy/destroy.sh"; then
      "$ROOT/scripts/deploy/report.sh" - destroyed
      echo "Destroyed deployment ${id} (${reason})"
    else
      echo "WARNING: could not destroy ${id}; will retry next run"
    fi )
}

# 1. Servers whose time is up.
running_ids=""
# shellcheck disable=SC2016  # the backticks below are JMESPath string literals, not shell
while read -r id expires; do
  [[ "$id" =~ ^[a-f0-9]{10}$ ]] || continue
  running_ids="$running_ids $id"
  exp_s="$(date -d "$expires" +%s 2>/dev/null || echo 0)"
  if [ "$exp_s" -gt 0 ] && [ "$exp_s" -le "$now" ]; then destroy_one "$id" "expired"; fi
done < <(aws ec2 describe-instances \
  --filters "Name=tag:ManagedBy,Values=pushpad-deploy" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[].Instances[].[Tags[?Key==`DeployId`]|[0].Value, Tags[?Key==`ExpiresAt`]|[0].Value]' --output text)

# 2. Workspaces with no server (a failed or interrupted run): remove them once they are clearly old.
terraform -chdir="$tf_dir" init -input=false -no-color -backend-config="bucket=${STATE_BUCKET}" > /dev/null
for ws in $(terraform -chdir="$tf_dir" workspace list | tr -d '* ' | grep -E '^d-[a-f0-9]{10}$' || true); do
  id="${ws#d-}"
  case " $running_ids " in *" $id "*) continue ;; esac
  modified="$(aws s3api head-object --bucket "$ARTIFACTS_BUCKET" --key "deployments/${id}/app.zip" --query LastModified --output text 2>/dev/null || echo "")"
  if [ -z "$modified" ] || [ "$modified" = "None" ]; then
    destroy_one "$id" "leftover workspace"
  else
    mod_s="$(date -d "$modified" +%s 2>/dev/null || echo "$now")"
    if [ $(( now - mod_s )) -gt $(( ttl_s + 1800 )) ]; then destroy_one "$id" "leftover workspace"; fi
  fi
done
echo "Deployment cleanup finished."
