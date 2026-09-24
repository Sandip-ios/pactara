import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPartnerState } from "@/lib/partners.functions";

export function usePartnerState() {
  const fetchPartnerState = useServerFn(getPartnerState);
  return useQuery({
    queryKey: ["partner-state"],
    queryFn: () => fetchPartnerState(),
    staleTime: 30_000,
  });
}