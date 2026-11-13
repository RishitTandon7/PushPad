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

# IAM role EC2 can assume: replaces access keys on the server.
resource "aws_iam_role" "app" {
  name_prefix = "${local.name}-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

# Least privilege: the instance may only read the build zips.
resource "aws_iam_role_policy" "read_artifacts" {
  name = "read-artifacts"
  role = aws_iam_role.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "arn:aws:s3:::${var.artifacts_bucket}/*"
    }]
  })
}

# Instance profile attaches the role to the EC2 instance.
resource "aws_iam_instance_profile" "app" {
  name_prefix = "${local.name}-"
  role        = aws_iam_role.app.name
}

# The server itself: boots from user_data, so changing the build replaces the instance (immutable infra).
resource "aws_instance" "app" {
  ami                         = data.aws_ssm_parameter.al2023.value
  instance_type               = var.instance_type
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  associate_public_ip_address = true

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    artifacts_bucket = var.artifacts_bucket
    app_version      = var.app_version
  })
  user_data_replace_on_change = true

  tags = {
    Name      = local.name
    Branch    = var.branch
    Env       = var.env
    Version   = var.app_version
    CreatedAt = timestamp()
    ManagedBy = "pushpad"
  }

  lifecycle {
    create_before_destroy = true
    # CreatedAt must stay the original creation time, not change on every apply.
    ignore_changes = [tags["CreatedAt"]]
  }
}
