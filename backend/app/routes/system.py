from __future__ import annotations

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.db.firestore import store
from app.services.optimizer import current_priority_config, list_events

router = APIRouter()


@router.get("/events")
def events(after: str | None = Query(default=None), limit: int = Query(default=25, ge=1, le=100)):
    after_dt = datetime.fromisoformat(after.replace("Z", "+00:00")) if after else None
    return {"events": list_events(after=after_dt, limit=limit)}


@router.get("/stream")
async def stream_events():
    async def event_generator():
        last_seen: datetime | None = None
        while True:
            events = list_events(after=last_seen, limit=25)
            if events:
                for event in sorted(events, key=lambda item: item.created_at):
                    payload = event.model_dump(mode="json")
                    yield f"event: system_event\ndata: {json.dumps(payload)}\n\n"
                    last_seen = event.created_at
            else:
                # Keep-alive comment to prevent idle timeouts on proxies.
                yield ": keepalive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/status")
def status():
    return {
        "database": "firestore" if store.firestore_enabled else "in-memory",
        "priority_config": current_priority_config(),
        "event_count": len(store.events.list()),
    }
