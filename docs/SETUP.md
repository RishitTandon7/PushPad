# PushPad setup (do these in order)

Region for everything: **ap-south-1 (Mumbai)**.

## 1. AWS budget alarm (2 minutes)
Billing console > Budgets > Create budget > Cost budget, monthly, e.g. **$5**, alert at 80% to your email.

## 2. IAM role for the Jenkins EC2
IAM > Roles > Create role > AWS service **EC2**. Create an inline policy named `pushpad-jenkins` with the JSON below, then name the role `pushpad-jenkins-role`.
No access keys are used anywhere; Jenkins gets credentials from this role.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "Identity", "Effect": "Allow", "Action": "sts:GetCallerIdentity", "Resource": "*" },
    { "Sid": "AmiLookup", "Effect": "Allow", "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:ap-south-1::parameter/aws/service/ami-amazon-linux-latest/*" },
    { "Sid": "Buckets", "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": ["arn:aws:s3:::pushpad-*", "arn:aws:s3:::pushpad-*/*"] },
    { "Sid": "Ec2", "Effect": "Allow",
      "Action": ["ec2:RunInstances", "ec2:TerminateInstances", "ec2:StopInstances", "ec2:ModifyInstanceAttribute",
        "ec2:Describe*", "ec2:CreateTags", "ec2:DeleteTags",
        "ec2:CreateSecurityGroup", "ec2:DeleteSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress", "ec2:AuthorizeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress",
        "ec2:AllocateAddress", "ec2:ReleaseAddress", "ec2:AssociateAddress", "ec2:DisassociateAddress"],
      "Resource": "*" },
    { "Sid": "InstanceRoles", "Effect": "Allow",
      "Action": ["iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:TagRole", "iam:PassRole",
        "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy", "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole",
        "iam:CreateInstanceProfile", "iam:DeleteInstanceProfile", "iam:GetInstanceProfile",
        "iam:AddRoleToInstanceProfile", "iam:RemoveRoleFromInstanceProfile", "iam:TagInstanceProfile"],
      "Resource": ["arn:aws:iam::*:role/pushpad-*", "arn:aws:iam::*:instance-profile/pushpad-*"] }
  ]
}
```

Notes: this is least-privilege where practical. EC2 actions cannot be scoped much further without tag conditions, and IAM is limited to `pushpad-*` names so Jenkins cannot create admin roles.

## 3. Launch the Jenkins EC2
- Amazon Linux 2023, instance type **t3.micro** (t2.micro on older free-tier accounts), 20 GB disk.
- IAM instance profile: `pushpad-jenkins-role`.
- Security group: TCP 8080 from **your IP only** (for the GitHub webhook see step 8), TCP 22 from your IP.
- Allocate and attach an Elastic IP if you want a stable Jenkins address (optional).

## 4. Install Jenkins and tools
```bash
ssh ec2-user@<jenkins-ip>
sudo dnf install -y git
git clone https://github.com/RishitTandon7/pushpad.git && cd pushpad
sudo ./scripts/bootstrap-jenkins.sh
sudo cat /var/lib/jenkins/secrets/initialAdminPassword   # unlock Jenkins at http://<ip>:8080
```
Choose "Install suggested plugins" and create your admin user.

## 5. Create the S3 buckets (one time)
```bash
cd pushpad/infra/bootstrap
terraform init
terraform apply          # creates pushpad-tfstate-<account> and pushpad-artifacts-<account>
```
The pipeline finds these names itself from your account ID, so there is nothing to copy into Jenkins.

## 6. Jenkins plugins
Manage Jenkins > Plugins > install: **Pipeline**, **Git**, **GitHub**, **Pipeline: Multibranch** (all in "suggested"), plus **JUnit** and **Credentials Binding** (usually preinstalled). Nothing else is required.

## 7. Multibranch pipeline job
New Item > name `pushpad` > **Multibranch Pipeline**.
- Branch Sources > Git (or GitHub) > repo URL `https://github.com/RishitTandon7/pushpad.git` (add a credential if the repo is private).
- Build Configuration: by Jenkinsfile, script path `Jenkinsfile`.
- Scan Multibranch Pipeline Triggers: periodically, 1 minute (works even without a webhook).
- Save. Every branch now appears as its own job.

## 8. GitHub webhook
GitHub repo > Settings > Webhooks > Add webhook:
- Payload URL: `http://<jenkins-ip>:8080/github-webhook/`
- Content type `application/json`, event: **Just the push event**.
- The Jenkins security group must allow port 8080 from GitHub's webhook IPs (or temporarily `0.0.0.0/0` during the demo). If you skip this, the 1-minute scan from step 7 still picks up pushes and deleted branches.

## 9. Cleanup job
New Item > `pushpad-cleanup` > **Pipeline** > Definition "Pipeline script from SCM" > Git, same repo, script path `Jenkinsfile.cleanup`, branch `main`. Run it once manually; its cron then runs every 5 minutes.

## 10. Optional: Telegram notifications
Create a bot with @BotFather, then in Jenkins > Credentials > Global add two **Secret text** credentials:
- ID `telegram-token`: the bot token
- ID `telegram-chat-id`: your chat ID
If either is missing the Notify stage skips Telegram silently.

## 11. First run
Push `main`. Jenkins builds, waits at **Deploy build N to PROD?**, click Deploy. Open the printed URL.

## After the review: clean up AWS
```bash
./scripts/destroy-all.sh          # destroys all previews and prod
cd infra/bootstrap && terraform destroy   # only after emptying/deleting versioned objects in both buckets
```
Then terminate the Jenkins EC2 and release its Elastic IP. Buckets are versioned, so empty all versions in the console first if `terraform destroy` complains.

---

# Part 2: Quick Share (paste a repo, get a 30-minute link)

Do this after Part 1 works (Jenkins, buckets, the multibranch job and prod). It adds the control plane settings, two Jenkins jobs, and a few permissions.

## 12. Extra IAM permissions for the Jenkins role
Add one statement to the `pushpad-jenkins` policy from step 2, so the pipeline can read its settings from Parameter Store:

```json
{ "Sid": "PushPadSettings", "Effect": "Allow", "Action": ["ssm:GetParameter"],
  "Resource": "arn:aws:ssm:ap-south-1:*:parameter/pushpad/*" }
```

Everything else the deployment pipeline needs is already covered: EC2, security groups and IAM roles named `pushpad-*` (deployments are named `pushpad-d-<id>`), S3 on `pushpad-*` buckets, and `ec2:Describe*` for the cleanup job. The prod instance gets DynamoDB and `/pushpad/*` read access from Terraform (`aws_iam_role_policy.control_plane` in `infra/main.tf`); you do not add that by hand.

## 13. Create the DynamoDB table
The table is part of `infra/bootstrap`, so apply it again:

```bash
cd infra/bootstrap && terraform apply     # adds table "pushpad-deployments" (on-demand, TTL on "ttl")
```

Then deploy `main` once more (Jenkins `pushpad` job, approve the prod step) so the prod instance picks up the new role policy and environment (`PUSHPAD_MODE=aws`, `DEPLOYMENTS_TABLE`).

## 14. Create a Jenkins API token
Jenkins > your user (top right) > Configure > API Token > Add new Token. Copy it once. The control plane uses it to start the deploy and destroy jobs through the REST API.

## 15. Store the settings in SSM Parameter Store
Run these on any machine with AWS access (replace the values in angle brackets; never commit them):

```bash
aws ssm put-parameter --region ap-south-1 --name /pushpad/jenkins-url      --type String       --overwrite --value "http://<jenkins-ip>:8080"
aws ssm put-parameter --region ap-south-1 --name /pushpad/jenkins-user     --type String       --overwrite --value "<your-jenkins-user>"
aws ssm put-parameter --region ap-south-1 --name /pushpad/jenkins-token    --type SecureString --overwrite --value "<api-token-from-step-14>"
aws ssm put-parameter --region ap-south-1 --name /pushpad/callback-secret  --type SecureString --overwrite --value "$(openssl rand -hex 24)"
aws ssm put-parameter --region ap-south-1 --name /pushpad/access-code      --type SecureString --overwrite --value "<a-code-you-share-with-testers>"
aws ssm put-parameter --region ap-south-1 --name /pushpad/public-base-url  --type String       --overwrite --value "http://<prod-elastic-ip>"
```

`public-base-url` is the prod URL printed by the pipeline; Jenkins posts its progress callbacks there. To turn the access code off, set `REQUIRE_ACCESS_CODE=false` for the app (the limits then are the only gate).

## 16. Let the prod server reach Jenkins
The control plane calls Jenkins on port 8080 from the prod instance. In the Jenkins security group add an inbound rule: TCP 8080 from `<prod-elastic-ip>/32`. (Callbacks go the other way, from Jenkins to prod port 80, which is already open.)

## 17. Create the two parameterized jobs
Both are Pipeline jobs, definition "Pipeline script from SCM", Git, your repo, branch `main`:

| Job name | Script path | Parameters (declared in the file) |
|---|---|---|
| `pushpad-deploy` | `Jenkinsfile.deploy` | `DEPLOY_ID`, `REPO_URL`, `BRANCH`, `SUBDIR` |
| `pushpad-destroy` | `Jenkinsfile.destroy` | `DEPLOY_ID` |

Run each job once by hand (it will fail on the empty parameters, which is fine) so Jenkins registers the parameters; after that the REST API can start them. Jenkins needs `git`, `zip`, `jq`, `terraform` and the AWS CLI, which `scripts/bootstrap-jenkins.sh` already installs.

## 18. Cleanup of expired deployments
Nothing new to create: the existing `pushpad-cleanup` job now has a third stage that destroys any deployment whose `ExpiresAt` tag has passed (and leftovers from failed runs). Run it once to confirm it finishes green.

