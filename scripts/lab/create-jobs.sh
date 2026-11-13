#!/usr/bin/env bash
# Creates (or updates) the two Jenkins jobs through the REST API: the multibranch job "pushpad" and the pipeline "pushpad-cleanup".
# Needs JENKINS_URL, JENKINS_USER, JENKINS_PASSWORD in the environment. Safe to re-run.
set -euo pipefail
: "${JENKINS_URL:?}" "${JENKINS_USER:?}" "${JENKINS_PASSWORD:?}"
OWNER="${REPO_OWNER:-RishitTandon7}"; REPO="${REPO_NAME:-PushPad}"
winp() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
JAR="$(winp "$(mktemp)")"; trap 'rm -f "$JAR"' EXIT
AUTH=(-u "$JENKINS_USER:$JENKINS_PASSWORD" -b "$JAR" -c "$JAR")
CRUMB="$(curl -fsS "${AUTH[@]}" "$JENKINS_URL/crumbIssuer/api/json" | python -c 'import json,sys;d=json.load(sys.stdin);print(d["crumbRequestField"]+":"+d["crumb"])')"

put_job() {  # name, xml file
  if curl -sS -f "${AUTH[@]}" "$JENKINS_URL/job/$1/api/json" >/dev/null 2>&1; then
    curl -fsS "${AUTH[@]}" -H "$CRUMB" -H 'Content-Type: application/xml' --data-binary "@$(winp "$2")" "$JENKINS_URL/job/$1/config.xml" >/dev/null; echo "updated $1"
  else
    curl -fsS "${AUTH[@]}" -H "$CRUMB" -H 'Content-Type: application/xml' --data-binary "@$(winp "$2")" "$JENKINS_URL/createItem?name=$1" >/dev/null; echo "created $1"
  fi
}

# Optional: BRANCH_REGEX limits which branches get a preview (the lab allows only 9 instances in total).
BRANCH_FILTER=""
[ -n "${BRANCH_REGEX:-}" ] && BRANCH_FILTER="<jenkins.scm.impl.trait.RegexSCMHeadFilterTrait><regex>$BRANCH_REGEX</regex></jenkins.scm.impl.trait.RegexSCMHeadFilterTrait>"
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
            $BRANCH_FILTER
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
# Pipeline-from-SCM job: name, Jenkinsfile path, description. JOBS_BRANCH picks which branch the pipeline files come from (default main).
scm_job() {
  cat > "$X2" <<XML
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>$3</description>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs><hudson.plugins.git.UserRemoteConfig><url>https://github.com/$OWNER/$REPO.git</url></hudson.plugins.git.UserRemoteConfig></userRemoteConfigs>
      <branches><hudson.plugins.git.BranchSpec><name>*/${JOBS_BRANCH:-main}</name></hudson.plugins.git.BranchSpec></branches>
    </scm>
    <scriptPath>$2</scriptPath>
    <lightweight>true</lightweight>
  </definition>
</flow-definition>
XML
  put_job "$1" "$X2"
}
put_job pushpad "$X1"
scm_job pushpad-cleanup Jenkinsfile.cleanup "Destroys orphaned previews and expired deployments every 5 minutes"
scm_job pushpad-deploy Jenkinsfile.deploy "Quick Share: deploys a pasted public repo (started by the control plane)"
scm_job pushpad-destroy Jenkinsfile.destroy "Quick Share: destroys one deployment early"
# Rewriting a job config forgets the parameters that a first run registered, so run both parameterized jobs once (they fail on empty input, which is expected).
for j in pushpad-deploy pushpad-destroy; do curl -sS "${AUTH[@]}" -H "$CRUMB" -X POST "$JENKINS_URL/job/$j/build" >/dev/null || true; done
echo "started one registration run each for pushpad-deploy and pushpad-destroy"
rm -f "$X1" "$X2"
