# Pass this to `terraform init -backend-config="bucket=..."`.
output "state_bucket" {
  value = aws_s3_bucket.state.id
}

# Pass this to Terraform as var.artifacts_bucket and to the Jenkins job.
output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.id
}
