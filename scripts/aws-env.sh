#!/usr/bin/env bash
# Source this: exports bucket names derived from the caller's AWS account (matches infra/bootstrap).
# No account ID is hardcoded anywhere; the Jenkins EC2 IAM role provides credentials.
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export STATE_BUCKET="pushpad-tfstate-${ACCOUNT_ID}"
export ARTIFACTS_BUCKET="pushpad-artifacts-${ACCOUNT_ID}"
