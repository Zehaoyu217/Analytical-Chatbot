import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchModels, setActiveModel } from "@/lib/api";

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: fetchModels,
  });
}

export function useSetActiveModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, model }: { provider: string; model: string }) =>
      setActiveModel(provider, model),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });
}
