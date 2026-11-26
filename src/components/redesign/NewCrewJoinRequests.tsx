import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { decideCrewJoinRequest, getCrewJoinRequests } from "@/lib/crew-join.functions";
import { requestAge } from "@/lib/crew-join";
import { Button } from "@/components/ui/button";
import { CrewAvatar, type RedesignCrewAvatarMember } from "./CrewAvatars";
import { stabilizeSignedUrls } from "@/lib/stable-urls";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

export const crewJoinRequestsOptions = (groupId: string) => queryOptions({
  queryKey: ["crew-join-requests", groupId],
  queryFn: async () => stabilizeSignedUrls(await getCrewJoinRequests({ data: { groupId } })),
});

export function NewCrewJoinRequests({ groupId }: { groupId: string }) {
  useHideBottomTabs(true, false);
  const navigate = useNavigate();
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  useStatusBarScrollToTop();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(crewJoinRequestsOptions(groupId));
  const decide = useServerFn(decideCrewJoinRequest);
  const [busy, setBusy] = useState<string | null>(null);

  const full = data.memberCount >= data.limit;
  const spotsLeft = Math.max(0, data.limit - data.memberCount);

  const act = async (requestId: string, decision: "approved" | "declined") => {
    setBusy(requestId);
    try {
      await decide({ data: { requestId, decision } });
      toast.success(decision === "approved" ? "They're in." : "Request declined.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crew-join-requests", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["crew-join-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["find-crews"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update this request. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="redesign-step3 fixed inset-0 bg-[var(--new-bg)] text-[var(--new-ink)]">
      <div ref={scrollRef} data-scroll-root className="h-full overflow-y-auto pb-[calc(100px+env(safe-area-inset-bottom))]">
        <header className="grid grid-cols-[44px_1fr_44px] items-center bg-[var(--new-white)] px-4 pb-4 pt-new-top">
          <Button variant="ghost" size="icon" aria-label="Back" className="h-11 w-11 rounded-full bg-[var(--new-control)]" onClick={() => navigate({ to: "/crews/$groupId", params: { groupId } })}>
            <ChevronLeft className="!size-[22px]" />
          </Button>
          <h1 className="text-center text-[17px] font-bold">Join requests</h1>
        </header>

        {full ? (
          <div className="mx-4 mt-3 rounded-[16px] bg-[var(--new-warning-soft)] px-4 py-3 text-[14px] leading-[1.45] text-[var(--new-warning-ink)]">
            <strong className="font-bold">{data.name} is full ({data.memberCount} of {data.limit}).</strong> To approve someone, a spot has to open first. Requests wait here for 14 days.
          </div>
        ) : (
          <div className="bg-[var(--new-control)] px-4 py-3 text-[14px] leading-[1.45] text-[var(--new-muted)]">
            You run {data.name}, so you decide who joins. {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left.
          </div>
        )}

        {data.requests.length ? (
          <section className="mt-3 bg-[var(--new-white)] px-4">
            {data.requests.map((request) => {
              const member: RedesignCrewAvatarMember = { id: request.id, name: request.name, avatarUrl: request.avatarUrl, avatarColor: "" };
              return (
                <div key={request.id} className="flex items-center gap-3 border-b border-[var(--new-control)] py-3 last:border-b-0">
                  <CrewAvatar member={member} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold text-[var(--new-ink)]">{request.name}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--new-muted)]">
                      {request.streak > 0 ? `${request.streak}-day streak` : "New streak"} · asked {requestAge(request.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      disabled={full || busy === request.id}
                      onClick={() => void act(request.id, "approved")}
                      className="h-9 rounded-[12px] bg-[var(--new-purple)] px-3 text-[14px] font-bold text-[var(--new-white)] hover:bg-[var(--new-purple)] hover:text-[var(--new-white)] disabled:bg-[var(--new-control)] disabled:text-[var(--new-chevron)] disabled:opacity-100"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy === request.id}
                      onClick={() => void act(request.id, "declined")}
                      className="h-9 rounded-[12px] bg-[var(--new-control)] px-3 text-[14px] font-bold text-[var(--new-ink)] disabled:opacity-50"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <div className="mt-3 bg-[var(--new-white)] p-5">
            <p className="text-[15px] font-bold text-[var(--new-ink)]">No requests right now.</p>
            <p className="mt-1 text-[14px] leading-[1.45] text-[var(--new-muted)]">When someone asks to join, they show up here.</p>
          </div>
        )}

        <p className="px-5 pt-3 text-[13px] leading-[1.45] text-[var(--new-muted)]">Declining doesn't tell them who said no.</p>
      </div>
    </div>
  );
}
