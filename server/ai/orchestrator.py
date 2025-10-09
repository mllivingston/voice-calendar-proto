from typing import Dict, Any
from services.events import EventsService
from ai import nlp
from core.config import settings
try:
    from ai.llm_openai import LLMOpenAI  # optional
except Exception:
    LLMOpenAI = None

class Orchestrator:
    def __init__(self, events: EventsService, broadcaster):
        self.events = events
        self.broadcaster = broadcaster
        self.llm = None
        if settings.llm_provider == "openai" and settings.openai_api_key and LLMOpenAI:
            self.llm = LLMOpenAI()

    async def handle_text(self, user_id: str, text: str) -> Dict[str, Any]:
        cmd = (await self.llm.route(text)) if self.llm else nlp.parse(text)
        intent = cmd.get('intent','unknown')
        title = cmd.get('title')
        start_at = cmd.get('start_at')
        end_at = cmd.get('end_at')
        all_day = bool(cmd.get('all_day'))

        if intent == 'add' and title and start_at:
            ev = self.events.create(user_id, title, start_at, end_at, all_day)
            msg = f"Added {ev.title} on {ev.start_at}"
            await self.broadcaster.broadcast_room(user_id, {"type":"event_created","event":ev.dict()})
            await self.broadcaster.broadcast_room(user_id, {"type":"assistant_text","text": msg})
            return {"assistant_text": msg, "delta": {"type":"event_created","event": ev.dict()}}

        if intent == 'delete':
            from datetime import datetime, timedelta
            after = datetime.now().isoformat()
            before = (datetime.now() + timedelta(days=90)).isoformat()
            matches = self.events.find_by_title_window(user_id, title or "", after, before)
            if len(matches) == 1:
                ok = self.events.delete_by_id(user_id, matches[0].id)
                if ok:
                    await self.broadcaster.broadcast_room(user_id, {"type":"event_deleted","event_id":matches[0].id})
                    msg = f"Removed {matches[0].title}"
                    await self.broadcaster.broadcast_room(user_id, {"type":"assistant_text","text": msg})
                    return {"assistant_text": msg, "delta": {"type":"event_deleted","event_id": matches[0].id}}
            elif len(matches) > 1:
                names = ", ".join(f"{m.title} ({m.start_at})" for m in matches[:5])
                msg = f"I found multiple matches: {names}. Say the exact time or tap to delete."
                await self.broadcaster.broadcast_room(user_id, {"type":"assistant_text","text": msg})
                return {"assistant_text": msg, "delta": None}
            msg = "I couldn't find that event."
            await self.broadcaster.broadcast_room(user_id, {"type":"assistant_text","text": msg})
            return {"assistant_text": msg, "delta": None}

        if intent == 'list':
            items = [e.dict() for e in self.events.list(user_id)]
            if not items:
                msg = "You have no events."
                await self.broadcaster.broadcast_room(user_id, {"type":"assistant_text","text": msg})
                return {"assistant_text": msg, "delta": None}
            items_sorted = sorted([e for e in items if e.get('start_at')], key=lambda x: x['start_at'])
            preview = "; ".join(f"{e['title']} at {e['start_at']}" for e in items_sorted[:5])
            msg = f"Upcoming: {preview}"
            await self.broadcaster.broadcast_room(user_id, {"type":"assistant_text","text": msg})
            return {"assistant_text": msg, "delta": {"type":"events_snapshot","events": items}}

        msg = "I wasn't sure what to do. Try 'Add lunch tomorrow at 1pm' or 'Delete dentist'."
        await self.broadcaster.broadcast_room(user_id, {"type":"assistant_text","text": msg})
        return {"assistant_text": msg, "delta": None}
