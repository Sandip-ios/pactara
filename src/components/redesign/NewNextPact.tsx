import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ChevronLeft, Minus, Plus } from "lucide-react";
import { newToastApi as toast } from "./new-toast";
import { getGroupsToday } from "@/lib/group-today.functions";
import { startNextPact } from "@/lib/pact-cycle.functions";
import { PACT_LENGTHS, nextPactStartLabel, notifyNamesLine } from "@/lib/pact-cycle";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useToastAbove } from "@/lib/toast-offset";
import { pactStatusOptions } from "./pact-query";

const INK = "#1C1917", MUTED = "#57534E";
const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const Label = ({ children }: { children: string }) => <p className="mt-6 text-[13px] font-extrabold uppercase" style={{ color: MUTED, letterSpacing: "0.5px" }}>{children}</p>;

export function NewNextPact({ groupId }: { groupId: string }) {
  useHideBottomTabs(true, false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  const actionRef = useRef<HTMLButtonElement>(null);
  const { data: status } = useQuery(pactStatusOptions(groupId));
  const { data: today } = useQuery({ queryKey: ["groups-today"], queryFn: () => getGroupsToday(), staleTime: 30_000 });
  const start = useServerFn(startNextPact);
  const group = today?.groups.find((g) => g.id === groupId);
  useToastAbove(actionRef, !!status && !!group && status.isOwner && status.done);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [perWeek, setPerWeek] = useState(7);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!status) return;
    setDays(status.duration === 60 || status.duration === 90 ? status.duration : 30);
    setPerWeek(status.daysPerWeek);
  }, [status?.duration, status?.daysPerWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!status || !group) return <div className="fixed inset-0" style={{ background: "#F4F2EF" }} aria-label="Loading" />;
  const back = () => navigate({ to: "/crews/$groupId", params: { groupId } });
  if (!status.isOwner || !status.done) {
    return (
      <div className="fixed inset-0 px-4 pt-new-top" style={{ background: "#F4F2EF", fontFamily: "Inter, system-ui, sans-serif" }}>
        <button type="button" aria-label="Back" onClick={back} className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#FFFFFF" }}><ChevronLeft size={22} /></button>
        <p className="mt-6 rounded-[20px] bg-white p-5 text-center text-[16px] font-bold">{status.isOwner ? "This pact is still going." : "Only the person who runs the crew starts the next pact."}</p>
      </div>
    );
  }
  const startDay = status.today;
  const others = group.members.filter((m) => !m.isYou).map((m) => first(m.name));
  const go = async () => {
    setBusy(true);
    try {
      await start({ data: { groupId, durationDays: days, daysPerWeek: perWeek } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pact-status", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["groups-today"] }),
        queryClient.invalidateQueries({ queryKey: ["home-crew", groupId] }),
      ]);
      toast.success(`New ${days}-day pact started.`);
      back();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the pact. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "#F4F2EF", color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
      <header className="relative flex shrink-0 items-center bg-white px-4 pb-3 pt-new-top">
        <button type="button" aria-label="Back" onClick={() => window.history.length > 1 ? window.history.back() : back()} className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#F4F2EF" }}><ChevronLeft size={22} /></button>
        <h1 className="pointer-events-none absolute inset-x-0 bottom-3 flex h-11 items-center justify-center text-[17px] font-bold">Next pact</h1>
      </header>
      <main ref={scrollRef} data-scroll-root className="min-h-0 flex-1 overflow-y-auto overscroll-none px-4 pb-6">
        <h2 className="mt-5 text-[28px] font-extrabold leading-tight">Keep {group.name} going</h2>
        <p className="mt-2 text-[15px] leading-[1.45]" style={{ color: MUTED }}>Streaks, members and goals carry over. Everyone can set a new goal.</p>
        <Label>How long</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PACT_LENGTHS.map((o) => {
            const on = days === o.days;
            return (
              <button key={o.days} type="button" aria-pressed={on} onClick={() => setDays(o.days)} className="rounded-[16px] px-2 py-3 text-center" style={on ? { background: "#EDE4FF", border: "2px solid #7C3AED", color: "#6D28D9" } : { background: "#FFFFFF", border: "1px solid #E7E3DE", margin: 1 }}>
                <span className="block text-[17px] font-extrabold">{o.days} days</span>
                <span className="mt-0.5 block text-[13px]" style={{ color: on ? "#6D28D9" : MUTED }}>{o.sub}</span>
              </button>
            );
          })}
        </div>
        <Label>Workouts a week</Label>
        <div className="mt-2 flex h-[52px] items-center justify-between rounded-[16px] bg-white px-4">
          <span className="text-[16px] font-normal" style={{ color: INK }}>{perWeek === status.daysPerWeek ? "Same as now" : `Changed from ${status.daysPerWeek}`}</span>
          <div className="-mr-3 flex items-center gap-4">
            <button type="button" aria-label="Fewer workouts" disabled={perWeek <= 1} onClick={() => setPerWeek((n) => Math.max(1, n - 1))} className="-mr-3 flex h-11 w-11 items-center justify-center" style={{ color: perWeek <= 1 ? "#D6D3D1" : INK }}><Minus size={20} /></button>
            <span className="w-6 text-center text-[20px] font-extrabold">{perWeek}</span>
            <button type="button" aria-label="More workouts" disabled={perWeek >= 7} onClick={() => setPerWeek((n) => Math.min(7, n + 1))} className="-ml-3 flex h-11 w-11 items-center justify-center" style={{ color: perWeek >= 7 ? "#D6D3D1" : INK }}><Plus size={20} /></button>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-2.5 px-1 text-[14px] leading-[1.45]" style={{ color: MUTED }}>
          <Bell size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{notifyNamesLine(others)}</span>
        </div>
      </main>
      <div className="shrink-0 px-6 pt-3" style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom), 16px) + 24px)" }}>
        <button ref={actionRef} type="button" disabled={busy} onClick={() => void go()} className="h-[52px] w-full rounded-[26px] text-[17px] font-bold text-white disabled:opacity-60" style={{ background: "#7C3AED" }}>
          {busy ? "Starting…" : `Start ${nextPactStartLabel(startDay)}`}
        </button>
      </div>
    </div>
  );
}
