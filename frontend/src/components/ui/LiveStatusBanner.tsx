import { formatDistanceToNowStrict } from "./time";
import { triggerLabel } from "../../utils/scoring";

export function LiveStatusBanner(props: {
  isLive: boolean;
  isRecomputing: boolean;
  isFetching: boolean;
  lastUpdated: number | null;
  triggerReason: string | null;
  onToggleLive: () => void;
}) {
  const readableTrigger = triggerLabel(props.triggerReason);
  const showBanner = props.isRecomputing || props.isFetching;

  if (!showBanner) {
    return null;
  }

  return (
    <section className="live-banner recompute-banner">
      <div className="live-summary">
        <strong>Recomputing allocation...</strong>
        <span>
          {props.lastUpdated
            ? `Last updated ${formatDistanceToNowStrict(props.lastUpdated)} ago`
            : "Waiting for first sync"}
          {readableTrigger ? ` | Trigger: ${readableTrigger}` : ""}
        </span>
      </div>
      <button className={props.isLive ? "mode-chip active" : "mode-chip"} onClick={props.onToggleLive}>
        {props.isLive ? "Pause live sync" : "Resume live sync"}
      </button>
    </section>
  );
}
