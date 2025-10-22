#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh not found. Install GitHub CLI first." >&2
  exit 1
fi

git fetch origin
BR="docs/playbook-$(date +%Y%m%d-%H%M%S)"
git switch -c "$BR"

git add PLAYBOOK.md scripts/doc-update.sh
if git diff --cached --quiet; then
  echo "Nothing to commit for PLAYBOOK.md or scripts/doc-update.sh" >&2
  exit 0
fi

git commit -m "docs(playbook): update rules + doc-update script"
git push -u origin HEAD

gh pr create --fill --base main --head "$BR"
gh pr merge --squash --delete-branch

git switch main
git pull --ff-only
echo "Docs updated on main."
