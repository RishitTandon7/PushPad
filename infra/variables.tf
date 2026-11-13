# S3 key of the build zip to deploy (e.g. builds/feature-x/app-feature-x-7.zip).
variable "app_version" {
  type = string
}

# Original branch name, kept as a tag for humans.
variable "branch" {
  type = string
}

# Environment type: controls Elastic IP and tagging.
variable "env" {
  type    = string
  default = "preview"
  validation {
    condition     = contains(["preview", "prod"], var.env)
    error_message = "env must be preview or prod."
  }
}

# EC2 size; t3.micro default (t2.micro may be the free-tier type on older accounts).
variable "instance_type" {
  type    = string
  default = "t3.micro"
}

# Bucket that holds build zips (output of infra/bootstrap).
variable "artifacts_bucket" {
  type = string
}

# CIDR allowed to SSH; empty keeps port 22 closed.
variable "ssh_cidr" {
  type    = string
  default = ""
}

# AWS region for all resources.
variable "region" {
  type    = string
  default = "ap-south-1"
}

# DynamoDB table (created in infra/bootstrap) where the control plane keeps deployment records.
variable "deployments_table" {
  type    = string
  default = "pushpad-deployments"
}
