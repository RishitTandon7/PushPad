#!/usr/bin/env bash
# Lab fallback for infra/bootstrap: the lab SCP blocks s3:GetBucketObjectLockConfiguration, which the Terraform AWS provider reads on every bucket, so the two buckets are made with the AWS CLI instead.
set -euo pipefail
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
for B in "pushpad-tfstate-${ACCOUNT_ID}" "pushpad-artifacts-${ACCOUNT_ID}"; do
  if ! aws s3api head-bucket --bucket "$B" 2>/dev/null; then
    if [ "$REGION" = "us-east-1" ]; then aws s3api create-bucket --bucket "$B" >/dev/null
    else aws s3api create-bucket --bucket "$B" --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null; fi
  fi
  aws s3api put-bucket-versioning --bucket "$B" --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "$B" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-public-access-block --bucket "$B" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "ready: $B"
done
