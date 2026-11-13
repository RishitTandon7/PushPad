# Demo day: PushPad on the AWS Academy Learner Lab

Written for the presenter. Everything here was run and checked on the night before; items marked (untested) were not.

## Addresses (they survive Stop and Start Lab because they are Elastic IPs)

| What | Value |
|---|---|
| Jenkins | http://100.62.189.125:8080 (user `admin`) |
| Prod site | http://32.199.10.180 |
| Webhook | `http://100.62.189.125:8080/github-webhook/` on the GitHub repo |
| Jenkins admin password | `aws ssm get-parameter --with-decryption --name /pushpad/jenkins-admin-password --query Parameter.Value --output text` |
| Region | us-east-1 (one variable: `AWS_DEFAULT_REGION` / Terraform `var.region`) |

## Morning checklist (10 minutes)

1. **Start Lab** in AWS Academy, wait for the green dot, then copy the new **AWS CLI** credentials into `aws configure` (they change every session, and the old ones are dead).
2. Wait 2 to 3 minutes. Open Jenkins at the address above. It comes back on its own (`systemctl enable jenkins`). Prod is also enabled at boot: open the prod URL and `/health`.
3. Check the webhook is green: GitHub repo > Settings > Webhooks > Recent Deliveries shows a 200, or `gh api repos/RishitTandon7/PushPad/hooks --jq '.[0].last_response.code'` prints 200.
4. One test push (proves the whole chain):
   ```bash
   git checkout -b feature/demo && echo "<!-- demo -->" >> app/public/index.html
   git commit -am "demo: morning check" && git push -u origin feature/demo
   ```
   Jenkins shows branch `feature/demo` within a few seconds. In about 3 minutes the console ends with `LIVE: http://<ip>`. Check `<ip>/version` shows the branch and build number.
5. Remove the test branch afterwards (`git push origin --delete feature/demo`) and run the **pushpad-cleanup** job (Build Now) so its server is destroyed.

## What to show

- **GitHub**: the repo, the branch list, the webhook deliveries.
- **Jenkins**: the `pushpad` multibranch job (one job per branch), a stage view with the 10 stages, and `pushpad-cleanup`.
- **AWS console (EC2, us-east-1)**: instances `pushpad-jenkins`, `pushpad-prod` (prod, with the Elastic IP) and one `pushpad-feature-...` per live branch. S3: `pushpad-artifacts-<account>` (build zips) and `pushpad-tfstate-<account>` (one state per workspace). DynamoDB: `pushpad-deployments`.
- **Live URLs**: preview `http://<ip>`, with `/health` and `/version` (branch, build, commit); prod `http://32.199.10.180`.

## Talk track (3 minutes)

1. (20 s) "PushPad is my own mini Vercel. Every Git branch gets its own live server, built by Jenkins and created by Terraform on AWS."
2. (40 s) Push a branch. "GitHub calls Jenkins through a webhook. Jenkins installs, lints and tests, zips the app, uploads it to S3, then Terraform makes one EC2 in its own workspace."
3. (30 s) Show the console reaching `LIVE:` and open the URL. "The page shows which branch, build and commit it is running: `/version`."
4. (30 s) "Quality gate": show the failed `feature/bad-price` run in the stage view. "A negative price fails the Test stage, so nothing is deployed."
5. (30 s) Delete the branch, run `pushpad-cleanup`. "The server for a deleted branch is destroyed, so nothing keeps costing money."
6. (30 s) Show `main`: "Main stops at an approval step, then deploys prod on a fixed Elastic IP. If the health check fails, Jenkins redeploys the previous good build automatically." (Proven on the night: a deliberately broken build was rolled back.)
7. Close: "Terraform workspaces, S3 remote state, immutable servers, IAM role instead of keys, and a cleanup job for cost control."

Approve a prod deploy from the UI (Jenkins > pushpad > main > the paused build > Proceed), or: `JENKINS_URL=... JENKINS_USER=admin JENKINS_PASSWORD=... scripts/lab/approve.sh <build-number>`.

## What was changed for the lab, and why

| Change | Why |
|---|---|
| `use_existing_iam` (default true) in `infra/` and `infra/deployment/` | Lab accounts cannot create IAM roles. The existing `LabInstanceProfile` is looked up by name instead. Set it false on a normal account. |
| Region is one variable, default us-east-1; the S3 backend takes it from `AWS_DEFAULT_REGION` | No `ap-south-1` left anywhere. |
| `infra/lab-jenkins/` with local state | The Jenkins host is created before the state bucket exists. `terraform apply -var my_ip_cidr=<ip>/32`. |
| `scripts/lab/bootstrap-buckets.sh` | The lab blocks `s3:GetBucketObjectLockConfiguration`, which the Terraform AWS provider reads on every bucket, so the two buckets are made with the AWS CLI. DynamoDB works, so the table still comes from `infra/bootstrap`. |
| `scripts/lab/jenkins-setup.sh`, `create-jobs.sh`, `20-github-ratelimit.groovy` | No setup wizard, admin user with a random password (kept in SSM), plugins, jobs through the REST API. |
| Java 21 in `bootstrap-jenkins.sh` | The current Jenkins LTS refuses to start on Java 17. |

## Troubleshooting (every problem hit on the night)

| Symptom | Cause | Fix |
|---|---|---|
| `terraform apply` of `infra/bootstrap` fails with `AccessDenied ... GetBucketObjectLockConfiguration` | Lab service control policy | Use `scripts/lab/bootstrap-buckets.sh` (buckets only). |
| Jenkins service fails with "older than the minimum required version (Java 21)" | Jenkins LTS needs Java 21 | `sudo dnf install -y java-21-amazon-corretto-headless`, then `sudo systemctl restart jenkins`. |
| `Permission denied` running a script on the instance | Git on Windows stores files without the execute bit | `git update-index --chmod=+x <file>` and commit. |
| First indexing hangs on "Jenkins-Imposed API Limiter ... Sleeping for 5 min" | Anonymous GitHub API access | `20-github-ratelimit.groovy` sets NoThrottle (runs at every Jenkins start). |
| A main build sits "in progress" forever after a Jenkins restart | A shell step that was running during the restart cannot resume | Abort it (build page > red X, or POST `/stop`, `/term`, `/kill`) and build again. |
| New main builds queue and do not start | A build waiting at **Approval** blocks the next one (`disableConcurrentBuilds`) | Approve or abort the waiting build. |
| Unit test fails after editing `/health` | The test checks the exact body `{status: ok}` | Keep that body. |
| `aws ... charmap codec can't encode` on Windows | Console encoding | `export PYTHONUTF8=1`. |
| `aws ssm ... Parameter name must be a fully qualified name` in Git Bash | Git Bash rewrites `/pushpad/...` into a Windows path | `export MSYS_NO_PATHCONV=1`. |
| `curl: (23)` or "Failed to open /tmp/..." in Git Bash | `curl.exe` does not understand `/dev/null` or `/tmp` | Redirect with `>/dev/null`, and use `cygpath -m` for files (the lab scripts already do). |
| Webhook shows a failure, Jenkins unreachable | Lab not started yet, or still booting | Wait 3 minutes, then **Redeliver**. The Elastic IP is unchanged so the URL is still valid. |
| SSH refused | Port 22 is open only to the IP that was current when it was created | Use SSM instead: `scripts/lab/ssm-run.sh <instance-id> '<command>'`. |
| AWS calls fail with `ExpiredToken` | The 4-hour lab session ended | Start Lab again and run `aws configure` with the new credentials. |

## Not tested

- Telegram notifications (not configured).
- The paste-a-repo platform (`Jenkinsfile.deploy`, `Jenkinsfile.destroy`, Phase B): not set up.
- Running with `use_existing_iam = false` against AWS (it passes `terraform validate` only).
