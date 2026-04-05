import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "priority_training_data.csv"
OUTPUT_PATH = ROOT / "artifacts" / "priority_model.json"


def load_rows() -> list[dict[str, float | str]]:
    with DATA_PATH.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        rows: list[dict[str, float | str]] = []
        for row in reader:
            rows.append(
                {
                    "task_type": row["task_type"].strip().lower(),
                    "people_affected": float(row["people_affected"]),
                    "severity": float(row["severity"]),
                    "deadline_minutes": float(row["deadline_minutes"]),
                    "priority_score": float(row["priority_score"]),
                }
            )
        return rows


def mean(values: list[float]) -> float:
    return sum(values) / max(1, len(values))


def fit_model(rows: list[dict[str, float | str]]) -> dict[str, object]:
    priorities = [float(row["priority_score"]) for row in rows]
    people = [float(row["people_affected"]) for row in rows]
    severities = [float(row["severity"]) for row in rows]
    deadlines = [float(row["deadline_minutes"]) for row in rows]

    mean_priority = mean(priorities)
    mean_people = mean(people)
    mean_severity = mean(severities)
    mean_deadline = mean(deadlines)

    def safe_weight(feature_values: list[float], feature_mean: float) -> float:
        numerator = sum(
            (value - feature_mean) * (priority - mean_priority)
            for value, priority in zip(feature_values, priorities, strict=False)
        )
        denominator = sum((value - feature_mean) ** 2 for value in feature_values)
        return 0.0 if denominator == 0 else numerator / denominator

    feature_weights = {
        "people_affected": safe_weight(people, mean_people),
        "severity": safe_weight(severities, mean_severity),
        "deadline_minutes": safe_weight(deadlines, mean_deadline),
    }

    base_without_task_type = (
        mean_priority
        - feature_weights["people_affected"] * mean_people
        - feature_weights["severity"] * mean_severity
        - feature_weights["deadline_minutes"] * mean_deadline
    )

    grouped_residuals: dict[str, list[float]] = {}
    for row in rows:
        baseline = (
            base_without_task_type
            + feature_weights["people_affected"] * float(row["people_affected"])
            + feature_weights["severity"] * float(row["severity"])
            + feature_weights["deadline_minutes"] * float(row["deadline_minutes"])
        )
        grouped_residuals.setdefault(str(row["task_type"]), []).append(float(row["priority_score"]) - baseline)

    task_type_weights = {
        task_type: mean(residuals) for task_type, residuals in grouped_residuals.items()
    }
    task_type_weights["__default__"] = 0.0

    return {
        "intercept": round(base_without_task_type, 6),
        "feature_weights": {
            key: round(value, 6) for key, value in feature_weights.items()
        },
        "task_type_weights": {
            key: round(value, 6) for key, value in task_type_weights.items()
        },
        "training_rows": len(rows),
    }


def evaluate(rows: list[dict[str, float | str]], model: dict[str, object]) -> float:
    feature_weights = model["feature_weights"]
    task_type_weights = model["task_type_weights"]
    intercept = float(model["intercept"])
    errors: list[float] = []

    for row in rows:
        prediction = intercept
        prediction += float(task_type_weights.get(str(row["task_type"]), task_type_weights["__default__"]))
        prediction += float(feature_weights["people_affected"]) * float(row["people_affected"])
        prediction += float(feature_weights["severity"]) * float(row["severity"])
        prediction += float(feature_weights["deadline_minutes"]) * float(row["deadline_minutes"])
        prediction = max(0.0, min(100.0, prediction))
        errors.append(abs(prediction - float(row["priority_score"])))

    return mean(errors)


def main() -> None:
    rows = load_rows()
    model = fit_model(rows)
    mae = evaluate(rows, model)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(model, indent=2), encoding="utf-8")

    print(f"Saved model to {OUTPUT_PATH}")
    print(f"Validation MAE: {mae:.2f}")


if __name__ == "__main__":
    main()
