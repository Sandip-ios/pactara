import { queryOptions } from "@tanstack/react-query";
import { getPactStatus } from "@/lib/pact-cycle.functions";

export const pactStatusOptions = (groupId: string) =>
  queryOptions({ queryKey: ["pact-status", groupId], queryFn: () => getPactStatus({ data: { groupId } }), staleTime: 30_000 });
