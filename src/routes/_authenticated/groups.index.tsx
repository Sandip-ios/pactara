import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Link as LinkIcon, ChevronRight } from "lucide-react";
import { getGroupsToday, type GroupToday } from "@/lib/group-today.functions";
import { PullToRefresh } from "@/components/PullToRefresh";
import { GroupOverflowMenu } from "@/components/groups/GroupOverflowMenu";
import {
  BG,
  GroupStreakChip,
  MemberAvatar,
  MemberStreakChip,
  NudgeButton,
  PURPLE,
  PURPLE_DEEP,
  PURPLE_SOFT,
  StatusPill,
} from "@/components/groups/AccountabilityBits";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsOverview,
});

function GroupsOverview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["groups-today"],
    queryFn: () => getGroupsToday(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");

  if (isLoading || !data) {
    return <div className="fixed inset-0 w-full overflow-hidden" style={{ background: BG }} />;
  }

  const groups = data.groups;
  const count = groups.length;
  const waitingOn = groups.reduce((n, g) => n + (g.memberCount - g.doneCount), 0);

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: "#0A0A0A" }}
    >
      <header className="bg-white px-6 pt-safe-5 pb-4">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span>
          <span>actara</span>
        </div>
      </header>

      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0];
              return k === "groups-today" || k === "my-groups" || k === "my-group-status";
            },
          })
        }
      >
        <div className="px-6 pt-4 flex items-baseline justify-between">
          <div className="text-[14px] text-neutral-500">
            {count} {count === 1 ? "group" : "groups"} · Free trial
          </div>
          {count > 0 && (
            <div className="text-[13px] font-semibold" style={{ color: waitingOn > 0 ? "#EA580C" : "#16A34A" }}>
              {waitingOn > 0 ? `${waitingOn} still to show up` : "Everyone showed up 🎉"}
            </div>
          )}
        </div>

        {/* Compact action row — group status is the focus of this screen now. */}
        <div className="px-4 mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate({ to: "/new-pactara" })}
            className="rounded-2xl px-4 py-3 text-left text-white flex items-center gap-3"
            style={{
              background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
              boxShadow: "0 12px 26px -16px rgba(124, 58, 237, 0.55)",
            }}
          >
            <span className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Plus size={18} />
            </span>
            <span className="text-[14px] font-bold leading-tight">New challenge</span>
          </button>

          <button
            onClick={() => setJoinOpen((v) => !v)}
            className="rounded-2xl px-4 py-3 text-left flex items-center gap-3"
            style={{
              border: joinOpen ? `1px solid ${PURPLE}` : "1px solid transparent",
              background: joinOpen ? PURPLE_SOFT : "#FFFFFF",
            }}
          >
            <span className="h-9 w-9 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-500 shrink-0">
              <LinkIcon size={17} />
            </span>
            <span className="text-[14px] font-bold leading-tight">Join via link</span>
          </button>
        </div>

        {joinOpen && (
          <div className="px-4 mt-3 flex gap-2">
            <input
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder="https://pactara.lovable.app/join/..."
              className="flex-1 rounded-2xl bg-white px-4 py-3 text-[15px] outline-none placeholder:text-neutral-400 border border-neutral-200 focus:border-purple-300"
            />
            <button
              disabled={!joinUrl.trim()}
              onClick={() => {
                const match = joinUrl.trim().match(/\/join\/([^/?#]+)/i);
                const id = match?.[1] ?? joinUrl.trim();
                if (!id) return;
                navigate({ to: "/join/$groupId", params: { groupId: id } });
              }}
              className="px-5 rounded-2xl text-white text-[15px] font-semibold disabled:opacity-50"
              style={{ background: PURPLE }}
            >
              Join
            </button>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {groups.length === 0 && <EmptyGroups />}
          {groups.map((g) => (
            <GroupAccountabilityCard key={g.id} group={g} />
          ))}
        </div>
      </PullToRefresh>
    </div>
  );
}

function GroupAccountabilityCard({ group }: { group: GroupToday }) {
  const navigate = useNavigate();
  const allDone = group.memberCount > 0 && group.doneCount === group.memberCount;
  const waiting = group.members.filter((m) => m.status !== "done");
  const freqLabel = group.frequency === "daily" ? "Daily" : `${group.daysPerWeek}x / week`;
  const shown = group.members.slice(0, 5);
  const overflow = group.memberCount - shown.length;

  const open = () => navigate({ to: "/groups/$groupId", params: { groupId: group.id } });

  return (
    <div className="mx-4 rounded-3xl overflow-hidden bg-white shadow-sm">
      {/* Identity strip */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
      >
        <button onClick={open} className="flex-1 min-w-0 flex items-center gap-3 text-left">
          <span className="text-[24px] leading-none">{group.emoji}</span>
          <span className="min-w-0">
            <span className="block text-white text-[18px] font-bold leading-tight truncate">
              {group.name}
            </span>
            <span className="block text-white/75 text-[12px] mt-0.5 truncate">
              {group.goal ? `${group.goal} · ` : ""}Day {group.dayNumber} of {group.durationDays} · {freqLabel}
            </span>
          </span>
        </button>
        <GroupOverflowMenu
          groupId={group.id}
          groupName={group.name}
          emoji={group.emoji}
          isAdmin={group.isAdmin}
          duration={group.durationDays}
          frequency={group.frequency}
          daysPerWeek={group.daysPerWeek}
        />
      </div>

      {/* The headline answer */}
      <button onClick={open} className="w-full text-left px-4 pt-4 pb-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[22px] font-black tracking-tight leading-none">
            {group.doneCount} of {group.memberCount} showed up{allDone ? " 🎉" : " today"}
          </div>
          <div className="text-[13px] text-neutral-500 mt-1.5">
            {allDone
              ? "Everyone made it today."
              : waiting.length === 1
                ? `One person left 👀`
                : `${waiting.length} still to go`}
          </div>
        </div>
        <ChevronRight size={20} className="text-neutral-300 mt-1" />
      </button>

      {/* Scannable roster */}
      <div className="px-4 pb-1 divide-y divide-neutral-100">
        {shown.map((m) => (
          <div key={m.userId} className="py-2.5 flex items-center gap-3">
            <MemberAvatar member={m} size={34} />
            <div className="flex-1 min-w-0 text-[14px] font-semibold truncate">
              {m.isYou ? "You" : m.firstName}
            </div>
            <MemberStreakChip streak={m.streak} />
            <StatusPill status={m.status} />
          </div>
        ))}
        {overflow > 0 && (
          <button onClick={open} className="py-2.5 w-full text-left text-[13px] font-semibold" style={{ color: PURPLE }}>
            +{overflow} more
          </button>
        )}
      </div>

      <div className="px-4 pt-2.5 pb-4 flex items-center gap-3">
        {group.groupStreak > 0 ? (
          <GroupStreakChip streak={group.groupStreak} />
        ) : (
          <span className="text-[13px] text-neutral-400">Show up together to start a group streak</span>
        )}
      </div>

      {!allDone && waiting.length === 1 && !waiting[0].isYou && (
        <div className="px-4 pb-4">
          <NudgeButton groupId={group.id} member={waiting[0]} />
        </div>
      )}
    </div>
  );
}

function EmptyGroups() {
  return (
    <div className="mx-4 rounded-3xl bg-white p-8 text-center">
      <div className="text-[16px] font-bold">No groups yet</div>
      <div className="text-[13px] text-neutral-500 mt-1">
        Start a new challenge or join via an invite link.
      </div>
    </div>
  );
}
