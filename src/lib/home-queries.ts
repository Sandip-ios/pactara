import { listMyGroups } from "@/lib/groups.functions";
import { getHomeCrew } from "@/lib/home-crew.functions";
import { stabilizeSignedUrls } from "@/lib/stable-urls";

/** Shared by Home and the launch prefetch, so both hit the same cache entries. */
export const myGroupsQuery = () => ({
  queryKey: ["my-groups"] as const,
  queryFn: () => listMyGroups(),
  staleTime: 60_000,
});

export const homeCrewQuery = (groupId: string | null) => ({
  queryKey: ["home-crew", groupId] as const,
  queryFn: () => getHomeCrew({ data: { groupId } }).then(stabilizeSignedUrls),
  staleTime: 30_000,
});
