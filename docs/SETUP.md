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
