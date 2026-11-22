import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { useEffect, useRef, useState } from "react";
import { Plus, Link as LinkIcon, ChevronRight, Search, X } from "lucide-react";
import { getGroupsToday, type GroupToday } from "@/lib/group-today.functions";
import { PullToRefresh } from "@/components/PullToRefresh";
import { GroupOverflowMenu, inviteLinkFor, ShareInviteDrawer } from "@/components/groups/GroupOverflowMenu";
import { PendingInvitesRow } from "@/components/groups/PendingInvitesRow";
import { PlansDiscover } from "@/components/plans/PlansDiscover";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";
import { crewPageCounts, crewPageStatus, crewWaiting } from "@/lib/group-today-view";
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

type DiscoverTab = "crews" | "plans";

export const Route = createFileRoute("/_authenticated/groups/")({
  validateSearch: (s: Record<string, unknown>): { invite?: string; tab?: DiscoverTab; complete?: string } => ({
    invite: typeof s.invite === "string" && s.invite ? s.invite : undefined,
    tab: s.tab === "crews" || s.tab === "plans" ? s.tab : undefined,
    complete: typeof s.complete === "string" && s.complete ? s.complete : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Discover · Pactara" },
      { name: "description", content: "Your crews and workout plans on Pactara." },
    ],
  }),
  component: GroupsOverview,
});

const D_INK = "#141218";

/** Discover header: title, plan search, then the Plans | Crews switch. */
function DiscoverHeader({
  value,
  onChange,
  query,
  onQuery,
  autoFocusSearch,
}: {
  value: DiscoverTab;
  onChange: (t: DiscoverTab) => void;
  query: string;
  onQuery: (q: string) => void;
  autoFocusSearch: boolean;
}) {
  return (
    <>
      <h1 className="mx-1 text-[30px] font-extrabold tracking-[-0.6px]" style={{ color: D_INK }}>
        Discover
      </h1>
      <label
        className="flex h-[50px] items-center gap-[10px] rounded-[25px] bg-white px-[14px]"
        style={{ border: "1.5px solid #E7E3DE" }}
      >
        <Search size={20} className="shrink-0" style={{ color: "#78716C" }} aria-hidden />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={'Try "no equipment" or "bad knees"'}
          aria-label="Search plans"
          enterKeyHint="search"
          autoFocus={autoFocusSearch}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#A8A29E]"
          style={{ color: D_INK }}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label="Clear search"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <X size={16} style={{ color: "#78716C" }} />
          </button>
        )}
      </label>
      <div
        className="grid grid-cols-2 gap-1 rounded-[14px] p-1"
        style={{ background: "#E7E3DE" }}
        role="tablist"
        aria-label="Discover"
      >
        {(["plans", "crews"] as const).map((t) => {
          const on = value === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t)}
              className="h-10 rounded-[11px] text-[15px] font-bold transition-colors"
              style={{
                background: on ? "#FFFFFF" : "transparent",
                color: on ? D_INK : "#44403C",
                boxShadow: on ? "0 1px 3px rgba(20,18,24,0.12)" : undefined,
              }}
            >
              {t === "crews" ? "Crews" : "Plans"}
            </button>
          );
        })}
      </div>
    </>
  );
}

const DISCOVER_TOP = "max(56px, calc(env(safe-area-inset-top) + 12px))";

function GroupsOverview() {
  useStatusBarScrollToTop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { invite: inviteGroupId, tab: tabParam, complete: completeSlug } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["groups-today"],
    queryFn: () => getGroupsToday(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const { data: partnerState } = usePartnerState();

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [inviteSheet, setInviteSheet] = useState<{ groupId: string; groupName: string } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteHandled = useRef(false);

  // Arriving with ?invite=<groupId> (e.g. from "Invite someone instead" on the
  // partner screen) opens the invite share for that group, then clears the param.
  useEffect(() => {
    if (!inviteGroupId || inviteHandled.current || !data) return;
    inviteHandled.current = true;
    navigate({ to: "/groups", search: { tab: "crews" }, replace: true });
    const group = data.groups.find((g) => g.id === inviteGroupId) ?? data.groups[0];
    if (!group) return;
    const relation = relationForGroup(group.id, partnerState);
    const groupName = relation?.name ?? group.name;
    const shareText = "Accept your invite to my Pactara group!";
    const link = inviteLinkFor(group.id);
    let canNativeShare = typeof navigator !== "undefined" && "share" in navigator;
    if (canNativeShare) {
      try {
        canNativeShare = window.self === window.top;
      } catch {
        canNativeShare = false;
      }
    }
    if (canNativeShare) {
      navigator.share({ title: shareText, text: shareText, url: link }).catch(() =>
        setInviteSheet({ groupId: group.id, groupName }),
      );
    } else {
      setInviteSheet({ groupId: group.id, groupName });
    }
  }, [inviteGroupId, data, navigate, partnerState]);

  // "In a crew" = at least one group with someone else in it.
  const inCrew = (data?.groups ?? []).some((g) => g.memberCount >= 2);
  const tab: DiscoverTab | null = tabParam ?? (inviteGroupId ? "crews" : data ? (inCrew ? "crews" : "plans") : null);
  const setTab = (t: DiscoverTab) =>
    navigate({ to: "/groups", search: (prev) => ({ ...prev, tab: t, complete: undefined }), replace: true });
  // The search finds plans: typing on Crews switches to Plans and keeps typing there.
  const [query, setQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const onQuery = (q: string) => {
    setQuery(q);
    if (tab !== "plans" && q.trim()) {
      setFocusSearch(true);
      setTab("plans");
    }
  };

  if (tab === "plans") {
    return (
      <div
        data-scroll-root
        className="fixed inset-0 w-full overflow-y-auto overscroll-none"
        style={{ background: "#F4F2EF", fontFamily: "Inter, system-ui, sans-serif", color: D_INK }}
      >
        <div className="flex flex-col gap-[18px] px-4 pb-[130px]" style={{ paddingTop: DISCOVER_TOP }}>
          <DiscoverHeader value="plans" onChange={setTab} query={query} onQuery={onQuery} autoFocusSearch={focusSearch} />
          <PlansDiscover
            query={query}
            onClearQuery={() => setQuery("")}
            completeSlug={completeSlug}
            onCloseComplete={() =>
              navigate({ to: "/groups", search: (prev) => ({ ...prev, complete: undefined }), replace: true })
            }
          />
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="fixed inset-0 w-full overflow-hidden" style={{ background: BG }} />;
  }

  const groups = data.groups;
  const count = groups.length;
  // Count distinct people, not per-group rows — the same person in several
  // groups was being counted once per group.
  const waitingOn = new Set(
    groups.flatMap((g) => crewWaiting(g.members).map((m) => m.userId)),
  ).size;

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: "#0A0A0A" }}
    >
      <header className="flex flex-col gap-[18px] px-4" style={{ paddingTop: DISCOVER_TOP }}>
        <DiscoverHeader value="crews" onChange={setTab} query={query} onQuery={onQuery} autoFocusSearch={false} />
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

        <PendingInvitesRow joinedIds={groups.map((g) => g.id)} />

        <div className="mt-4 space-y-3">
          {groups.length === 0 && <EmptyGroups />}
          {groups.map((g) => {
            const relation = relationForGroup(g.id, partnerState);
            return (
              <GroupAccountabilityCard
                key={g.id}
                group={g}
                displayName={relation?.name ?? g.name}
                displayEmoji={relation?.emoji ?? g.emoji}
              />
            );
          })}
        </div>
      </PullToRefresh>

      {inviteSheet && (
        <ShareInviteDrawer
          open
          onOpenChange={(o) => {
            if (!o) setInviteSheet(null);
          }}
          groupName={inviteSheet.groupName}
          inviteLink={inviteLinkFor(inviteSheet.groupId)}
          shareText="Accept your invite to my Pactara group!"
          copied={inviteCopied}
          onCopy={() => {
            navigator.clipboard.writeText(inviteLinkFor(inviteSheet.groupId)).catch(() => {});
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 1800);
          }}
        />
      )}
    </div>
  );
}

function GroupAccountabilityCard({
  group,
  displayName,
  displayEmoji,
}: {
  group: GroupToday;
  displayName: string;
  displayEmoji: string;
}) {
  const navigate = useNavigate();
  // Members resting today aren't due: left out of "{n} of {m}" and never nudged.
  const counts = crewPageCounts(group.members);
  const allDone = counts.due > 0 && counts.done === counts.due;
  const waiting = crewWaiting(group.members);
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
           <span className="text-[24px] leading-none">{displayEmoji}</span>
          <span className="min-w-0">
            <span className="block text-white text-[18px] font-bold leading-tight truncate">
               {displayName}
            </span>
            <span className="block text-white/75 text-[12px] mt-0.5 truncate">
              Day {group.dayNumber} of {group.durationDays} · {freqLabel}
            </span>
          </span>
        </button>
        <GroupOverflowMenu
          groupId={group.id}
           groupName={displayName}
           emoji={displayEmoji}
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
            {counts.done} of {counts.due} showed up{allDone ? " 🎉" : " today"}
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
            <StatusPill status={crewPageStatus(m)} />
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
