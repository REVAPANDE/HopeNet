import { apiClient } from "../../services/apiClient";
import type { PriorityConfig, SystemEventRecord } from "../../types";

export function getSystemEvents(after?: string | null) {
  const params = after ? `?after=${encodeURIComponent(after)}` : "";
  return apiClient<{ events: SystemEventRecord[] }>(`/system/events${params}`);
}

export function getSystemStatus() {
  return apiClient<{ database: string; priority_config: PriorityConfig; event_count: number }>("/system/status");
}
