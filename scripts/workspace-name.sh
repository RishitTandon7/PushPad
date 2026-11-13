#!/usr/bin/env bash
# Prints the Terraform workspace name for a Git branch (used by both pipelines).
# main -> prod; otherwise lowercase, only a-z 0-9 and dashes, max 30 chars.
set -euo pipefail

branch="${1:?usage: workspace-name.sh <branch>}"

if [ "$branch" = "main" ]; then
  echo "prod"
  exit 0
fi

name=$(printf '%s' "$branch" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-30 | sed -E 's/-+$//')
# A branch made only of symbols would give an empty name; fall back to a safe word.
echo "${name:-branch}"
