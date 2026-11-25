import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Dumbbell, Trophy } from "lucide-react";
import { MUTED, useMyPlans } from "./PlanBits";
import { Button } from '@/components/ui/button';
import '@/components/profile/profile.css';

/** Own profile: the current plan (name + week) and finished plans under it. */
export function ProfilePlans() {
  const navigate = useNavigate();
  const { data } = useMyPlans();
  const active = data?.active ?? null;
  const completed = data?.completed ?? [];
  if (!active && completed.length === 0) return null;
  const open = (slug: string) => navigate({ to: "/plans/$slug", params: { slug } });

  return (
    <div className="profile-plan overflow-hidden">
      {active && (
        <Button variant="ghost" onClick={() => open(active.slug)} className="profile-control profile-plan-row">
          <span className="profile-plan-icon">
            <Dumbbell size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="profile-plan-label">
              Current plan
            </span>
            <span className="profile-plan-name block">
              {active.name} · Week {active.currentWeek} of {active.weeks}
            </span>
          </span>
          <ChevronRight size={18} className="profile-plan-chevron" />
        </Button>
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
