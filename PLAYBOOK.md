Got it. Here’s a complete, merged, single-file PLAYBOOK.md you can paste in (full contents, not just edits). It incorporates all prior rules and today’s Auth & Proxy Hardening updates.
# PLAYBOOK
**Version:** 10-15C (Comprehensive)  
**Scope:** Development workflow, terminal protocol, env layout, backend & frontend startup, Supabase Auth (HS256), Next.js proxy patterns, crash-proof curl probes, testing, and triage.

---

## 0) Core Principles
- **Smallest possible changes.** Make one change, run, prove, then proceed.
- **Create vs Edit.**  
  - **Create** = new file.  
  - **Edit** = replace the *entire* contents of an existing file (never partial line edits).
- **Deterministic commands only.** Every command block must be pasteable, with no comments or prompts inside.
- **Three terminal roles (always labeled):**  
  - **FRONTEND TERMINAL** — runs Next.js (`npm run dev`).  
  - **BACKEND TERMINAL** — runs FastAPI (`python -m uvicorn ...`).  
  - **NEW TEMP TERMINAL** — one-offs (git, curl, lsof, etc.), then close.
- **Environment-safe bootstraps** precede any command that depends on Node or Python.
- **Reversible.** Provide quick rollback for any git or file change.

---

## 1) Terminal Protocol (ALWAYS)
- Before each command block, specify: **Terminal**, **cwd**, **Env**, **Assumptions**, **Rollback** (when relevant).
- Command blocks: *no* inline comments, prompts, or extraneous output.
- Keep long-running servers (frontend/backend) in their dedicated terminals. Use **NEW TEMP TERMINAL** for diagnostics and git.

**Reminders table:**

| Role               | Typical use                       | Keep running |
|--------------------|-----------------------------------|--------------|
| FRONTEND TERMINAL  | `npm run dev` (Next.js)           | Yes          |
| BACKEND TERMINAL   | `python -m uvicorn ...` (FastAPI) | Yes          |
| NEW TEMP TERMINAL  | `git`, `curl`, quick checks       | No           |

---

## 2) Repository Layout (paths of record)
- Frontend app: `frontend/`
- Backend app: `server/`
- Single Python virtualenv: `<repo-root>/.venv`
- Frontend env file of record: `frontend/.env.local`
- Backend env file of record: `server/.env`

---

## 3) Env Files (single sources of truth)
### 3.1 Frontend — `frontend/.env.local`
Required keys (local dev):
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
NEXT_PUBLIC_SERVER_URL=http://127.0.0.1:8000
> Rule: Next.js only auto-loads `.env*` from the app root. If `.env.local` exists at repo root, **move** it:
git mv .env.local frontend/.env.local

### 3.2 Backend — `server/.env` (HS256)
Required keys (local dev):
SUPABASE_JWT_SECRET=<your_supabase_project_jwt_secret>
SUPABASE_URL=<optional_project_url_if_used>
AUTH_BYPASS=false

---

## 4) Backend Startup (deterministic, root .venv)
**Terminal:** BACKEND TERMINAL  
**cwd:** `<repo-root>`  
**Env:** activates `<repo-root>/.venv`  
**Assumptions:** `server/requirements.txt`, `server/.env` exist  
**Rollback:** `deactivate && rm -rf .venv`

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r server/requirements.txt
set -a; [ -f server/.env ] && source server/.env; set +a
python -m uvicorn server.main:app --reload --log-level debug

**PyJWT sanity probe (NEW TEMP TERMINAL):**
source .venv/bin/activate
python -c "import sys,jwt; print(sys.executable); print('PyJWT', jwt.version)"

---

## 5) Frontend Startup (Next.js)
**Terminal:** FRONTEND TERMINAL  
**cwd:** `<repo-root>/frontend`  
**Env:** none  
**Assumptions:** `frontend/.env.local` exists with required keys  
**Rollback:** STOP FRONTEND then rerun
npm install
npm run dev

---

## 6) Supabase Auth (HS256) — E2E Flow
- Client obtains Supabase **access token**.
- Client **attaches** `Authorization: Bearer <token>` on calls to the app’s Next.js API routes.
- Next.js API routes **forward** `Authorization` to FastAPI.
- FastAPI validates HS256 token using `SUPABASE_JWT_SECRET` and returns 401 if missing/invalid.

### 6.1 Client fetch helper (example shape)
- Centralize `Authorization` header attachment using `@supabase/supabase-js` session.

*(Keep your existing working helper; this is the pattern of record.)*

---

## 7) Next.js Proxy Pattern (never throw, forward auth)
**File:** `frontend/app/api/calendar/mutate/route.ts` (POST example)
```ts
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
    console.error("[api/calendar/mutate] proxy failure:", detail, "upstream:", upstream);
    return NextResponse.json({ error: "upstream_connect_failed", detail, upstream }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed", allow: ["POST"] }, { status: 405 });
}
Rules of this pattern:
Always set a safe default upstream (http://127.0.0.1:8000) to avoid undefined URL crashes.
Forward the incoming Authorization header.
Try/catch the upstream fetch; on error, return { error, detail, upstream } with 502 (never 500 thrown from route).
Provide an explicit GET → 405 handler for POST-only routes.
8) Crash-Proof Curl Probes (no jq)
Default (raw body):
curl -sS http://localhost:3000/api/calendar/mutate
Status + headers + body:
curl -iS http://localhost:3000/api/calendar/mutate
POST (for POST-only routes):
curl -iS -X POST http://localhost:3000/api/calendar/mutate -H "Content-Type: application/json" --data '{"op":"noop","payload":{}}'
Pretty-if-JSON, else raw (Node fallback):
curl -sS http://localhost:3000/api/calendar/mutate | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2));}catch(e){console.log(s);}})"
Direct backend (signed-out 401 expectation):
curl -iS -X POST http://127.0.0.1:8000/calendar/mutate -H "Content-Type: application/json" --data '{"op":"noop","payload":{}}'
9) Auth Verification — Deterministic Outcomes
Signed-out (expect 401)
Backend direct:
curl -iS -X POST http://127.0.0.1:8000/calendar/mutate -H "Content-Type: application/json" --data '{"op":"noop","payload":{}}'
Via proxy:
curl -iS -X POST http://localhost:3000/api/calendar/mutate -H "Content-Type: application/json" --data '{"op":"noop","payload":{}}'
Signed-in (expect 200)
TOKEN="<paste_supabase_access_token>"
curl -iS -X POST http://localhost:3000/api/calendar/mutate -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" --data '{"op":"noop","payload":{}}'
10) Troubleshooting Matrix (smallest-first)
405 on GET → Route is POST-only; use POST probe.
500 from proxy (HTML) → Route threw; replace with pattern in §7 and restart frontend.
502 upstream_connect_failed → Backend not reachable or wrong NEXT_PUBLIC_SERVER_URL; verify backend runs on 127.0.0.1:8000, check frontend/.env.local, restart frontend.
ImportError: jwt → In BACKEND TERMINAL:
source .venv/bin/activate
python -m pip install PyJWT
Restart backend with §4.
401 while signed-in → Client not attaching token or proxy not forwarding Authorization. Re-check client helper and §7 proxy headers.
11) Git Hygiene & Rollbacks
Never commit secrets. Ensure .env, .env.local are git-ignored if needed.
Single-file edits use full replacement content. For multiple files, prefer smallest set of files possible.
Commit example (NEW TEMP TERMINAL):
git add -A
git commit -m "Apply 10-15C playbook-compliant auth/proxy updates"
git log -1 --stat
Rollback last commit:
git reset --soft HEAD~1
12) Roadmap Snapshot (post-Auth)
UI restore: bring back visual calendar UI; render server diffs (create/update/delete/move) onto the calendar.
GET /calendar/list + tiny in-page list: add the backend endpoint and a simple list on /ai-test or equivalent.
Delete last: button wired to delete_event using id from last diff or list selection.
Optional: Web Speech API mic capture feeding the input box.
Later: Real provider adapter (Google), undo/confirmation sheet, per-user persistence beyond mock.
13) Golden Rules (keep at top of mind)
Label terminals. Show cwd and env activation before every command.
One venv at repo root. Always install from server/requirements.txt.
Run Uvicorn as a module: python -m uvicorn ....
Load backend env in BACKEND TERMINAL: set -a; source server/.env; set +a.
Next.js proxies must never throw; they must forward Authorization.
Curl probes must be jq-free and method-correct.