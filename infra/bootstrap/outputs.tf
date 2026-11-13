# Pass this to `terraform init -backend-config="bucket=..."`.
output "state_bucket" {
  value = aws_s3_bucket.state.id
}

# Pass this to Terraform as var.artifacts_bucket and to the Jenkins job.
output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.id
}

# Table name the control plane uses (also the default of var.deployments_table).
output "deployments_table" {
  value = aws_dynamodb_table.deployments.name
}
