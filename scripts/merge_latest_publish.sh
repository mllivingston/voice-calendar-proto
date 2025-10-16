#!/usr/bin/env bash
set -euo pipefail

PUBLISH_TREE="$(cd "$(git rev-parse --show-toplevel)"; pwd)"

git -C "$PUBLISH_TREE" fetch --all --prune
git -C "$PUBLISH_TREE" switch main
git -C "$PUBLISH_TREE" pull

LATEST="$(git -C "$PUBLISH_TREE" branch -r --list 'origin/publish/*' --sort='-committerdate' | head -n 1 | sed 's|origin/||')"
if [ -z "$LATEST" ]; then
  echo "No remote publish/* branches found"; exit 0
fi

set +e
git -C "$PUBLISH_TREE" merge --no-ff "$LATEST"
MERGE_RC=$?
set -e

if [ $MERGE_RC -ne 0 ]; then
  # Prefer publish branch versions for conflicts
  CONFLICTS="$(git -C "$PUBLISH_TREE" diff --name-only --diff-filter=U || true)"
  if [ -n "$CONFLICTS" ]; then
    for f in $CONFLICTS; do
      git -C "$PUBLISH_TREE" checkout --theirs -- "$f"
      git -C "$PUBLISH_TREE" add -- "$f"
    done
    git -C "$PUBLISH_TREE" commit -m "Merge $LATEST into main (prefer publish snapshot)"
  fi
fi

git -C "$PUBLISH_TREE" push origin main
echo "Merged $LATEST into main"
