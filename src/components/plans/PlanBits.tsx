import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { getCrewOnPlan, getCrewPlans, getMyPlans, listPlans } from "@/lib/plans.functions";
import {
  dayMinutes,
  moveGroup,
  movesForWeek,
  type MoveGroup,
  type Plan,
  type PlanDay,
  type PlanGoal,
  type PlanMove,
} from "@/lib/workout-plans";
import { BodyMap } from "./BodyMap";

export const BG = "#F5F2EE";
export const PURPLE = "#7C3AED";
export const PURPLE_SOFT = "#EFE9FB";
export const INK = "#0A0A0A";
export const MUTED = "#78716C";
export const FONT = "Inter, system-ui, sans-serif";

/** Plan screens palette (from the approved designs). */
export const P = {
  discoverBg: "#F4F2EF",
  pageBg: "#F5F2EE",
  ink: "#141218",
  stone: "#57534E",
  stoneDark: "#44403C",
  line: "#E7E3DE",
  purple: "#7C3AED",
  violet: "#6D28D9",
  violetDeep: "#4C1D95",
  violetText: "#5B21B6",
  violetTint: "#F5F0FF",
  tile: "#F7F5F2",
  chevron: "#A8A29E",
} as const;

export const GOAL_TILE: Record<PlanGoal, { tint: string; ink: string }> = {
  muscle: { tint: "#EDE7FB", ink: "#4C1D95" },
  fat_loss: { tint: "#FFF1E7", ink: "#7C2D12" },
  glutes: { tint: "#FCE7F3", ink: "#831843" },
  beginner: { tint: "#E8F6EC", ink: "#14532D" },
  home: { tint: "#EEF2FF", ink: "#312E81" },
  run: { tint: "#FEF9C3", ink: "#713F12" },
};

const PLAN_BADGE: Record<string, { tint: string; ink: string }> = {
  "build-muscle": { tint: "#EDE7FB", ink: "#5B21B6" },
  "lose-fat": { tint: "#FFF1E7", ink: "#9A3412" },
  "glute-builder": { tint: "#FCE7F3", ink: "#9D174D" },
  "walk-strength": { tint: "#E8F6EC", ink: "#166534" },
  "home-no-equipment": { tint: "#EEF2FF", ink: "#3730A3" },
  "first-5k": { tint: "#FEF9C3", ink: "#854D0E" },
};
export const planBadge = (slug: string) => PLAN_BADGE[slug] ?? { tint: "#EDE7FB", ink: "#5B21B6" };

const MOVE_TILE: Record<MoveGroup, { tint: string; ink: string }> = {
  CH: { tint: "#EDE7FB", ink: "#5B21B6" },
  SH: { tint: "#EEF2FF", ink: "#3730A3" },
  BK: { tint: "#E8F6EC", ink: "#166534" },
  LG: { tint: "#FEF9C3", ink: "#854D0E" },
  AR: { tint: "#FFF1E7", ink: "#9A3412" },
  CO: { tint: "#E0F2FE", ink: "#075985" },
  GL: { tint: "#FCE7F3", ink: "#9D174D" },
};

export function usePlans() {
  return useQuery({ queryKey: ["plans"], queryFn: () => listPlans(), staleTime: 10 * 60_000 });
}

export function useMyPlans() {
  return useQuery({ queryKey: ["my-plans"], queryFn: () => getMyPlans(), staleTime: 30_000 });
}

export function useCrewPlans() {
  return useQuery({ queryKey: ["crew-plans"], queryFn: () => getCrewPlans(), staleTime: 60_000 });
}

export function useCrewOnPlan(planId: string | null) {
  return useQuery({
    queryKey: ["crew-on-plan", planId],
    queryFn: () => getCrewOnPlan({ data: { planId: planId! } }),
    enabled: !!planId,
    staleTime: 60_000,
  });
}

export function gearText(plan: Pick<Plan, "gear">): string {
  return plan.gear.length ? plan.gear.join(" · ") : "No equipment";
}

/** Discover plan row: WEEKS badge, name, schedule, short gear and level. */
export function PlanRow({ plan, onOpen }: { plan: Plan; onOpen: () => void }) {
  const badge = planBadge(plan.slug);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-3 rounded-[16px] bg-white p-[14px] text-left transition-transform active:scale-[0.99]"
    >
      <span
        className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[14px] leading-none"
        style={{ background: badge.tint, color: badge.ink }}
      >
        <span className="text-[18px] font-extrabold">{plan.weeks}</span>
        <span className="mt-[3px] text-[10px] font-bold">WEEKS</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[16px] font-extrabold" style={{ color: P.ink }}>
          {plan.name}
        </span>
        <span className="text-[13px]" style={{ color: P.stoneDark }}>
          {plan.daysPerWeek} days a week · {plan.minutes} min
        </span>
        <span className="text-[12px] font-semibold" style={{ color: P.stone }}>
          {plan.gearShort ?? gearText(plan)} · {plan.level}
        </span>
      </span>
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

/** Moves with dose and the plain-English how-to (plan day screen). */
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
  lighter,
  onClose,
}: {
  plan: Plan;
  day: PlanDay | null;
  week: number;
  lighter: boolean;
  onClose: () => void;
}) {
  const moves = day ? movesForWeek(day.moves, lighter) : [];
  return (
    <Drawer open={!!day} onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent
        className="max-h-[92dvh] rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]"
        style={{ fontFamily: FONT, color: P.ink }}
      >
        {day && (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-4">
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
                <span className="text-[12px] font-bold" style={{ color: P.violet }}>
                  WEEK {week} · DAY {day.dayNumber}
                </span>
                <DrawerTitle className="text-[22px] font-extrabold leading-tight tracking-tight">{day.title}</DrawerTitle>
                <DrawerDescription className="text-[13px]" style={{ color: P.stone }}>
                  {day.moves.length} {day.moves.length === 1 ? "move" : "moves"} · {dayMinutes(day, plan)} min
                  {lighter ? " · Lighter week" : ""}
                  {day.note ? ` · ${day.note}` : ""}
                </DrawerDescription>
              </div>
              <span className="flex shrink-0 items-center justify-center rounded-[16px] p-1.5" style={{ background: P.tile }}>
                <BodyMap muscles={day.muscles} width={120} height={114} />
              </span>
            </div>
            <ol className="rounded-[16px]" style={{ border: `1.5px solid ${P.line}` }}>
              {moves.map((m, i) => {
                const g = moveGroup(m.name);
                const t = MOVE_TILE[g];
                return (
                  <li
                    key={`${m.name}-${i}`}
                    className="flex gap-3 p-3"
                    style={{ borderTop: i ? `1px solid ${P.line}` : undefined }}
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-extrabold"
                      style={{ background: t.tint, color: t.ink }}
                      aria-hidden
                    >
                      {g}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-bold">{m.name}</span>
                        <span className="shrink-0 text-right text-[13px] font-bold" style={{ color: P.violet }}>
                          {m.dose}
                        </span>
                      </span>
                      <span className="text-[13px] leading-snug" style={{ color: P.stone }}>
                        {m.plain}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              onClick={onClose}
              className="h-12 w-full shrink-0 rounded-full bg-white text-[15px] font-bold"
              style={{ border: `1.5px solid ${P.line}`, color: P.ink }}
            >
              Close
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
