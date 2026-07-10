import { createFileRoute } from "@tanstack/react-router";
import { BadgeUnlockedModal } from "@/components/BadgeUnlockedModal";

export const Route = createFileRoute("/badge-preview")({
  ssr: false,
  component: () => <BadgeUnlockedModal badges={[1]} onClose={() => {}} />,
});
