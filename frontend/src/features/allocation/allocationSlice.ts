import type { AllocationResponse, Task, Volunteer } from "../../types";
import { useStore, type TriggerReason } from "../../store/useStore";

export function setAllocationSlice(payload: {
  allocations: AllocationResponse;
  tasks: Task[];
  volunteers: Volunteer[];
  triggerReason: TriggerReason;
}) {
  useStore.getState().setDashboardData(payload);
}
