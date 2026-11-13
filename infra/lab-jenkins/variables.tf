# AWS region for the Jenkins host.
variable "region" {
  type    = string
  default = "us-east-1"
}

# Operator public IP in CIDR form (e.g. 1.2.3.4/32); allowed to use SSH.
variable "my_ip_cidr" {
  type = string
}

# Repo the instance clones to get the bootstrap scripts.
variable "repo_url" {
  type    = string
  default = "https://github.com/RishitTandon7/PushPad.git"
}

# Jenkins needs memory for Terraform runs.
variable "instance_type" {
  type    = string
  default = "t3.medium"
}

# Existing lab instance profile (IAM cannot be created in the lab).
variable "instance_profile" {
  type    = string
  default = "LabInstanceProfile"
}

# Existing EC2 key pair for SSH; empty means no key (use SSM instead).
variable "key_name" {
  type    = string
  default = "vockey"
}
