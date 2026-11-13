# Public IP: the Elastic IP on prod, the instance IP on previews.
output "public_ip" {
  value = var.env == "prod" ? aws_eip.prod[0].public_ip : aws_instance.app.public_ip
}

# Live URL printed by the pipeline.
output "url" {
  value = "http://${var.env == "prod" ? aws_eip.prod[0].public_ip : aws_instance.app.public_ip}"
}

# Instance ID, handy for debugging in the console.
output "instance_id" {
  value = aws_instance.app.id
}
