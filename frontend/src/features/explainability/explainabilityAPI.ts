import { apiClient } from "../../services/apiClient";
import type { ExplainabilityResponse } from "../../types";

export function getExplanation(volunteerId: string, taskId: string) {
  return apiClient<ExplainabilityResponse>("/allocation/explain", {
    method: "POST",
    body: JSON.stringify({ volunteer_id: volunteerId, task_id: taskId, style: "detailed" })
  });
}
