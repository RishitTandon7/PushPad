# PushPad

**Share your code as a live site in 2 minutes. No setup, no env vars.**

Paste a public GitHub repo, click Deploy, watch the pipeline run, and get a link that works for 30 minutes. Then the server is deleted. Think Vercel preview deployments, self-hosted on your own AWS with Jenkins and Terraform.

Tools: Git/GitHub, Jenkins, Terraform, AWS. No Docker, Kubernetes or Ansible. Region: ap-south-1.

PushPad does two jobs with the same pipeline ideas:

| Mode | What it does | Entry point |
|---|---|---|
| **Quick Share** (the product) | Deploys any visitor's public repo for 30 minutes | `Jenkinsfile.deploy`, `Jenkinsfile.destroy` |
| **Branch previews** (the original) | Every branch of PushPad's own repo gets a temporary EC2, `main` goes to prod with approval and rollback | `Jenkinsfile`, `Jenkinsfile.cleanup` |

## Architecture

```mermaid
flowchart LR
  V[Visitor] -->|paste repo URL| CP[Control plane<br/>Express on the prod EC2]
  CP <-->|records, no state on disk| DDB[(DynamoDB<br/>pushpad-deployments)]
  CP -->|settings and secrets| SSM[(SSM Parameter Store)]
  CP -->|REST: buildWithParameters| J[Jenkins]
  J -->|stage callbacks + secret header| CP
  J -->|1 clone, 2 detect, 3 zip source only| S3[(S3 artifacts<br/>deployments/id/)]
  J -->|terraform apply, workspace d-id| TF[infra/deployment]
  TF <-->|state + lock| S3S[(S3 state)]
  TF --> E[One small EC2 per deployment<br/>non-root, port 80, IMDSv2]
  S3 -->|role reads only its own folder| E
  V -->|opens the live URL| E
  C[Cleanup job every 5 min] -->|ExpiresAt tag passed| E
```

The control plane is the existing Express app (`app/`). It serves the website and the API, and keeps all state in DynamoDB because prod instances are replaced on every deploy.

