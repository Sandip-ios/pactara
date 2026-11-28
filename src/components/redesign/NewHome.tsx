import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGroupsToday } from "@/lib/group-today.functions";
import { crewPageCounts } from "@/lib/group-today-view";
import { newActivityUnreadOptions } from "./social-query";
import { useMyPlans, usePlans } from "@/components/plans/PlanBits";
import { beginNewCheckInForGroups } from "@/lib/redesign-checkin";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { useClaimSharedWorkout } from "@/components/workout/useClaimSharedWorkout";
import { useOpenSharedPlan } from "@/components/plans/useOpenSharedPlan";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { useActiveWorkout } from "@/lib/active-workout";
import { dayForWeek, dayMinutes } from "@/lib/workout-plans";
import { cancelNewHomeRest, getNewHomePlanStatus } from "@/lib/home-today.functions";
import { selectTodayState, type TodayPlanInput } from "@/lib/home-today";
import { NewNotifBanner } from "./NewNotifBanner";
import { PostingStrip } from "./post/PostingStrip";
import { HOME_INITIAL_TAB, showHomeToday, type HomeTab } from "@/lib/home-feed";
import { HomeSocialFeed } from "./HomeSocialFeed";
import { NewTodayCard } from "./NewTodayCard";
import { newToast } from "./new-toast";

export function NewHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  useStatusBarScrollToTop();
  useClaimSharedWorkout();
  useOpenSharedPlan();
  const crewsQuery = useQuery({ queryKey: ["groups-today"], queryFn: () => getGroupsToday(), staleTime: 30_000 });
  const { data: notifications } = useQuery(newActivityUnreadOptions);
  const mine = useMyPlans();
  const catalog = usePlans();
  const planStatus = useQuery({ queryKey: ["new-home-plan-status"], queryFn: () => getNewHomePlanStatus(), staleTime: 30_000 });
  const activeWorkout = useActiveWorkout();
  const starter = useStartWorkout();
  const cancelRest = useServerFn(cancelNewHomeRest);
  const [tab, setTab] = useState<HomeTab>(HOME_INITIAL_TAB);

  const crews = (crewsQuery.data?.groups ?? []).map((group) => {
    const counts = crewPageCounts(group.members);
    const me = group.members.find((member) => member.isYou);
    return {
      id: group.id,
      name: group.name,
      checkedIn: me?.status === "done",
      cover: me?.coverKind ?? null,
      checkedInCount: counts.done,
      dueCount: counts.due,
    };
  });

  const active = mine.data?.active ?? null;
  const activePlan = active ? (catalog.data ?? []).find((item) => item.id === active.planId) ?? null : null;
  const activeDay = activePlan && active ? dayForWeek(activePlan, active.nextDay, active.currentWeek) : null;
  let plan: TodayPlanInput | null = null;
  if (active && activePlan && activeDay) {
    const live = activeWorkout?.plan?.userPlanId === active.id;
    plan = {
      slug: activePlan.slug,
      name: activePlan.name,
      week: active.currentWeek,
      day: active.nextDay,
      title: activeDay.title,
      minutes: dayMinutes(activeDay, activePlan),
      coverUrl: activePlan.coverUrl,
      status: live ? "in_progress" : planStatus.data?.checkedInToday ? "checked_in" : planStatus.data?.doneNotCheckedIn ? "done" : "not_started",
      elapsedMinutes: live ? Math.max(0, Math.floor((Date.now() - activeWorkout.startedAt) / 60000)) : 0,
    };
  }

  if (!plan && planStatus.data?.checkedInToday) {
    plan = { slug: "", name: "", week: 1, day: 1, title: "", minutes: "", coverUrl: null, status: "checked_in", elapsedMinutes: 0 };
  }

  const hasCrews = (crewsQuery.data?.groups.length ?? 0) > 0;
  const planLoading = hasCrews && (mine.isLoading || catalog.isLoading || planStatus.isLoading);
  const selection = selectTodayState({
    status: crewsQuery.isError ? "error" : crewsQuery.isLoading || !crewsQuery.data || planLoading ? "loading" : "ready",
    crews,
    plan,
  });

  const openCheckIn = (ids: string[]) => {
    const first = ids[0];
    if (!first) return;
    beginNewCheckInForGroups(ids, first, null);
    void navigate({ to: "/check-in" });
  };
  const checkInAnyway = async (ids: string[]) => {
    try {
      await cancelRest({ data: { groupIds: ids } });
      queryClient.removeQueries({ queryKey: ["rest-day-info"] });
      await queryClient.invalidateQueries({ queryKey: ["groups-today"] });
      openCheckIn(ids);
    } catch {
      newToast("Couldn't open check-in. Try again.");
    }
  };
  const startPlan = async () => {
    if (activeWorkout) {
      await navigate({ to: "/workout/log" });
      return;
    }
    if (!activePlan || !active) return;
    try {
      await starter.startPlan(activePlan, active, { week: active.currentWeek, day: active.nextDay });
    } catch {
      newToast("Couldn't start the workout. Try again.");
    }
  };

  return (
    <div ref={scrollRef} data-scroll-root className="redesign-step3 fixed inset-0 overflow-y-auto overscroll-none bg-[var(--new-bg)] pb-[calc(104px+env(safe-area-inset-bottom))] text-[var(--new-ink)]">
      <header className="flex items-center justify-between bg-[var(--new-white)] px-5 pb-3 pt-new-top">
        <h1 className="text-[24px] font-extrabold tracking-[-0.5px]"><span className="text-[var(--new-purple-text)]">P</span>actara</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-[var(--new-control)]" aria-label="Search" onClick={() => navigate({ to: "/groups" })}><Search className="!size-5" /></Button>
          <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full bg-[var(--new-control)]" aria-label="Activity" onClick={() => navigate({ to: "/activity" })}><Bell className="!size-5" />{(notifications?.total ?? 0) > 0 && <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-[var(--new-red)]" />}</Button>
        </div>
      </header>
      <nav className="new-home-tabs" role="tablist" aria-label="Home feed">
        {(["following", "for-you"] as const).map((value) => <Button key={value} variant="ghost" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === "following" ? "Following" : "For you"}</Button>)}
      </nav>
      <PostingStrip />
      {crewsQuery.data && <NewNotifBanner crewNames={crewsQuery.data.groups.map((group) => group.name)} />}
      {showHomeToday(tab) && (
        <NewTodayCard
          selection={selection}
          crews={crews}
          plan={plan}
          onRetry={() => void crewsQuery.refetch()}
          onOpenCrew={(groupId) => void navigate({ to: "/crews/$groupId", params: { groupId } })}
          onCheckIn={openCheckIn}
          onCheckInAnyway={(ids) => void checkInAnyway(ids)}
          onStartCrew={() => void navigate({ to: "/new-pactara" })}
          onStartPlan={startPlan}
          onResumePlan={() => void navigate({ to: "/workout/log" })}
        />
      )}
      <HomeSocialFeed tab={tab} />
    </div>
  );
}
