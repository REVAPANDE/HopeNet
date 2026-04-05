import { apiClient } from "../../services/apiClient";
import type { Volunteer } from "../../types";

export function getVolunteers() {
  return apiClient<Volunteer[]>("/volunteers");
}

