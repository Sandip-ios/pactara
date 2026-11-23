import { useQuery } from "@tanstack/react-query";
import { getCrewOnPlan, getCrewPlans, getMyPlans, listPlans } from "@/lib/plans.functions";
import type { Plan, PlanGoal } from "@/lib/workout-plans";

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
