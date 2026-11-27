import { createFileRoute } from "@tanstack/react-router";
import { NewOnly } from "@/components/redesign/post/NewOnly";
import { NewCheckInPost } from "@/components/redesign/NewCheckInPost";
export const Route = createFileRoute("/_authenticated/check-ins/$checkInId")({
  head: () => ({
    meta: [
      { title: "Shared check-in · Pactara" },
      { name: "description", content: "A check-in shared with you on Pactara." },
      { property: "og:title", content: "Shared check-in · Pactara" },
      { property: "og:description", content: "A check-in shared with you on Pactara." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const { checkInId } = Route.useParams();
    return (
      <NewOnly>
        <NewCheckInPost id={checkInId} />
      </NewOnly>
    );
  },
});
