import { createFileRoute } from "@tanstack/react-router";
import { NewOnly } from "@/components/redesign/post/NewOnly";
import { NewOwnPost } from "@/components/redesign/post/NewOwnPost";

export const Route = createFileRoute("/_authenticated/post/$postId")({
  head: () => ({ meta: [{ title: "Post · Pactara" }, { name: "description", content: "A photo or video post on Pactara." }, { property: "og:title", content: "Post · Pactara" }, { property: "og:description", content: "A photo or video post on Pactara." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
function Page() {
  const { postId } = Route.useParams();
  return <NewOnly><NewOwnPost postId={postId} /></NewOnly>;
}
