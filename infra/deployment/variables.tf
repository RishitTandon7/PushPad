# The contract of this module. A second provider (for example Oracle Cloud) can implement the same
# generic inputs (deploy_id, artifact_url, app_type, ttl_minutes) and outputs (url, instance_id).

# Deployment id from the control plane (10 hex characters).
variable "deploy_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{10}$", var.deploy_id))
    error_message = "deploy_id must be 10 lowercase hex characters."
  }
}

# Where the zipped source lives. This AWS implementation expects s3://<bucket>/<key>.
variable "artifact_url" {
  type = string
  validation {
    condition     = can(regex("^s3://[a-z0-9.-]+/deployments/[a-f0-9]{10}/[A-Za-z0-9._-]+$", var.artifact_url))
    error_message = "artifact_url must look like s3://<bucket>/deployments/<id>/<file>."
  }
}

# How to run the project: a tiny static file server, or npm start.
variable "app_type" {
  type = string
  validation {
    condition     = contains(["static", "node"], var.app_type)
    error_message = "app_type must be static or node."
  }
}

# How long the deployment may live; the server also shuts itself down after this (plus a small margin).
variable "ttl_minutes" {
  type    = number
  default = 30
}

# Small and cheap; the control plane can raise it for a future paid plan.
variable "instance_type" {
  type    = string
  default = "t3.micro"
}

# AWS region for the deployment.
variable "region" {
  type    = string
  default = "ap-south-1"
}
