import { createFileRoute } from "@tanstack/react-router";
import { NewOnly } from "@/components/redesign/post/NewOnly";
import { NewPostPicker } from "@/components/redesign/post/NewPostPicker";

export const Route = createFileRoute("/_authenticated/post/new")({
  head: () => ({ meta: [{ title: "New post · Pactara" }, { name: "description", content: "Post a photo or video from your library." }, { property: "og:title", content: "New post · Pactara" }, { property: "og:description", content: "Post a photo or video from your library." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <NewOnly><NewPostPicker /></NewOnly>,
});
