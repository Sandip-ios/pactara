import { createFileRoute } from "@tanstack/react-router";
import { NewOnly } from "@/components/redesign/post/NewOnly";
import { NewPostEdit } from "@/components/redesign/post/NewPostEdit";

export const Route = createFileRoute("/_authenticated/post/edit")({
  head: () => ({ meta: [{ title: "Edit post · Pactara" }, { name: "description", content: "Trim, crop and order your post." }, { property: "og:title", content: "Edit post · Pactara" }, { property: "og:description", content: "Trim, crop and order your post." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <NewOnly><NewPostEdit /></NewOnly>,
});
