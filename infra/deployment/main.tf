provider "aws" {
  region = var.region
}

# Latest Amazon Linux 2023 AMI from the public SSM parameter (no hardcoded AMI ID).
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# Default VPC so no networking has to be created per deployment.
data "aws_vpc" "default" {
  default = true
}

locals {
  name = "pushpad-d-${var.deploy_id}"
  # Split s3://bucket/key into its parts so the role can be limited to this deployment's own folder.
  artifact_parts = regex("^s3://([^/]+)/(.+)$", var.artifact_url)
  bucket         = local.artifact_parts[0]
  prefix         = "deployments/${var.deploy_id}"
}
