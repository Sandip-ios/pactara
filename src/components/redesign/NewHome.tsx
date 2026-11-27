import { useEffect, useState } from "react";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Check, Search, Sparkle, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGroupsToday } from "@/lib/group-today.functions";
import { crewPageCounts } from "@/lib/group-today-view";
import { newActivityUnreadOptions } from './social-query';
import { useMyPlans } from "@/components/plans/PlanBits";
import { beginNewCheckIn } from "@/lib/redesign-checkin";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { useClaimSharedWorkout } from "@/components/workout/useClaimSharedWorkout";
import { useOpenSharedPlan } from "@/components/plans/useOpenSharedPlan";
import { NewNotifBanner } from "./NewNotifBanner";

import { PostingStrip } from "./post/PostingStrip";

export function NewHome() {
  const navigate = useNavigate();
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  useStatusBarScrollToTop();
  useClaimSharedWorkout();
  useOpenSharedPlan();
  const { user } = useRouteContext({ from: "/_authenticated" });
  const { data, isLoading } = useQuery({ queryKey: ["groups-today"], queryFn: () => getGroupsToday(), staleTime: 30_000 });
  const { data: notifications } = useQuery(newActivityUnreadOptions);
  const plans = useMyPlans();
  const [hidePlan, setHidePlan] = useState(true);
  const userId = user.id;
  useEffect(() => {
    if (!userId) return;
    try { setHidePlan(localStorage.getItem(`pactara:home-plan:${userId}`) === "1"); } catch { setHidePlan(false); }
  }, [userId]);
  const hidePlanRow = () => {
    setHidePlan(true);
    if (userId) try { localStorage.setItem(`pactara:home-plan:${userId}`, "1"); } catch { /* private mode */ }
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
      <PostingStrip />
      {data && <NewNotifBanner crewNames={data.groups.map((g) => g.name)} />}
      <section aria-label="Today" className="mx-3 mt-3 rounded-[20px] bg-[var(--new-white)] px-3.5 py-1.5">
        {isLoading ? <div className="h-24 animate-pulse" aria-label="Loading crews" /> : data?.groups.length ? data.groups.map((group) => {
          const counts = crewPageCounts(group.members);
          const done = group.members.find((m) => m.isYou)?.status === "done";
          return <div key={group.id} className="flex items-center gap-3 border-b border-[var(--new-divider)] py-2.5 last:border-0">
            <Button variant="ghost" onClick={() => navigate({ to: "/crews/$groupId", params: { groupId: group.id } })} className="h-auto min-w-0 flex-1 justify-start gap-3 whitespace-normal p-0 text-left hover:bg-transparent">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--new-soft)] text-[var(--new-purple)]"><Users className="!size-5" /></span>
              <span className="min-w-0"><span className="block text-[15px] font-bold">{group.name} · day {group.dayNumber}</span><span className="block text-[12px] font-normal text-[var(--new-muted)]">{counts.done} of {counts.due} in today</span></span>
            </Button>
            {done ? <span className="flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-[18px] bg-[var(--new-green-soft)] px-3 text-[13px] font-bold text-[var(--new-green)]"><Check size={15} />You're in</span> : <Button variant="ghost" className="h-9 shrink-0 rounded-[18px] bg-[var(--new-purple)] px-3 text-[13px] font-bold text-[var(--new-white)] hover:bg-[var(--new-purple)]" onClick={() => { beginNewCheckIn(group.id, null); navigate({ to: "/check-in" }); }}>Check in</Button>}
          </div>;
        }) : <div className="flex items-center justify-between gap-2 py-4"><span className="text-[17px] font-extrabold">Start or join a crew</span><Button variant="ghost" className="h-10 rounded-full bg-[var(--new-soft)] text-[var(--new-purple-text)]" onClick={() => navigate({ to: "/new-pactara" })}>Start</Button></div>}
        {plans.isSuccess && !plans.data?.active && !hidePlan && <div className="flex items-center gap-3 border-t border-[var(--new-divider)] py-2.5">
          <span className="new-plan-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--new-white)]"><Sparkle size={20} /></span>
          <div className="min-w-0 flex-1"><p className="text-[15px] font-bold">Want a plan to follow?</p><p className="text-[12px] text-[var(--new-muted)]">4 quick questions, or browse plans</p></div>
          <Button variant="ghost" className="h-9 shrink-0 rounded-[18px] bg-[var(--new-soft)] px-3 text-[13px] font-bold text-[var(--new-purple)]" onClick={() => navigate({ to: "/find-plan" })}>Find one</Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-[var(--new-chevron)]" aria-label="Dismiss" onClick={hidePlanRow}><X className="!size-4" /></Button>
        </div>}
      </section>
    </div>
  );
}