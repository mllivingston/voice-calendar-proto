import re
from datetime import datetime, timedelta
from typing import Literal, Optional

Intent = Literal['add','list','delete','unknown']
WEEKDAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
_time_re = re.compile(r"(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", re.I)

def _next_weekday(target_idx: int) -> datetime:
    today = datetime.now()
    days_ahead = (target_idx - today.weekday()) % 7
    return today + timedelta(days=days_ahead or 7)

def parse(text: str) -> dict:
    t = text.strip().lower()
    intent: Intent = 'unknown'
    if any(k in t for k in ['add','create','schedule','set up','book','i have']): intent='add'
    elif any(k in t for k in ['delete','remove','cancel']): intent='delete'
    elif any(k in t for k in ['list','show','what','view']): intent='list'

    now = datetime.now()
    start_dt: Optional[datetime] = None
    if 'today' in t: start_dt = now
    elif 'tomorrow' in t: start_dt = now + timedelta(days=1)
    else:
        for idx, name in enumerate(WEEKDAYS):
            if name in t:
                start_dt = _next_weekday(idx)
                break

    m = _time_re.search(t)
    if m:
        hour = int(m.group(1)); minute = int(m.group(2) or 0); ap = (m.group(3) or '').lower()
        if ap == 'pm' and hour < 12: hour += 12
        if ap == 'am' and hour == 12: hour = 0
    else:
        hour, minute = 9, 0

    title = t
    for phrase in ['add','create','schedule','book','set up','i have','i have a','i have an']: title = title.replace(phrase, '')
    for wd in ['today','tomorrow'] + WEEKDAYS + ['at']: title = title.replace(wd, '')
    title = re.sub(_time_re, '', title)
    title = re.sub(r"\s+", " ", title).strip().title()

    start_iso = None
    if start_dt:
        start_dt = start_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
        start_iso = start_dt.isoformat()

    return {'intent': intent, 'title': title, 'start_at': start_iso, 'end_at': None, 'all_day': False}
