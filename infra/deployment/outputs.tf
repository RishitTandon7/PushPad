# Public URL of the deployment (port 80, no domain in the free plan).
output "url" {
  value = "http://${aws_instance.site.public_ip}"
}

# Instance id, useful for debugging in the console.
output "instance_id" {
  value = aws_instance.site.id
}
