import { Activity, BellRing, Radar } from "lucide-react";
import { triggerLabel } from "../../utils/scoring";
import type { SystemEventRecord } from "../../types";

export function SystemStatusPanel(props: {
  triggerReason: string | null;
  eventCount: number;
  latestEvent: SystemEventRecord | null;
  isRecomputing: boolean;
}) {
  const readableTrigger = triggerLabel(props.triggerReason);

  return (
    <section className="panel system-status-panel">
      <div className="section-header">
        <span>System Intelligence</span>
      </div>
      <div className="status-grid">
        <div className="status-tile">
          <span className="status-icon">
            <Activity size={14} />
          </span>
          <div>
            <strong>{props.isRecomputing ? "Reallocation running" : "Live allocation stable"}</strong>
            <p>{props.isRecomputing ? "Scoring responders against the latest field state" : "Assignments are synced to the latest backend state"}</p>
          </div>
        </div>
        <div className="status-tile">
          <span className="status-icon warm">
            <BellRing size={14} />
          </span>
          <div>
            <strong>{readableTrigger ? `Trigger: ${readableTrigger}` : "Trigger: Initial load"}</strong>
            <p>{props.eventCount} recent system events are available for live refresh</p>
          </div>
        </div>
        <div className="status-tile">
          <span className="status-icon neutral">
            <Radar size={14} />
          </span>
          <div>
            <strong>{props.latestEvent?.message ?? "Waiting for first operational event"}</strong>
            <p>{props.latestEvent ? `Latest event type: ${triggerLabel(props.latestEvent.type)}` : "New tasks, dropouts, and simulations will appear here"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
