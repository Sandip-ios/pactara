/**
 * Comment media rules shared by the server, the feed preview and notifications.
 * A comment needs words, an attachment, or both; text is capped at 1,000 characters.
 */
export type CommentMediaKind = "photo" | "gif" | "video";

export const COMMENT_MAX_LENGTH = 1000;

export function commentMediaKind(url: string | null | undefined, type: string | null | undefined): CommentMediaKind | null {
  if (!url) return null;
  const t = (type ?? "").toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t === "image/gif" || /\.gif(\?|$)/i.test(url) || /giphy|tenor/i.test(url)) return "gif";
  if (!t && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url)) return "video";
  return "photo";
}

/** "sent a GIF" / "sent a photo" / "sent a video", shown after the person's name. */
export function mediaOnlyCommentLine(kind: CommentMediaKind): string {
  return kind === "gif" ? "sent a GIF" : kind === "video" ? "sent a video" : "sent a photo";
}

/** Why a comment can't be saved, or null when it can. */
export function commentProblem(body: string, mediaUrl: string | null): string | null {
  if (!body && !mediaUrl) return "Comment cannot be empty";
  if (body.length > COMMENT_MAX_LENGTH) return "Comment is too long";
  return null;
}

/** Push for a new comment: "{Name} commented" with the text, or "{Name} sent a GIF" when there is none. */
export function commentPush(name: string, body: string, kind: CommentMediaKind | null): { title: string; body: string } {
  if (body) return { title: `${name} commented`, body: body.slice(0, 120) };
  return { title: `${name} ${mediaOnlyCommentLine(kind ?? "photo")}`, body: "Tap to see it" };
}
