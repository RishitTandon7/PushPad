# Remote state in S3 with native lockfile locking (Terraform >= 1.10); no DynamoDB needed.
# The bucket name is NOT hardcoded: terraform init -backend-config="bucket=<name>".
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    key          = "pushpad/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
