# Demo day: PushPad on the AWS Academy Learner Lab

Written for the presenter. Everything here was run on the night before; items under "Not tested" were not.

## Addresses (Elastic IPs: they survive Stop and Start Lab)

| What | Value |
|---|---|
| PushPad (prod, real platform) | http://32.199.10.180 |
| Jenkins | http://100.62.189.125:8080 , user `admin` |
| Jenkins password | `aws ssm get-parameter --with-decryption --name /pushpad/jenkins-admin-password --query Parameter.Value --output text` |
| **Access code** (needed to deploy) | SSM `/pushpad/access-code`: `aws ssm get-parameter --with-decryption --name /pushpad/access-code --query Parameter.Value --output text` (printed once in the terminal the night before) |
| Webhook | GitHub repo > Settings > Webhooks > `http://100.62.189.125:8080/github-webhook/` |
| Region | us-east-1 |

Mock mode and the access code `demo` do NOT work on prod. Locally `cd app && npm start` gives the simulated version with code `demo`.

## Morning checklist (about 10 minutes)

1. **Start Lab**, wait for the green dot, then paste the new AWS CLI credentials into `aws configure` (they change every session).
2. Wait 3 minutes. Open Jenkins and the prod URL: both come back by themselves (services are enabled at boot). `curl http://32.199.10.180/health` should print `{"status":"ok"}`.
3. Webhook green: `gh api repos/RishitTandon7/PushPad/hooks --jq '.[0].last_response.code'` prints 200.
4. Check the platform: open the prod site, paste `https://github.com/RishitTandon7/PushPad`, Options > Folder `examples/static-site`, enter the access code, Deploy. Delete it when it is live.
5. **Slot rule**: the lab allows only 9 instances in total and 6 belong to other courses. After Jenkins and prod there is exactly **one** free slot, so only ONE of these can run at a time: a Quick Share deployment, or a branch preview. Delete the deployment (button) or the preview branch (then run `pushpad-cleanup`) before starting the other. The platform limit is set to 1 for this reason (`max_active_deployments` in `infra/variables.tf`; raise it only if you stop instances that are not yours).

## Talk track (3 minutes)

Deployments now live **10 minutes**.

1. (15 s) "PushPad is my own mini Vercel. Paste a GitHub repo, get a link for 10 minutes. Jenkins builds it and Terraform creates one small server on AWS for it." Show the EC2 console: only Jenkins and prod.
2. (30 s) Paste the repo URL (`examples/static-site` chip), enter the access code, press Deploy. "Six real stages, reported by Jenkins to the page: clone, detect, zip, upload to S3, Terraform apply, health check. Jenkins only zips the code, it never runs it."
3. (30 s) Show the EC2 console: the new instance with tags `DeployId` and `ExpiresAt`. "No SSH, port 80 only, IMDSv2, non-root user."
4. (30 s) Open the live link on your phone. Point at the 10:00 countdown.
5. (20 s) Press **Delete now**. Refresh the EC2 console: the instance is terminating. "Deleting needs a one-time token that only this browser holds."
6. (45 s) Branch previews: `git checkout -b feature/demo`, small change, push. Jenkins builds it, the console prints `LIVE: http://...`, the page's `/version` shows branch, build and commit. Show the `feature/bad-price` run in the stage view: "a negative price fails the Test stage and nothing is deployed". Then "main stops at an approval step before it touches prod, and rolls back automatically if the health check fails."
   (Do step 6 only after step 5 has freed the slot.)
7. (10 s) Close: "Workspaces per branch and per deployment, S3 remote state, immutable servers, least privilege, cost control: 10 minute TTL, a self-shutdown timer on every instance, and a cleanup job."

Backup lines: failure demo = deploy `docs` (a folder with no `index.html` or `package.json`): Detect fails with a plain message. Wrong or missing access code and non-GitHub URLs are rejected before anything starts.

## If something breaks live

| Symptom | Do this |
|---|---|
| Deploy says "build system is not reachable" | Jenkins is still booting or the jobs lost their parameters: wait 2 minutes; if it persists run `JENKINS_URL=... JENKINS_USER=admin JENKINS_PASSWORD=... scripts/lab/create-jobs.sh` (it re-registers them). |
| Deploy fails at "Terraform apply" and the EC2 console shows the instance terminated within seconds | The lab's 9-instance cap. Delete the other preview or deployment, run `pushpad-cleanup`, retry. |
| "You already have a deployment" / rate limit | One per person and 3 per hour. Delete the live one, or remove test rows: `aws dynamodb delete-item --table-name pushpad-deployments --key '{"id":{"S":"<id>"}}'`. |
| Site cannot be reached at all | Lab not started or still booting. Show the recorded run instead, or local mock mode (`cd app && npm start`, code `demo`). |
| A main build waits forever / later builds queue | It is waiting at **Approval**: approve it (Jenkins UI, or `scripts/lab/approve.sh <build>`) or abort it. |
| Everything is on fire | Roll back to the simple version, below. |

### Roll back to v1-demo (branch previews only, verified the night before)

```bash
git checkout main && git reset --hard v1-demo && git push --force-with-lease origin main
# then in Jenkins: pushpad > main > Build Now > Proceed at the approval step
```
`v1-demo` is the verified Phase A state (the tag is on GitHub). To return to the platform: `git reset --hard v2-platform`, force-push and redeploy the same way.

## What was changed for the lab, and why

| Change | Why |
|---|---|
| `use_existing_iam` (default true) | Lab accounts cannot create IAM; `LabInstanceProfile` is looked up by name. |
| One region variable, default us-east-1 | No hardcoded region. |
| `infra/lab-jenkins/`, `scripts/lab/*` | Jenkins host, automatic setup (no wizard), jobs through the REST API, helper scripts. |
| Buckets made with the AWS CLI | The lab blocks `s3:GetBucketObjectLockConfiguration`, which Terraform reads. |
| Java 21 for Jenkins | Current Jenkins LTS refuses Java 17. |
| `MAX_ACTIVE` / `max_active_deployments` = 1 | The lab terminates instance number 10 (`Client.UserInitiatedShutdown` by `vocareum`). |
| 10-minute lifetime | One config value: `ttlMinutes` in `app/config/limits.json`. |
| Settings in SSM `/pushpad/*` (works in the lab) | Jenkins URL, user, API token, callback secret, access code, public base URL. |

## More troubleshooting (hit on the night)

| Symptom | Fix |
|---|---|
| `terraform apply` of `infra/bootstrap` fails on bucket object lock | `scripts/lab/bootstrap-buckets.sh` |
| Jenkins fails with "requires Java 21" | `sudo dnf install -y java-21-amazon-corretto-headless` |
| `Permission denied` on a script | `git update-index --chmod=+x <file>` |
| Branch indexing sleeps "Jenkins-Imposed API Limiter" | `scripts/lab/20-github-ratelimit.groovy` (applied at every start) |
| A build hangs after a Jenkins restart | Abort it (`/stop`, `/term`, `/kill`) and rebuild |
| Prod apply fails "shutting-down ... UserInitiatedShutdown" | Not enough free instance slots: prod replacement needs one extra instance. Delete previews first. |
| Deploy/cleanup jobs fail "couldn't find remote ref" | They read their Jenkinsfile from a branch (`JOBS_BRANCH`, default main). Rerun `scripts/lab/create-jobs.sh`. |
| After editing a job config, deploys return `build_unavailable` | Config rewrite drops the parameters; `create-jobs.sh` runs each job once to re-register them. |
| Git Bash: `Parameter name must be a fully qualified name` | `export MSYS_NO_PATHCONV=1` |
| `aws` prints a charmap error on Windows | `export PYTHONUTF8=1` |
| `ExpiredToken` | Start Lab again and run `aws configure`. |

## Not tested

- Telegram notifications.
- Running with `use_existing_iam = false` against AWS (validate only).
- The UI in a real browser against prod (the browser tool in this environment blocked the request); the full flow was tested through the API, which is what the UI calls. Run steps 4 and 5 of the checklist once yourself.
- 3 concurrent deployments (the lab cannot hold them).
