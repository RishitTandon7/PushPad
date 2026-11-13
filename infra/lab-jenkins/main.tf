# Lab Jenkins host: one EC2 + Elastic IP, local state (the state bucket does not exist yet when this is first created).
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

# Latest Amazon Linux 2023 AMI from the public SSM parameter (no hardcoded AMI ID).
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# Default VPC so no networking has to be created.
data "aws_vpc" "default" {
  default = true
}

# Lab accounts cannot create IAM, so the existing instance profile is looked up by name.
data "aws_iam_instance_profile" "lab" {
  name = var.instance_profile
}

# Firewall: SSH only from the operator's IP, Jenkins UI and the GitHub webhook from anywhere.
resource "aws_security_group" "jenkins" {
  name_prefix = "pushpad-jenkins-"
  description = "PushPad Jenkins"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from the operator"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip_cidr]
  }

  ingress {
    description = "Jenkins UI and webhook"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
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

# The Jenkins server: user_data clones the repo and runs the lab bootstrap scripts.
resource "aws_instance" "jenkins" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  key_name               = var.key_name == "" ? null : var.key_name
  vpc_security_group_ids = [aws_security_group.jenkins.id]
  iam_instance_profile   = data.aws_iam_instance_profile.lab.name

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    repo_url = var.repo_url
    region   = var.region
  })
  user_data_replace_on_change = true

  tags = {
    Name      = "pushpad-jenkins"
    ManagedBy = "pushpad"
  }
}

# Fixed public address so the webhook URL survives lab stop and start.
resource "aws_eip" "jenkins" {
  domain = "vpc"
  tags   = { Name = "pushpad-jenkins", ManagedBy = "pushpad" }
}

# Attach the Elastic IP to the Jenkins instance.
resource "aws_eip_association" "jenkins" {
  instance_id   = aws_instance.jenkins.id
  allocation_id = aws_eip.jenkins.id
}
