import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllocationState, getPriorityConfig, recomputeAllocation, updatePriorityConfig } from "./allocationAPI";
import { getTasks } from "../tasks/tasksAPI";
import { getVolunteers } from "../volunteers/volunteersAPI";
import { DASHBOARD_QUERY_KEY, EVENTS_QUERY_KEY } from "../system/systemEvents";
import { getSystemEvents } from "../system/systemAPI";
import { setAllocationSlice } from "./allocationSlice";
import { useStore } from "../../store/useStore";
import { subscribeSystemEvents } from "../../services/websocket";
import type { PriorityWeights } from "../../types";

export function useDashboardData() {
  const isLive = useStore((state) => state.isLive);
  const triggerReason = useStore((state) => state.triggerReason);

  const query = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const [allocations, tasks, volunteers, priorityConfig] = await Promise.all([
        getAllocationState(),
        getTasks(),
        getVolunteers(),
        getPriorityConfig()
      ]);
      return { allocations, tasks, volunteers, priorityConfig };
    },
    refetchInterval: isLive ? 6000 : false,
    staleTime: 2000
  });

  const setPriorityConfig = useStore((state) => state.setPriorityConfig);

  useEffect(() => {
    if (!query.data) return;
    setAllocationSlice({
      allocations: query.data.allocations,
      tasks: query.data.tasks,
      volunteers: query.data.volunteers,
      triggerReason: triggerReason ?? "INITIAL_LOAD"
    });
    setPriorityConfig(query.data.priorityConfig);
  }, [query.data, triggerReason, setPriorityConfig]);

  return query;
}

export function useRecomputeAllocation() {
  const queryClient = useQueryClient();
  const setRecomputing = useStore((state) => state.setRecomputing);
  const clearSimulation = useStore((state) => state.clearSimulation);

  return useMutation({
    mutationFn: () => recomputeAllocation("manual"),
    onMutate: () => {
      clearSimulation();
      setRecomputing(true, "ASSIGNMENT_RECOMPUTED");
    },
    onSuccess: async (allocation) => {
      const state = useStore.getState();
      setAllocationSlice({
        allocations: allocation,
        tasks: state.tasks,
        volunteers: state.volunteers,
        triggerReason: "ASSIGNMENT_RECOMPUTED"
      });
      queryClient.setQueryData(DASHBOARD_QUERY_KEY, (current: any) =>
        current
          ? {
              ...current,
              allocations: allocation
            }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
    },
    onSettled: () => setRecomputing(false, "ASSIGNMENT_RECOMPUTED")
  });
}

export function useUpdatePriorityWeights() {
  const queryClient = useQueryClient();
  const setRecomputing = useStore((state) => state.setRecomputing);
  const setPriorityConfig = useStore((state) => state.setPriorityConfig);
  const clearSimulation = useStore((state) => state.clearSimulation);

  return useMutation({
    mutationFn: (weights: PriorityWeights) => updatePriorityConfig(weights),
    onMutate: () => {
      clearSimulation();
      setRecomputing(true, "PRIORITY_UPDATE");
    },
    onSuccess: async (result) => {
      const state = useStore.getState();
      setPriorityConfig(result.config);
      setAllocationSlice({
        allocations: result.allocation,
        tasks: state.tasks,
        volunteers: state.volunteers,
        triggerReason: "PRIORITY_UPDATE"
      });
      queryClient.setQueryData(DASHBOARD_QUERY_KEY, (current: any) =>
        current
          ? {
              ...current,
              allocations: result.allocation,
              priorityConfig: result.config
            }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
    },
    onSettled: () => setRecomputing(false, "PRIORITY_UPDATE")
  });
}

export function useLiveEventFeed() {
  const isLive = useStore((state) => state.isLive);
  const applyEventRecords = useStore((state) => state.applyEventRecords);
  const lastSeenRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: () => getSystemEvents(lastSeenRef.current),
    refetchInterval: isLive ? 4000 : false,
    staleTime: 1000
  });

  const events = useMemo(() => query.data?.events ?? [], [query.data]);

  useEffect(() => {
    if (!events.length) return;
    applyEventRecords(events);
    lastSeenRef.current = events[0].created_at;
    const shouldRefreshDashboard = events.some((event) =>
      ["ASSIGNMENT_RECOMPUTED", "PRIORITY_UPDATE", "NEW_TASK", "VOLUNTEER_DROPOUT", "VOLUNTEER_MOVEMENT"].includes(event.type)
    );
    if (shouldRefreshDashboard) {
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    }
  }, [applyEventRecords, events, queryClient]);

  useEffect(() => {
    if (!isLive) return;
    return subscribeSystemEvents(
      (event) => {
        applyEventRecords([event]);
        if (["ASSIGNMENT_RECOMPUTED", "PRIORITY_UPDATE", "NEW_TASK", "VOLUNTEER_DROPOUT", "VOLUNTEER_MOVEMENT"].includes(event.type)) {
          void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        }
      },
      () => {
        // Polling query remains active as a fallback if the stream disconnects.
      }
    );
  }, [applyEventRecords, isLive, queryClient]);

  return query;
}
