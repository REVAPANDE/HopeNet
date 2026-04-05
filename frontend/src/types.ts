export type Coordinates = {
  lat: number;
  lng: number;
};

export type VolunteerStatus = "available" | "busy" | "offline";

export type Volunteer = {
  id: string;
  name: string;
  skills: string[];
  location: Coordinates;
  capacity: number;
  assigned_count: number;
  reliability: number;
  status: VolunteerStatus;
};

export type Task = {
  id: string;
  title: string;
  type: string;
  location: Coordinates;
  severity: number;
  people_affected: number;
  required_skills: string[];
  deadline_minutes: number;
  status: string;
  area: string;
  priority_score: number;
};

export type Assignment = {
  volunteer_id: string;
  task_id: string;
  score: number;
  explanation: string;
  created_at: string;
};

export type AssignmentReason = {
  volunteer_id: string;
  task_id: string;
  skill_match: number;
  distance_km: number;
  priority_score: number;
  availability_score: number;
  fairness_penalty: number;
  distance_component: number;
  priority_component: number;
  skill_component: number;
  availability_component: number;
  workload_component: number;
  final_score: number;
  confidence: number;
};

export type AllocationMetrics = {
  coverage_rate: number;
  avg_distance_km: number;
  fairness_index: number;
  pending_critical_tasks: number;
  volunteer_utilization: number;
};

export type AllocationResponse = {
  assignments: Assignment[];
  reasons: AssignmentReason[];
  metrics: AllocationMetrics;
  unassigned_tasks: string[];
  summary: string;
};

export type SimulationScenario = "volunteer_dropout" | "demand_spike";

export type SimulationResponse = {
  baseline: AllocationResponse;
  simulated: AllocationResponse;
  impact_summary: string;
  simulated_tasks: Task[];
  simulated_volunteers: Volunteer[];
};

export type SystemEventType =
  | "NEW_TASK"
  | "VOLUNTEER_DROPOUT"
  | "VOLUNTEER_MOVEMENT"
  | "PRIORITY_UPDATE"
  | "SIMULATION_RUN"
  | "ASSIGNMENT_RECOMPUTED";

export type SystemEvent = {
  type: SystemEventType;
  createdAt: number;
  payload?: Record<string, unknown>;
};

export type SystemEventRecord = {
  id: string;
  type: SystemEventType;
  message: string;
  created_at: string;
  metadata: Record<string, string | number | boolean>;
};

export type PriorityWeights = {
  skill_match: number;
  distance: number;
  priority: number;
  availability: number;
  workload_penalty: number;
};

export type PriorityConfig = {
  id: string;
  weights: PriorityWeights;
  updated_at: string;
};

export type AlternativeVolunteer = {
  volunteer_id: string;
  volunteer_name: string;
  final_score: number;
  reason_not_selected: string;
  distance_km: number;
  skill_match: number;
  workload_penalty: number;
};

export type AssignmentExplanationDetail = {
  volunteer_id: string;
  task_id: string;
  score: number;
  confidence: number;
  reasoning: string[];
  alternatives: AlternativeVolunteer[];
  narrative: string;
};

export type ExplainabilityResponse = {
  explanation: string;
  detail: AssignmentExplanationDetail;
};

export type AllocationBundle = {
  allocations: AllocationResponse;
  tasks: Task[];
  volunteers: Volunteer[];
};
