import { useQuery } from "@tanstack/react-query";
import { getGroupsToday } from "@/lib/group-today.functions";
import { atCrewLimit } from "@/lib/crew-limit";

/** Reads the same crew list as the Crews tab, so the limit matches the cards shown. */
export function useCrewLimit() {
  const { data } = useQuery({ queryKey: ["groups-today"], queryFn: () => getGroupsToday(), staleTime: 30_000 });
  return Boolean(data && atCrewLimit(data.groups.length));
}
