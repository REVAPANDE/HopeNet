import { ShieldAlert, Users, Waves } from "lucide-react";
import type { SimulationResponse, SimulationScenario } from "../../types";

export function SimulationPanel(props: {
  scenario: SimulationScenario;
  setScenario: (scenario: SimulationScenario) => void;
  dropoutRate: number;
  setDropoutRate: (value: number) => void;
  demandMultiplier: number;
  setDemandMultiplier: (value: number) => void;
  targetArea: string;
  setTargetArea: (value: string) => void;
  areas: string[];
  onRun: () => void;
  isPending: boolean;
  simulation: SimulationResponse | null;
}) {
  const simulationDelta = props.simulation
    ? Math.round((props.simulation.simulated.metrics.coverage_rate - props.simulation.baseline.metrics.coverage_rate) * 100)
    : 0;
  const pendingCritical = props.simulation?.simulated.metrics.pending_critical_tasks ?? 0;
  const shortageDetected =
    props.simulation?.simulated.metrics.coverage_rate !== undefined
      ? props.simulation.simulated.metrics.coverage_rate < props.simulation.baseline.metrics.coverage_rate
      : false;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">What-If Simulator</span>
          <h2>What-if Scenario Simulator</h2>
        </div>
        <ShieldAlert size={18} />
      </div>

      <div className="simulation-card">
        <div className="scenario-tabs">
          <button
            className={props.scenario === "volunteer_dropout" ? "scenario-tab active" : "scenario-tab"}
            onClick={() => props.setScenario("volunteer_dropout")}
          >
            <Users size={15} />
            Volunteer Availability Drop
          </button>
          <button
            className={props.scenario === "demand_spike" ? "scenario-tab active" : "scenario-tab"}
            onClick={() => props.setScenario("demand_spike")}
          >
            <Waves size={15} />
            Demand spike
          </button>
        </div>

        {props.scenario === "volunteer_dropout" ? (
          <div className="sim-controls">
            <label>
              Dropout rate
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.1"
                value={props.dropoutRate}
                onChange={(event) => props.setDropoutRate(Number(event.target.value))}
              />
            </label>
            <div className="sim-control-value">{Math.round(props.dropoutRate * 100)}% volunteers unavailable</div>
          </div>
        ) : (
          <div className="sim-controls">
            <label>
              Target area
              <select value={props.targetArea} onChange={(event) => props.setTargetArea(event.target.value)}>
                {props.areas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Demand multiplier
              <input
                type="range"
                min="1.5"
                max="3"
                step="0.5"
                value={props.demandMultiplier}
                onChange={(event) => props.setDemandMultiplier(Number(event.target.value))}
              />
            </label>
            <div className="sim-control-value">{props.demandMultiplier.toFixed(1)}x demand surge</div>
          </div>
        )}

        <button className="primary-button" onClick={props.onRun}>
          {props.isPending ? "Simulating impact..." : "Simulate Impact"}
        </button>

        {props.simulation ? (
          <div className="simulation-results">
            <strong>Impact:</strong>
            <p>
              • Coverage {simulationDelta <= 0 ? "decreased" : "increased"} by {Math.abs(simulationDelta)}%
              <br />
              • {pendingCritical} critical tasks now pending
              <br />
              • {shortageDetected ? "Resource shortage detected" : "Resources remain stable"}
            </p>
            <div className="simulation-metrics">
              <div className="simulation-metric">
                <span>Coverage impact</span>
                <strong>{simulationDelta > 0 ? "+" : ""}{simulationDelta}%</strong>
              </div>
              <div className="simulation-metric">
                <span>Tasks in scenario</span>
                <strong>{props.simulation.simulated_tasks.length}</strong>
              </div>
              <div className="simulation-metric">
                <span>Available responders</span>
                <strong>{props.simulation.simulated_volunteers.filter((volunteer) => volunteer.status !== "offline").length}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
