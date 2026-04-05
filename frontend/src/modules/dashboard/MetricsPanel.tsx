import type { AllocationResponse } from "../../types";

export function MetricsPanel({ allocation }: { allocation: AllocationResponse }) {
  return (
    <section className="metrics-strip">
      <span>
        <strong>{Math.round(allocation.metrics.coverage_rate * 100)}%</strong>
        Tasks Covered
      </span>
      <span>
        <strong>{allocation.metrics.avg_distance_km} km</strong>
        Avg Distance
      </span>
      <span>
        <strong>{allocation.metrics.fairness_index.toFixed(2)}</strong>
        Workload Balance
      </span>
      <span>
        <strong>{allocation.metrics.pending_critical_tasks}</strong>
        Critical Pending
      </span>
    </section>
  );
}
