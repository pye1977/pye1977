"""WebSocket broadcaster for live audit events + waterfall updates."""
import asyncio
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


class _Broadcaster:
    def __init__(self) -> None:
        self._sockets: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def register(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._sockets.add(ws)

    async def unregister(self, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets.discard(ws)

    async def broadcast(self, event: dict[str, Any]) -> None:
        if not self._sockets:
            return
        # JSON-serialize once
        msg = json.dumps(_clean(event), default=str)
        dead: list[WebSocket] = []
        async with self._lock:
            for ws in list(self._sockets):
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self._sockets.discard(ws)


def _clean(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items() if k != "_id"}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


broadcaster = _Broadcaster()

router = APIRouter(tags=["ws"])


@router.websocket("/api/ws/audit")
async def ws_audit(ws: WebSocket) -> None:
    await broadcaster.register(ws)
    try:
        while True:
            # Server is push-only; we still consume client pings to keep alive.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await broadcaster.unregister(ws)
