import { AnimatePresence, motion } from "framer-motion";
import type { AssignmentExplanationDetail } from "../../types";

function toReasoningPoints(explanation: string) {
  return explanation
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((item) => item.trim().replace(/[.]+$/, ""))
    .filter(Boolean)
    .slice(0, 4);
}

export function ExplainabilityPanel(props: {
  explanation: string;
  detail: AssignmentExplanationDetail | null;
  isPending: boolean;
  onRegenerate: () => void;
}) {
  const fallbackPoints = [
    "Closest volunteer (11.5 km)",
    "Skill match: Medical",
    "High urgency",
    "Balanced workload"
  ];

  const reasoningPoints =
    props.detail?.reasoning?.length
      ? props.detail.reasoning
      : props.explanation
        ? toReasoningPoints(props.explanation)
        : fallbackPoints;

  return (
    <section className="panel reasoning-panel">
      <div className="section-header">
        <span>Decision Reasoning</span>
      </div>
      <AnimatePresence mode="wait">
        {props.isPending ? (
          <motion.div
            key="loading"
            className="reasoning-state reasoning-loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            <div className="reasoning-loading-header">
              <span className="mini-spinner" />
              <strong>Generating reasoning...</strong>
            </div>
            <div className="reasoning-skeleton-list">
              <span />
              <span />
              <span />
              <span />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className="reasoning-state"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            {props.detail ? (
              <div className="reasoning-scorecard">
                <span>{`Score ${props.detail.score.toFixed(2)}`}</span>
                <span>{`Confidence ${(props.detail.confidence * 100).toFixed(0)}%`}</span>
              </div>
            ) : null}

            <div className="reasoning-list">
              {reasoningPoints.map((item, index) => (
                <p key={`${index}-${item}`}>- {item}</p>
              ))}
            </div>

            {props.detail?.alternatives?.length ? (
              <div className="alternatives-panel">
                <strong>Why not others?</strong>
                {props.detail.alternatives.map((alternative) => (
                  <div key={alternative.volunteer_id} className="alternative-item">
                    <span>{alternative.volunteer_name}</span>
                    <p>{alternative.reason_not_selected}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
      <button className="feed-link reasoning-action" onClick={props.onRegenerate}>
        {props.isPending ? "Generating..." : "Re-explain"}
      </button>
    </section>
  );
}
