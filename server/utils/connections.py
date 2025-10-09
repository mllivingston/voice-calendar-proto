from typing import Dict, Set
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room, set()).add(ws)

    def disconnect(self, room: str, ws: WebSocket):
        try:
            if room in self.rooms and ws in self.rooms[room]:
                self.rooms[room].remove(ws)
                if not self.rooms[room]:
                    del self.rooms[room]
        except Exception:
            pass

    async def broadcast_room(self, room: str, message: dict):
        for ws in list(self.rooms.get(room, set())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(room, ws)

manager = ConnectionManager()
