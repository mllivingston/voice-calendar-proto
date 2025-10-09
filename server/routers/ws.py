from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from auth.supabase import verify_supabase_token
from utils.connections import manager
from services.events import EventsService

router = APIRouter(tags=["ws"])

@router.websocket("/ws")
async def events_ws(ws: WebSocket):
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4401)
        return
    try:
        claims = verify_supabase_token(token)
    except Exception:
        await ws.close(code=4401)
        return

    user_id = claims.get("sub") or "anon"
    await manager.connect(user_id, ws)
    svc = EventsService()
    await ws.send_json({"type":"initial_events", "events": [e.dict() for e in svc.list(user_id)]})
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)
