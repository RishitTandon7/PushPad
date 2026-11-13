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

# Firewall: HTTP open to the world, SSH only when ssh_cidr is set.
resource "aws_security_group" "app" {
  name_prefix = "${local.name}-"
  description = "PushPad app ${terraform.workspace}"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.ssh_cidr == "" ? [] : [var.ssh_cidr]
    content {
      description = "SSH (opt-in)"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}
