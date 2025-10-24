# GIT_PLAYBOOK — Zero-Drama Publishing

A minimal, repeatable protocol to ship changes from **local, working code** to GitHub **without errors**.  
This playbook is the ONLY source for Git commands. We do not publish unless steps here pass.

---

## 0) Principles

1. **Never reuse feature branch names.** Always create a fresh, timestamped branch from your current HEAD.
2. **Publish only after local verification.** If the app isn’t green locally, do not touch Git.
3. **No merges/rebases during publish.** We push a new branch and open a PR. Period.
4. **No force unless explicitly required.** If a branch name collides, pick a new name.
5. **Keep `main` pristine.** `main` is only updated by GitHub’s squash-merge of your PR.

---

## 1) Local Verification Checklist (required)

You can only publish when these pass:

- Backend running, endpoints green:
  - `/ai/interpret` returns `needs_clarify: true` for generic utterances.
  - `/ai/clarify` returns `confirmed: true` and a finalized `command`.
  - `/calendar/mutate` returns `status:"ok"`.
  - `/calendar/list` shows the created event.
- (Optional) Frontend proxy calls succeed.

### Backend smoke (paste-ready)

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Rollback:** close terminal
curl -is http://127.0.0.1:8000/docs | head -n 1
curl -s http://127.0.0.1:8000/openapi.json | python3 -m json.tool
curl -s -X POST http://127.0.0.1:8000/ai/interpret -H "Content-Type: application/json" -d '{"utterance":"Schedule coffee"}' | python3 -m json.tool
RESP=$(curl -s -X POST http://127.0.0.1:8000/ai/clarify -H "Content-Type: application/json" -d '{"utterance":"Schedule coffee","options":[{"text":"Create a one-hour event starting next hour"},{"text":"Create a 30-minute event starting in 30 minutes"},{"text":"Discard"}],"selection_index":0}')
echo "$RESP" | python3 -m json.tool
curl -s -X POST http://127.0.0.1:8000/calendar/mutate -H "Content-Type: application/json" -d "$(python3 -c 'import sys,json; r=json.load(sys.stdin); print(json.dumps({"command":r}))' <<< "$RESP")" | python3 -m json.tool
curl -s http://127.0.0.1:8000/calendar/list | python3 -m json.tool

### Frontend proxy smoke (optional)

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Rollback:** close terminal
curl -is http://localhost:3000 | head -n 1
curl -s http://localhost:3000/api/calendar/list | python3 -m json.tool
curl -s -X POST http://localhost:3000/api/calendar/mutate -H "Content-Type: application/json" -d '{"command":{"op":"create","title":"frontend-proxy-check","start":"2025-10-24T13:00:00","end":"2025-10-24T14:00:00"}}' | python3 -m json.tool
curl -s http://127.0.0.1:8000/calendar/list | python3 -m json.tool

**Proceed only if the checks are green.**

---

## 2) Prepare a Clean Publish State

We ensure we’re not carrying accidental changes and that we know exactly what will be in the PR.

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Rollback:** close terminal
git status --porcelain
git rev-parse --abbrev-ref HEAD

**Expected:**
- `git status --porcelain` shows only the files you intend to publish (e.g., `M server/main.py`).
- You can be on any branch; we will create a new one next.

If you have extra, unintentional changes, stash them:

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Rollback:** `git stash pop`
git stash push -u -m "WIP local extras before publish"

---

## 3) Create a Fresh, Timestamped Branch (never reuse names)

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Assumptions:** Working tree contains your verified changes  
**Rollback:** `git switch main && git branch -D "$BR"`
BR=feat/publish-$(date +%Y%m%d-%H%M%S)
git switch -c "$BR"

---

## 4) Stage and Commit Exactly What You Verified

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Rollback:** `git restore --staged . && git restore .`
git add server/main.py
git status --porcelain
git commit -m "feat: Phase 6 Step 1 — add /ai/clarify and dialog-ready models (zero UI drift)"

---

## 5) Push the New Branch (no merges, no rebases)

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Rollback:** pick a new `BR` and repeat step 3
git push -u origin "$BR"

If you see “non-fast-forward” or “already exists”, choose a **new** branch name:

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Rollback:** none
BR=feat/publish-$(date +%Y%m%d-%H%M%S)-b
git switch -c "$BR"
git push -u origin "$BR"

---

## 6) Open PR and Merge (GitHub UI)

- Title: `Phase 6 — Step 2: /ai/clarify merged (zero UI drift)`
- Description: short summary of what you verified locally.
- **Squash & merge** into `main`.

No rebases. No “update branch”. If GitHub warns about conflicts, stop and ask for help.

---

## 7) (Optional) Fast-Forward Local `main` and Tag

Only after the PR is merged.

**Terminal:** NEW TEMP TERMINAL  
**cwd:** `<repo-root>`  
**Env:** none  
**Rollback:** `git tag -d phase6-step2`
git fetch origin
git checkout main
git pull --ff-only
git tag -a phase6-step2 -m "Phase 6 — Step 2: /ai/clarify merged"
git push origin --tags

---

## 8) Safety & Recovery Snippets

**Return to clean main without losing work:**
git stash push -u -m "WIP checkpoint"
git fetch origin
git switch main
git reset --hard origin/main

**Nuke local dirt (destructive):**
git fetch origin
git switch main
git reset --hard origin/main
git clean -fdx

**List and inspect stash:**
git stash list
git stash show -p stash@{0}

---

## 9) Communication Contract

Before any publish guidance, we will **always ask** for the following, and you can paste outputs:

1. Backend smoke results (the exact commands in §1).
2. `git status --porcelain` and `git rev-parse --abbrev-ref HEAD`.

Only after those two are green and sensible will we give you the three publish blocks:
- §3 Create fresh branch
- §4 Commit files
- §5 Push branch

If anything deviates, we stop and fix locally—**no Git experiments**.

---

## 10) Time Budget

Git operations must consume **≤ 5%** of session time.  
If we exceed that, we immediately revert to local-only work and postpone publishing.

---