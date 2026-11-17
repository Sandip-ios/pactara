/**
 * Feed deep links: /home?group=<groupId>&post=<postId>[&comments=1]
 *
 * The feed shows one group at a time. A notification about another group must
 * carry that group's id so tapping it switches the feed instead of leaving the
 * user in whichever group they were last viewing.
 */
export type FeedDeepLink = { group?: string; post?: string; comments: boolean };

/** Add (or replace) the group on a /home link. Other links are returned as-is. */
export function withFeedGroup(url: string, groupId: string | null | undefined): string {
  if (!groupId) return url;
  const [path, query = ""] = url.split("?");
  if (path !== "/home") return url;
  const params = new URLSearchParams(query);
  params.delete("group");
  const rest = params.toString();
  return `/home?group=${encodeURIComponent(groupId)}${rest ? `&${rest}` : ""}`;
}

export function feedUrl(opts: { groupId?: string | null; postId?: string | null; comments?: boolean }): string {
  const params = new URLSearchParams();
  if (opts.groupId) params.set("group", opts.groupId);
  if (opts.postId) params.set("post", opts.postId);
  if (opts.comments) params.set("comments", "1");
  const q = params.toString();
  return q ? `/home?${q}` : "/home";
}

export function parseFeedDeepLink(search: string): FeedDeepLink {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    group: params.get("group") || undefined,
    post: params.get("post") || undefined,
    comments: params.get("comments") === "1",
  };
}
