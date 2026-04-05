from __future__ import annotations

import os

from app.models.schemas import AssignmentReason, Task, Volunteer


def local_explanation(reason: AssignmentReason, volunteer: Volunteer, task: Task) -> str:
    skill_text = "strong" if reason.skill_match >= 0.8 else "partial"
    fairness_text = "balanced" if reason.fairness_penalty < 0.5 else "higher-than-average"
    return (
        f"{volunteer.name} was matched to {task.title} because they are {reason.distance_km} km away, "
        f"have a {skill_text} skill match ({reason.skill_match:.0%}), and the task priority is "
        f"{task.priority_score:.1f}/100. Current workload pressure is {fairness_text}, which was included "
        f"to keep volunteer distribution fair."
    )


def explain_assignment(reason: AssignmentReason, volunteer: Volunteer, task: Task, style: str = "brief") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    use_vertex = os.getenv("GEMINI_USE_VERTEXAI", "false").lower() == "true"
    project = os.getenv("VERTEX_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("VERTEX_LOCATION", "us-central1")
    fallback = local_explanation(reason, volunteer, task)

    prompt = f"""
    You are generating a transparent emergency-response assignment explanation.
    Keep it {style}, factual, and easy for operators to trust.

    Volunteer: {volunteer.model_dump()}
    Task: {task.model_dump()}
    Reason metrics: {reason.model_dump()}

    Mention proximity, skills, urgency, and workload fairness.
    """

    try:
        from google import genai  # type: ignore

        if use_vertex and project:
            client = genai.Client(vertexai=True, project=project, location=location)
        elif api_key:
            client = genai.Client(api_key=api_key)
        else:
            return fallback

        response = client.models.generate_content(model=model_name, contents=prompt)
        text = getattr(response, "text", "") or fallback
        return text.strip()
    except Exception:
        return fallback
