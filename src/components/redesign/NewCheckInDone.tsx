import { Award, Check, Flame, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GroupToday } from "@/lib/group-today.functions";
import { doneCrewLine, nextCheckInBadge } from "@/lib/redesign-checkin";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { useOpenAtTop } from "@/lib/use-open-at-top";

export function NewCheckInDone({ groups, streak, onDone, onNote }: { groups: GroupToday[]; streak: number; onDone: () => void; onNote: () => void }) {
  useHideBottomTabs(true, false);
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  const crew = groups[0];
  const crewStreak = crew?.groupStreak ?? 0;
  const badge = nextCheckInBadge(streak);
  return <div ref={scrollRef} data-scroll-root className="redesign-step3 fixed inset-0 z-40 overflow-y-auto bg-[var(--new-bg)] px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[max(72px,calc(max(env(safe-area-inset-top),44px)+12px))] text-[var(--new-ink)]">
    <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--new-green-soft)] text-[var(--new-green)]"><Check size={38} strokeWidth={3} /></div>
    <h1 className="mt-4 text-center text-[30px] font-extrabold">You're in</h1>
    <p className="mt-2 text-center text-[16px] leading-[1.45] text-[var(--new-muted)]">{doneCrewLine(groups)}</p>
    <div className="mt-6 grid grid-cols-2 gap-2.5">
      <div className="rounded-[20px] bg-[var(--new-orange-soft)] p-4 text-[var(--new-orange-strong)]"><Flame size={24} className="text-[var(--new-orange)]" /><p className="mt-2 text-[28px] font-extrabold">{streak} {streak === 1 ? "day" : "days"}</p><p className="mt-1 text-[13px] font-bold text-[var(--new-orange)]">{streak === 1 ? "Your streak starts today" : `Your streak, up from ${Math.max(0, streak - 1)}`}</p></div>
      <div className="rounded-[20px] bg-[var(--new-lavender)] p-4 text-[var(--new-deep)]"><Users size={24} className="text-[var(--new-purple-text)]" /><p className="mt-2 text-[28px] font-extrabold">{crewStreak} {crewStreak === 1 ? "day" : "days"}</p><p className="mt-1 text-[13px] font-bold text-[var(--new-purple-text)]">{crew?.memberCount === 1 ? "Invite people to grow it" : `${crewStreak ? "Crew streak grows when" : "Starts when"} all ${crew?.memberCount ?? 0} are in`}</p></div>
    </div>
    {badge && <div className="mt-3 flex items-center gap-3 rounded-[20px] bg-[var(--new-white)] px-4 py-3.5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--new-blue-soft)] text-[var(--new-blue)]"><Award size={22} /></span><p className="text-[15px]"><strong>{badge.remaining} more days</strong> to your <strong>{badge.milestone}-day badge</strong></p></div>}
    <Button variant="ghost" onClick={onDone} className="mt-6 h-[52px] w-full rounded-[26px] bg-[var(--new-purple)] text-[17px] font-bold text-[var(--new-white)] hover:bg-[var(--new-purple)]">Done</Button>
    <Button variant="ghost" onClick={onNote} className="mt-3 h-[52px] w-full rounded-[26px] bg-[var(--new-soft)] text-[15px] font-bold text-[var(--new-purple-text)]"><MessageCircle className="!size-5" />Add a note for the crew</Button>
  </div>;
}