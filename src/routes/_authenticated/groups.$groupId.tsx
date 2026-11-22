import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, MessageSquare, Moon } from "lucide-react";
import { crewPageCanNudge, crewPageCounts, crewPageStatus } from "@/lib/group-today-view";
import { getGroupsToday, type GroupToday, type MemberToday } from "@/lib/group-today.functions";
import { FeedList } from "@/components/feed/FeedList";
import { useGroupFeed } from "@/components/feed/use-group-feed";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { GroupOverflowMenu } from "@/components/groups/GroupOverflowMenu";
import {
  BG,
  GroupStreakChip,
  MemberAvatar,
  MemberStreakChip,
  NudgeButton,
  PURPLE,
  PURPLE_DEEP,
  elapsedLabel,
  formatTime,
  statusLabel,
} from "@/components/groups/AccountabilityBits";
import { WorkoutCheerSheet } from "@/components/groups/WorkoutCheerSheet";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupDetailPage,
});

function GroupDetailPage() {
  useStatusBarScrollToTop();
  const { groupId } = Route.useParams();
  // A "started working out" push deep links to ?workout=<sessionId>.
  const workout = useRouterState({
    select: (s) => (s.location.search as { workout?: string }).workout,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"today" | "activity">("today");
  const [cheerSessionId, setCheerSessionId] = useState<string | null>(null);

  // A "started working out" push deep links straight to that session.
  useEffect(() => {
    if (workout) setCheerSessionId(workout);
  }, [workout]);

  // Viewing a group makes it the active group, so a check-in started from here
  // posts to this group.
  useEffect(() => {
    if (groupId && typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", groupId);
    }
  }, [groupId]);

  const { data, isLoading } = useQuery({
    queryKey: ["groups-today"],
    queryFn: () => getGroupsToday(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const group = data?.groups.find((g) => g.id === groupId);
  const { data: partnerState } = usePartnerState();

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
  const relation = relationForGroup(group.id, partnerState);
  const displayName = relation?.name ?? group.name;
  const displayEmoji = relation?.emoji ?? group.emoji;

  return (
    <div
      data-scroll-root
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
             groupName={displayName}
             emoji={displayEmoji}
            isAdmin={group.isAdmin}
            duration={group.durationDays}
            frequency={group.frequency}
            daysPerWeek={group.daysPerWeek}
            onDeleted={() => navigate({ to: "/groups" })}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
           <span className="text-[30px] leading-none">{displayEmoji}</span>
          <div className="min-w-0">
            <div className="text-white text-[24px] font-black tracking-tight leading-tight truncate">
               {displayName}
            </div>
            <div className="text-white/75 text-[13px] mt-0.5 truncate">
              Day {group.dayNumber} of {group.durationDays}
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
        {tab === "today" ? (
           <TodayTab group={group} displayName={displayName} onCheer={setCheerSessionId} />
        ) : (
          <ActivityTab groupId={group.id} solo={relation?.kind === "solo" || group.memberCount <= 1} />
        )}
      </PullToRefresh>

      {cheerSessionId && (
        <WorkoutCheerSheet
          sessionId={cheerSessionId}
          onClose={() => {
            setCheerSessionId(null);
            if (workout) {
              navigate({ to: "/groups/$groupId", params: { groupId }, replace: true });
            }
          }}
        />
      )}
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

function TodayTab({ group, displayName, onCheer }: { group: GroupToday; displayName: string; onCheer: (sessionId: string) => void }) {
  // Members resting today aren't due, so they're left out of "{n} of {m}".
  const counts = crewPageCounts(group.members);
  const allDone = counts.due > 0 && counts.done === counts.due;
  const waiting = group.members.filter((m) => {
    const s = crewPageStatus(m);
    return s !== "done" && s !== "rest";
  });
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
             {displayName} showed up
          </div>
          <div className="mt-1.5 text-[26px] font-black tracking-tight">
            {counts.done} of {counts.due} completed today
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
            {counts.done} of {counts.due} showed up
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
          <MemberStatusRow key={m.userId} groupId={group.id} member={m} onCheer={onCheer} />
        ))}
      </div>
    </div>
  );
}

function MemberStatusRow({
  groupId,
  member,
  onCheer,
}: {
  groupId: string;
  member: MemberToday;
  onCheer: (sessionId: string) => void;
}) {
  const time = formatTime(member.committedAt);
  const status = crewPageStatus(member);
  const canNudge = crewPageCanNudge(status, member.isYou);
  const liveWorkout = status === "working_out" && member.workoutSessionId;

  let secondary = status === "rest" ? "Resting today" : statusLabel(status);
  if (status === "committed" && time) secondary = `Committed at ${time}`;

  return (
    <div className="px-4 py-3.5 flex items-center gap-3">
      <MemberProfileLink userId={member.userId} isYou={member.isYou}>
        <MemberAvatar member={member} size={44} />
      </MemberProfileLink>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold truncate">{member.isYou ? "You" : member.name}</span>
          {status === "done" && <MemberStreakChip streak={member.streak} />}
        </div>
        <div
          className="text-[13px] mt-0.5 truncate"
          style={{
            color:
              status === "done" || status === "working_out"
                ? "#16A34A"
                : status === "rest"
                  ? "#7C5CD6"
                  : status === "committed"
                    ? "#D97706"
                    : "#8A8580",
          }}
        >
          {status === "done" ? (
            "✓ Already checked in"
          ) : status === "rest" ? (
            <span className="inline-flex items-center gap-1 font-semibold">
              <Moon size={13} style={{ color: "#A78BFA" }} aria-hidden />
              Resting today
            </span>
          ) : (
            secondary
          )}
        </div>
        {status === "working_out" && (
          <div className="text-[12px] text-neutral-400 mt-0.5">
            {elapsedLabel(member.workoutStartedAt) ?? "Started just now"}
          </div>
        )}
        {status === "committed" && (
          <div className="text-[12px] text-neutral-400 mt-0.5">⏳ Waiting to check in</div>
        )}
        {status === "missed" && (
          <div className="text-[12px] text-neutral-400 mt-0.5">Tomorrow is a fresh start.</div>
        )}
      </div>
      {liveWorkout && !member.isYou ? (
        <button
          onClick={() => onCheer(member.workoutSessionId as string)}
          className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
          style={{ background: "#DCFCE7", color: "#15803D" }}
        >
          Cheer
        </button>
      ) : (
        canNudge && <NudgeButton groupId={groupId} member={member} variant="ghost" />
      )}
    </div>
  );
}

function ActivityTab({ groupId, solo }: { groupId: string; solo: boolean }) {
  const groupFeed = useGroupFeed(groupId, { staleTime: 30_000 });

  // Same day-by-day feed as Home, for this one group.
  return (
    <div className="pb-2">
      <FeedList
        items={groupFeed.feed?.items}
        meta={groupFeed.feed?.meta}
        loading={groupFeed.isPending}
        refreshFailed={groupFeed.refreshFailed}
        onRetry={() => void groupFeed.refetch()}
        groupId={groupId}
        solo={solo}
        hasMore={groupFeed.hasMore}
        loadingMore={groupFeed.loadingMore}
        loadMoreFailed={groupFeed.loadMoreFailed}
        onLoadMore={groupFeed.loadMore}
      />
    </div>
  );
}
