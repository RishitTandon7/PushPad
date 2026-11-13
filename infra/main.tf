provider "aws" {
  region = var.region
}

# Latest Amazon Linux 2023 AMI, looked up from the public SSM parameter (no hardcoded AMI ID).
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# Default VPC so we need no networking of our own.
data "aws_vpc" "default" {
  default = true
}

locals {
  # Workspace name doubles as the resource name prefix (e.g. pushpad-feature-new-roll).
  name = "pushpad-${terraform.workspace}"
}
