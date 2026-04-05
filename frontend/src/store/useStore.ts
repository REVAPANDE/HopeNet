import { create } from "zustand";
import type {
  AllocationResponse,
  PriorityConfig,
  SimulationResponse,
  SystemEventRecord,
  SystemEventType,
  Task,
  Volunteer
} from "../types";

export type TriggerReason = SystemEventType | "LIVE_SYNC" | "INITIAL_LOAD" | null;

type HopeNetState = {
  allocations: AllocationResponse | null;
  tasks: Task[];
  volunteers: Volunteer[];
  simulation: SimulationResponse | null;
  events: SystemEventRecord[];
  priorityConfig: PriorityConfig | null;
  isLive: boolean;
  isRecomputing: boolean;
  lastUpdated: number | null;
  triggerReason: TriggerReason;
  setDashboardData: (payload: {
    allocations: AllocationResponse;
    tasks: Task[];
    volunteers: Volunteer[];
    triggerReason: TriggerReason;
    updatedAt?: number | null;
  }) => void;
  setSimulation: (payload: SimulationResponse) => void;
  clearSimulation: () => void;
  setLive: (value: boolean) => void;
  setRecomputing: (value: boolean, reason?: TriggerReason) => void;
  setPriorityConfig: (config: PriorityConfig) => void;
  setEvents: (events: SystemEventRecord[]) => void;
  applyEventRecords: (events: SystemEventRecord[]) => void;
};

export const useStore = create<HopeNetState>((set, get) => ({
  allocations: null,
  tasks: [],
  volunteers: [],
  simulation: null,
  events: [],
  priorityConfig: null,
  isLive: true,
  isRecomputing: false,
  lastUpdated: null,
  triggerReason: null,
  setDashboardData: ({ allocations, tasks, volunteers, triggerReason, updatedAt }) =>
    set({
      allocations,
      tasks,
      volunteers,
      triggerReason,
      lastUpdated: updatedAt ?? Date.now(),
      isRecomputing: false
    }),
  setSimulation: (simulation) =>
    set({
      simulation,
      triggerReason: "SIMULATION_RUN",
      lastUpdated: Date.now(),
      isRecomputing: false
    }),
  clearSimulation: () => set({ simulation: null }),
  setLive: (value) => set({ isLive: value }),
  setRecomputing: (value, reason) => set({ isRecomputing: value, triggerReason: reason ?? null }),
  setPriorityConfig: (priorityConfig) => set({ priorityConfig }),
  setEvents: (events) => set({ events }),
  applyEventRecords: (events) => {
    if (!events.length) return;
    const existing = get().events;
    const mergedMap = new Map(existing.map((event) => [event.id, event]));
    events.forEach((event) => mergedMap.set(event.id, event));
    const merged = Array.from(mergedMap.values()).sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
    const latest = merged[0];
    set({
      events: merged.slice(0, 20),
      triggerReason: latest?.type ?? get().triggerReason,
      lastUpdated: latest ? new Date(latest.created_at).getTime() : get().lastUpdated
    });
  }
}));
