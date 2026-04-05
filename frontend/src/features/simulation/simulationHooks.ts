import { useMutation, useQueryClient } from "@tanstack/react-query";
import { runSimulation } from "./simulationAPI";
import { useStore } from "../../store/useStore";
import { DASHBOARD_QUERY_KEY, EVENTS_QUERY_KEY } from "../system/systemEvents";

export function useSimulation() {
  const queryClient = useQueryClient();
  const setSimulation = useStore((state) => state.setSimulation);
  const setRecomputing = useStore((state) => state.setRecomputing);

  return useMutation({
    mutationFn: runSimulation,
    onMutate: () => {
      setRecomputing(true, "SIMULATION_RUN");
    },
    onSuccess: async (simulation) => {
      setSimulation(simulation);
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
    },
    onSettled: () => {
      setRecomputing(false, "SIMULATION_RUN");
    }
  });
}
