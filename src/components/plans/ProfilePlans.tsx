import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Dumbbell, Trophy } from "lucide-react";
import { MUTED, PURPLE, PURPLE_SOFT, useMyPlans } from "./PlanBits";

/** Own profile: the current plan (name + week) and finished plans under it. */
export function ProfilePlans() {
  const navigate = useNavigate();
  const { data } = useMyPlans();
  const active = data?.active ?? null;
  const completed = data?.completed ?? [];
  if (!active && completed.length === 0) return null;
  const open = (slug: string) => navigate({ to: "/plans/$slug", params: { slug } });

  return (
    <div className="mt-3 overflow-hidden rounded-2xl" style={{ background: "#FAF8F6" }}>
      {active && (
        <button type="button" onClick={() => open(active.slug)} className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: PURPLE_SOFT, color: PURPLE }}>
            <Dumbbell size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
              Current plan
            </span>
            <span className="block truncate text-[14px] font-semibold">
              {active.name} · Week {active.currentWeek} of {active.weeks}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-neutral-400" />
        </button>
      )}
      {completed.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => open(c.slug)}
          className="flex min-h-[44px] w-full items-center gap-3 border-t px-3 py-2 text-left"
          style={{ borderColor: "#F0EDE9" }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <Trophy size={15} style={{ color: MUTED }} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: MUTED }}>
            Completed · {c.name}
          </span>
        </button>
      ))}
    </div>
  );
}
