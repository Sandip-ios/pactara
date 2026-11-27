import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isVideoPath, signGridThumbs } from "./media-urls";
import { crewPostUrl } from "./activity-deeplink";
import { SAVED_PAGE_SIZE, keepVisible, mergeSaved, type SavedRef, type SavedTile } from "./saved-posts";

type Row = Record<string, unknown>;
const sb = (c: unknown) => c as SupabaseClient;

/** Save or unsave a check-in. RLS only allows your own rows on check-ins you can see. */
export const toggleCheckInSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; on: boolean }) => ({ id: String(input.id), on: !!input.on }))
  .handler(async ({ context, data }) => {
    const t = sb(context.supabase).from("check_in_saves");
    const { error } = data.on
      ? await t.upsert({ check_in_id: data.id, user_id: context.userId }, { onConflict: "user_id,check_in_id", ignoreDuplicates: true })
      : await t.delete().eq("check_in_id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ids of check-ins you saved (still visible to you), for the feed bookmark state. */
export const getMySavedCheckInIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await sb(context.supabase).from("check_in_saves").select("check_in_id").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1000);
    return ((data ?? []) as Row[]).map((r) => r["check_in_id"] as string);
  });

/** Saved › Posts: your saved posts and check-ins, newest saved first, 30 per page. */
export const getSavedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { before?: string | null } | undefined) => ({ before: input?.before ? String(input.before) : null }))
  .handler(async ({ context, data }): Promise<{ items: SavedTile[]; nextBefore: string | null }> => {
    const supabase = sb(context.supabase);
    const me = context.userId;
    // Over-fetch so rows skipped as gone or hidden rarely shorten a page.
    const take = SAVED_PAGE_SIZE * 2;
    let ps = supabase.from("social_post_saves").select("post_id, created_at").eq("user_id", me).order("created_at", { ascending: false }).limit(take);
    let cs = supabase.from("check_in_saves").select("check_in_id, created_at").eq("user_id", me).order("created_at", { ascending: false }).limit(take);
    if (data.before) { ps = ps.lt("created_at", data.before); cs = cs.lt("created_at", data.before); }
    const [{ data: postSaves }, { data: ciSaves }] = await Promise.all([ps, cs]);
    const postRefs: SavedRef[] = ((postSaves ?? []) as Row[]).map((r) => ({ kind: "post", id: r["post_id"] as string, savedAt: r["created_at"] as string }));
    const ciRefs: SavedRef[] = ((ciSaves ?? []) as Row[]).map((r) => ({ kind: "checkin", id: r["check_in_id"] as string, savedAt: r["created_at"] as string }));
    const postIds = postRefs.map((r) => r.id);
    const ciIds = ciRefs.map((r) => r.id);

    // Both reads run under RLS, so deleted or no-longer-visible items simply don't come back.
    const [{ data: posts }, { data: items }, { data: checkIns }] = await Promise.all([
      postIds.length ? supabase.from("social_posts").select("id, caption, workout, status").in("id", postIds).eq("status", "live") : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("social_post_items").select("post_id, kind, path, poster_path, position").in("post_id", postIds).order("position") : Promise.resolve({ data: [] }),
      ciIds.length ? supabase.rpc("get_new_home_checkins", { _ids: ciIds }).then(({ data, error }) => { if (error) throw new Error("Could not load saved check-ins"); return { data: ((data ?? []) as Row[]).map(c => ({ id: c["id"], user_id: c["userId"], group_id: c["groupId"], checkin_date: c["localDate"], photo_url: c["photoUrl"], note: c["note"], day_post_id: c["postId"] })) }; }) : Promise.resolve({ data: [] }),
    ]);
    const postById = new Map(((posts ?? []) as Row[]).map((p) => [p["id"] as string, p]));
    const ciById = new Map(((checkIns ?? []) as Row[]).map((c) => [c["id"] as string, c]));
    const visible = new Set([...[...postById.keys()].map((id) => `post:${id}`), ...[...ciById.keys()].map((id) => `checkin:${id}`)]);
    const { page, more } = mergeSaved(keepVisible(postRefs, visible), keepVisible(ciRefs, visible));

    const pagePostIds = new Set(page.filter((r) => r.kind === "post").map((r) => r.id));
    const itemsByPost = new Map<string, Row[]>();
    for (const i of (items ?? []) as Row[]) {
      const id = i["post_id"] as string;
      if (!pagePostIds.has(id)) continue;
      itemsByPost.set(id, [...(itemsByPost.get(id) ?? []), i]);
    }
    const pageCis = page.filter((r) => r.kind === "checkin").flatMap((r) => { const c = ciById.get(r.id); return c ? [c] : []; });
    const { data: memberships } = await supabase.from("group_members").select("group_id").eq("user_id", me);
    const ownCrews = new Set((memberships ?? []).map(m => m["group_id"] as string));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Day post ids, so a check-in tile opens its exact card in the crew feed.
    const dayKeys = new Map<string, string>();
    if (pageCis.length) {
      const { data: days } = await supabase.from("daily_posts").select("id, user_id, group_id, local_date, check_in_id")
        .in("user_id", [...new Set(pageCis.map((c) => c["user_id"] as string))])
        .in("group_id", [...new Set(pageCis.map((c) => c["group_id"] as string))])
        .in("local_date", [...new Set(pageCis.map((c) => c["checkin_date"] as string))]);
      for (const d of (days ?? []) as Row[]) {
        dayKeys.set(`${d["user_id"]}|${d["group_id"]}|${d["local_date"]}`, d["id"] as string);
        if (d["check_in_id"]) dayKeys.set(`ci|${d["check_in_id"]}`, d["id"] as string);
      }
    }

    const postFirst = (id: string) => (itemsByPost.get(id) ?? [])[0];
    const postsBucketPaths = [...pagePostIds].map((id) => postFirst(id)).flatMap((i) => (i ? [(i["kind"] === "video" ? i["poster_path"] : i["path"]) as string | null] : [])).filter((p): p is string => !!p);
    const [postUrls, ciUrls] = await Promise.all([
      (async () => {
        const out = new Map<string, string>();
        await Promise.all(postsBucketPaths.map(async (path) => {
          const { data: s } = await supabase.storage.from("posts").createSignedUrl(path, 60 * 60, { transform: { width: 360, height: 450, resize: "cover", quality: 75 } });
          if (s?.signedUrl) out.set(path, s.signedUrl);
        }));
        return out;
      })(),
      signGridThumbs(supabaseAdmin, pageCis.map((c) => c["photo_url"] as string | null)),
    ]);

    const tiles: SavedTile[] = page.map((ref) => {
      if (ref.kind === "post") {
        const p = postById.get(ref.id);
        if (!p) throw new Error("Saved post unavailable");
        const list = itemsByPost.get(ref.id) ?? [];
        const first = list[0];
        const path = first ? ((first["kind"] === "video" ? first["poster_path"] : first["path"]) as string | null) : null;
        const workout = (p["workout"] ?? null) as { title?: string } | null;
        return { kind: "post", id: ref.id, savedAt: ref.savedAt, thumbUrl: path ? postUrls.get(path) ?? null : null, video: first?.["kind"] === "video", multi: list.length > 1, workout: !!workout, href: `/post/${ref.id}`, label: (p["caption"] as string) || workout?.title || "Saved post" };
      }
      const c = ciById.get(ref.id);
      if (!c) throw new Error("Saved check-in unavailable");
      const photo = (c["photo_url"] as string | null) ?? null;
      const groupId = c["group_id"] as string;
      const dayId = dayKeys.get(`ci|${ref.id}`) ?? dayKeys.get(`${c["user_id"]}|${groupId}|${c["checkin_date"]}`);
      const href = !ownCrews.has(groupId) ? `/check-ins/${ref.id}` : dayId ? crewPostUrl({ groupId, postId: dayId, checkInId: ref.id }) : `/crews/${groupId}?crewTab=posts`;
      return { kind: "checkin", id: ref.id, savedAt: ref.savedAt, thumbUrl: photo ? (photo.startsWith("http") ? photo : ciUrls.get(photo) ?? null) : null, video: !!photo && isVideoPath(photo), multi: false, workout: false, href, label: (c["note"] as string) || "Saved check-in" };
    });
    return { items: tiles, nextBefore: more ? page[page.length - 1]?.savedAt ?? null : null };
  });
