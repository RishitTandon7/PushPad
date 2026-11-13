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

# Firewall: HTTP in, nothing else. No SSH, and outbound is limited to web traffic (DNS and metadata are not filtered by security groups).
resource "aws_security_group" "site" {
  name_prefix = "${local.name}-"
  description = "PushPad deployment ${var.deploy_id}"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTP out (package mirrors)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTPS out (S3, npm, dnf)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}
