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
  default     = "ap-south-1"
}

# Account ID makes bucket names globally unique without hardcoding it.
data "aws_caller_identity" "me" {}

locals {
  state_bucket     = "pushpad-tfstate-${data.aws_caller_identity.me.account_id}"
  artifacts_bucket = "pushpad-artifacts-${data.aws_caller_identity.me.account_id}"
}
