import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { getGroupsToday } from "@/lib/group-today.functions";
import { getUnreadChatCounts } from "@/lib/chat.functions";
import { crewPageCounts } from "@/lib/group-today-view";
import { inTodayLine } from "@/lib/your-crews";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";
import { CrewAvatarOverlap } from "./CrewAvatars";
import { useOpenAtTop } from "@/lib/use-open-at-top";

const BG = "#F5F2EE";
const INK = "#1C1917";
const MUTED = "#57534E";
const PURPLE = "#7C3AED";

export function NewCrewsScreen() {
  const navigate = useNavigate();
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  const { data, isLoading } = useQuery({
    queryKey: ["groups-today"],
    queryFn: () => getGroupsToday(),
    staleTime: 30_000,
  });
  const { data: unread } = useQuery({
    queryKey: ["unread-chat-counts"],
    queryFn: () => getUnreadChatCounts(),
    staleTime: 15_000,
  });
  const { data: partnerState } = usePartnerState();
  const groups = data?.groups ?? [];
  const startCrew = () => navigate({ to: "/new-pactara" });

  return (
    <div ref={scrollRef} data-scroll-root className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: INK }}>
      <header className="flex items-center justify-between bg-white px-4 pb-4 pt-new-top">
        <h1 className="flex h-11 items-center text-[26px] font-extrabold">Crews</h1>
        <button
          type="button"
          onClick={startCrew}
          className="flex h-9 items-center gap-1 rounded-full px-3.5 text-[15px] font-bold"
          style={{ background: "#EDE4FF", color: "#6D28D9" }}
        >
          <Plus size={17} strokeWidth={2.5} aria-hidden />
          New crew
        </button>
      </header>

      <div className="text-[13px] font-extrabold" style={{ color: MUTED, letterSpacing: "0.6px", padding: "18px 16px 8px" }}>YOUR CREWS</div>

      {isLoading && !data ? (
        <div className="mx-4 h-[92px] animate-pulse rounded-[20px] bg-white" aria-label="Loading crews" />
      ) : groups.length ? (
        <div>
          {groups.map((group) => {
            const counts = crewPageCounts(group.members);
            const unreadCount = unread?.counts[group.id] ?? 0;
            const relation = relationForGroup(group.id, partnerState);
            const name = relation?.name ?? group.name;
            const members = group.members.map((member) => ({
              id: member.userId,
              name: member.name,
              avatarUrl: member.avatarUrl,
              avatarColor: member.avatarColor,
            }));
            return (
              <button
                type="button"
                key={group.id}
                onClick={() => navigate({ to: "/crews/$groupId", params: { groupId: group.id } })}
                className="flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left"
                style={{ borderRadius: 20, margin: "0 16px 10px", width: "calc(100% - 32px)" }}
                aria-label={`Open ${name}`}
              >
                <CrewAvatarOverlap members={members} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-extrabold">{name}</span>
                  <span className="mt-0.5 block text-[13px] leading-[1.35]" style={{ color: MUTED }}>
                    {inTodayLine(counts)} · {group.groupStreak > 0 ? `${group.groupStreak}-day crew streak` : "Crew streak starts today"}
                  </span>
                </span>
                {unreadCount > 0 && (
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: PURPLE }} aria-label={`${unreadCount} unread chat messages`}>
                    {unreadCount}
                  </span>
                )}
                <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} aria-hidden />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mx-4 rounded-[20px] bg-white p-5">
          <h2 className="text-[17px] font-bold">You're not in a crew yet</h2>
          <p className="mt-1.5 text-[14px] leading-[1.45]" style={{ color: MUTED }}>Start one with friends or join with an invite link.</p>
          <button type="button" onClick={startCrew} className="mt-5 h-12 w-full rounded-full text-[16px] font-bold text-white" style={{ background: PURPLE }}>Start a crew</button>
        </div>
      )}

      {groups.length > 0 && <p className="px-5 text-[13px] leading-[1.45]" style={{ color: MUTED }}>The number is new chat messages. You can be in up to 3 crews.</p>}
    </div>
  );
}
