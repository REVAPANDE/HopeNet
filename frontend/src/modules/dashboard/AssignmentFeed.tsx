import { AnimatePresence, motion } from "framer-motion";
import { priorityLabel } from "../../utils/scoring";
import type { AllocationResponse, Task, Volunteer } from "../../types";

function indicatorTone(priority: string) {
  if (priority === "Critical") return "critical";
  if (priority === "High") return "high";
  if (priority === "Moderate") return "moderate";
  return "normal";
}

export function AssignmentFeed(props: {
  allocation: AllocationResponse;
  tasks: Task[];
  volunteers: Volunteer[];
  lastUpdated: number | null;
  triggerReason: string | null;
  onExplain: (volunteerId: string, taskId: string) => void;
}) {
  const taskMap = new Map(props.tasks.map((task) => [task.id, task]));
  const volunteerMap = new Map(props.volunteers.map((volunteer) => [volunteer.id, volunteer]));
  const isFreshUpdate =
    props.lastUpdated !== null &&
    Date.now() - props.lastUpdated < 8000 &&
    ["ASSIGNMENT_RECOMPUTED", "PRIORITY_UPDATE", "NEW_TASK", "VOLUNTEER_DROPOUT"].includes(props.triggerReason ?? "");

  return (
    <section className="panel feed-panel">
      <div className="section-header">
        <span>Assignment Feed</span>
      </div>
      <div className="feed-list">
        <AnimatePresence initial={false}>
          {props.allocation.assignments.map((assignment) => {
            const task = taskMap.get(assignment.task_id);
            const volunteer = volunteerMap.get(assignment.volunteer_id);
            const reason = props.allocation.reasons.find(
              (entry) => entry.task_id === assignment.task_id && entry.volunteer_id === assignment.volunteer_id
            );
            const priorityText = priorityLabel(reason?.priority_score ?? 0);
            const confidence = Math.round((reason?.confidence ?? 0) * 100);

            return (
              <motion.article
                key={`${assignment.volunteer_id}-${assignment.task_id}`}
                className={`feed-item ${indicatorTone(priorityText)} ${isFreshUpdate ? "fresh-update" : ""}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: "easeInOut" }}
                layout
              >
                <div className="feed-indicator" />
                <div className="feed-content">
                  <strong>{`${task?.title ?? "Task"} - ${task?.area ?? "Zone"}`}</strong>
                  <span>{volunteer?.name ?? "Volunteer"}</span>
                  <p>{`Score ${(reason?.final_score ?? assignment.score).toFixed(2)} | ${(reason?.distance_km ?? 0).toFixed(1)} km | ${priorityText}`}</p>
                  <small>{`Skill ${Math.round((reason?.skill_match ?? 0) * 100)}% | Confidence ${confidence}% | Workload penalty ${(reason?.fairness_penalty ?? 0).toFixed(2)}`}</small>
                </div>
                <button
                  className="feed-link"
                  onClick={() => props.onExplain(assignment.volunteer_id, assignment.task_id)}
                >
                  View reasoning {"->"}
                </button>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
