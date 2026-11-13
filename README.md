# PushPad

A self-hosted mini Vercel for a DevOps course project. **Every Git branch gets its own temporary AWS EC2 environment with a live URL**, created by Terraform and triggered by Jenkins. Deleting or merging the branch destroys it. `main` deploys to production behind an approval gate, with automatic rollback.

Tools: Git/GitHub, Jenkins, Terraform, AWS. No Docker, Kubernetes or Ansible. Region: ap-south-1.

## Architecture

```mermaid
flowchart LR
  Dev[Developer] -->|git push| GH[GitHub]
  GH -->|webhook| J[Jenkins EC2]
  J -->|lint, test, zip| S3A[(S3 artifacts)]
  J -->|terraform apply| TF[Terraform workspace per branch]
  TF <-->|state + lock| S3S[(S3 state)]
  TF --> P[Preview EC2 per branch]
  TF --> PR[Prod EC2 + Elastic IP]
  S3A -->|IAM role download at boot| P
  S3A -->|IAM role download at boot| PR
  J -->|health check /health /version| P
  C[Cleanup job every 5 min] -->|git ls-remote vs workspaces| TF
```

## What each tool does
| Tool | Role |
|---|---|
| Git / GitHub | Source of truth. A branch is a request for an environment. |
| Jenkins | Runs the pipeline: test, package, deploy, health check, notify, cleanup. |
| Terraform | Creates the EC2, security group, IAM role (and Elastic IP for prod). One workspace per branch. |
| AWS | EC2 runs the app, S3 stores build zips and Terraform state, IAM gives servers read-only access to zips. |

## Pipeline stages (`Jenkinsfile`)
| # | Stage | What happens |
|---|---|---|
| 1 | Checkout | Get code; map branch to workspace (`scripts/workspace-name.sh`). |
| 2 | Install and Lint | `npm ci`, ESLint. |
| 3 | Test | Jest; publishes JUnit results. A bad `menu.json` fails here. |
| 4 | Package | Write `version.json`, production deps only, zip `app/`. |
| 5 | Upload to S3 | Zip goes to the artifacts bucket. |
| 6 | Terraform Init | Remote state, select or create the branch workspace. |
| 7 | Approval | Only on `main`: "Deploy build N to PROD?" |
| 8 | Terraform Apply | New EC2 boots from the zip; prod rollback target saved first. |
| 9 | Health Check | Retry `/health` up to 3 min, `/version` must show this build; on prod failure, roll back. |
| 10 | Notify | Print URL, set build description, optional Telegram. |

`Jenkinsfile.cleanup` runs every 5 minutes: destroys workspaces whose branch no longer exists (via `git ls-remote --heads`) and previews older than 24 h, then deletes their zips.

## Repo layout
```
app/              Express app + static frontend (app/public) + tests
infra/            Terraform for one environment (+ bootstrap/ for the buckets)
scripts/          workspace-name, aws-env, health-check, cleanup, bootstrap-jenkins, destroy-all
Jenkinsfile       branch pipeline          Jenkinsfile.cleanup   cleanup cron job
docs/             SETUP.md (do first), DEMO.md (live demo script)
```

Run locally: `cd app && npm ci && npm start` then open http://localhost:3000.

## Cost notes
- Always on: one Jenkins EC2 and one prod EC2 (plus the Elastic IP, which is free while attached). Instance type is the Terraform variable `instance_type` (default `t3.micro`; **`t2.micro` may be the free-tier type on older accounts**, pass `-var instance_type=t2.micro`).
- Previews live minutes, and the cost guard destroys any preview older than 24 hours.
- S3 usage is a few MB. Set the budget alarm first (see `docs/SETUP.md`).
- After the review run `scripts/destroy-all.sh`, then stop the Jenkins EC2.

## Moving off AWS later
The pipeline only needs "give me a Linux server that downloads a zip and runs it". To move: swap `infra/main.tf` for another Terraform provider (Azure VM, DigitalOcean droplet, Hetzner), keep the S3-style artifact step by using that provider's object storage, and keep Jenkinsfile, scripts and app unchanged apart from `aws s3 cp` calls and the AMI lookup.

## Interview talking points
- **Workspaces**: one state per branch from the same code; the workspace name is the sanitized branch name, so `main` is `prod` and previews cannot touch prod.
- **Remote state and locking**: state lives in a versioned, encrypted S3 bucket; `use_lockfile` stops two pipelines applying to the same state at once (no DynamoDB needed on Terraform 1.10+).
- **Immutable infrastructure**: a new build means `user_data` changes, so Terraform replaces the instance (create-before-destroy) rather than patching it.
- **IAM roles instead of keys**: Jenkins and every app server use instance roles; servers can only `s3:GetObject` the artifacts bucket. No secrets in Git.
- **Cleanup and cost control**: scheduled job reconciles workspaces with live branches, plus a 24 h age limit and a budget alarm.
- **Rollback**: before each prod apply the last healthy zip key is copied to `prod/previous.txt`; a failed health check re-applies it and fails the build.
- **Fail early**: lint and tests gate everything, so bad data like a negative price never reaches AWS.

## Known limits
- Two branches that sanitize to the same name (`feature/x` and `feature-x`) would share a workspace.
- Prod deploys replace the instance, so there is a short gap while the Elastic IP moves.
