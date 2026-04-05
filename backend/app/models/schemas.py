from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    pending = "pending"
    assigned = "assigned"
    completed = "completed"


class VolunteerStatus(str, Enum):
    available = "available"
    busy = "busy"
    offline = "offline"


class Coordinates(BaseModel):
    lat: float
    lng: float


class Volunteer(BaseModel):
    id: str
    name: str
    skills: list[str]
    location: Coordinates
    capacity: int = 1
    assigned_count: int = 0
    reliability: float = 0.95
    status: VolunteerStatus = VolunteerStatus.available


class Task(BaseModel):
    id: str
    title: str
    type: str
    location: Coordinates
    severity: int = Field(ge=1, le=10)
    people_affected: int = Field(ge=1)
    required_skills: list[str]
    deadline_minutes: int = Field(ge=5)
    status: TaskStatus = TaskStatus.pending
    area: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    requested_volunteers: int = 1
    priority_score: float = 0.0


class AssignmentReason(BaseModel):
    volunteer_id: str
    task_id: str
    skill_match: float
    distance_km: float
    priority_score: float
    availability_score: float = 0.0
    fairness_penalty: float
    distance_component: float = 0.0
    priority_component: float = 0.0
    skill_component: float = 0.0
    availability_component: float = 0.0
    workload_component: float = 0.0
    final_score: float
    confidence: float = 0.0


class AlternativeVolunteer(BaseModel):
    volunteer_id: str
    volunteer_name: str
    final_score: float
    reason_not_selected: str
    distance_km: float
    skill_match: float
    workload_penalty: float


class AssignmentExplanation(BaseModel):
    volunteer_id: str
    task_id: str
    score: float
    confidence: float
    reasoning: list[str]
    alternatives: list[AlternativeVolunteer]
    narrative: str


class Assignment(BaseModel):
    volunteer_id: str
    task_id: str
    score: float
    explanation: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AllocationMetrics(BaseModel):
    coverage_rate: float
    avg_distance_km: float
    fairness_index: float
    pending_critical_tasks: int
    volunteer_utilization: float


class AllocationResponse(BaseModel):
    assignments: list[Assignment]
    reasons: list[AssignmentReason]
    metrics: AllocationMetrics
    unassigned_tasks: list[str]
    summary: str


class ScenarioType(str, Enum):
    volunteer_dropout = "volunteer_dropout"
    demand_spike = "demand_spike"


class SimulationRequest(BaseModel):
    scenario: ScenarioType
    dropout_rate: float | None = Field(default=None, ge=0, le=1)
    target_area: str | None = None
    demand_multiplier: float | None = Field(default=None, ge=1, le=5)


class SimulationResponse(BaseModel):
    baseline: AllocationResponse
    simulated: AllocationResponse
    impact_summary: str
    simulated_tasks: list[Task]
    simulated_volunteers: list[Volunteer]


class ExplainRequest(BaseModel):
    volunteer_id: str
    task_id: str
    style: Literal["brief", "detailed"] = "brief"


class PriorityFeatures(BaseModel):
    task_type: str
    people_affected: int
    severity: int
    deadline_minutes: int


class BatchPriorityRequest(BaseModel):
    tasks: list[Task]


class PriorityWeights(BaseModel):
    skill_match: float = 0.35
    distance: float = 0.2
    priority: float = 0.25
    availability: float = 0.15
    workload_penalty: float = 0.15


class PriorityConfig(BaseModel):
    id: str = "default"
    weights: PriorityWeights = Field(default_factory=PriorityWeights)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UpdatePriorityRequest(BaseModel):
    weights: PriorityWeights


class RecomputeRequest(BaseModel):
    reason: Literal["manual", "priority_update", "new_task", "volunteer_dropout"] = "manual"


class SystemEventType(str, Enum):
    new_task = "NEW_TASK"
    volunteer_dropout = "VOLUNTEER_DROPOUT"
    priority_update = "PRIORITY_UPDATE"
    assignment_recomputed = "ASSIGNMENT_RECOMPUTED"
    simulation_run = "SIMULATION_RUN"


class SystemEventRecord(BaseModel):
    id: str
    type: SystemEventType
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, str | float | int | bool] = Field(default_factory=dict)
