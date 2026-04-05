from fastapi import APIRouter, HTTPException

from app.db.firestore import store
from app.models.schemas import BatchPriorityRequest, Task
from app.services.optimizer import emit_event, recompute_assignments
from app.services.vertex import predict_priority
from app.models.schemas import RecomputeRequest, SystemEventType

router = APIRouter()


@router.get("", response_model=list[Task])
def list_tasks():
    tasks = store.tasks.list()
    for task in tasks:
        task.priority_score = predict_priority(task)
    return tasks


@router.post("/score")
def batch_score(payload: BatchPriorityRequest):
    return {
        "scores": [
            {"task_id": task.id, "priority_score": predict_priority(task)}
            for task in payload.tasks
        ]
    }


@router.get("/{task_id}", response_model=Task)
def get_task(task_id: str):
    task = store.tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    task.priority_score = predict_priority(task)
    return task


@router.post("", response_model=Task)
def upsert_task(task: Task):
    task.priority_score = predict_priority(task)
    saved = store.tasks.upsert(task.id, task)
    emit_event(
        SystemEventType.new_task,
        f"Task updated: {task.title}",
        {"task_id": task.id, "priority_score": task.priority_score, "area": task.area},
    )
    recompute_assignments(RecomputeRequest(reason="new_task"))
    return saved
