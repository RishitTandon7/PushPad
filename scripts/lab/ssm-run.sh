#!/usr/bin/env bash
# Run a shell command on an instance through SSM and print the output. Usage: ssm-run.sh <instance-id> '<command>'
set -euo pipefail
ID="$1"; CMD="$2"
CID=$(aws ssm send-command --instance-ids "$ID" --document-name AWS-RunShellScript --parameters "$(python -c 'import json,sys;print(json.dumps({"commands":[sys.argv[1]]}))' "$CMD")" --query Command.CommandId --output text)
for _ in $(seq 1 60); do
  S=$(aws ssm get-command-invocation --command-id "$CID" --instance-id "$ID" --query Status --output text 2>/dev/null || echo Pending)
  case "$S" in Success|Failed|Cancelled|TimedOut) break;; esac; sleep 3
done
aws ssm get-command-invocation --command-id "$CID" --instance-id "$ID" --query '[StandardOutputContent,StandardErrorContent]' --output text
