PLAYBOOK 10-17D (Comprehensive + Stability + Bypass Auth Flow)
Scope
Development workflow, terminal protocol, env layout, backend & frontend startup, Supabase Auth (HS256), Next.js proxy patterns, crash-proof curl probes, deterministic Git publishing, CWD jump rules, server-side ASR, Safari-safe MediaRecorder, and AUTH_BYPASS mode.
0 · Core Principles
Smallest possible changes. One change → run → prove → proceed.
Create = new file. Edit = replace full file.
Deterministic commands only. Copy-pasteable; no inline comments or prompts.
Environment-safe bootstraps precede any Node/Python-dependent command.
Reversible. Always show rollback for git or file changes.
1 · Terminal Protocol (ALWAYS)
Every block must specify: Terminal · cwd · Env · Assumptions · Rollback.
Role / Typical use / Keep running
FRONTEND TERMINAL — npm run dev (Next.js) — ✅
BACKEND TERMINAL — python -m uvicorn … (FastAPI) — ✅
NEW TEMP TERMINAL — git · curl · diagnostics — 🚫
1A · CWD & Jump Rules
Rule CWD-1: Every command must include an explicit jump.
Canonical jumps
cd "$(git rev-parse --show-toplevel)"/..
cd voice-calendar-proto
pwd
cd "$(git rev-parse --show-toplevel)"/..
cd voice-calendar-proto-publish
pwd
Universal “from anywhere” jumps (10-17 addition)
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/voice-calendar-proto")"
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/voice-calendar-proto")/frontend"
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/voice-calendar-proto")/server"
Quick verify
git rev-parse --show-toplevel
git branch --show-current
pwd
2 · Repository Layout
Frontend app → frontend/
Backend app → server/
Root virtualenv → .venv
Frontend env → frontend/.env.local
Backend env → server/.env
3 · Env Files
3.1 Frontend frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=<supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_SERVER_URL=http://127.0.0.1:8000
OPENAI_API_KEY=<openai_key>
If .env.local exists at repo root →
git mv .env.local frontend/.env.local
3.2 Backend server/.env
SUPABASE_JWT_SECRET=<supabase_jwt_secret>
SUPABASE_URL=<optional_url>
AUTH_BYPASS=false
4 · Backend Startup (deterministic)
BACKEND TERMINAL
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/voice-calendar-proto")"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r server/requirements.txt
set -a; [ -f server/.env ] && source server/.env; set +a
python -m uvicorn server.main:app --reload --log-level debug --reload-dir server
PyJWT sanity probe (NEW TEMP TERMINAL)
source .venv/bin/activate
python -c "import sys,jwt; print(sys.executable); print('PyJWT', jwt.version)"
5 · Frontend Startup (Next.js)
FRONTEND TERMINAL
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/voice-calendar-proto")/frontend"
npm install
npm run dev
6 · Auth Mode Invariants (10-17C upgrade)
Local bypass mode (default for dev):
export AUTH_BYPASS=true|yes|1 before backend start.
FastAPI short-circuits auth; no token needed.
Real-token mode (prod tests):
omit AUTH_BYPASS; endpoints require valid HS256 bearer.
Do not mix modes in a session.
If switching modes → STOP BACKEND → restart with new flag.
7 · Backend Launch Invariant
Always launch from repo root:
python -m uvicorn server.main:app --reload --log-level debug --reload-dir server
If running inside /server:
export PYTHONPATH="$(pwd)/.."
use main:app.
Stop stale servers before each run (Ctrl +C).
8 · Deterministic Token Handling (real-token mode only)
Never depend on prior exports.
Inline a fresh TOKEN="..." or read from token.txt in the same block.
Keep all probe blocks self-contained.
9 · Frontend ↔ Backend Contracts (proto)
Interpret → Mutate: unwrap { command:{...} } → {...} before sending.
Mutate: send the command object directly (unwrapped).
Delete: supported shape {"op":"delete_last"} for “Delete last”.
Authoritative refresh: after any successful mutate → refetch /api/calendar/list.
10 · Next.js Proxy Pattern (safe forward auth)
File → frontend/app/api/calendar/mutate/route.ts (see original content in 10-17A; unchanged pattern)
Rules →
Upstream http://127.0.0.1:8000
Always forward Authorization
Try/catch upstream; 502 = connect fail
POST-only → explicit 405 for GET
11 · Crash-Proof Curl Probes (no jq)
(Retain 10-17A content; unchanged)
Key reminder: always run probes in NEW TEMP TERMINAL after verifying backend alive.
12 · Auth Verification Outcomes
Signed-out (bypass off): expect 401.
Signed-out (bypass on): expect 200 with stub user {"sub":"dev-bypass"}.
Signed-in (real token): expect 200 and per-user data.
13 · Terminal Discipline (re-affirmed 10-17C)
Label all three terminals.
Always show cwd + venv activation before commands.
Before probes or auth-mode switches → STOP BACKEND → bootstrap + restart.
Keep probes self-contained (no shared vars across shells).
14 · Git Hygiene & Rollbacks
(Use section 11 and 12 from 10-17A verbatim)
Ensure .env, .env.local, server/.env, frontend/.env.local all git-ignored.
15 · Git Publishing Workflow (Full-Snapshot Flow)
(Sections 12 + publish hygiene from 10-17A stay unchanged.)
16 · Contracts & UI Behavior (ASR + Mic Flow notes)
Keep sections 10-17A A–F verbatim:
ASR endpoint (OpenAI Whisper)
Safari-safe MediaRecorder
Library helpers
Mic flow
Import path rules
ASR triage checklist
17 · Stability Post-Action 11
Bypass confirmed working in server/auth/init.py with true/yes/1.
Interpret normalization prevents silent no-ops.
Delete last uses backend-supported op:"delete_last".
Smoke tests now token-free when bypass on.
18 · Golden Rules (unchanged from 10-17A)
Label terminals and show cwd/env before commands.
One venv at repo root; install via server/requirements.txt.
Run Uvicorn as module.
Load backend env in BACKEND TERMINAL.
Next.js proxies never throw; always forward auth.
Curl probes must be method-correct & jq-free.
CWD-1 enforced before any location-sensitive command.
19 · Playbook Addendum (10-17D+)
Contract Source of Truth & Guards
Backend models define the contract; frontend validates responses at runtime.
All network calls use safeFetch with a schema guard from lib/schemas.ts.
On failure, show an inline ErrorBanner; do not crash the page.
Dev Pages & Flags
/ai-test and /ai-test/events are dev-only surfaces. Guard their nav with NEXT_PUBLIC_DEV_UI when preparing to ship.
Git Save-Points
Tag meaningful milestones:
git tag -a action-12.5 -m "Frontend guards + safeFetch"
git push origin action-12.5
End of Playbook 10-17D (Consolidated 10-17A + 10-17C + bypass auth workflow validated in Actions 10–11; amended with runtime guards in Action 12.5).
Added in update 10-20 : Repo-First Edit: Before any file change, assistant must fetch the current file from the Git connector and cite it.
Visual-Impacting Label: Any change that can affect layout must carry a VISUAL-IMPACTING label and default to “off” until approved.
Function-Only Patch Mode: When the goal is functional (e.g., confirmation step), edit only the smallest unit that implements that function (here: MicCapture) and do not alter consumer page visuals.
Import Path Lock: Resolve imports relative to current file; do not introduce new alias paths unless they already exist.
