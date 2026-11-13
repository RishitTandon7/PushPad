# Bootstrap root: run ONCE by hand (local state) to create the buckets the pipeline needs.
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  description = "AWS region for everything"
  type        = string
  default     = "us-east-1"
}

# Account ID makes bucket names globally unique without hardcoding it.
data "aws_caller_identity" "me" {}

locals {
  state_bucket     = "pushpad-tfstate-${data.aws_caller_identity.me.account_id}"
  artifacts_bucket = "pushpad-artifacts-${data.aws_caller_identity.me.account_id}"
}

# Bucket that stores Terraform state for every workspace.
resource "aws_s3_bucket" "state" {
  bucket = local.state_bucket
}

# Versioning lets us recover an older state file if one is corrupted.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# State can contain sensitive values, so encrypt it at rest.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Never allow the state bucket to be public.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket that holds the build zips the EC2 instances download at boot.
resource "aws_s3_bucket" "artifacts" {
  bucket = local.artifacts_bucket
}

# Versioning keeps history of build artifacts.
resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Artifacts are private too; instances read them through their IAM role.
resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Table where the control plane stores short-term deployment records (on-demand billing, nothing to size).
resource "aws_dynamodb_table" "deployments" {
  name         = "pushpad-deployments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  # DynamoDB deletes old records on its own a week after a deployment expires.
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}
