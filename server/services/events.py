from typing import List, Optional
from sqlmodel import select
from db.models import Event
from db.session import get_session
from datetime import datetime

class EventsService:
    def list(self, user_id: str) -> List[Event]:
        with get_session() as s:
            stmt = select(Event).where(Event.user_id == user_id)
            return list(s.exec(stmt))

    def create(self, user_id: str, title: str, start_at: Optional[str], end_at: Optional[str], all_day: bool=False) -> Event:
        now_iso = datetime.utcnow().isoformat()
        ev = Event(user_id=user_id, title=title, start_at=start_at, end_at=end_at, all_day=all_day, created_at=now_iso, updated_at=now_iso)
        with get_session() as s:
            s.add(ev)
            s.commit()
            s.refresh(ev)
        return ev

    def delete_by_id(self, user_id: str, event_id: str) -> bool:
        with get_session() as s:
            ev = s.get(Event, event_id)
            if not ev or ev.user_id != user_id:
                return False
            s.delete(ev)
            s.commit()
            return True

    def find_by_title_window(self, user_id: str, title_like: str, start_after: Optional[str]=None, start_before: Optional[str]=None) -> List[Event]:
        with get_session() as s:
            stmt = select(Event).where(Event.user_id == user_id)
            if title_like:
                stmt = stmt.where(Event.title.ilike(f"%{title_like}%"))
            results = list(s.exec(stmt))
            if start_after:
                results = [e for e in results if e.start_at and e.start_at >= start_after]
            if start_before:
                results = [e for e in results if e.start_at and e.start_at < start_before]
            return results

    def delete_many(self, user_id: str, ids: List[str]) -> int:
        count = 0
        with get_session() as s:
            for id_ in ids:
                ev = s.get(Event, id_)
                if ev and ev.user_id == user_id:
                    s.delete(ev)
                    count += 1
            s.commit()
        return count
