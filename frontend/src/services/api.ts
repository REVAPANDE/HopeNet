import { AllocationResponse, SimulationResponse, Task, Volunteer } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  listVolunteers: () => request<Volunteer[]>("/volunteers"),
  listTasks: () => request<Task[]>("/tasks"),
  getAllocation: () => request<AllocationResponse>("/allocation/state"),
  runSimulation: (body: unknown) =>
    request<SimulationResponse>("/allocation/simulate", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  explainAssignment: (volunteer_id: string, task_id: string) =>
    request<{ explanation: string }>("/allocation/explain", {
      method: "POST",
      body: JSON.stringify({ volunteer_id, task_id, style: "detailed" })
    })
};
