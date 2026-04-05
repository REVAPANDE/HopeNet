import { apiClient } from "../../services/apiClient";
import type { Task } from "../../types";

export function getTasks() {
  return apiClient<Task[]>("/tasks");
}

