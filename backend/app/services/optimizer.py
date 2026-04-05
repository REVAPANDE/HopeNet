from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from app.db.firestore import store
from app.models.schemas import (
    AllocationMetrics,
    AllocationResponse,
    AlternativeVolunteer,
    Assignment,
    AssignmentExplanation,
    ExplainRequest,
    PriorityConfig,
    PriorityWeights,
    RecomputeRequest,
    SimulationRequest,
    SimulationResponse,
    SystemEventRecord,
    SystemEventType,
    Task,
    UpdatePriorityRequest,
    Volunteer,
    VolunteerStatus,
)
from app.services.gemini import explain_assignment
from app.services.matching import build_reason, confidence_score, prioritized_tasks
from app.services.vertex import predict_priority


def _available_volunteers(volunteers: list[Volunteer]) -> list[Volunteer]:
    return [
        volunteer
        for volunteer in volunteers
        if volunteer.status == VolunteerStatus.available and volunteer.assigned_count < volunteer.capacity
    ]


def _compute_metrics(
    assignments: list[Assignment],
    reasons,
    tasks: list[Task],
    volunteers: list[Volunteer],
) -> AllocationMetrics:
    assigned_task_ids = {assignment.task_id for assignment in assignments}
    coverage = len(assigned_task_ids) / max(1, len(tasks))
    avg_distance = sum(reason.distance_km for reason in reasons) / max(1, len(reasons))
    workloads = [volunteer.assigned_count / max(1, volunteer.capacity) for volunteer in volunteers]
    fairness_index = 1 - (max(workloads, default=0) - min(workloads, default=0))
    critical_pending = sum(
        1 for task in tasks if task.priority_score >= 75 and task.id not in assigned_task_ids
    )
    utilization = sum(volunteer.assigned_count for volunteer in volunteers) / max(
        1, sum(volunteer.capacity for volunteer in volunteers)
    )
    return AllocationMetrics(
        coverage_rate=round(coverage, 3),
        avg_distance_km=round(avg_distance, 2),
        fairness_index=round(max(0.0, fairness_index), 3),
        pending_critical_tasks=critical_pending,
        volunteer_utilization=round(utilization, 3),
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def current_priority_config() -> PriorityConfig:
    config = store.priority_config.get("default")
    if config is not None:
        return config

    config = PriorityConfig()
    store.priority_config.upsert(config.id, config)
    return config


def update_priority_config(payload: UpdatePriorityRequest) -> PriorityConfig:
    config = PriorityConfig(weights=payload.weights, updated_at=_now())
    store.priority_config.upsert(config.id, config)
    emit_event(
        SystemEventType.priority_update,
        "Priority weights updated",
        {
            "skill_match": payload.weights.skill_match,
            "distance": payload.weights.distance,
            "priority": payload.weights.priority,
            "availability": payload.weights.availability,
            "workload_penalty": payload.weights.workload_penalty,
        },
    )
    return config


def emit_event(
    event_type: SystemEventType,
    message: str,
    metadata: dict[str, str | float | int | bool] | None = None,
) -> SystemEventRecord:
    event = SystemEventRecord(
        id=str(uuid4()),
        type=event_type,
        message=message,
        created_at=_now(),
        metadata=metadata or {},
    )
    store.events.upsert(event.id, event)
    return event


def list_events(after: datetime | None = None, limit: int = 25) -> list[SystemEventRecord]:
    events = sorted(store.events.list(), key=lambda event: event.created_at, reverse=True)
    if after is not None:
        events = [event for event in events if event.created_at > after]
    return events[:limit]


def _reasoning_points(reason, volunteer: Volunteer, task: Task) -> list[str]:
    priority_bucket = "critical" if task.priority_score >= 85 else "high" if task.priority_score >= 65 else "moderate"
    return [
        f"Closest qualified option within {reason.distance_km:.1f} km",
        f"Skill match contributed {reason.skill_component:.2f} with {reason.skill_match:.0%} overlap",
        f"Task urgency is {priority_bucket} and added {reason.priority_component:.2f} to the score",
        f"Availability and workload balance kept the assignment sustainable",
    ]


def _alternative_reason(alternative, winner_score: float, volunteer_name: str) -> str:
    gaps: list[str] = []
    if alternative.distance_component < 0.12:
        gaps.append("farther away")
    if alternative.skill_match < 0.75:
        gaps.append("weaker skill match")
    if alternative.fairness_penalty > 0.5:
        gaps.append("higher workload")
    if alternative.availability_score < 0.5:
        gaps.append("less remaining capacity")
    gap_text = ", ".join(gaps) if gaps else "slightly lower total match score"
    return f"{volunteer_name} ranked below the chosen responder due to {gap_text}; score gap {winner_score - alternative.final_score:.2f}."


def run_allocation(tasks: list[Task] | None = None, volunteers: list[Volunteer] | None = None) -> AllocationResponse:
    tasks = deepcopy(tasks if tasks is not None else store.tasks.list())
    volunteers = deepcopy(volunteers if volunteers is not None else store.volunteers.list())
    weights = current_priority_config().weights

    for task in tasks:
        task.priority_score = predict_priority(task)

    candidate_pool = {volunteer.id: volunteer for volunteer in _available_volunteers(volunteers)}
    assignments: list[Assignment] = []
    reasons = []
    unassigned_tasks: list[str] = []

    for task in prioritized_tasks(tasks):
        scored_candidates = []
        for volunteer in candidate_pool.values():
            reason = build_reason(volunteer, task, weights)
            scored_candidates.append((volunteer, reason))

        scored_candidates.sort(key=lambda entry: entry[1].final_score, reverse=True)
        best_volunteer = scored_candidates[0][0] if scored_candidates else None
        best_reason = scored_candidates[0][1] if scored_candidates else None
        runner_up = scored_candidates[1][1].final_score if len(scored_candidates) > 1 else None

        if best_reason is None or best_volunteer is None or best_reason.final_score < 0.2:
            unassigned_tasks.append(task.id)
            continue

        best_reason.confidence = confidence_score(best_reason.final_score, runner_up)
        explanation = explain_assignment(best_reason, best_volunteer, task)
        assignments.append(
            Assignment(
                volunteer_id=best_volunteer.id,
                task_id=task.id,
                score=best_reason.final_score,
                explanation=explanation,
            )
        )
        reasons.append(best_reason)
        best_volunteer.assigned_count += 1
        if best_volunteer.assigned_count >= best_volunteer.capacity:
            candidate_pool.pop(best_volunteer.id, None)

    metrics = _compute_metrics(assignments, reasons, tasks, volunteers)
    summary = (
        f"Allocated {len(assignments)} tasks with {metrics.coverage_rate:.0%} coverage, "
        f"{metrics.avg_distance_km:.1f} km average travel, and fairness index {metrics.fairness_index:.2f}."
    )
    store.assignments.bulk_upsert(
        {f"{assignment.volunteer_id}:{assignment.task_id}": assignment for assignment in assignments}
    )
    return AllocationResponse(
        assignments=assignments,
        reasons=reasons,
        metrics=metrics,
        unassigned_tasks=unassigned_tasks,
        summary=summary,
    )


def recompute_assignments(request: RecomputeRequest | None = None) -> AllocationResponse:
    allocation = run_allocation()
    emit_event(
        SystemEventType.assignment_recomputed,
        "Assignments recomputed",
        {
            "coverage_rate": allocation.metrics.coverage_rate,
            "pending_critical_tasks": allocation.metrics.pending_critical_tasks,
            "trigger": request.reason if request else "manual",
        },
    )
    return allocation


def simulate_allocation(request: SimulationRequest) -> SimulationResponse:
    baseline = run_allocation()
    tasks = deepcopy(store.tasks.list())
    volunteers = deepcopy(store.volunteers.list())

    if request.scenario.value == "volunteer_dropout":
        rate = request.dropout_rate or 0.2
        active_count = max(1, round(len(volunteers) * (1 - rate)))
        ranked = sorted(volunteers, key=lambda volunteer: volunteer.reliability, reverse=True)
        active_ids = {volunteer.id for volunteer in ranked[:active_count]}
        for volunteer in volunteers:
            if volunteer.id not in active_ids:
                volunteer.status = VolunteerStatus.offline
                volunteer.capacity = 0
    elif request.scenario.value == "demand_spike" and request.target_area:
        multiplier = request.demand_multiplier or 2.0
        surge_tasks: list[Task] = []
        for task in tasks:
            if task.area.lower() == request.target_area.lower():
                task.people_affected = int(task.people_affected * multiplier)
                task.severity = min(10, task.severity + 1)
                additional_tasks = max(1, round(multiplier) - 1)
                for index in range(additional_tasks):
                    surge_tasks.append(
                        Task(
                            id=f"{task.id}-surge-{index + 1}",
                            title=f"{task.title} Surge {index + 1}",
                            type=task.type,
                            location={
                                "lat": task.location.lat + 0.012 * (index + 1),
                                "lng": task.location.lng + 0.01 * (index + 1),
                            },
                            severity=min(10, task.severity + 1),
                            people_affected=max(20, int(task.people_affected * 0.55)),
                            required_skills=task.required_skills,
                            deadline_minutes=max(10, int(task.deadline_minutes * 0.75)),
                            area=task.area,
                            requested_volunteers=task.requested_volunteers,
                        )
                    )
        tasks.extend(surge_tasks)

    simulated = run_allocation(tasks=tasks, volunteers=volunteers)
    delta = simulated.metrics.coverage_rate - baseline.metrics.coverage_rate
    impact_summary = (
        f"Scenario changed coverage by {delta:+.0%} and pending critical tasks from "
        f"{baseline.metrics.pending_critical_tasks} to {simulated.metrics.pending_critical_tasks}."
    )
    emit_event(
        SystemEventType.simulation_run,
        "Simulation executed",
        {
            "scenario": request.scenario.value,
            "coverage_delta": round(delta, 3),
        },
    )
    return SimulationResponse(
        baseline=baseline,
        simulated=simulated,
        impact_summary=impact_summary,
        simulated_tasks=tasks,
        simulated_volunteers=volunteers,
    )


def explain_existing_assignment(request: ExplainRequest) -> str:
    tasks = {task.id: task for task in store.tasks.list()}
    volunteers = {volunteer.id: volunteer for volunteer in store.volunteers.list()}
    allocation = run_allocation()
    reason_map = {(reason.volunteer_id, reason.task_id): reason for reason in allocation.reasons}

    if request.volunteer_id not in volunteers or request.task_id not in tasks:
        raise ValueError("Volunteer or task not found")
    if (request.volunteer_id, request.task_id) not in reason_map:
        raise ValueError("Assignment not found in the current allocation")

    volunteer = volunteers[request.volunteer_id]
    task = tasks[request.task_id]
    task.priority_score = predict_priority(task)
    reason = reason_map[(request.volunteer_id, request.task_id)]
    return explain_assignment(reason, volunteer, task, request.style)


def explain_assignment_detail(request: ExplainRequest) -> AssignmentExplanation:
    tasks = {task.id: task for task in store.tasks.list()}
    volunteers = {volunteer.id: volunteer for volunteer in store.volunteers.list()}
    if request.volunteer_id not in volunteers or request.task_id not in tasks:
        raise ValueError("Volunteer or task not found")

    task = tasks[request.task_id]
    task.priority_score = predict_priority(task)
    weights = current_priority_config().weights
    candidate_reasons = []
    for volunteer in volunteers.values():
        if volunteer.status != VolunteerStatus.available and volunteer.id != request.volunteer_id:
            continue
        candidate_reasons.append((volunteer, build_reason(volunteer, task, weights)))

    candidate_reasons.sort(key=lambda entry: entry[1].final_score, reverse=True)
    selected_entry = next(
        ((volunteer, reason) for volunteer, reason in candidate_reasons if volunteer.id == request.volunteer_id),
        None,
    )

    if selected_entry is None:
        raise ValueError("Assignment not found in the current allocation")

    selected_volunteer, selected_reason = selected_entry
    runner_up = next((reason.final_score for volunteer, reason in candidate_reasons if volunteer.id != request.volunteer_id), None)
    selected_reason.confidence = confidence_score(selected_reason.final_score, runner_up)
    alternatives = []
    for alternative_volunteer, alternative_reason in candidate_reasons:
        if alternative_volunteer.id == request.volunteer_id:
            continue
        alternatives.append(
            AlternativeVolunteer(
                volunteer_id=alternative_volunteer.id,
                volunteer_name=alternative_volunteer.name,
                final_score=alternative_reason.final_score,
                reason_not_selected=_alternative_reason(alternative_reason, selected_reason.final_score, alternative_volunteer.name),
                distance_km=alternative_reason.distance_km,
                skill_match=alternative_reason.skill_match,
                workload_penalty=alternative_reason.fairness_penalty,
            )
        )
        if len(alternatives) == 2:
            break

    return AssignmentExplanation(
        volunteer_id=selected_volunteer.id,
        task_id=task.id,
        score=selected_reason.final_score,
        confidence=selected_reason.confidence,
        reasoning=_reasoning_points(selected_reason, selected_volunteer, task),
        alternatives=alternatives,
        narrative=explain_assignment(selected_reason, selected_volunteer, task, request.style),
    )


def bootstrap_demo_state() -> None:
    if store.tasks.list() or store.volunteers.list():
        return

    volunteers = [
        Volunteer(
            id="vol-1",
            name="Asha Menon",
            skills=["medical", "triage", "coordination"],
            location={"lat": 12.9716, "lng": 77.5946},
            capacity=2,
            assigned_count=0,
            reliability=0.98,
        ),
        Volunteer(
            id="vol-2",
            name="Rohan Iyer",
            skills=["transport", "logistics", "food"],
            location={"lat": 12.9352, "lng": 77.6245},
            capacity=2,
            assigned_count=1,
            reliability=0.93,
        ),
        Volunteer(
            id="vol-3",
            name="Fatima Khan",
            skills=["shelter", "counseling", "coordination"],
            location={"lat": 12.9279, "lng": 77.6271},
            capacity=1,
            assigned_count=0,
            reliability=0.91,
        ),
        Volunteer(
            id="vol-4",
            name="Naveen Rao",
            skills=["evacuation", "rescue", "medical"],
            location={"lat": 13.0099, "lng": 77.5511},
            capacity=2,
            assigned_count=1,
            reliability=0.96,
        ),
    ]

    tasks = [
        Task(
            id="task-1",
            title="Flood Evacuation Support",
            type="evacuation",
            location={"lat": 12.9784, "lng": 77.6408},
            severity=9,
            people_affected=140,
            required_skills=["evacuation", "medical"],
            deadline_minutes=35,
            area="East Zone",
        ),
        Task(
            id="task-2",
            title="Medical Camp Setup",
            type="medical",
            location={"lat": 12.9698, "lng": 77.7500},
            severity=8,
            people_affected=80,
            required_skills=["medical", "triage"],
            deadline_minutes=45,
            area="East Zone",
        ),
        Task(
            id="task-3",
            title="Shelter Coordination",
            type="shelter",
            location={"lat": 12.9141, "lng": 77.6450},
            severity=7,
            people_affected=210,
            required_skills=["shelter", "coordination"],
            deadline_minutes=90,
            area="South Zone",
        ),
        Task(
            id="task-4",
            title="Food Delivery Route",
            type="food",
            location={"lat": 13.0358, "lng": 77.5970},
            severity=6,
            people_affected=120,
            required_skills=["logistics", "food"],
            deadline_minutes=70,
            area="North Zone",
        ),
    ]

    store.volunteers.bulk_upsert({volunteer.id: volunteer for volunteer in volunteers})
    store.tasks.bulk_upsert({task.id: task for task in tasks})
    current_priority_config()
