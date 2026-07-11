import { createFileRoute } from "@tanstack/react-router";
import { TrialEndedPaywall } from "@/components/TrialEndedPaywall";

export const Route = createFileRoute("/paywall-preview")({
  ssr: false,
  component: () => (
    <TrialEndedPaywall firstName="Alex" mode="intro" onDismiss={() => {}} />
  ),
});
