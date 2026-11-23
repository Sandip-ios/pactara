import { useQuery } from "@tanstack/react-query";
import { getCrewOnPlan, getCrewPlans, getMyPlans, listPlans } from "@/lib/plans.functions";
import { useState } from "react";
import type { Plan } from "@/lib/workout-plans";
import { coverThumb, type GoalTileKey } from "@/lib/plan-filters";

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

export const GOAL_TILE: Record<GoalTileKey, { tint: string; ink: string }> = {
  muscle: { tint: "#EDE7FB", ink: "#4C1D95" },
  fat_loss: { tint: "#FFF1E7", ink: "#7C2D12" },
  glutes: { tint: "#FCE7F3", ink: "#831843" },
  strength: { tint: "#E7EEF7", ink: "#1E3A5F" },
  beginner: { tint: "#E8F6EC", ink: "#14532D" },
  run: { tint: "#FEF9C3", ink: "#713F12" },
  home: { tint: "#EEF2FF", ink: "#312E81" },
  mobility: { tint: "#E3F4F1", ink: "#134E4A" },
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

/** Discover plan card: cover photo, YOUR PLAN pill, name, schedule, short gear and level. */
export function PlanCard({ plan, onOpen, mine = false }: { plan: Plan; onOpen: () => void; mine?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = coverThumb(plan.coverUrl);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-[16px] bg-white p-[10px] text-left transition-transform active:scale-[0.99]"
    >
      <span className="block h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[12px]" style={{ background: GOAL_TILE[plan.goal]?.tint ?? P.tile }}>
        {src && !failed && (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
            data-plan-cover={plan.slug}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
        {mine && (
          <span
            className="rounded-full px-2 py-[2px] text-[11px] font-extrabold tracking-[0.3px]"
            style={{ background: "#EDE7FB", color: "#5B21B6" }}
          >
            YOUR PLAN
          </span>
        )}
        <span className="text-[16px] font-bold leading-tight" style={{ color: P.ink }}>
          {plan.name}
        </span>
        <span className="text-[13px]" style={{ color: P.stoneDark }}>
          {plan.weeks} weeks · {plan.daysPerWeek} days a week · {plan.minutes} min
        </span>
        <span className="text-[12px] font-semibold" style={{ color: P.stone }}>
          {plan.gearShort ?? gearText(plan)} · {plan.level}
        </span>
      </span>
    </button>
  );
}
