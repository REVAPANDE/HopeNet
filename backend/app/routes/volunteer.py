from fastapi import APIRouter, HTTPException

from app.db.firestore import store
from app.models.schemas import Volunteer
from app.models.schemas import RecomputeRequest, SystemEventType
from app.models.schemas import VolunteerMovementRequest
from app.services.optimizer import emit_event, recompute_assignments

router = APIRouter()


@router.get("", response_model=list[Volunteer])
def list_volunteers():
    return store.volunteers.list()


@router.get("/{volunteer_id}", response_model=Volunteer)
def get_volunteer(volunteer_id: str):
    volunteer = store.volunteers.get(volunteer_id)
    if volunteer is None:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return volunteer


@router.post("", response_model=Volunteer)
def upsert_volunteer(volunteer: Volunteer):
    saved = store.volunteers.upsert(volunteer.id, volunteer)
    if volunteer.status.value == "offline":
        emit_event(
            SystemEventType.volunteer_dropout,
            f"Volunteer offline: {volunteer.name}",
            {"volunteer_id": volunteer.id},
        )
        recompute_assignments(RecomputeRequest(reason="volunteer_dropout"))
    return saved


@router.post("/{volunteer_id}/move", response_model=Volunteer)
def move_volunteer(volunteer_id: str, payload: VolunteerMovementRequest):
    volunteer = store.volunteers.get(volunteer_id)
    if volunteer is None:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    volunteer.location = payload.location
    saved = store.volunteers.upsert(volunteer.id, volunteer)
    emit_event(
        SystemEventType.volunteer_movement,
        f"Volunteer moved: {volunteer.name}",
        {
            "volunteer_id": volunteer.id,
            "lat": payload.location.lat,
            "lng": payload.location.lng,
        },
    )
    recompute_assignments(RecomputeRequest(reason="volunteer_movement"))
    return saved
