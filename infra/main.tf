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

# Who is running Terraform: used to build the DynamoDB table ARN without hardcoding the account ID.
data "aws_caller_identity" "me" {}

# Prod only (the control plane): read and write the deployments table, and read /pushpad/* settings from Parameter Store.
resource "aws_iam_role_policy" "control_plane" {
  count = var.env == "prod" ? 1 : 0
  name  = "control-plane"
  role  = aws_iam_role.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Scan", "dynamodb:Query"]
        Resource = "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.me.account_id}:table/${var.deployments_table}"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.me.account_id}:parameter/pushpad/*"
      }
    ]
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
    artifacts_bucket  = var.artifacts_bucket
    app_version       = var.app_version
    pushpad_mode      = var.env == "prod" ? "aws" : "mock" # previews simulate deployments; only prod talks to Jenkins and AWS
    deployments_table = var.deployments_table
    region            = var.region
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

# Prod only: a fixed public IP so the prod URL never changes.
resource "aws_eip" "prod" {
  count  = var.env == "prod" ? 1 : 0
  domain = "vpc"
  tags   = { Name = local.name, ManagedBy = "pushpad" }
}

# Attach the Elastic IP to the current prod instance.
resource "aws_eip_association" "prod" {
  count         = var.env == "prod" ? 1 : 0
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.prod[0].id
}
