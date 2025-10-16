#!/usr/bin/env bash
set -euo pipefail

echo "🔍  Pre-publish sanity check…"

# 1) Required wrapper scripts present?
for f in dev/py dev/uv; do
  if [[ ! -f "$f" ]]; then
    echo "❌  Missing $f"
    exit 1
  fi
done

# 2) Git working tree sanity
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "❌  Not a git repository"
  exit 1
fi

# 3) Show staged files
echo "📂  Staged files:"
git diff --cached --name-only || true

# 4) Block secrets from being staged
if git diff --cached --name-only | grep -Eq '(^|/)(\.env\.local|\.dev_token|server/\.env)$'; then
  echo "🚫  Refusing to publish: secret file is staged (.env.local / .dev_token / server/.env)"
  exit 1
fi

# 5) Nudge: show untracked/modified summary
echo "📝  Working tree summary:"
git status -s

echo "✅  Sanity check passed."
