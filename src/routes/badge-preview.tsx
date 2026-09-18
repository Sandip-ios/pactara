import { createFileRoute } from "@tanstack/react-router";
import { BadgeUnlockedModal } from "@/components/BadgeUnlockedModal";

export const Route = createFileRoute("/badge-preview")({
  head: () => ({
    meta: [
      { title: "Streak Celebration | Pactara" },
      { name: "description", content: "Preview a Pactara streak milestone celebration." },
      { property: "og:title", content: "Streak Celebration | Pactara" },
      { property: "og:description", content: "Preview a Pactara streak milestone celebration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: () => <BadgeUnlockedModal badges={[3]} onClose={() => {}} />,
});
