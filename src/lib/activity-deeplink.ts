export const ACTIVITY_UNAVAILABLE = "This isn't available anymore";

export type ActivityDeepLinkKind =
  | "comment" | "reply" | "comment_like" | "reaction" | "checkin"
  | "nudge" | "reminder" | "crew_request" | "crew_approved"
  | "pact_signed" | "pact_restart" | "pact_complete" | "join"
  | "milestone" | "follow" | "follow_request" | "follow_accepted"
  | "message";

export type ActivityDeepLinkInput = {
  kind: ActivityDeepLinkKind;
  groupId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  actorId?: string | null;
  requestId?: string | null;
};

/** Indirect new-version links let a tap recheck that its target still exists. */
export function activityOpenUrl(input: ActivityDeepLinkInput): string {
  const params = new URLSearchParams({ kind: input.kind });
  if (input.groupId) params.set("group", input.groupId);
  if (input.postId) params.set("post", input.postId);
  if (input.commentId) params.set("comment", input.commentId);
  if (input.actorId) params.set("actor", input.actorId);
  if (input.requestId) params.set("request", input.requestId);
  return `/activity/open?${params.toString()}`;
}

/** The redesign's Posts tab, optionally with one comment targeted in its sheet. */
export function crewPostUrl(input: {
  groupId: string;
  postId: string;
  commentId?: string | null;
  fromActivity?: boolean;
}): string {
  const params = new URLSearchParams({ crewTab: "posts", post: input.postId });
  if (input.commentId) {
    params.set("comments", "1");
    params.set("comment", input.commentId);
  }
  if (input.fromActivity) params.set("from", "activity");
  return `/crews/${encodeURIComponent(input.groupId)}?${params.toString()}`;
}

export function withActivityGroup(url: string | undefined, groupId: string | null | undefined): string | undefined {
  if (!url || !groupId || !url.startsWith("/activity/open")) return url;
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.set("group", groupId);
  return `${path}?${params.toString()}`;
}

/** Row navigation remembers Activity in history; push navigation does not invent that history. */
export function withActivityReturn(href: string): string {
  const [path, query = ""] = href.split("?");
  if (path !== "/crews" && !path?.startsWith("/crews/")) return href;
  const params = new URLSearchParams(query);
  params.set("from", "activity");
  return `${path}?${params.toString()}`;
}

export function pushUrlForVersion(classicUrl: string | undefined, newUrl: string | undefined, isNew: boolean): string | undefined {
  return isNew ? (newUrl ?? classicUrl) : classicUrl;
}

/** Existing reminder copy keeps its classic URL; new members get the matching Activity target. */
export function inferredReminderActivityUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const [path, query = ""] = url.split("?");
  if (path !== "/check-in") return undefined;
  const groupId = new URLSearchParams(query).get("group");
  return groupId ? activityOpenUrl({ kind: "reminder", groupId }) : undefined;
}
