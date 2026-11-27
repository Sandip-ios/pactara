export type CommentPreview = { id: string; userId: string; name: string; body: string; at: string };

/** Earliest readable comment, independent of query order. Blocked pairs are excluded. */
export function firstVisibleComment<T extends CommentPreview>(comments: readonly T[], blocked: ReadonlySet<string> = new Set()): T | null {
  return comments.filter(c => !blocked.has(c.userId)).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))[0] ?? null;
}