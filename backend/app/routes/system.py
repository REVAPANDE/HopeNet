from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query

from app.db.firestore import store
from app.services.optimizer import current_priority_config, list_events

router = APIRouter()


@router.get("/events")
def events(after: str | None = Query(default=None), limit: int = Query(default=25, ge=1, le=100)):
    after_dt = datetime.fromisoformat(after.replace("Z", "+00:00")) if after else None
    return {"events": list_events(after=after_dt, limit=limit)}


@router.get("/status")
def status():
    return {
        "database": "firestore" if store.firestore_enabled else "in-memory",
        "priority_config": current_priority_config(),
        "event_count": len(store.events.list()),
    }
