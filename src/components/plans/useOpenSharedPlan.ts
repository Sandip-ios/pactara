import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { takePendingSharedPlan } from "@/lib/pending-shared-plan";

/**
 * A shared-plan link opened while signed out: once the member reaches Home
 * (after signup, onboarding and the paywall, or after signing in), open that
 * plan's page with its start button ready. Never starts the plan.
 */
export function useOpenSharedPlan() {
  const navigate = useNavigate();
  useEffect(() => {
    const slug = takePendingSharedPlan();
    if (slug) void navigate({ to: "/plans/$slug", params: { slug } });
  }, [navigate]);
}
