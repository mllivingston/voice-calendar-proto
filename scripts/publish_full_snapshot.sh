#!/usr/bin/env bash
set -euo pipefail

# Resolve trees
APP_TREE="$(cd "$(git rev-parse --show-toplevel)"; pwd)"
PARENT_DIR="$(dirname "$APP_TREE")"
PUBLISH_TREE="$PARENT_DIR/voice-calendar-proto-publish"

# Ensure publish tree exists and is a git worktree on 'main'
if git -C "$PUBLISH_TREE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  : # publish tree already present
else
  # If the directory exists but is not a git repo, bail out
  if [ -d "$PUBLISH_TREE" ] && [ ! -e "$PUBLISH_TREE/.git" ]; then
    echo "Error: $PUBLISH_TREE exists but is not a git worktree. Move/rename it or make it a worktree."
    exit 1
  fi
  git -C "$APP_TREE" fetch --all --prune
  git -C "$APP_TREE" worktree add "$PUBLISH_TREE" main
fi

# Optional auto-WIP if the app tree is dirty (unstaged or staged changes)
DIRTY=0
if ! git -C "$APP_TREE" diff --quiet || ! git -C "$APP_TREE" diff --cached --quiet; then
  DIRTY=1
fi
if [ "$DIRTY" -eq 1 ] && [ "${AUTO_WIP:-0}" = "1" ]; then
  git -C "$APP_TREE" add -A
  git -C "$APP_TREE" commit -m "WIP snapshot before publish"
fi

# Compute exact snapshot commit from the app tree
APP_SHA="$(git -C "$APP_TREE" rev-parse --verify HEAD)"
APP_BRANCH="$(git -C "$APP_TREE" branch --show-current || echo detached)"
STAMP="$(date +%Y%m%d-%H%M%S)"
PUB_BRANCH="publish/$STAMP"

if [ -z "$APP_SHA" ]; then
  echo "Could not resolve app tree HEAD"; exit 1
fi

# Create (or reset) publish branch in the publish tree at the exact app commit
git -C "$PUBLISH_TREE" fetch --all --prune
git -C "$PUBLISH_TREE" switch -C "$PUB_BRANCH" "$APP_SHA"

# Run sanity in the publish tree if present
if [ -x "$PUBLISH_TREE/scripts/pre_publish_check.sh" ]; then
  "$PUBLISH_TREE/scripts/pre_publish_check.sh"
fi

git -C "$PUBLISH_TREE" push -u origin "$PUB_BRANCH"

echo "Published branch: $PUB_BRANCH (from $APP_BRANCH@$APP_SHA)"
echo "Next: in $PUBLISH_TREE run scripts/merge_latest_publish.sh to land on main."
