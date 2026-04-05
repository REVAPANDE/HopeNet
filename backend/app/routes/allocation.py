from fastapi import APIRouter, HTTPException

from app.models.schemas import ExplainRequest, RecomputeRequest, SimulationRequest, UpdatePriorityRequest
from app.services.optimizer import (
    current_priority_config,
    explain_assignment_detail,
    explain_existing_assignment,
    recompute_assignments,
    run_allocation,
    simulate_allocation,
    update_priority_config,
)

router = APIRouter()


@router.get("/state")
def allocation_state():
    return run_allocation()


@router.post("/run")
def run():
    return recompute_assignments()


@router.get("/assignments")
def assignments():
    return run_allocation()


@router.post("/recompute")
def recompute(request: RecomputeRequest = RecomputeRequest()):
    return recompute_assignments(request)


@router.get("/priority-config")
def get_priority_config():
    return current_priority_config()


@router.post("/update-priority")
def update_priority(request: UpdatePriorityRequest):
    config = update_priority_config(request)
    allocation = recompute_assignments(RecomputeRequest(reason="priority_update"))
    return {"config": config, "allocation": allocation}


@router.post("/simulate")
def simulate(request: SimulationRequest):
    return simulate_allocation(request)


@router.post("/explain")
def explain(request: ExplainRequest):
    try:
        detail = explain_assignment_detail(request)
        return {
            "explanation": explain_existing_assignment(request),
            "detail": detail,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
