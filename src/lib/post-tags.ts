/** Pure tag rules for library posts. The database (`can_tag_user`) enforces the same rules. */
import type { AudienceKind } from "./post-audience";

export type TagCandidate = {
  id: string;
  /** Active crews this person shares with the author. */
  sharedCrewIds: string[];
  authorFollows: boolean;
  followsAuthor: boolean;
  under18: boolean;
  blockedEitherWay: boolean;
  newVersion: boolean;
};
export type TagAuthor = { id: string; under18: boolean; isPrivate: boolean };

/** Only people who would see the post with this audience can be tagged. */
export function canTag(author: TagAuthor, audience: { kind: AudienceKind; crewIds: string[] }, c: TagCandidate): boolean {
  if (c.id === author.id || audience.kind === "only_me" || c.blockedEitherWay || !c.newVersion) return false;
  const inCrew = audience.kind === "everyone" ? c.sharedCrewIds.length > 0 : c.sharedCrewIds.some((id) => audience.crewIds.includes(id));
  if (inCrew) return true;
  if (audience.kind !== "everyone") return false;
  // Outside crews, adults and under-18 members never interact.
  if (author.under18 !== c.under18) return false;
  return c.authorFollows && (!author.isPrivate || c.followsAuthor);
}

export type TaggablePerson = { id: string; name: string; username: string | null; avatar: string | null; avatarColor: string | null; section: "crew" | "follow"; crew: string | null };

/** "Your crews" then "People you follow"; someone in both shows once under crews; search matches name or username. */
export function tagSections(people: TaggablePerson[], query: string) {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const seen = new Set<string>();
  const crew: TaggablePerson[] = [];
  const follow: TaggablePerson[] = [];
  for (const p of [...people.filter((x) => x.section === "crew"), ...people.filter((x) => x.section === "follow")]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (q && !p.name.toLowerCase().includes(q) && !(p.username ?? "").toLowerCase().includes(q)) continue;
    (p.section === "crew" ? crew : follow).push(p);
  }
  return { crew, follow };
}

/** Audience changed: keep only tags for people still taggable. Only me clears everything. */
export function pruneTags(tags: string[], audience: AudienceKind, allowedIds: string[] | null): string[] {
  if (audience === "only_me") return [];
  if (!allowedIds) return tags;
  return tags.filter((t) => allowedIds.includes(t));
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "Member";

/** Composer row trailing text: "Kemi", "Kemi, Chris", "Kemi, Chris +1". */
export function tagRowLabel(names: string[]): string {
  const f = names.map(first);
  if (!f.length) return "";
  return f.length <= 2 ? f.join(", ") : `${f.slice(0, 2).join(", ")} +${f.length - 2}`;
}

export type WithPart = { text: string; bold: boolean };
/** Post header: "with Chris", "with Chris and Kemi", "with Chris and 2 others"; the viewer comes first as "you". */
export function withLineParts(tagged: { id: string; name: string }[], viewerId: string | null): WithPart[] {
  if (!tagged.length) return [];
  const sorted = [...tagged.filter((t) => t.id === viewerId), ...tagged.filter((t) => t.id !== viewerId)];
  const label = (t: { id: string; name: string }) => (t.id === viewerId ? "you" : first(t.name));
  const out: WithPart[] = [{ text: "with ", bold: false }, { text: label(sorted[0]!), bold: true }];
  if (sorted.length === 2) out.push({ text: " and ", bold: false }, { text: label(sorted[1]!), bold: true });
  if (sorted.length > 2) out.push({ text: " and ", bold: false }, { text: `${sorted.length - 1} others`, bold: true });
  return out;
}
export const withLineText = (tagged: { id: string; name: string }[], viewerId: string | null) => withLineParts(tagged, viewerId).map((p) => p.text).join("");

/** One notification per person per post: only tags never notified before. */
export function tagsToNotify(tags: { userId: string; notifiedAt: string | null }[]): string[] {
  return [...new Set(tags.filter((t) => !t.notifiedAt).map((t) => t.userId))];
}

/** Tag pushes need push on and Tags on (default on); the Activity row shows either way. */
export function tagPushAllowed(prefs: { push_enabled?: boolean | null; tags_enabled?: boolean | null } | null): boolean {
  if (!prefs) return true;
  return prefs.push_enabled !== false && prefs.tags_enabled !== false;
}

/** Remove me: shown only to a tagged viewer who isn't the author. */
export function canRemoveMe(post: { authorId: string; taggedIds: string[] }, viewerId: string): boolean {
  return post.authorId !== viewerId && post.taggedIds.includes(viewerId);
}
export function removeMe<T extends { id: string }>(tagged: T[], viewerId: string): T[] {
  return tagged.filter((t) => t.id !== viewerId);
}

export function tagPushText(authorName: string, caption: string) {
  const c = caption.trim().replace(/\s+/g, " ");
  return { title: `${authorName.trim() || "Someone"} tagged you`, body: c.length > 120 ? `${c.slice(0, 119).trimEnd()}…` : c || "Tap to see the post" };
}
