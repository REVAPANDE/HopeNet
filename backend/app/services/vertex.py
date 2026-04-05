from __future__ import annotations

import os
import json
from pathlib import Path

from app.models.schemas import PriorityFeatures, Task


def heuristic_priority(features: PriorityFeatures) -> float:
    severity_weight = features.severity * 5.5
    affected_weight = min(features.people_affected, 500) * 0.08
    deadline_weight = max(0, 120 - min(features.deadline_minutes, 120)) * 0.18
    type_bonus = {
        "medical": 12,
        "evacuation": 11,
        "shelter": 8,
        "food": 6,
        "transport": 5,
    }.get(features.task_type.lower(), 4)
    return round(min(100.0, severity_weight + affected_weight + deadline_weight + type_bonus), 2)


def local_model_priority(task: Task) -> float | None:
    model_path = Path(__file__).resolve().parents[2] / "ml" / "artifacts" / "priority_model.json"
    if not model_path.exists():
        return None

    try:
        model = json.loads(model_path.read_text(encoding="utf-8"))
        task_type = task.type.lower()
        intercept = float(model.get("intercept", 0.0))
        task_type_weights = model.get("task_type_weights", {})
        weights = model.get("feature_weights", {})

        prediction = intercept
        prediction += float(task_type_weights.get(task_type, task_type_weights.get("__default__", 0.0)))
        prediction += float(weights.get("people_affected", 0.0)) * float(task.people_affected)
        prediction += float(weights.get("severity", 0.0)) * float(task.severity)
        prediction += float(weights.get("deadline_minutes", 0.0)) * float(task.deadline_minutes)
        return round(max(0.0, min(100.0, prediction)), 2)
    except Exception:
        return None


def predict_priority(task: Task) -> float:
    features = PriorityFeatures(
        task_type=task.type,
        people_affected=task.people_affected,
        severity=task.severity,
        deadline_minutes=task.deadline_minutes,
    )

    project = os.getenv("VERTEX_PROJECT_ID")
    endpoint_id = os.getenv("VERTEX_ENDPOINT_ID")
    location = os.getenv("VERTEX_LOCATION", "us-central1")
    use_local_model = os.getenv("VERTEX_USE_LOCAL_MODEL", "false").lower() == "true"

    if use_local_model:
        local_score = local_model_priority(task)
        if local_score is not None:
            return local_score

    if not project or not endpoint_id:
        return heuristic_priority(features)

    try:
        from google.cloud import aiplatform_v1  # type: ignore

        client = aiplatform_v1.PredictionServiceClient()
        endpoint_path = (
            endpoint_id
            if endpoint_id.startswith("projects/")
            else f"projects/{project}/locations/{location}/endpoints/{endpoint_id}"
        )
        instance = {
            "task_type": features.task_type,
            "people_affected": features.people_affected,
            "severity": features.severity,
            "deadline_minutes": features.deadline_minutes,
        }
        prediction = client.predict(endpoint=endpoint_path, instances=[instance])
        value = prediction.predictions[0]

        if isinstance(value, dict):
            if "priority_score" in value:
                return float(value["priority_score"])
            if "value" in value:
                return float(value["value"])

        if isinstance(value, (int, float)):
            return float(value)

        return heuristic_priority(features)
    except Exception:
        return heuristic_priority(features)
