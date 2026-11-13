# PushPad demo script (about 3 minutes)

Before you start: Jenkins job `pushpad` and `pushpad-cleanup` exist, `main` has been deployed once, and you have the repo cloned locally. Keep three tabs open: AWS EC2 console (ap-south-1), Jenkins, and a terminal.

## 1. Show the empty state (20 s)
**Do:** EC2 console, Instances.
**Say:** "Only two servers exist: Jenkins and production. No preview servers yet."

## 2. Create a branch and change a dish price (20 s)
```bash
git checkout -b feature/new-roll
sed -i 's/"price": 12.0/"price": 13.5/' app/menu.json     # Dragon Roll price change
git commit -am "feat: raise dragon roll price"
git push -u origin feature/new-roll
```
**Say:** "I changed one price on a new branch and pushed it. That is all I do."

## 3. Jenkins picks it up (40 s)
**Do:** Jenkins > pushpad > feature%2Fnew-roll, open the running build (Stage View or Console).
**Say:** "Jenkins scanned the repo and found the branch. Stages: lint, test, package the app into a zip with its dependencies, upload to S3, Terraform init, select a workspace named after the branch, apply. Terraform now creates an EC2."
**Do:** switch to the EC2 console and refresh: a new instance `pushpad-feature-new-roll` appears with tags Branch, Env=preview.

## 4. Open the preview (20 s)
**Do:** click the URL in the build description (or Console, "LIVE:") and open it. Scroll to **Live build**: branch `feature/new-roll`, build number, commit, PREVIEW badge. Scroll to the menu carousel: Dragon Roll shows $13.50.
**Say:** "That page is served by the new server. The status panel reads /version, which the pipeline wrote."

## 5. Show the test stage blocking bad code (30 s)
```bash
sed -i 's/"price": 13.5/"price": -1/' app/menu.json
git commit -am "test: break the menu on purpose"
git push
```
**Do:** open the new build: it fails red in the **Test** stage and nothing is deployed.
**Say:** "A negative price fails the menu test, so the pipeline stops before it can touch AWS. The preview from before is still healthy."
```bash
git reset --hard HEAD~1 && git push --force-with-lease    # undo the bad commit
```

## 6. Delete the branch, environment disappears (30 s)
```bash
git checkout main
git push origin --delete feature/new-roll
git branch -D feature/new-roll
```
**Do:** run the `pushpad-cleanup` job now (it also runs every 5 minutes). Console shows `Destroyed environment for deleted branch feature/new-roll`; EC2 shows the instance terminating.
**Say:** "Cleanup compares Terraform workspaces with the branches on GitHub and destroys the ones with no branch. The same job also removes previews older than 24 hours to protect the bill."

## 7. Main deploys to prod (30 s)
```bash
git checkout main
sed -i 's/"price": 12.0/"price": 13.5/' app/menu.json
git commit -am "feat: raise dragon roll price"
git push origin main
```
**Do:** the build pauses at **Deploy build N to PROD?**; click Deploy. After the health check, open the prod URL (an Elastic IP, so it never changes).
**Say:** "Production needs a human approval. If the health check fails, the pipeline re-applies the previous known-good build automatically and fails the build."

## Backup lines
- "Why not Docker?": the course scope is Jenkins, Terraform and AWS; each environment is an immutable EC2 built from a zip.
- If a build is slow, explain the stages while the EC2 boots (about 1 to 2 minutes).
