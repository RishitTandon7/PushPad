# PushPad demo script (about 3 minutes)

Before you start: prod is deployed and the Part 2 setup in `docs/SETUP.md` is done. Open three tabs: the PushPad site, the AWS EC2 console (us-east-1, filter `tag:ManagedBy = pushpad-deploy`), and Jenkins. Have your phone ready and know the access code.

## 1. The pitch (15 s)
**Show:** the home page, then the EC2 console with no deployment instances.
**Say:** "PushPad turns a GitHub repo into a live site for 10 minutes. Right now only Jenkins and prod are running, so there are no deployment servers."

## 2. Paste a repo and deploy (30 s)
**Do:** paste `https://github.com/<you>/pushpad`, press **Options**, set Folder to `examples/static-site` (or press the **Static site** chip), enter the access code, press **Deploy**.
**Say:** "No account, no config. The page switches to the live pipeline."

## 3. Watch the real stages (60 s)
**Show:** the six stage cells lighting up, the log, and the timer. Flip to Jenkins to show the same build running.
**Say:** "Clone, detect the project type, zip the source, upload to S3, Terraform creates one small EC2, then a health check. These updates are real callbacks from Jenkins, not an animation. Notice Jenkins only zips the code: it never runs it."
**Do:** switch to the EC2 console and refresh: a new `pushpad-d-<id>` instance appears with tags `DeployId` and `ExpiresAt`.

## 4. Open it on your phone (30 s)
**Do:** when the orange pulse runs along the grid, the live URL card appears. Press **Share** (or Copy) and open the link on your phone.
**Say:** "That is a real cloud server on its own public address, running as a non-root user, with no SSH and no secrets."

## 5. The countdown (15 s)
**Show:** the 10:00 ring counting down.
**Say:** "It is deleted automatically at zero. The server also shuts itself down as a backup if the cleanup job were ever down."

## 6. Delete it early (30 s)
**Do:** press **Delete now**. Show Jenkins running `pushpad-destroy`, then refresh the EC2 console: the instance is terminating and then gone.
**Say:** "Deleting needs a one-time manage token that only this browser holds. The destroy job removes the server, the Terraform workspace and the S3 files."

## 7. Show a failure and the limits (optional, 20 s)
**Do:** paste a repo with no `index.html` or `start` script and press Deploy: the Detect stage fails with a plain message. Then open the **FAQ** drawer to show the limits (3 active, 1 per person, 3 per hour).
**Say:** "Bad input fails early and clearly, and nothing is left running."

## Backup lines
- "Why not Docker?": each deployment is its own immutable EC2, built by Terraform, which is the point of the course project.
- "Is this safe?": untrusted code only ever runs on its own isolated instance, never on Jenkins.
- If the build is slow, talk through the architecture diagram in the README while the EC2 boots (about 1 to 2 minutes).
- No AWS handy? Run `cd app && npm start` and use mock mode: access code `demo`, the same UI and stages, and a repo named `fail` to show the error state.
