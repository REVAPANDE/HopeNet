import { useMutation } from "@tanstack/react-query";
import { getExplanation } from "./explainabilityAPI";

export function useExplanation() {
  return useMutation({
    mutationFn: ({ volunteerId, taskId }: { volunteerId: string; taskId: string }) =>
      getExplanation(volunteerId, taskId)
  });
}
