#!/usr/bin/env bash
# Stage 1: shallow clone of a public GitHub repo. Never runs anything from the repo.
# shellcheck source=scripts/deploy/common.sh
source "$(dirname "$0")/common.sh"
require_id
validate_inputs

rm -rf "$WORK/src"
export GIT_TERMINAL_PROMPT=0                      # never ask for credentials: private repos simply fail
say "Cloning ${REPO_URL#https://github.com/} (${BRANCH}), shallow"

# core.symlinks=false: links in the repo become plain files, so they cannot point at files on this server.
if ! timeout "$(limit cloneTimeoutSeconds)" git -c core.symlinks=false -c protocol.allow=never -c protocol.https.allow=always \
     clone --depth 1 --single-branch --no-tags --branch "$BRANCH" -- "$REPO_URL" "$WORK/src" > "$WORK/clone.log" 2>&1; then
  tail -n 3 "$WORK/clone.log" || true
  fail "Could not clone the repository. Check that it is public and the branch exists."
fi

rm -rf "$WORK/src/.git"
find "$WORK/src" -type l -delete                  # belt and braces: remove any symlink that survived
files="$(find "$WORK/src" -type f | wc -l)"
say "Cloned ${files} files"
project_dir > /dev/null
