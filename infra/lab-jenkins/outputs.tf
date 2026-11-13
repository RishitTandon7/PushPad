# Elastic IP of Jenkins.
output "jenkins_ip" {
  value = aws_eip.jenkins.public_ip
}

# Jenkins URL.
output "jenkins_url" {
  value = "http://${aws_eip.jenkins.public_ip}:8080"
}

# Instance ID (for SSM sessions).
output "instance_id" {
  value = aws_instance.jenkins.id
}
