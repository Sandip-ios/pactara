import { createFileRoute } from "@tanstack/react-router";
import { NewOnly } from "@/components/redesign/post/NewOnly";
import { NewPostCompose } from "@/components/redesign/post/NewPostCompose";

export const Route = createFileRoute("/_authenticated/post/compose")({
  head: () => ({ meta: [{ title: "Share your post · Pactara" }, { name: "description", content: "Add a caption, a workout and who sees it." }, { property: "og:title", content: "Share your post · Pactara" }, { property: "og:description", content: "Add a caption, a workout and who sees it." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <NewOnly><NewPostCompose /></NewOnly>,
});
