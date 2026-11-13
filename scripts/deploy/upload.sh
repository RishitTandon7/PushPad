#!/usr/bin/env bash
# Stage 4: upload the zip to deployments/<id>/ in the artifacts bucket.
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
require_id
load_buckets

say "Uploading to deployments/${DEPLOY_ID}/"
aws s3 cp "$WORK/app.zip" "s3://${ARTIFACTS_BUCKET}/deployments/${DEPLOY_ID}/app.zip" --only-show-errors || fail "Could not upload the package."
say "Upload complete"
