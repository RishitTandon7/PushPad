#!/usr/bin/env bash
# Prepares a fresh Amazon Linux 2023 EC2 as the PushPad Jenkins server. Safe to re-run.
# Usage: sudo ./scripts/bootstrap-jenkins.sh
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }

# Base tools (dnf skips anything already installed). AWS CLI v2 is preinstalled on AL2023.
dnf install -y git zip unzip jq java-17-amazon-corretto-headless nodejs20 || dnf install -y git zip unzip jq java-17-amazon-corretto-headless nodejs

# Jenkins LTS repo + package.
if [ ! -f /etc/yum.repos.d/jenkins.repo ]; then
  curl -fsSL -o /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
  rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
fi
dnf install -y jenkins

# Terraform from HashiCorp's repo (AL2023 has its own repo definition).
if [ ! -f /etc/yum.repos.d/hashicorp.repo ]; then
  curl -fsSL -o /etc/yum.repos.d/hashicorp.repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
fi
dnf install -y terraform

# Start Jenkins now and on every boot.
systemctl enable --now jenkins

echo "Done. Jenkins: http://<this-ip>:8080  Initial password:"
echo "  sudo cat /var/lib/jenkins/secrets/initialAdminPassword"
