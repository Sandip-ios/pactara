import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, Check, ChevronLeft, ChevronRight, CircleCheck, Flame, Lock, Moon, Snowflake } from "lucide-react";
import { getGroupsToday, type GroupToday, type MemberToday } from "@/lib/group-today.functions";
import { getHomeCrew, type HomeCrewMember } from "@/lib/home-crew.functions";
import { getNotificationPrefs } from "@/lib/profile.functions";
import { crewPageCanNudge, crewPageCounts, crewPageStatus } from "@/lib/group-today-view";
import { checkedInSubline, crewShowedUpLine, redesignWeekCell, reminderClock } from "@/lib/redesign-crew-view";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";
import { elapsedLabel, NudgeButton } from "@/components/groups/AccountabilityBits";
import { FeedList } from "@/components/feed/FeedList";
import { useGroupFeed } from "@/components/feed/use-group-feed";
import { FeedContext } from "@/components/feed/feed-context";
import { isVideoUrl } from "@/components/feed/FeedMedia";
import { MediaLightbox } from "@/components/MediaLightbox";
import { useCheers } from "@/components/TimelineCard";
import { GroupChatView } from "@/routes/_authenticated/chat.$groupId";
import { CrewAvatar, CrewAvatarOverlap } from "./CrewAvatars";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import type { FeedItem } from "@/lib/daily-posts.functions";
import type { CheckInNode } from "@/lib/feed-days";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { NewSheet, NewSheetButton, NewSheetChip } from "./NewSheet";
import { NewCrewControls } from "./NewCrewControls";
import { beginNewCheckIn } from "@/lib/redesign-checkin";
import { useServerFn } from "@tanstack/react-start";
import { completeCrewJoinGoal, getCrewJoinGoal } from "@/lib/crew-join.functions";
import { NewPactBanner } from "./NewPactBanner";
import { pactStatusOptions } from "./pact-query";
import { JOIN_GOAL_MAX } from "@/lib/crew-join";
import { Button } from "@/components/ui/button";
import { newToastApi as toast } from "./new-toast";
import { ACTIVITY_UNAVAILABLE } from "@/lib/activity-deeplink";

const BG = "#F5F2EE";
const INK = "#1C1917";
const MUTED = "#57534E";
const PURPLE = "#7C3AED";
const GREEN = "#15803D";
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

type Tab = "today" | "posts" | "chat";
type MediaState = { src: string; kind: "image" | "video" } | null;

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

function avatarMember(member: MemberToday | HomeCrewMember) {
  return { id: member.userId, name: member.name, avatarUrl: member.avatarUrl, avatarColor: member.avatarColor };
}

export function NewCrewScreen({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const searchStr = useRouterState({ select: state => state.location.searchStr });
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  useStatusBarScrollToTop();
  const [deepLink, setDeepLink] = useState<{ post: string; comments: boolean; comment: string | null } | null>(() => {
    if (typeof window === "undefined") return null;
    const query = new URLSearchParams(window.location.search);
    const post = query.get("post");
    return post ? { post, comments: query.get("comments") === "1" || Boolean(query.get("comment")), comment: query.get("comment") } : null;
  });
  const [fromActivity, setFromActivity] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "activity");
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("post")) return "posts";
    const value = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("crewTab") : null;
    return value === "chat" || value === "posts" ? value : "today";
  });
  // Activity rows and new-version pushes share this exact Posts-tab target.
  // Consume the URL after storing it so tapping the same row again still works.
  useEffect(() => {
    const query = new URLSearchParams(searchStr || (typeof window !== "undefined" ? window.location.search : ""));
    const requestedTab = query.get("crewTab");
    if (requestedTab === "chat" || requestedTab === "posts") setTab(requestedTab);
    const post = query.get("post");
    if (!post) return;
    setDeepLink({ post, comments: query.get("comments") === "1" || Boolean(query.get("comment")), comment: query.get("comment") });
    setFromActivity(query.get("from") === "activity");
    setTab("posts");
    void navigate({ to: "/crews/$groupId", params: { groupId }, search: { crewTab: "posts" }, replace: true });
  }, [searchStr, groupId, navigate]);
  // The design hides the bottom bar in Chat so the composer sits at the bottom.
  useHideBottomTabs(tab === "chat", false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [media, setMedia] = useState<MediaState>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["groups-today"],
    queryFn: () => getGroupsToday(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: homeCrew } = useQuery({
    queryKey: ["home-crew", groupId],
    queryFn: () => getHomeCrew({ data: { groupId } }),
    staleTime: 30_000,
  });
  const { data: prefs } = useQuery({ queryKey: ["notification-prefs"], queryFn: () => getNotificationPrefs() });
  const { data: partnerState } = usePartnerState();
  const { data: joinGoal } = useQuery({ queryKey: ["crew-join-goal", groupId], queryFn: () => getCrewJoinGoal({ data: { groupId } }), staleTime: 60_000 });
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalAnswered, setGoalAnswered] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);
  const finishGoal = useServerFn(completeCrewJoinGoal);
  useEffect(() => { if (joinGoal?.show && !goalAnswered) setGoalOpen(true); }, [joinGoal?.show, goalAnswered]);
  const answerGoal = async (goal: string | null) => {
    setGoalBusy(true);
    try { await finishGoal({ data: { groupId, goal } }); } catch { /* the prompt comes back next visit */ }
    setGoalBusy(false);
    setGoalOpen(false);
    setGoalAnswered(true);
  };
  const groupFeed = useGroupFeed(groupId, { staleTime: 30_000 });
  const { data: pact } = useQuery(pactStatusOptions(groupId));
  // First visit after the last day: the Pact done screen, once per member per pact.
  useEffect(() => {
    if (pact?.done && !pact.doneSeen) navigate({ to: "/crews/$groupId/pact-done", params: { groupId }, replace: true });
  }, [pact?.done, pact?.doneSeen, groupId, navigate]);

  useEffect(() => {
    localStorage.setItem("active-group-id", groupId);
  }, [groupId]);

  const group = data?.groups.find((item) => item.id === groupId);
  const relation = relationForGroup(groupId, partnerState);
  const displayName = relation?.name ?? group?.name ?? "Crew";
  const me = group?.members.find((member) => member.isYou);
  const viewerDone = !!me && crewPageStatus(me) === "done";
  const counts = group ? crewPageCounts(group.members) : { done: 0, due: 0 };
  const feedMe = groupFeed.feed?.meta?.members.find((member) => member.isMe) ?? null;

  const checkIn = () => {
    beginNewCheckIn(groupId, groupId);
    navigate({ to: "/check-in" });
  };

  if (isLoading || !data) {
    return <div className="fixed inset-0" style={{ background: BG }} aria-label="Loading crew" />;
  }

  if (!group) {
    return (
      <div className="fixed inset-0 overflow-y-auto" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
        <header className="bg-white px-4 pb-4 pt-new-top">
          <button type="button" aria-label="Back" onClick={() => navigate({ to: "/crews" })} className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#F4F2EF" }}><ChevronLeft size={22} /></button>
        </header>
        <div className="m-4 rounded-[20px] bg-white p-6 text-center text-[16px] font-bold">This crew is no longer available</div>
      </div>
    );
  }

  const reminder = prefs?.daily_reminder_enabled ? reminderClock(prefs.daily_reminder_time) : null;

  return (
    <FeedContext.Provider value={{ me: feedMe, weeklyTarget: homeCrew?.weeklyTarget ?? 5 }}>
      <div ref={scrollRef} data-scroll-root className={`redesign-step3 fixed inset-0 w-full overflow-y-auto overscroll-none ${tab === "chat" ? "" : "pb-[calc(104px+env(safe-area-inset-bottom))]"}`} style={{ background: BG, color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
        <header className="bg-white pt-new-top">
          <div className="flex items-center justify-between px-4">
            <button type="button" aria-label="Back" onClick={() => { if (fromActivity && router.history.canGoBack()) router.history.back(); else void navigate({ to: "/crews" }); }} className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#F4F2EF" }}>
              <ChevronLeft size={22} />
            </button>
            <NewCrewControls group={group} groups={data.groups} tab={tab} name={displayName} />
          </div>
          <div className="mt-2 flex items-center gap-3 px-4 pb-3">
            <CrewAvatarOverlap members={group.members.map(avatarMember)} size={40} />
            <div className="min-w-0">
              <NewCrewControls group={group} groups={data.groups} tab={tab} name={displayName} header />
              <p className="mt-[2px] flex items-center gap-1.5 text-[13px] leading-[15px]" style={{ color: MUTED }}>
                <Lock size={13} aria-hidden /> Private crew · {pact?.done ? "pact done" : `day ${group.dayNumber} of ${group.durationDays}`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 border-b" style={{ borderColor: "#E7E3DE" }} role="tablist" aria-label="Crew sections">
            {(["today", "posts", "chat"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className="relative h-12 text-[15px] capitalize"
                style={{ color: tab === item ? "#6D28D9" : MUTED, fontWeight: tab === item ? 700 : 600 }}
              >
                {item}
                {tab === item && <span className="absolute inset-x-0 bottom-[-1px] h-[3px]" style={{ background: PURPLE }} aria-hidden />}
              </button>
            ))}
          </div>
        </header>

        {tab === "today" && (
          <main>
            {pact && <NewPactBanner groupId={groupId} crewName={displayName} ownerName={(group.members.find((m) => m.userId === pact.ownerId)?.name ?? "The owner").trim().split(/\s+/)[0] ?? "The owner"} status={pact} />}
            <section className="m-4 rounded-[20px] bg-white p-4">
              <h2 className="text-[28px] font-extrabold leading-tight">{counts.done} of {counts.due} showed up</h2>
              <p className="mt-2 text-[15px] leading-[1.45]" style={{ color: MUTED }}>{crewShowedUpLine(counts.done, counts.due, viewerDone)}</p>
              <button type="button" onClick={() => setStreakOpen(true)} className="mt-4 flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-extrabold" style={{ background: "#FFEDE0", color: "#9A3412" }}>
                <Flame size={16} style={{ color: "#EA580C" }} fill="#EA580C" aria-hidden />
                {group.groupStreak > 0 ? `${group.groupStreak}-day crew streak` : "Crew streak starts today"}
                <ChevronRight size={16} aria-hidden />
              </button>
              {viewerDone ? (
                <div className="mt-5 flex h-[52px] items-center justify-center gap-2 text-[16px] font-bold" style={{ color: GREEN }}>
                  <CircleCheck size={22} aria-hidden /> You're in today
                </div>
              ) : (
                <>
                  <button type="button" onClick={checkIn} className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[26px] text-[17px] font-bold text-white" style={{ background: PURPLE }}>
                    <Camera size={21} aria-hidden /> Check in
                  </button>
                  {reminder && <p className="mt-2.5 text-center text-[13px]" style={{ color: MUTED }}>You said you'd be in by {reminder}</p>}
                </>
              )}
            </section>

            <SectionLabel>THIS WEEK</SectionLabel>
            {homeCrew ? <WeekCard crew={homeCrew.members} /> : <div className="mx-4 h-40 animate-pulse rounded-[20px] bg-white" aria-label="Loading this week" />}

            <SectionLabel>WHERE EVERYONE STANDS</SectionLabel>
            <section className="mx-4 overflow-hidden rounded-[20px] bg-white">
              {youLast(group.members).map((member, index) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  home={homeCrew?.members.find((item) => item.userId === member.userId)}
                  groupId={group.id}
                  items={groupFeed.feed?.items ?? []}
                  divider={index > 0}
                  onOpenMedia={setMedia}
                />
              ))}
            </section>
          </main>
        )}

        {tab === "posts" && (
          <main className="pb-2">
            <FeedList
              items={groupFeed.feed?.items}
              meta={groupFeed.feed?.meta}
              loading={groupFeed.isPending}
              refreshFailed={groupFeed.refreshFailed}
              onRetry={() => void groupFeed.refetch()}
              groupId={group.id}
              solo={relation?.kind === "solo" || group.memberCount <= 1}
              hasMore={groupFeed.hasMore}
              loadingMore={groupFeed.loadingMore}
              loadMoreFailed={groupFeed.loadMoreFailed}
              onLoadMore={groupFeed.loadMore}
              todayCounts={{ inCount: counts.done, dueCount: counts.due }}
              variant="redesign"
              deepLinkPost={deepLink?.post}
              deepLinkComments={deepLink?.comments}
              deepLinkComment={deepLink?.comment}
              onDeepLinkMissing={() => {
                toast.error(ACTIVITY_UNAVAILABLE);
                void navigate({ to: "/activity", replace: true });
              }}
            />
          </main>
        )}

        {tab === "chat" && <main><GroupChatView groupId={group.id} embedded crewName={displayName} /></main>}
      </div>

      <NewSheet open={streakOpen} onOpenChange={setStreakOpen} title="Crew streak" description="Today's crew streak details">
          <div className="flex flex-col items-center py-5 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "#FFEDE0" }}><Flame size={30} style={{ color: "#EA580C" }} fill="#EA580C" /></span>
            <div className="mt-3 text-[28px] font-extrabold">{group.groupStreak} {group.groupStreak === 1 ? "day" : "days"}</div>
            <p className="mt-2 text-[15px] leading-[1.5]" style={{ color: MUTED }}>{counts.done} of {counts.due} members are in today. Everyone needs to be in to keep the crew streak.</p>
          </div>
          <NewSheetButton onClick={() => setStreakOpen(false)}>Done</NewSheetButton>
      </NewSheet>
      <NewSheet open={goalOpen} onOpenChange={(o) => { if (!o) { setGoalOpen(false); setGoalAnswered(true); } }} title={`You're in ${displayName}`} subtitle="What's your goal in this crew? Everyone has their own, and your crewmates see it on your row.">
        <div>
          <input aria-label="Your goal" maxLength={JOIN_GOAL_MAX} value={goalText} onChange={(e) => setGoalText(e.target.value)} className="h-[52px] w-full rounded-[16px] border border-[var(--new-handle)] bg-[var(--new-white)] px-3 text-[16px] text-[var(--new-ink)] outline-none focus:border-[var(--new-purple)]" />
          <p className="mt-1 text-right text-[12px]" style={{ color: MUTED }}>{goalText.length}/{JOIN_GOAL_MAX}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Build muscle", "Lose fat", "Stay consistent"].map((chip) => (
              <NewSheetChip key={chip} selected={goalText === chip} onClick={() => setGoalText(chip)}>{chip}</NewSheetChip>
            ))}
          </div>
          <NewSheetButton disabled={goalBusy || !goalText.trim()} onClick={() => void answerGoal(goalText.trim())}>Save goal</NewSheetButton>
          <Button variant="ghost" disabled={goalBusy} onClick={() => void answerGoal(null)} className="mt-[10px] h-11 w-full bg-transparent text-[15px] font-bold text-[var(--new-muted)] hover:bg-transparent hover:text-[var(--new-muted)]">Skip for now</Button>
        </div>
      </NewSheet>
      {media && <MediaLightbox src={media.src} kind={media.kind} onClose={() => setMedia(null)} />}
    </FeedContext.Provider>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="text-[13px] font-extrabold" style={{ color: MUTED, letterSpacing: "0.6px", padding: "18px 16px 8px" }}>{children}</div>;
}

function WeekCard({ crew }: { crew: HomeCrewMember[] }) {
  const viewerToday = crew.find((member) => member.isYou)?.today ?? crew[0]?.today ?? "";
  const todayIndex = viewerToday ? (new Date(`${viewerToday}T12:00:00Z`).getUTCDay() + 6) % 7 : -1;
  return (
    <section className="mx-4 rounded-[20px] bg-white p-3.5">
      <div className="grid items-center gap-1" style={{ gridTemplateColumns: "minmax(64px, 1fr) repeat(7, 32px)" }}>
        <span />
        {WEEK_LETTERS.map((letter, index) => <span key={`${letter}-${index}`} className="text-center text-[12px] font-bold" style={{ color: index === todayIndex ? "#6D28D9" : MUTED }}>{letter}</span>)}
        {youLast(crew).map((member) => {
          const covers = new Map(member.coverKinds.map((cover) => [cover.date, cover.kind]));
          return (
            <div key={member.userId} className="col-span-8 grid grid-cols-subgrid items-center gap-1 py-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <CrewAvatar member={avatarMember(member)} size={20} />
                <span className="truncate text-[14px] font-bold">{member.isYou ? "You" : member.firstName}</span>
              </div>
              {member.days.map((day) => {
                const state = redesignWeekCell({ date: day.date, state: day.state, today: member.today, coverKind: covers.get(day.date) });
                return <WeekCell key={day.date} state={state} date={day.date} />;
              })}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-start gap-x-4 gap-y-1.5 text-[12px]" style={{ color: MUTED }}>
        <LegendItem bg="#DCFCE7" icon={<Check size={9} strokeWidth={3} style={{ color: "#15803D" }} />} label="Checked in" />
        <LegendItem bg="#F3EEFF" icon={<Moon size={9} style={{ color: "#A78BFA" }} fill="#A78BFA" />} label="Rest day" />
        <LegendItem bg="#E0F2FE" icon={<Snowflake size={9} style={{ color: "#0284C7" }} />} label="Freeze used" />
      </div>
    </section>
  );
}

function WeekCell({ state, date }: { state: ReturnType<typeof redesignWeekCell>; date: string }) {
  const label = `${date}: ${state === "checked" ? "checked in" : state === "rest" ? "rest day" : state === "freeze" ? "freeze used" : state === "today" ? "not in yet" : "empty"}`;
  const style = state === "checked" ? { background: "#DCFCE7" }
    : state === "rest" ? { background: "#F3EEFF" }
      : state === "freeze" ? { background: "#E0F2FE" }
        : state === "today" ? { border: "2px dashed #A8A29E" }
          : { background: "#F0EDE9" };
  return (
    <span role="img" aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-full" style={style}>
      {state === "checked" && <Check size={17} strokeWidth={3} style={{ color: GREEN }} />}
      {state === "rest" && <Moon size={15} style={{ color: "#A78BFA" }} />}
      {state === "freeze" && <Snowflake size={15} style={{ color: "#0284C7" }} />}
    </span>
  );
}

function MemberRow({ member, home, groupId, items, divider, onOpenMedia }: {
  member: MemberToday;
  home: HomeCrewMember | undefined;
  groupId: string;
  items: FeedItem[];
  divider: boolean;
  onOpenMedia: (media: MediaState) => void;
}) {
  const status = crewPageStatus(member);
  const todayItem = home ? items.find((item) => item.userId === member.userId && item.localDate === home.today) : undefined;
  const checkIn = todayItem?.nodes
    .filter((node): node is CheckInNode => node.kind === "check_in")
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const done = status === "done";
  const resting = status === "rest";
  const workingOut = status === "working_out";
  const canNudge = crewPageCanNudge(status, member.isYou) && home?.nudgeAllowed !== false;
  const video = checkIn?.photoUrl ? isVideoUrl(checkIn.photoUrl) : false;

  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: divider ? "1px solid #F0EDE9" : undefined }}>
      <MemberProfileLink userId={member.userId} isYou={member.isYou} className="shrink-0">
        <span className="sr-only">{member.isYou ? "Your profile" : `${member.name}'s profile`}</span>
        <CrewAvatar member={avatarMember(member)} size={44} />
      </MemberProfileLink>
      <div className="min-w-0 flex-1">
        <MemberProfileLink userId={member.userId} isYou={member.isYou} className="block truncate text-[16px] font-extrabold">{member.isYou ? "You" : member.name}</MemberProfileLink>
        <div className="mt-0.5 text-[14px] font-bold" style={{ color: done || workingOut ? GREEN : resting ? "#7C5CD6" : member.isYou ? MUTED : "#C2410C" }}>
          {done ? `Checked in${checkIn ? ` at ${clock(checkIn.at)}` : ""}` : resting ? "Resting today" : workingOut ? "Working out now" : "Not in yet"}
        </div>
        {done && <div className="mt-0.5 truncate text-[13px]" style={{ color: MUTED }}>{checkedInSubline(checkIn?.workout?.title, member.streak)}</div>}
        {workingOut && <div className="mt-0.5 text-[13px]" style={{ color: MUTED }}>{elapsedLabel(member.workoutStartedAt) ?? "Started just now"}</div>}
      </div>
      {done && !member.isYou && todayItem && checkIn && <CrewCheerButton item={todayItem} />}
      {canNudge && <NudgeButton groupId={groupId} member={member} variant="redesign" initialSent={home?.nudgedToday ?? false} />}
      {done && checkIn?.photoUrl && (
        <button
          type="button"
          aria-label={`Open ${member.isYou ? "your" : `${member.firstName}'s`} check-in ${video ? "video" : "photo"}`}
          onClick={() => onOpenMedia({ src: checkIn.photoUrl!, kind: video ? "video" : "image" })}
          className="h-11 w-11 shrink-0 overflow-hidden rounded-[12px] bg-neutral-100"
        >
          {video && !checkIn.posterUrl ? <video src={checkIn.photoUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" /> : <img src={checkIn.posterUrl ?? checkIn.photoUrl} alt="" className="h-full w-full object-cover" />}
        </button>
      )}
    </div>
  );
}

function CrewCheerButton({ item }: { item: FeedItem }) {
  const cheers = useCheers(item);
  return (
    <button
      type="button"
      onClick={cheers.toggle}
      aria-pressed={!!cheers.myEmoji}
      aria-label={cheers.myEmoji ? "Remove your cheer" : "Cheer this check-in"}
      className="flex h-9 shrink-0 items-center rounded-full px-3 text-[14px] font-bold"
      style={{ background: "#DCFCE7", color: GREEN }}
    >
      {cheers.myEmoji ? `${cheers.myEmoji} Cheered` : "Cheer"}
    </button>
  );
}

function youLast<T extends { isYou: boolean }>(members: T[]): T[] {
  return [...members.filter((member) => !member.isYou), ...members.filter((member) => member.isYou)];
}

function LegendItem({ bg, icon, label }: { bg: string; icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full" style={{ background: bg }} aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
