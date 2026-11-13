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
  instance_profile = var.use_existing_iam ? data.aws_iam_instance_profile.existing[0].name : aws_iam_instance_profile.site[0].name
  name             = "pushpad-d-${var.deploy_id}"
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

# Role the instance assumes, so no access keys exist on the server (skipped in the lab).
resource "aws_iam_role" "site" {
  count       = var.use_existing_iam ? 0 : 1
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

# Least privilege: read ONLY this deployment's own folder in the artifacts bucket.
resource "aws_iam_role_policy" "read_own_prefix" {
  count = var.use_existing_iam ? 0 : 1
  name  = "read-own-artifact"
  role  = aws_iam_role.site[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "arn:aws:s3:::${local.bucket}/${local.prefix}/*"
    }]
  })
}

# Lab mode: look up the instance profile that already exists in the account.
data "aws_iam_instance_profile" "existing" {
  count = var.use_existing_iam ? 1 : 0
  name  = var.existing_instance_profile
}

# Attaches the role to the instance.
resource "aws_iam_instance_profile" "site" {
  count       = var.use_existing_iam ? 0 : 1
  name_prefix = "${local.name}-"
  role        = aws_iam_role.site[0].name
}

# The server for one deployment: it downloads the zip, runs it as a non-root user on port 80, and terminates itself when time is up.
resource "aws_instance" "site" {
  ami                         = data.aws_ssm_parameter.al2023.value
  instance_type               = var.instance_type
  vpc_security_group_ids      = [aws_security_group.site.id]
  iam_instance_profile        = local.instance_profile
  associate_public_ip_address = true

  # Safety net: a shutdown inside the instance terminates it, even if the cleanup job is down.
  instance_initiated_shutdown_behavior = "terminate"

  # IMDSv2 only, hop limit 1: stops user code reaching instance credentials through proxies or containers.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_size = 8
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    artifact_url     = var.artifact_url
    app_type         = var.app_type
    shutdown_minutes = var.ttl_minutes + 10
  })

  tags = {
    Name      = local.name
    DeployId  = var.deploy_id
    ExpiresAt = timeadd(timestamp(), "${var.ttl_minutes}m")
    AppType   = var.app_type
    ManagedBy = "pushpad-deploy"
  }

  lifecycle {
    # ExpiresAt is fixed at creation; timestamp() would otherwise change it on every run.
    ignore_changes = [tags["ExpiresAt"]]
  }
}
