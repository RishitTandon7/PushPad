# The region comes from AWS_DEFAULT_REGION at init time, so it is never hardcoded here.
# Remote state for short-term deployments, kept separate from the branch-preview state in infra/.
# One workspace per deployment (d-<id>); the bucket is passed with -backend-config="bucket=<name>".
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    key          = "pushpad/deployments.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
