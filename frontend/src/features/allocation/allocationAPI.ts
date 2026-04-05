import { apiClient } from "../../services/apiClient";
import type { AllocationResponse, PriorityConfig, PriorityWeights } from "../../types";

export function getAllocationState() {
  return apiClient<AllocationResponse>("/allocation/state");
}

export function recomputeAllocation(reason: "manual" | "priority_update" | "new_task" | "volunteer_dropout" = "manual") {
  return apiClient<AllocationResponse>("/allocation/recompute", {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export function getPriorityConfig() {
  return apiClient<PriorityConfig>("/allocation/priority-config");
}

export function updatePriorityConfig(weights: PriorityWeights) {
  return apiClient<{ config: PriorityConfig; allocation: AllocationResponse }>("/allocation/update-priority", {
    method: "POST",
    body: JSON.stringify({ weights })
  });
}
