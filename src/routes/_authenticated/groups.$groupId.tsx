import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { getGroupsToday, type GroupToday, type MemberToday } from "@/lib/group-today.functions";
import { getGroupFeed } from "@/lib/daily-posts.functions";
import { splitFeedIntoTimelineCards } from "@/lib/feed-cards";
import { TimelineCard } from "@/components/TimelineCard";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { GroupOverflowMenu } from "@/components/groups/GroupOverflowMenu";
import {
  BG,
  GroupStreakChip,
  MemberAvatar,
  MemberStreakChip,
  NudgeButton,
  PURPLE,
  PURPLE_DEEP,
  formatTime,
  statusLabel,
} from "@/components/groups/AccountabilityBits";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"today" | "activity">("today");

  const { data, isLoading } = useQuery({
    queryKey: ["groups-today"],
    queryFn: () => getGroupsToday(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const group = data?.groups.find((g) => g.id === groupId);

  if (isLoading || !data) {
    return <div className="fixed inset-0 w-full overflow-hidden" style={{ background: BG }} />;
  }

  if (!group) {
    return (
      <div className="fixed inset-0 w-full overflow-y-auto pb-28" style={{ background: BG }}>
        <DetailHeader title="Group" onBack={() => navigate({ to: "/groups" })} />
        <div className="mx-4 mt-6 rounded-3xl bg-white p-8 text-center">
          <div className="text-[16px] font-bold">This group is no longer available</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: "#0A0A0A" }}
    >
      <div
        className="pt-safe-4 pb-5 px-4"
        style={{ background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ to: "/groups" })}
            aria-label="Back to groups"
            className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center text-white"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1" />
          <GroupOverflowMenu
            groupId={group.id}
            groupName={group.name}
            emoji={group.emoji}
            isAdmin={group.isAdmin}
            duration={group.durationDays}
            frequency={group.frequency}
            daysPerWeek={group.daysPerWeek}
            onDeleted={() => navigate({ to: "/groups" })}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[30px] leading-none">{group.emoji}</span>
          <div className="min-w-0">
            <div className="text-white text-[24px] font-black tracking-tight leading-tight truncate">
              {group.name}
            </div>
            <div className="text-white/75 text-[13px] mt-0.5 truncate">
              {group.goal ? `${group.goal} · ` : ""}Day {group.dayNumber} of {group.durationDays}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        <div className="rounded-full bg-white p-1 grid grid-cols-2 shadow-sm">
          {(["today", "activity"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="rounded-full py-2.5 text-[14px] font-bold capitalize"
              style={
                tab === t
                  ? { background: PURPLE, color: "#FFFFFF" }
                  : { background: "transparent", color: "#8A8580" }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0];
              return k === "groups-today" || k === "group-feed" || k === "my-groups";
            },
          })
        }
      >
        {tab === "today" ? <TodayTab group={group} /> : <ActivityTab groupId={group.id} />}
      </PullToRefresh>
    </div>
  );
}

function DetailHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="bg-white px-4 pt-safe-5 pb-4 flex items-center gap-2">
      <button onClick={onBack} aria-label="Back" className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center">
        <ChevronLeft size={22} />
      </button>
      <div className="text-[18px] font-bold">{title}</div>
    </header>
  );
}

function TodayTab({ group }: { group: GroupToday }) {
  const allDone = group.memberCount > 0 && group.doneCount === group.memberCount;
  const waiting = group.members.filter((m) => m.status !== "done");
  const [confetti, setConfetti] = useState(false);

  // Celebrate once per group per day when the final member checks in.
  useEffect(() => {
    if (!allDone) return;
    const key = `group-celebrated:${group.id}:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable — still celebrate
    }
    setConfetti(true);
  }, [allDone, group.id]);

  return (
    <div className="pt-4">
      {confetti && <ConfettiBurst onDone={() => setConfetti(false)} />}

      {allDone ? (
        <div
          className="mx-4 rounded-3xl px-6 py-7 text-center text-white"
          style={{
            background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
            boxShadow: "0 20px 40px -22px rgba(124, 58, 237, 0.7)",
          }}
        >
          <div className="text-[34px] leading-none">🎉</div>
          <div className="mt-3 text-[13px] font-bold tracking-[0.16em] uppercase text-white/80">
            {group.name} showed up
          </div>
          <div className="mt-1.5 text-[26px] font-black tracking-tight">
            {group.doneCount} of {group.memberCount} completed today
          </div>
          <div className="mt-1.5 text-[14px] text-white/80">Everyone kept their commitment.</div>
          {group.groupStreak > 0 && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3.5 py-1.5 text-[13px] font-bold">
              🔥 {group.groupStreak} day group streak
            </div>
          )}
          <div className="mt-3 text-[13px] text-white/70">Keep it going tomorrow.</div>
        </div>
      ) : (
        <div className="mx-4 rounded-3xl bg-white px-5 py-5 shadow-sm">
          <div className="text-[28px] font-black tracking-tight leading-none">
            {group.doneCount} of {group.memberCount} showed up
          </div>
          <div className="text-[14px] text-neutral-500 mt-2">
            {waiting.length === 1 ? "One person left 👀" : `${waiting.length} people still to go`}
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <GroupStreakChip streak={group.groupStreak} />
            {group.groupStreak === 0 && (
              <span className="text-[13px] text-neutral-400">
                When everyone shows up, the group streak starts.
              </span>
            )}
          </div>
          {group.groupStreak > 0 && (
            <div className="text-[13px] text-neutral-500 mt-2">
              Everyone has shown up together for {group.groupStreak} {group.groupStreak === 1 ? "day" : "days"}.
            </div>
          )}
        </div>
      )}

      <div className="px-6 mt-6 mb-2 text-[12px] font-bold tracking-[0.14em] text-neutral-400">
        WHERE EVERYONE STANDS
      </div>

      <div className="mx-4 rounded-3xl bg-white shadow-sm divide-y divide-neutral-100 overflow-hidden">
        {group.members.map((m) => (
          <MemberStatusRow key={m.userId} groupId={group.id} member={m} />
        ))}
      </div>
    </div>
  );
}

function MemberStatusRow({ groupId, member }: { groupId: string; member: MemberToday }) {
  const time = formatTime(member.committedAt);
  const canNudge = !member.isYou && (member.status === "not_committed" || member.status === "committed" || member.status === "in_progress");

  let secondary = statusLabel(member.status);
  if (member.status === "committed" && time) secondary = `Committed at ${time}`;

  return (
    <div className="px-4 py-3.5 flex items-center gap-3">
      <MemberAvatar member={member} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold truncate">{member.isYou ? "You" : member.name}</span>
          {member.status === "done" && <MemberStreakChip streak={member.streak} />}
        </div>
        <div
          className="text-[13px] mt-0.5 truncate"
          style={{
            color:
              member.status === "done"
                ? "#16A34A"
                : member.status === "committed"
                  ? "#D97706"
                  : "#8A8580",
          }}
        >
          {member.status === "done" ? "✓ Already checked in" : secondary}
        </div>
        {member.status === "committed" && (
          <div className="text-[12px] text-neutral-400 mt-0.5">⏳ Waiting to check in</div>
        )}
        {member.status === "missed" && (
          <div className="text-[12px] text-neutral-400 mt-0.5">Tomorrow is a fresh start.</div>
        )}
      </div>
      {canNudge && <NudgeButton groupId={groupId} member={member} variant="ghost" />}
    </div>
  );
}

function ActivityTab({ groupId }: { groupId: string }) {
  const { data } = useQuery({
    queryKey: ["group-feed", groupId],
    queryFn: () => getGroupFeed({ data: { groupId } }),
    staleTime: 30_000,
  });

  const cards = splitFeedIntoTimelineCards(data?.items ?? []).filter((c) =>
    c.nodes.some((n) => n.kind !== "pending"),
  );

  if (cards.length === 0) {
    return (
      <div className="mx-4 mt-6 rounded-3xl bg-white p-8 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-full bg-purple-50 flex items-center justify-center mb-3">
          <MessageSquare size={24} style={{ color: PURPLE }} />
        </div>
        <div className="text-[16px] font-bold">Nothing here yet</div>
        <div className="text-[13px] text-neutral-500 mt-1 max-w-[260px]">
          Commitments and check-ins from this group will show up here.
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3 pb-2">
      {cards.map((item) => (
        <TimelineCard key={`${item.id}-${item.localDate}`} item={item} />
      ))}
    </div>
  );
}
