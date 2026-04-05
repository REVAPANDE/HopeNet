export function priorityBadge(priorityScore: number) {
  if (priorityScore >= 85) return "High Priority";
  if (priorityScore >= 70) return "Elevated";
  return "Monitored";
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function priorityLabel(priorityScore: number) {
  if (priorityScore >= 85) return "Critical";
  if (priorityScore >= 70) return "High";
  if (priorityScore >= 50) return "Moderate";
  return "Low";
}

export function triggerLabel(triggerReason: string | null) {
  switch (triggerReason) {
    case "PRIORITY_UPDATE":
      return "Priority recalculation";
    case "NEW_TASK":
      return "New task received";
    case "VOLUNTEER_DROPOUT":
      return "Volunteer dropout";
    case "VOLUNTEER_MOVEMENT":
      return "Volunteer movement";
    case "SIMULATION_RUN":
      return "Scenario simulation";
    case "LIVE_SYNC":
      return "Live refresh";
    case "INITIAL_LOAD":
      return "System startup";
    default:
      return null;
  }
}
