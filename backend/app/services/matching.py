from __future__ import annotations

import heapq
import math

from app.models.schemas import AssignmentReason, PriorityWeights, Task, Volunteer


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def skill_match_score(volunteer: Volunteer, task: Task) -> float:
    if not task.required_skills:
        return 1.0
    overlap = len(set(volunteer.skills) & set(task.required_skills))
    return overlap / len(task.required_skills)


def fairness_penalty(volunteer: Volunteer) -> float:
    if volunteer.capacity <= 0:
        return 1.0
    return min(1.0, volunteer.assigned_count / max(1, volunteer.capacity))


def availability_score(volunteer: Volunteer) -> float:
    if volunteer.capacity <= 0:
        return 0.0
    remaining_capacity = max(0, volunteer.capacity - volunteer.assigned_count)
    return min(1.0, remaining_capacity / volunteer.capacity)


def inverse_distance_score(distance_km: float, cap_km: float = 30.0) -> float:
    normalized = min(distance_km, cap_km) / cap_km
    return round(max(0.0, 1 - normalized), 3)


def confidence_score(final_score: float, runner_up_score: float | None = None) -> float:
    margin = max(0.0, final_score - runner_up_score) if runner_up_score is not None else final_score * 0.2
    confidence = min(0.98, max(0.18, final_score * 0.65 + margin * 0.35))
    return round(confidence, 3)


def build_reason(volunteer: Volunteer, task: Task, weights: PriorityWeights) -> AssignmentReason:
    distance = haversine_km(
        volunteer.location.lat,
        volunteer.location.lng,
        task.location.lat,
        task.location.lng,
    )
    skill_score = skill_match_score(volunteer, task)
    workload_penalty = fairness_penalty(volunteer)
    distance_score = inverse_distance_score(distance)
    availability = availability_score(volunteer)
    priority_weight = round(task.priority_score / 100.0, 3)
    skill_component = weights.skill_match * skill_score
    distance_component = weights.distance * distance_score
    priority_component = weights.priority * priority_weight
    availability_component = weights.availability * availability
    workload_component = weights.workload_penalty * workload_penalty
    final_score = skill_component + distance_component + priority_component + availability_component - workload_component

    return AssignmentReason(
        volunteer_id=volunteer.id,
        task_id=task.id,
        skill_match=round(skill_score, 3),
        distance_km=round(distance, 2),
        priority_score=round(task.priority_score, 2),
        availability_score=round(availability, 3),
        fairness_penalty=round(workload_penalty, 3),
        distance_component=round(distance_component, 3),
        priority_component=round(priority_component, 3),
        skill_component=round(skill_component, 3),
        availability_component=round(availability_component, 3),
        workload_component=round(workload_component, 3),
        final_score=round(max(0.0, min(1.0, final_score)), 3),
        confidence=0.0,
    )


def prioritized_tasks(tasks: list[Task]) -> list[Task]:
    queue: list[tuple[float, str, Task]] = []
    for task in tasks:
        heapq.heappush(queue, (-task.priority_score, task.id, task))
    ordered: list[Task] = []
    while queue:
        ordered.append(heapq.heappop(queue)[2])
    return ordered
