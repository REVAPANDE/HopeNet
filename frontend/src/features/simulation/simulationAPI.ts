import { apiClient } from "../../services/apiClient";
import type { SimulationResponse, SimulationScenario } from "../../types";

type SimulationPayload =
  | { scenario: "volunteer_dropout"; dropout_rate: number }
  | { scenario: "demand_spike"; target_area: string; demand_multiplier: number };

export function runSimulation(payload: SimulationPayload) {
  return apiClient<SimulationResponse>("/allocation/simulate", {
    method: "POST",
    body: JSON.stringify(payload satisfies { scenario: SimulationScenario })
  });
}

