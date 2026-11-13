#!/usr/bin/env bash
# Lab Jenkins setup, run on the Jenkins host after bootstrap-jenkins.sh: no setup wizard, admin user with a random password, plugins, region. Safe to re-run.
# The generated password is stored in SSM Parameter Store (/pushpad/jenkins-admin-password), never in git.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
JH=/var/lib/jenkins
PM_VERSION=2.16.0

systemctl stop jenkins

# Skip the wizard and give every job the region (the Jenkinsfiles read AWS_DEFAULT_REGION).
mkdir -p /etc/systemd/system/jenkins.service.d
cat > /etc/systemd/system/jenkins.service.d/pushpad.conf <<CONF
[Service]
Environment="JAVA_OPTS=-Djava.awt.headless=true -Djenkins.install.runSetupWizard=false -Dhudson.model.ParametersAction.keepUndefinedParameters=true"
Environment="AWS_DEFAULT_REGION=${REGION}"
CONF
systemctl daemon-reload

# Random admin password, created once and kept in SSM so the operator can read it.
if [ ! -s "$JH/lab-admin-password" ]; then
  head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20 > "$JH/lab-admin-password"
  aws ssm put-parameter --region "$REGION" --name /pushpad/jenkins-admin-password --type SecureString --overwrite --value "$(cat "$JH/lab-admin-password")" >/dev/null || echo "WARN: could not store the password in SSM"
fi
chown jenkins:jenkins "$JH/lab-admin-password"; chmod 600 "$JH/lab-admin-password"

# Init script: creates the admin user and locks Jenkins down on every start.
mkdir -p "$JH/init.groovy.d"
cat > "$JH/init.groovy.d/10-admin.groovy" <<'GROOVY'
import jenkins.model.*
import hudson.security.*
def j = Jenkins.get()
def pw = new File('/var/lib/jenkins/lab-admin-password').text.trim()
def realm = new HudsonPrivateSecurityRealm(false)
realm.createAccount('admin', pw)
j.setSecurityRealm(realm)
def auth = new FullControlOnceLoggedInAuthorizationStrategy()
auth.setAllowAnonymousRead(false)
j.setAuthorizationStrategy(auth)
j.setNumExecutors(2)
j.save()
GROOVY
cp "$(dirname "$0")/20-github-ratelimit.groovy" "$JH/init.groovy.d/20-github-ratelimit.groovy"
chown -R jenkins:jenkins "$JH/init.groovy.d"

# Plugins from the setup guide (pipeline, git, github, multibranch, junit, credentials binding) plus helpers.
curl -fsSL -o /tmp/pm.jar "https://github.com/jenkinsci/plugin-installation-manager-tool/releases/download/${PM_VERSION}/jenkins-plugin-manager-${PM_VERSION}.jar"
sudo -u jenkins java -jar /tmp/pm.jar --war /usr/share/java/jenkins.war --plugin-download-directory "$JH/plugins" \
  --plugins workflow-aggregator git github github-branch-source workflow-multibranch junit credentials-binding timestamper ws-cleanup pipeline-stage-view pipeline-input-step cloudbees-folder

systemctl enable --now jenkins
echo "Jenkins is starting with the admin user. Password: aws ssm get-parameter --with-decryption --name /pushpad/jenkins-admin-password"
