import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MAX_GROUP_MEMBERS } from "./invite-resolver";
import { currentStreak, groupStreak, localDateIn, weeklyTarget } from "./streak-rules";
import { effectiveRequestStatus, type DiscoveryCrew } from "./crew-join";
import { signAvatarThumbs } from "./media-urls";
import { shownInFindACrew } from "./crew-discovery-rules";

type DB = SupabaseClient<Database>;
async function all<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw new Error("Couldn't load crews. Try again.");
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return out;
  }
}
export async function discoveryCrews(db: DB, viewerId: string, mode: "find" | "pending" | "preview", groupId?: string): Promise<DiscoveryCrew[]> {
  const [{ data: memberships }, { data: requests }, { data: blocks }] = await Promise.all([
    db.from("group_members").select("group_id").eq("user_id", viewerId),
    db.from("crew_join_requests").select("id,group_id,status,created_at").eq("requester_id", viewerId).order("created_at", { ascending: false }),
    db.from("user_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
  ]);
  const mine = new Set((memberships ?? []).map(m => m.group_id));
  const blocked = new Set((blocks ?? []).map(b => b.blocker_id === viewerId ? b.blocked_id : b.blocker_id));
  const pending = (requests ?? []).filter(r => effectiveRequestStatus(r.status as "pending", r.created_at) === "pending");
  let query = db.from("groups").select("id,name,about,owner_id,frequency,days_per_week,discoverable").is("ended_at", null).eq("kind", "group").order("created_at", { ascending: false });
  if (mode === "preview") {
    if (!groupId) return [];
    query = query.eq("id", groupId);
  } else if (mode === "pending") {
    if (!pending.length) return [];
    query = query.in("id", pending.map(r => r.group_id));
  } else query = query.eq("discoverable", true).limit(100);
  const { data: groups, error } = await query;
  if (error) throw new Error("Couldn't load crews. Try again.");
  const ownerIds = [...new Set((groups ?? []).map(g => g.owner_id))];
  const { data: owners } = ownerIds.length ? await db.from("profiles").select("id,new_version_enabled,app_version").in("id", ownerIds) : { data: [] };
  const ownerById = new Map((owners ?? []).map(o => [o.id, o]));
  const visible = (groups ?? []).filter(g => !blocked.has(g.owner_id) && (mode !== "find" || !mine.has(g.id)) && (mine.has(g.id) || pending.some(r => r.group_id === g.id) || shownInFindACrew(g.discoverable, ownerById.get(g.owner_id))));
  if (!visible.length) return [];
  const ids = visible.map(g => g.id);
  const roster = await all(db.from("group_members").select("group_id,user_id,joined_at").in("group_id", ids).order("joined_at").order("user_id"));
  const users = [...new Set([...roster.map(r => r.user_id), ...visible.map(g => g.owner_id)])];
  const { data: profiles } = await db.from("profiles").select("id,name,avatar_url,timezone").in("id", users);
  const byId = new Map((profiles ?? []).map(p => [p.id, p]));
  const [checks, freezes] = await Promise.all([
    all(db.from("check_ins").select("group_id,user_id,checkin_date").in("group_id", ids)),
    all(db.from("streak_freezes_used").select("group_id,user_id,freeze_date").in("group_id", ids)),
  ]);
  const previewMembers = visible.flatMap(g => roster.filter(r => r.group_id === g.id).sort((a,b) => Number(b.user_id === g.owner_id) - Number(a.user_id === g.owner_id)).slice(0,4));
  const signed = await signAvatarThumbs(db, previewMembers.map(m => byId.get(m.user_id)?.avatar_url), 128);
  const backend = process.env["SUPABASE_URL"] ?? "";
  const browser = import.meta.env.VITE_SUPABASE_URL;
  const avatar = (id: string) => {
    const path = byId.get(id)?.avatar_url;
    const url = path ? signed.get(path) ?? (path.startsWith("https://") ? path : null) : null;
    return url && backend && browser ? url.replace(backend, browser) : url;
  };
  const first = (id: string) => byId.get(id)?.name.trim().split(/\s+/)[0] || "Member";
  const viewer = await db.from("profiles").select("timezone").eq("id", viewerId).maybeSingle();
  const today = localDateIn(viewer.data?.timezone ?? "UTC");
  return visible.map(g => {
    const members = roster.filter(r => r.group_id === g.id);
    const requested = pending.find(r => r.group_id === g.id);
    const streakMembers = members.map(m => ({ joinedOn: localDateIn(byId.get(m.user_id)?.timezone ?? "UTC", new Date(m.joined_at)), kept: new Set([...checks.filter(c => c.group_id === g.id && c.user_id === m.user_id).map(c => c.checkin_date), ...freezes.filter(f => f.group_id === g.id && f.user_id === m.user_id).map(f => f.freeze_date)]) }));
    return { id: g.id, name: g.name, about: g.about, memberCount: members.length, limit: MAX_GROUP_MEMBERS, daysPerWeek: weeklyTarget(g), crewStreak: groupStreak(streakMembers, today), ownerFirstName: first(g.owner_id), members: members.sort((a,b) => Number(b.user_id === g.owner_id) - Number(a.user_id === g.owner_id)).slice(0,4).map(m => ({ firstName: first(m.user_id), avatarUrl: avatar(m.user_id), isOwner: m.user_id === g.owner_id })), requestId: requested?.id ?? null, requested: Boolean(requested), isMember: mine.has(g.id) };
  });
}
export async function requesterProfiles(db: DB, ids: string[]) {
  if (!ids.length) return new Map<string, { name: string; avatarUrl: string | null; streak: number }>();
  const [{ data: profiles }, checks, freezes] = await Promise.all([
    db.from("profiles").select("id,name,avatar_url,timezone").in("id", ids),
    all(db.from("check_ins").select("user_id,checkin_date").in("user_id", ids)),
    all(db.from("streak_freezes_used").select("user_id,freeze_date").in("user_id", ids)),
  ]);
  const signed = await signAvatarThumbs(db, (profiles ?? []).map(p => p.avatar_url), 128);
  return new Map((profiles ?? []).map(p => [p.id, { name: p.name, avatarUrl: p.avatar_url ? (signed.get(p.avatar_url) ?? null)?.replace(process.env["SUPABASE_URL"] ?? "", import.meta.env.VITE_SUPABASE_URL) ?? null : null, streak: currentStreak(new Set([...checks.filter(c => c.user_id === p.id).map(c => c.checkin_date), ...freezes.filter(f => f.user_id === p.id).map(f => f.freeze_date)]), localDateIn(p.timezone ?? "UTC")) }]));
}