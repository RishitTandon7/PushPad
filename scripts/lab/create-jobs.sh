#!/usr/bin/env bash
# Creates (or updates) the two Jenkins jobs through the REST API: the multibranch job "pushpad" and the pipeline "pushpad-cleanup".
# Needs JENKINS_URL, JENKINS_USER, JENKINS_PASSWORD in the environment. Safe to re-run.
set -euo pipefail
: "${JENKINS_URL:?}" "${JENKINS_USER:?}" "${JENKINS_PASSWORD:?}"
OWNER="${REPO_OWNER:-RishitTandon7}"; REPO="${REPO_NAME:-PushPad}"
JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
AUTH=(-u "$JENKINS_USER:$JENKINS_PASSWORD" -b "$JAR" -c "$JAR")
CRUMB="$(curl -fsS "${AUTH[@]}" "$JENKINS_URL/crumbIssuer/api/json" | python -c 'import json,sys;d=json.load(sys.stdin);print(d["crumbRequestField"]+":"+d["crumb"])')"

put_job() {  # name, xml file
  if curl -fsS -o /dev/null "${AUTH[@]}" "$JENKINS_URL/job/$1/api/json"; then
    curl -fsS -o /dev/null "${AUTH[@]}" -H "$CRUMB" -H 'Content-Type: application/xml' --data-binary "@$2" "$JENKINS_URL/job/$1/config.xml"; echo "updated $1"
  else
    curl -fsS -o /dev/null "${AUTH[@]}" -H "$CRUMB" -H 'Content-Type: application/xml' --data-binary "@$2" "$JENKINS_URL/createItem?name=$1"; echo "created $1"
  fi
}

X1="$(mktemp)"; X2="$(mktemp)"
cat > "$X1" <<XML
<?xml version='1.1' encoding='UTF-8'?>
<org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject>
  <description>PushPad branch previews: every branch gets its own pipeline</description>
  <sources class="jenkins.branch.MultiBranchProject\$BranchSourceList">
    <data>
      <jenkins.branch.BranchSource>
        <source class="org.jenkinsci.plugins.github_branch_source.GitHubSCMSource">
          <id>pushpad-github</id>
          <apiUri>https://api.github.com</apiUri>
          <repoOwner>$OWNER</repoOwner>
          <repository>$REPO</repository>
          <repositoryUrl>https://github.com/$OWNER/$REPO</repositoryUrl>
          <traits>
            <org.jenkinsci.plugins.github__branch__source.BranchDiscoveryTrait><strategyId>1</strategyId></org.jenkinsci.plugins.github__branch__source.BranchDiscoveryTrait>
          </traits>
        </source>
        <strategy class="jenkins.branch.DefaultBranchPropertyStrategy"><properties class="empty-list"/></strategy>
      </jenkins.branch.BranchSource>
    </data>
  </sources>
  <factory class="org.jenkinsci.plugins.workflow.multibranch.WorkflowBranchProjectFactory"><scriptPath>Jenkinsfile</scriptPath></factory>
  <triggers>
    <com.cloudbees.hudson.plugins.folder.computed.PeriodicFolderTrigger><spec>H/15 * * * *</spec><interval>900000</interval></com.cloudbees.hudson.plugins.folder.computed.PeriodicFolderTrigger>
  </triggers>
</org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject>
XML
cat > "$X2" <<XML
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Destroys orphaned previews and expired deployments every 5 minutes</description>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs><hudson.plugins.git.UserRemoteConfig><url>https://github.com/$OWNER/$REPO.git</url></hudson.plugins.git.UserRemoteConfig></userRemoteConfigs>
      <branches><hudson.plugins.git.BranchSpec><name>*/main</name></hudson.plugins.git.BranchSpec></branches>
    </scm>
    <scriptPath>Jenkinsfile.cleanup</scriptPath>
    <lightweight>true</lightweight>
  </definition>
</flow-definition>
XML
put_job pushpad "$X1"
put_job pushpad-cleanup "$X2"
rm -f "$X1" "$X2"
