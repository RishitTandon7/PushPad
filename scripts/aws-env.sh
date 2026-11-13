#!/usr/bin/env bash
# Source this: exports bucket names derived from the caller's AWS account (matches infra/bootstrap).
# No account ID is hardcoded anywhere; the Jenkins EC2 IAM role provides credentials.
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_REGION="$AWS_DEFAULT_REGION"
export TF_VAR_region="$AWS_DEFAULT_REGION"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export STATE_BUCKET="pushpad-tfstate-${ACCOUNT_ID}"
export ARTIFACTS_BUCKET="pushpad-artifacts-${ACCOUNT_ID}"
