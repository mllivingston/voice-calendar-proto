PLAYBOOK
Version: 10-17A (Comprehensive + CWD Jumps + Full-Snapshot Git + ASR)
Scope: Development workflow, terminal protocol, env layout, backend & frontend startup, Supabase Auth (HS256), Next.js proxy patterns, crash-proof curl probes, testing & triage, deterministic Git publish workflow, CWD jump rules, server-side ASR, Safari-safe MediaRecorder.
0) Core Principles
Smallest possible changes. Make one change, run, prove, then proceed.
Create = new file. Edit = replace the entire contents of an existing file (never partial line edits).
Deterministic commands only. Every command block must be pasteable, with no comments or prompts inside.
Environment-safe bootstraps precede any command that depends on Node or Python.
Reversible. Provide quick rollback for any git or file change.
1) Terminal Protocol (ALWAYS)
Before each command block, specify: Terminal, cwd, Env, Assumptions, Rollback (when relevant).
Keep long-running servers (frontend/backend) in their dedicated terminals. Use NEW TEMP TERMINAL for diagnostics and git.
Reminders
Role	Typical use	Keep running
FRONTEND TERMINAL	npm run dev (Next.js)	Yes
BACKEND TERMINAL	python -m uvicorn ... (FastAPI)	Yes
NEW TEMP TERMINAL	git, curl, quick checks	No
1A) Terminal CWD & Jump Rules
Rule CWD-1 — Explicit CWD jumps are mandatory. Whenever a command assumes a directory, include a copy-pasteable jump first.
Canonical jumps (app tree & publish tree)
cd "$(git rev-parse --show-toplevel)"/..
cd voice-calendar-proto
pwd
cd "$(git rev-parse --show-toplevel)"/..
cd voice-calendar-proto-publish
pwd
Quick verify
git rev-parse --show-toplevel
git branch --show-current
pwd
Universal “from anywhere” jumps (10-17 addition)
These work in any new terminal; fall back to ~/voice-calendar-proto if not inside a repo.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/voice-calendar-proto")"
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/voice-calendar-proto")/frontend"
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/voice-calendar-proto")/server"
2) Repository Layout (paths of record)
Frontend app: frontend/
Backend app: server/
Single Python virtualenv: <repo-root>/.venv
Frontend env file of record: frontend/.env.local
Backend env file of record: server/.env
3) Env Files (single sources of truth)
3.1 Frontend — frontend/.env.local
Required keys (local dev):
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
NEXT_PUBLIC_SERVER_URL=http://127.0.0.1:8000
If .env.local exists at repo root, move it:
git mv .env.local frontend/.env.local
10-17 addition (ASR):
OPENAI_API_KEY=<your_openai_key>
3.2 Backend — server/.env (HS256)
Required keys (local dev):
SUPABASE_JWT_SECRET=<your_supabase_project_jwt_secret>
SUPABASE_URL=<optional_project_url_if_used>
AUTH_BYPASS=false
4) Backend Startup (deterministic, root .venv)
BACKEND TERMINAL
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r server/requirements.txt
set -a; [ -f server/.env ] && source server/.env; set +a
python -m uvicorn server.main:app --reload --log-level debug
PyJWT sanity probe (NEW TEMP TERMINAL)
source .venv/bin/activate
python -c "import sys,jwt; print(sys.executable); print('PyJWT', jwt.version)"
5) Frontend Startup (Next.js)
FRONTEND TERMINAL
npm install
npm run dev
6) Supabase Auth (HS256) — E2E Flow
Client obtains Supabase access token.
Client attaches Authorization: Bearer <token> on calls to the app’s Next.js API routes.
Next.js API routes forward Authorization to FastAPI.
FastAPI validates HS256 token using SUPABASE_JWT_SECRET and returns 401 if missing/invalid.
Expectation: When signed-out (or using curl without Authorization), 401s from interpret/mutate are normal.
7) Next.js Proxy Pattern (never throw, forward auth)
File: frontend/app/api/calendar/mutate/route.ts (POST example)
import { NextRequest, NextResponse } from "next/server";
const upstream = process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8000";

function forwardableHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  h.set("content-type", "application/json");
  return h;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${upstream}/calendar/mutate`, {
      method: "POST",
      headers: forwardableHeaders(req),
      body,
    });

    const headers = new Headers();
    const ct = res.headers.get("content-type");
    if (ct) headers.set("content-type", ct);

    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers });
  } catch (e: any) {
    const detail = typeof e?.message === "string" ? e.message : (e?.toString?.() ?? "proxy error");
    return NextResponse.json({ error: "upstream_connect_failed", detail, upstream }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed", allow: ["POST"] }, { status: 405 });
}
Rules of this pattern
Safe default upstream http://127.0.0.1:8000
Forward the incoming Authorization header
Try/catch the upstream fetch; return { error, detail, upstream } with 502 on error
Provide explicit GET → 405 handler for POST-only routes
8) Crash-Proof Curl Probes (no jq)
Default (raw body)
curl -sS http://localhost:3000/api/calendar/mutate
Status + headers + body
curl -iS http://localhost:3000/api/calendar/mutate
POST (for POST-only routes)
curl -iS -X POST http://localhost:3000/api/calendar/mutate -H "Content-Type: application/json" --data '{"op":"noop","payload":{}}'
Pretty-if-JSON, else raw (Node fallback)
curl -sS http://localhost:3000/api/calendar/mutate | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2));}catch(e){console.log(s);}})"
Direct backend (signed-out 401 expectation)
curl -iS -X POST http://127.0.0.1:8000/calendar/mutate -H "Content-Type: application/json" --data '{"op":"noop","payload":{}}'
9) Auth Verification — Deterministic Outcomes
Signed-out (expect 401) — backend direct
curl -iS -X POST http://127.0.0.1:8000/calendar/mutate -H "Content-Type: application/json" --data '{"op":"noop","payload":{}}'
Signed-out (expect 401) — via proxy
curl -iS -X POST http://localhost:3000/api/calendar/mutate -H "Content-Type: application/json" --data '{"op":"noop","payload":{}}'
Signed-in (expect 200)
TOKEN="<paste_supabase_access_token>"
curl -iS -X POST http://localhost:3000/api/calendar/mutate -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" --data '{"op":"noop","payload":{}}'
10) Troubleshooting Matrix (smallest-first)
405 on GET → Route is POST-only; use POST probe.
500 from proxy (HTML) → Route threw; replace with pattern in §7 and restart frontend.
502 upstream_connect_failed → Backend unreachable or wrong NEXT_PUBLIC_SERVER_URL; verify backend on 127.0.0.1:8000, check frontend/.env.local, restart frontend.
ImportError: jwt → In BACKEND TERMINAL:
source .venv/bin/activate
python -m pip install PyJWT
401 while signed-in → Client not attaching token or proxy not forwarding Authorization. Re-check client helper and §7 proxy headers.
11) Git Hygiene & Rollbacks
Never commit secrets. Ensure .env, .env.local, .dev_token, server/.env, frontend/.env.local are git-ignored.
Single-file edits use full replacement content. For multiple files, prefer the smallest set possible.
Commit example (NEW TEMP TERMINAL)
git add -A
git commit -m "Apply 10-16A playbook-compliant auth/proxy updates"
git log -1 --stat
Rollback last commit
git reset --soft HEAD~1
12) Git Publishing Workflow — Full-Snapshot, No Downtime
Goal: Keep app servers running in the app tree while publishing from a separate publish tree. No branch flips in running terminals.
12.1 One-time: ensure publish worktree exists
NEW TEMP TERMINAL
cd "$(git rev-parse --show-toplevel)"/..
cd voice-calendar-proto
pwd
git fetch --all --prune
git worktree add ../voice-calendar-proto-publish main
12.2 Publish a full snapshot from the app tree
NEW TEMP TERMINAL
cd "$(git rev-parse --show-toplevel)"/..
cd voice-calendar-proto
pwd
AUTO_WIP=1 scripts/publish_full_snapshot.sh
Expected: prints Published branch: publish/<timestamp> (...)
12.3 Merge newest publish/* into main from the publish tree
NEW TEMP TERMINAL
cd "$(git rev-parse --show-toplevel)"/..
cd voice-calendar-proto-publish
pwd
git fetch --all --prune
git switch -c merge-main-$(date +%Y%m%d-%H%M%S) --track origin/main
LATEST_REMOTE=$(git for-each-ref --format='%(refname:short)' --sort=-committerdate refs/remotes/origin/publish | head -n 1)
[ -n "$LATEST_REMOTE" ] && git merge --no-ff "$LATEST_REMOTE" || true
if git diff --name-only --diff-filter=U | grep . >/dev/null 2>&1; then git checkout --theirs $(git diff --name-only --diff-filter=U); git add $(git diff --name-only --diff-filter=U); git commit -m "Merge $LATEST_REMOTE into main (prefer publish snapshot)"; fi
git push origin HEAD:main
12.4 Verify (still in publish tree)
git fetch --all --prune
git log --oneline -1 origin/main
10-17 additions (publish hygiene)
The snapshot includes only committed changes. If the pre-check shows “Staged files:” empty, nothing new will land.
Ensure .env.local is untracked:
echo -e "\n.env.local\nfrontend/.env.local" >> .gitignore
git rm --cached .env.local 2>/dev/null || true
git rm --cached frontend/.env.local 2>/dev/null || true
git add .gitignore
git commit -m "gitignore: ensure .env.local not tracked" || true
13) Roadmap Snapshot (post-Auth)
UI restore: bring back visual calendar UI; render server diffs (create/update/delete/move) onto the calendar.
GET /calendar/list + tiny in-page list.
Delete last: button wired to delete_event using id from last diff or list selection.
Optional: Web Speech API mic capture feeding the input box.
Later: Real provider adapter (Google), undo/confirmation sheet, per-user persistence beyond mock.
14) Golden Rules
Label terminals. Show cwd and env activation before every command.
One venv at repo root. Always install from server/requirements.txt.
Run Uvicorn as a module: python -m uvicorn ....
Load backend env in BACKEND TERMINAL: set -a; source server/.env; set +a.
Next.js proxies must never throw; they must forward Authorization.
Curl probes must be jq-free and method-correct.
CWD-1 enforced: every location-dependent command must be preceded by a jump block.
10-17 Additions (ASR + Helpers + Safari Notes)
A) ASR Endpoint (Next.js)
File: frontend/app/api/ai/asr/route.ts
Requires: OPENAI_API_KEY in frontend/.env.local and npm i openai
Accepts: raw Blob (with content-type) or multipart/form-data (file)
Returns: { "text": string }
B) Safari-Safe MediaRecorder (zero-byte fix)
Choose a supported MIME (Safari often prefers audio/mp4 / audio/m4a).
Wait for the stop event before constructing the Blob.
Prefer multipart/form-data for uploads.
Reference snippet maintained in the repo notes.
C) Frontend Helpers (library)
File: frontend/lib/ai.ts (exports)
transcribeAudio(blob: Blob): Promise<string> → POST /api/ai/asr (multipart)
interpret(text: string, token?: string) → POST /api/ai/interpret
mutate(command: any, token?: string) → POST /api/calendar/mutate
Auth expectation: 401 from interpret/mutate when no Bearer—normal.
D) /ai-test/events Mic Flow (wired)
recording → asr → interpret → mutate → done | error
Shows transcript, last command JSON, and a temporary in-page list updated from returned diff.
When logged out, ASR succeeds; interpret/mutate may 401 (expected).
E) Imports & Paths Guidance
Prefer relative imports in app pages (e.g., ../../../lib/ai) to avoid alias drift.
If using @/* aliases, ensure frontend/tsconfig.json sets:
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./*"] } } }
F) ASR Triage (500s) — Order of Checks
OPENAI_API_KEY present in frontend/.env.local
Restart npm run dev after env changes
npm i openai done in frontend
Use multipart/form-data instead of raw Blob
Verify with a known file:
curl -sS -X POST http://localhost:3000/api/ai/asr -H "content-type: audio/m4a" --data-binary @~/Desktop/test.m4a
End of PLAYBOOK 10-17A