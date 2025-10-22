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
Permanent fixes (so we don’t repeat this)
A) One source of truth for routes
Policy: No inline calendar endpoints in server/main.py. Only server/routes/calendar.py owns /calendar/*.
Guardrail: add a CI/test that fails if @app.get("/calendar or @app.post("/calendar exists anywhere.
NEW TEMP TERMINAL (add a quick guard you can run locally)
grep -Rn '@app\.\(get\|post\)("/calendar' server && echo "DUPLICATE CALENDAR ENDPOINTS FOUND" || echo "OK: no inline calendar endpoints"
B) Re-entrant locking & no nested locks
Policy: Use threading.RLock() in any in-memory store.
Rule: Never call a public API that acquires the lock from within a with _LOCK: block; expose an internal unlocked view (we added _events_json_unlocked).
C) Zero-friction verification (no curl, no Swagger)
Policy: Keep a checked-in probe script that exercises the endpoints deterministically with hard timeouts.
Why: One command, no shell quirks, prints pass/fail immediately.
🟩 CREATE/EDIT FILE
Path: server/scripts/probe_history.cjs
Runs a: create A → create B → history → undo_n → list → replay_n → list → replay_to_ts → history
Exits non-zero on failure.
FRONTEND TERMINAL (just creating the file from repo root is fine; label says FRONTEND to keep playbook happy)
cat > server/scripts/probe_history.cjs <<'JS'
const http = require('http');
function req({ method='GET', path='/', body=null, timeoutMs=5000 }) {
  return new Promise((resolve, reject) => {
    const opts = { host: '127.0.0.1', port: 8000, path, method, headers: { Connection: 'close', Expect: '' } };
    let payload = null;
    if (body) { payload = Buffer.from(JSON.stringify(body)); opts.headers['Content-Type']='application/json'; opts.headers['Content-Length']=Buffer.byteLength(payload); }
    const t = setTimeout(()=>{ if(sock) sock.destroy(new Error('timeout')); reject(new Error(`timeout ${method} ${path}`)); }, timeoutMs);
    const r = http.request(opts, res => { let data=''; res.setEncoding('utf8'); res.on('data', c=>data+=c); res.on('end', ()=>{ clearTimeout(t); resolve({status:res.statusCode,data});});});
    let sock=null; r.on('socket', s=>{ sock=s; s.setNoDelay(true); }); r.on('error', e=>{ clearTimeout(t); reject(e);}); if(payload) r.write(payload); r.end();
  });
}
(async()=>{
  try{
    const now=new Date().toISOString();
    let out=await req({method:'POST',path:'/calendar/mutate',body:{type:'create_event',title:'A',start:now,end:''}}); if(out.status!==200) throw new Error('create A failed'); console.log('CREATE A', out.status);
    out=await req({method:'POST',path:'/calendar/mutate',body:{type:'create_event',title:'B',start:now,end:''}}); if(out.status!==200) throw new Error('create B failed'); console.log('CREATE B', out.status);
    out=await req({method:'GET',path:'/calendar/history'}); if(out.status!==200) throw new Error('history after create failed'); console.log('HISTORY 1', out.status);
    out=await req({method:'POST',path:'/calendar/mutate',body:{op:'undo_n',n:1}}); if(out.status!==200) throw new Error('undo_n failed'); console.log('UNDO_N', out.status);
    out=await req({method:'GET',path:'/calendar/list'}); if(out.status!==200) throw new Error('list after undo failed'); console.log('LIST 1', out.status, out.data);
    out=await req({method:'POST',path:'/calendar/mutate',body:{op:'replay_n',n:1}}); if(out.status!==200) throw new Error('replay_n failed'); console.log('REPLAY_N', out.status);
    out=await req({method:'GET',path:'/calendar/list'}); if(out.status!==200) throw new Error('list after replay failed'); console.log('LIST 2', out.status, out.data);
    const ts=new Date().toISOString();
    out=await req({method:'POST',path:'/calendar/mutate',body:{op:'replay_to_ts',ts}}); if(out.status!==200) throw new Error('replay_to_ts failed'); console.log('REPLAY_TO_TS', out.status);
    out=await req({method:'GET',path:'/calendar/history'}); if(out.status!==200) throw new Error('history final failed'); console.log('HISTORY 2', out.status);
    console.log('PROBE OK');
    process.exit(0);
  }catch(e){ console.error('PROBE FAIL', e.message||e); process.exit(1); }
})();
JS
💻 NEW TEMP TERMINAL — run the probe (backend KEEP RUNNING)
node server/scripts/probe_history.cjs
This is the only command you need next time to prove backend behavior after a change.
D) Add a real healthcheck that exercises POST, not just GET
Policy: /healthz must accept a tiny POST {op:"noop"} and return 200 quickly.
That gives you one universal “am I alive for POST?” check (works from any tool).
NEW TEMP TERMINAL (tiny router addition)
cat > server/routes/health.py <<'PY'
from fastapi import APIRouter
router = APIRouter()
@router.get("/healthz")
def g(): return {"ok": True}
@router.post("/healthz")
def p(): return {"ok": True}
PY
NEW TEMP TERMINAL (mount it)
python - <<'PY'
from pathlib import Path
p=Path("server/main.py")
s=p.read_text()
if "from server.routes import health" not in s:
    s=s.replace("from server.routes import calendar", "from server.routes import calendar\nfrom server.routes import health")
if "app.include_router(health.router)" not in s:
    s=s.replace("app.include_router(calendar.router)", "app.include_router(calendar.router)\napp.include_router(health.router)")
p.write_text(s)
print("mounted /healthz")
PY
Now you can always do:
node -e "fetch('http://127.0.0.1:8000/healthz',{method:'POST'}).then(r=>r.text()).then(console.log)"
E) CWD discipline (playbook pin)
BACKEND TERMINAL must be repo root; FRONTEND TERMINAL must be frontend/.
Put this in your shell profile to warn you if you’re in the wrong place:
NEW TEMP TERMINAL
cat >> ~/.zshrc <<'Z'
function vc_cwd_guard() {
  if [[ "$1" == "backend" && ! -f server/main.py ]]; then echo "Not repo root (backend). cd to voice-calendar-proto/"; return 1; fi
  if [[ "$1" == "frontend" && ! -d frontend ]]; then echo "Not at repo root/has frontend dir."; return 1; fi
}
Z
The minimal “Change → Verify” protocol (copy/paste next time)
STOP BACKEND (Ctrl+C in BACKEND TERMINAL)
START BACKEND (repo root)
source .venv/bin/activate
export AUTH_BYPASS=1
python -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload --log-level debug --reload-dir server
VERIFY (single command)
node server/scripts/probe_history.cjs
COMMIT
git add -A
git commit -m "Action XX: <short desc>; probe_history OK"
No curl. No Swagger. No ambiguity.
What I’ll do differently
Default to surgical edits only (never shrink a large file unless absolutely necessary).
Provide a single deterministic probe script with every backend change.
Add a quick route-conflict guard and healthz POST as standard practice.
Keep responses terse and focused on “Change → Verify,” not tool troubleshooting.
If you want, I can bundle the guard checks + probe into a tiny make verify-backend or npm run probe:backend script so it’s one muscle-memory command.
🔒 New Development Rules — Reliability & Scoping Update (Post Phases 0-2)
1 — Critical-File Protection
Pre-Check Before Edit
Always open the existing file via Cursor or connector first.
Record its line count, visual footprint (header/nav presence), and any functions tied to hardware/browser permissions.
If the file controls user permissions, mic, or camera (e.g. MicCapture.tsx), mark it CRITICAL in the PR description.
Edit Modes
Function-Only Patch (FOP): Allowed only when adding a helper, hook, or utility; no JSX layout changes, no event-binding changes.
Visual-Impacting (VI): Must include explicit before/after screenshots in the PR description.
Default to FOP; upgrade to VI only with visible UI intent.
Immutable Entrypoints
Start, Stop, Record, and Permission handlers are off-limits unless the goal is mic/ASR debugging.
These must remain callable user gestures to preserve Safari and Chrome permission flows.
Rollback Path
Every edit to a CRITICAL file must include a one-line rollback command in the chat output
git restore --source=HEAD -- path/to/file.
2 — Scoping & Velocity Framework
Scale	Meaning	Expected Work	Example
S	Small (1 unit)	Single file change ≤ 50 LOC, no layout impact	Add flag to env echo route
M	Medium (2 units)	Feature spanning backend + frontend with tests	Durable SQLite store + auth gate
L	Large (3–4 units)	Cross-system change or multi-phase UI feature	Dialog manager or streaming ASR
Velocity formula: Units / Session.
Use completed phases as baseline (4 units in 1 session = ≈4 units per session).
3 — Phase Review Discipline
After each phase:
Outcome Log: 1 paragraph on what passed, what broke, why.
Risk Register: List new fragile areas (e.g., Safari mic permissions).
Scope Variance: Note planned vs. actual units; explain variance (±1 unit is OK).
Rule Feedback: If a regression occurred, add a “Why it broke” note (see example from Phase 1–2) and update this section before continuing.
4 — Testing & Commit Requirements
Pre-Commit Tests
Backend pytest must pass with 1 passed minimum.
Frontend node frontend/scripts/smoke-list.mjs must return “ok”.
Never commit if either fails.
Commit Message Template
Phase X: <scope>
- Phase 0 flags and gates
- Phase 1 auth + durable store
- Phase 2 UI affordances + tests
(n units, no layout changes)
PR Labeling
[SAFE-PATCH] for Function-Only edits.
[VISUAL-IMPACTING] for layout or CSS changes.
[CRITICAL-FILE] if editing mic/audio routines.
5 — Learning Archive (from Phases 0–2)
Lesson	Implementation Rule
Mic permission path is fragile	Never edit Start/Record handlers outside dedicated mic phase.
Interpreter can return NOOP	Keep client simple; add clarify/coercion server-side.
Title normalization belongs post-interpret	All semantic repairs live between interpret and confirm only.
Visual risk increases with file size	Always measure LOC and tag Visual-Impacting if > 200 LOC.
6 — Velocity Tracking Template (Markdown snippet)
| Phase | Est Units | Actual | Δ | Notes |
|:--|:--|:--|:--|:--|
| 0 | 1 | 1 | 0 | Env flags |
| 1 | 2 | 2 | 0 | SQLite store |
| 2 | 1 | 1 | 0 | Affordances + tests |
| Total | 4 | 4 | 0 | Velocity ≈ 4 units/session |
## 🔒 Reliability & Scoping Rules (Post Phases 0–2)
Path: PLAYBOOK.md
Reason: Consolidate the new reliability rules (from Phases 0–2) and add a streamlined Git protocol so doc changes never waste time again. Paste this whole section near your existing “Editing Protocol”.
## 🔒 Reliability & Scoping Rules (Post Phases 0–2)

### 1) Critical-File Protection
- **Pre-check before edit:** open file first; note line count and any permission-gated handlers.
- **Edit modes:** Default **FOP (Function-Only Patch)** = no JSX/layout or event-binding changes. Use **VI (Visual-Impacting)** only with screenshots.
- **Immutable entrypoints:** Never change mic permission triggers (Start/Record/Stop) unless the *explicit* goal is ASR/mic work.
- **Rollback line:** Every change to a CRITICAL file includes `git restore --source=HEAD -- <path>` in the chat.

### 2) Scoping & Velocity
- **S (1 unit):** ≤50 LOC, single-file, no layout impact.  
- **M (2 units):** spans FE/BE with minimal tests.  
- **L (3–4 units):** cross-system or multi-turn UI.
- **Velocity:** Units completed per session. Baseline from Phases 0–2: **4 units/session**.

### 3) Phase Review Discipline
After each phase ship:
1) Outcome log (what passed/broke and why)  
2) Risk register (fragile areas)  
3) Scope variance (est vs actual, ±1 OK)  
4) New rule(s) added here if we caused a regression

### 4) Tests & Commits
- **Pre-commit must pass:** `pytest` (≥1 test) and frontend smoke (`node frontend/scripts/smoke-list.mjs`).
- **Commit template:**
Phase X: <scope>
bullets...
(N units, <FOP|VI>, critical files: [..] or none)

### 5) Learnings → Rules (from 0–2)
| Lesson | Rule |
|---|---|
| Safari mic permissions are fragile | Don’t touch Start/Record/Stop in FOP edits |
| Interpreter may return NOOP | Keep client simple; fix in server clarify/coercion |
| Title normalization placement | Only between **interpret → confirm** |

### 6) Velocity Tracking
| Phase | Est | Actual | Δ | Notes |
| 0 | 1 | 1 | 0 | Flags |
| 1 | 2 | 2 | 0 | SQLite + auth gate |
| 2 | 1 | 1 | 0 | Affordances + tests |
| Total | 4 | 4 | 0 | ≈4 units/session |

---

## 🧭 Docs & Playbook Update Protocol (Instant)

### Fast Path A — with `gh` (recommended; protected `main`)
1) Ensure `PLAYBOOK.md` is edited and saved.  
2) Run the helper script:
scripts/doc-update.sh
This will: create a docs branch → push → open PR → squash-merge → return you to `main`.

### Fast Path B — no `gh`
1) Create a short-lived docs branch, commit, and push.  
2) Open the browser PR link and merge there.  
3) `git switch main && git pull --ff-only`.

### Preflight (any path)
- If other unrelated local edits exist, stash them first:
git stash push -m "wip: hold local edits"
- Pop them after the docs merge if needed:
git stash pop
