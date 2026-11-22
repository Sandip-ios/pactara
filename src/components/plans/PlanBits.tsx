import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { getCrewPlans, getMyPlans, listPlans } from "@/lib/plans.functions";
import { dayMinutes, type Plan, type PlanDay, type PlanMove } from "@/lib/workout-plans";

export const BG = "#F5F2EE";
export const PURPLE = "#7C3AED";
export const PURPLE_SOFT = "#EFE9FB";
export const INK = "#0A0A0A";
export const MUTED = "#78716C";
export const FONT = "Inter, system-ui, sans-serif";

export function usePlans() {
  return useQuery({ queryKey: ["plans"], queryFn: () => listPlans(), staleTime: 10 * 60_000 });
}

export function useMyPlans() {
  return useQuery({ queryKey: ["my-plans"], queryFn: () => getMyPlans(), staleTime: 30_000 });
}

export function useCrewPlans() {
  return useQuery({ queryKey: ["crew-plans"], queryFn: () => getCrewPlans(), staleTime: 60_000 });
}

export function gearText(plan: Pick<Plan, "gear">): string {
  return plan.gear.length ? plan.gear.join(" · ") : "No equipment";
}

/** Browse list card. */
export function PlanCard({ plan, onOpen }: { plan: Plan; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[20px] bg-white p-4 text-left shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
        {plan.weeks} weeks
      </div>
      <div className="mt-1 text-[18px] font-black tracking-tight" style={{ color: INK }}>
        {plan.name}
      </div>
      <div className="mt-0.5 text-[14px]" style={{ color: MUTED }}>
        {plan.daysPerWeek} days a week · {plan.minutes} min
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip>{plan.level}</Chip>
        <Chip>{gearText(plan)}</Chip>
      </div>
    </button>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: BG, color: "#44403C" }}>
      {children}
    </span>
  );
}

/** Moves with dose and the plain-English how-to. */
export function MoveList({ moves }: { moves: PlanMove[] }) {
  return (
    <ol className="divide-y" style={{ borderColor: "#F0EDE9" }}>
      {moves.map((m, i) => (
        <li key={`${m.name}-${i}`} className="py-3 first:pt-0 last:pb-0" style={{ borderColor: "#F0EDE9" }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold" style={{ color: INK }}>
              {m.name}
            </span>
            <span className="shrink-0 text-right text-[13px] font-semibold" style={{ color: PURPLE }}>
              {m.dose}
            </span>
          </div>
          <p className="mt-1 text-[14px] leading-snug" style={{ color: MUTED }}>
            {m.plain}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Read-only preview of one day (browsing is free). */
export function DayPreviewSheet({
  plan,
  day,
  week,
  onClose,
}: {
  plan: Plan;
  day: PlanDay | null;
  week: number;
  onClose: () => void;
}) {
  return (
    <Drawer open={!!day} onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="p-0 pb-[max(env(safe-area-inset-bottom),16px)]">
        {day && (
          <>
            <DrawerHeader className="px-4 pb-2 pt-3 text-left">
              <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
                Day {day.dayNumber}
                {day.weekNumber ? ` · Week ${week}` : ""}
              </div>
              <DrawerTitle className="text-[22px] font-black tracking-tight">{day.title}</DrawerTitle>
              <DrawerDescription className="text-[14px]" style={{ color: MUTED }}>
                {day.moves.length} {day.moves.length === 1 ? "move" : "moves"} · {dayMinutes(day, plan)} min
                {day.note ? ` · ${day.note}` : ""}
              </DrawerDescription>
            </DrawerHeader>
            <div className="max-h-[60dvh] overflow-y-auto px-4 pb-2 pt-2">
              <MoveList moves={day.moves} />
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
