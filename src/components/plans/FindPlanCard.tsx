import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";

/** "Not sure? Find your plan": the one card that opens the quiz. Used on Discover and the Workouts tab. */
export function FindPlanCard() {
  return (
    <Link
      to="/find-plan"
      className="flex items-center gap-3 rounded-[16px] p-[14px]"
      style={{ background: "#EDE7FB" }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: "#7C3AED" }} aria-hidden>
        <Sparkles size={22} color="#FFFFFF" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-extrabold" style={{ color: "#4C1D95" }}>
          Not sure? Find your plan
        </span>
        <span className="text-[13px] font-medium" style={{ color: "#5B21B6" }}>
          4 quick questions, then we pick for you
        </span>
      </span>
      <ChevronRight size={20} className="shrink-0" style={{ color: "#5B21B6" }} aria-hidden />
    </Link>
  );
}
