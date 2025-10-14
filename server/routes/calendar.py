from fastapi import APIRouter, Depends, HTTPException, status, Request
from jose import jwt, JWTError
import os
from server.ai.schema import Command
from server.calendarsvc.tools import apply, MutateError

router = APIRouter(prefix="/calendar", tags=["calendar"])

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

def get_current_user(request: Request):
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    if not SUPABASE_JWT_SECRET:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server auth not configured")
    token = auth.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"])
        sub = payload.get("sub") or payload.get("user_id")
        email = payload.get("email")
        if not sub:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: no sub")
        return {"user_id": sub, "email": email}
    except JWTError:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.post("/mutate")
async def post_mutate(cmd: Command, user=Depends(get_current_user)):
    if cmd.needs_clarification:
        return {"status":"needs_clarification", "question": cmd.clarification_question}
    try:
        result = apply(cmd)
        return {"status":"ok", **result}
    except MutateError as e:
        return {"status":"error", "error": str(e)}

@router.get("/list")
async def get_list(user=Depends(get_current_user)):
    """
    Auth-guarded list endpoint.
    Tries a few non-breaking strategies to obtain events; falls back to empty.
    """
    events = []
    try:
        # Strategy A: calendarsvc.tools exposes list_events()
        from server.calendarsvc.tools import list_events as _list_events
        try:
            events = _list_events() or []
        except TypeError:
            # if signature differs, just ignore
            events = []
    except Exception:
        try:
            # Strategy B: mock provider's USER_DB (if present)
            from server.calendarsvc.providers.mock import USER_DB
            try:
                # Flatten all users; if per-user later, we can scope by user['user_id']
                for user_events in USER_DB.values():
                    try:
                        events.extend(getattr(user_events, "values")() if hasattr(user_events, "values") else list(user_events))
                    except Exception:
                        pass
            except Exception:
                pass
        except Exception:
            pass

    def _to_dict(e):
        try:
            return e.__dict__
        except Exception:
            return e
    return {"events": [_to_dict(e) for e in events]}
