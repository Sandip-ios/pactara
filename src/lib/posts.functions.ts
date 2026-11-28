import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bestExerciseMatch, parseCaptionMoves } from "./caption-workout";
import type { AudienceKind, PostAudience } from "./post-audience";
import type { TaggablePerson } from "./post-tags";
import { isUnder18 } from "./redesign-profile";
import { signAvatarThumbs } from "./media-urls";
import { stabilizeSignedUrls } from "./stable-urls";
import type { PostItemInput, PostWorkout, PostWorkoutChoice, PostWorkoutMove, SocialPostView } from "./social-post-types";

/*
 * Camera-roll posts. These live only in social_posts and never write
 * check_ins, daily_posts, streaks, badges or crew check-in pushes.
 */

const BUCKET = "posts";
type Row = Record<string, unknown>;
const sb = (c: unknown) => c as SupabaseClient;
const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "Member";

async function myCrews(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("group_members")
    .select("group_id, joined_at, groups!inner(id, name, ended_at, group_members(count))")
    .eq("user_id", userId)
    .is("groups.ended_at", null)
    .order("joined_at", { ascending: true });
  return ((data ?? []) as unknown as { group_id: string; groups: { name: string; group_members: { count: number }[] } }[]).map((r) => ({ id: r.group_id, name: r.groups.name, members: r.groups.group_members?.[0]?.count ?? 0 }));
}

async function exerciseMap(supabase: SupabaseClient, ids: string[]) {
  const map = new Map<string, { name: string; image_start: string | null; log_type: string | null }>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return map;
  const { data } = await supabase.from("exercises").select("id, name, image_start, log_type").in("id", unique);
  for (const e of (data ?? []) as Row[]) map.set(e["id"] as string, { name: e["name"] as string, image_start: (e["image_start"] as string) ?? null, log_type: (e["log_type"] as string) ?? null });
  return map;
}

/** Sets and reps only; weight columns are never selected. */
async function snapshotWorkout(supabase: SupabaseClient, userId: string, choice: PostWorkoutChoice): Promise<{ workout: PostWorkout | null; sessionId: string | null; workoutId: string | null; creditUserId: string | null }> {
  if (!choice) return { workout: null, sessionId: null, workoutId: null, creditUserId: null };
  if (choice.source === "caption") {
    const moves: PostWorkoutMove[] = choice.moves.slice(0, 20).map((m) => ({
      exerciseId: m.exerciseId, name: m.name, imageStart: m.imageStart, logType: "reps",
      sets: Array.from({ length: Math.max(1, Math.min(20, m.sets)) }, () => ({ reps: m.reps, seconds: null, isPr: false })),
    }));
    return { workout: { source: "caption", title: "Workout", minutes: 0, sets: moves.reduce((n, m) => n + m.sets.length, 0), prCount: 0, moves }, sessionId: null, workoutId: null, creditUserId: null };
  }
  if (choice.source === "session") {
    const { data: s } = await supabase.from("workout_sessions").select("id, title, summary, workout_id").eq("id", choice.id).eq("user_id", userId).maybeSingle();
    if (!s) throw new Error("Workout not found");
    const { data: logs } = await supabase.from("workout_set_logs").select("exercise_id, position, set_no, reps, seconds, is_pr").eq("session_id", choice.id).eq("user_id", userId).order("position").order("set_no");
    const ex = await exerciseMap(supabase, ((logs ?? []) as Row[]).map((l) => l["exercise_id"] as string));
    const moves: PostWorkoutMove[] = [];
    for (const l of (logs ?? []) as Row[]) {
      const id = l["exercise_id"] as string;
      let m = moves[moves.length - 1];
      if (!m || m.exerciseId !== id) {
        const e = ex.get(id);
        m = { exerciseId: id, name: e?.name ?? "Exercise", imageStart: e?.image_start ?? null, logType: e?.log_type === "timed" ? "timed" : "reps", sets: [] };
        moves.push(m);
      }
      m.sets.push({ reps: (l["reps"] as number) ?? null, seconds: (l["seconds"] as number) ?? null, isPr: !!l["is_pr"] });
    }
    const summary = (s["summary"] ?? null) as { minutes?: number; prs?: unknown[] } | null;
    let creditUserId: string | null = null;
    if (s["workout_id"]) {
      const { data: w } = await supabase.from("workouts").select("source_user_id").eq("id", s["workout_id"] as string).maybeSingle();
      creditUserId = (w?.["source_user_id"] as string | null) ?? null;
    }
    return {
      workout: { source: "session", title: (s["title"] as string) || "Workout", minutes: summary?.minutes ?? 0, sets: moves.reduce((n, m) => n + m.sets.length, 0), prCount: summary?.prs?.length ?? 0, moves },
      sessionId: choice.id, workoutId: (s["workout_id"] as string) ?? null, creditUserId: creditUserId && creditUserId !== userId ? creditUserId : null,
    };
  }
  const { data: w } = await supabase.from("workouts").select("id, name, exercises, source_user_id").eq("id", choice.id).eq("user_id", userId).maybeSingle();
  if (!w) throw new Error("Workout not found");
  const list = ((w["exercises"] ?? []) as { exerciseId: string; sets?: number; reps?: number | null; seconds?: number | null }[]);
  const ex = await exerciseMap(supabase, list.map((x) => x.exerciseId));
  const moves: PostWorkoutMove[] = list.map((x) => {
    const e = ex.get(x.exerciseId);
    const timed = e?.log_type === "timed" || (!x.reps && !!x.seconds);
    return { exerciseId: x.exerciseId, name: e?.name ?? "Exercise", imageStart: e?.image_start ?? null, logType: timed ? "timed" : "reps",
      sets: Array.from({ length: Math.max(1, x.sets ?? 1) }, () => ({ reps: timed ? null : (x.reps ?? null), seconds: timed ? (x.seconds ?? null) : null, isPr: false })) };
  });
  const { data: last } = await supabase.from("workout_sessions").select("summary").eq("user_id", userId).eq("workout_id", choice.id).not("logged_at", "is", null).order("logged_at", { ascending: false }).limit(1).maybeSingle();
  const summary = (last?.["summary"] ?? null) as { minutes?: number; prs?: unknown[] } | null;
  const credit = (w["source_user_id"] as string | null) ?? null;
  return {
    workout: { source: "saved", title: (w["name"] as string) || "Workout", minutes: summary?.minutes ?? 0, sets: moves.reduce((n, m) => n + m.sets.length, 0), prCount: summary?.prs?.length ?? 0, moves },
    sessionId: null, workoutId: choice.id, creditUserId: credit && credit !== userId ? credit : null,
  };
}

/** Crews, the under-18 rule and workouts to attach, for the composer. */
export const getPostComposeContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = sb(context.supabase);
    const { userId } = context;
    const [crews, { data: prof }, { data: sessions }, { data: saved }] = await Promise.all([
      myCrews(supabase, userId),
      supabase.rpc("get_my_app_prefs"),
      supabase.from("workout_sessions").select("id, title, summary, logged_at").eq("user_id", userId).not("logged_at", "is", null).order("logged_at", { ascending: false }).limit(10),
      supabase.from("workouts").select("id, name, exercises").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
    ]);
    const prefs = prof?.[0];
    const { data: remembered } = await supabase.rpc("get_my_post_audience");
    const savedIds = ((saved ?? []) as Row[]).flatMap(w => ((w["exercises"] ?? []) as { exerciseId: string }[]).map(x => x.exerciseId));
    const drawings = await exerciseMap(supabase, savedIds);
    const sessionDrawings = await Promise.all(((sessions ?? []) as Row[]).map(async s => {
      const { data: log } = await supabase.from("workout_set_logs").select("exercise_id").eq("session_id", s["id"]).order("position").limit(1).maybeSingle();
      const map = await exerciseMap(supabase, log ? [log["exercise_id"]] : []);
      return log ? map.get(log["exercise_id"])?.image_start ?? null : null;
    }));
    return {
      userId,
      crews,
      isPrivate: prefs?.["is_private"] !== false,
      remembered: remembered as PostAudience | null,
      under18: isUnder18((prefs?.["birthday"] as string | null) ?? null),
      sessions: ((sessions ?? []) as Row[]).map((s, i) => {
        const sum = (s["summary"] ?? {}) as { exercises?: number; sets?: number; minutes?: number };
        return { id: s["id"] as string, title: (s["title"] as string) || "Workout", loggedAt: s["logged_at"] as string, imageStart: sessionDrawings[i] ?? null, exercises: sum.exercises ?? 0, sets: sum.sets ?? 0, minutes: sum.minutes ?? 0 };
      }),
      saved: ((saved ?? []) as Row[]).map((w) => {
        const list = (w["exercises"] ?? []) as { exerciseId: string; sets?: number }[];
        return { id: w["id"] as string, title: (w["name"] as string) || "Workout", imageStart: list[0] ? drawings.get(list[0].exerciseId)?.image_start ?? null : null, exercises: list.length, sets: list.reduce((n, x) => n + (x.sets ?? 1), 0) };
      }),
    };
  });

/** Exercises named in the caption, matched to the library. */
export const matchCaptionWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caption: string }) => ({ caption: String(input?.caption ?? "").slice(0, 2200) }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const moves = parseCaptionMoves(data.caption).slice(0, 12);
    const out: { exerciseId: string; name: string; imageStart: string | null; sets: number; reps: number }[] = [];
    for (const m of moves) {
      const word = m.query.split(" ").sort((a, b) => b.length - a.length)[0]?.replace(/s$/i, "") ?? "";
      if (word.length < 3) continue;
      const { data: rows } = await supabase.from("exercises").select("id, name, image_start, owner_id").ilike("name", `%${word}%`).or(`owner_id.is.null,owner_id.eq.${context.userId}`).limit(40);
      const best = bestExerciseMatch(m.query, ((rows ?? []) as Row[]).map((r) => ({ id: r["id"] as string, name: r["name"] as string, image: (r["image_start"] as string) ?? null })));
      if (best && !out.some((o) => o.exerciseId === best.id)) out.push({ exerciseId: best.id, name: best.name, imageStart: best.image, sets: m.sets, reps: m.reps });
    }
    return { moves: out };
  });

/** What the Share workout card shows before posting. */
export const getShareWorkoutPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workoutId?: string | null; sessionId?: string | null }) => ({ workoutId: input?.workoutId ?? null, sessionId: input?.sessionId ?? null }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const choice: PostWorkoutChoice = data.sessionId ? { source: "session", id: data.sessionId } : data.workoutId ? { source: "saved", id: data.workoutId } : null;
    const snap = await snapshotWorkout(supabase, context.userId, choice);
    let credit: string | null = null;
    let creditAvatar: string | null = null;
    if (snap.creditUserId) {
      const { data: p } = await supabase.from("profiles").select("name, avatar_url").eq("id", snap.creditUserId).maybeSingle();
      credit = (p?.["name"] as string | null)?.trim() || "Member";
      const avatar = (p?.["avatar_url"] as string | null) ?? null;
      if (avatar) creditAvatar = avatar.startsWith("http") ? avatar : (await signAvatarThumbs(supabase, [avatar], 96)).get(avatar) ?? null;
    }
    return { workout: snap.workout, title: snap.workout?.title ?? "Workout", minutes: snap.workout?.minutes ?? 0, sets: snap.workout?.sets ?? 0, prs: snap.workout?.prCount ?? 0, credit, creditAvatar };
  });

/** Step 1 of posting: one atomic insert (audience, crews, items) while media uploads. */
export const createSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caption: string; audience: AudienceKind; crewIds: string[]; items: PostItemInput[]; workout: PostWorkoutChoice; commentsOn: boolean; tags: string[]; skipDiscover: boolean; mealId?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const snap = await snapshotWorkout(supabase, context.userId, data.workout);
    const items = (data.items ?? []).slice(0, 10).map((i) => ({
      kind: i.kind, path: i.path, poster_path: i.posterPath, duration_s: i.duration, trim_start: i.trimStart, trim_end: i.trimEnd,
      muted: i.muted, cover_s: i.cover, crop: i.crop,
    }));
    const args = {
      _caption: (data.caption ?? "").slice(0, 2200), _audience: data.audience, _group_ids: data.crewIds ?? [], _items: items,
      _workout: snap.workout, _workout_session_id: snap.sessionId, _workout_id: snap.workoutId, _credit_user_id: snap.creditUserId,
      _comments_on: data.commentsOn !== false, _tags: data.tags ?? [], _skip_discover: !!data.skipDiscover,
    };
    const { data: id, error } = data.mealId ? await supabase.rpc("create_library_meal_post", { ...args, _meal_id: data.mealId }) : await supabase.rpc("create_library_post_v2", args);
    if (error || !id) throw new Error(error?.message ?? "Couldn't post");
    if (!items.length) { await notifyCredit(supabase, context.userId, id as string); await notifyTags(supabase, context.userId, id as string); }
    return { id: id as string };
  });

async function notifyCredit(supabase: SupabaseClient, userId: string, postId: string) {
  const { data: p } = await supabase.from("social_posts").select("credit_user_id, workout, audience").eq("id", postId).maybeSingle();
  const credit = p?.["credit_user_id"] as string | null;
  if (!credit || p?.["audience"] === "only_me") return;
  const { data: visible } = await supabase.rpc("can_see_social_post", { _post_id: postId, _viewer: credit });
  if (!visible) return;
  try {
    const { data: me } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
    const { pushToUsers } = await import("./notify.server");
    const title = ((p?.["workout"] ?? {}) as { title?: string }).title ?? "your workout";
    await pushToUsers([credit], { title: "Pactara", body: `${firstName(me?.["name"] as string | null)} posted ${title} and credited you`, url: `/post/${postId}`, actorUserId: userId } as Parameters<typeof pushToUsers>[1]);
  } catch (e) {
    console.error("[posts] credit push failed", e);
  }
}

/** Claims never-notified tags of a live post (one push per person per post) and pushes those with Tags on. */
async function notifyTags(supabase: SupabaseClient, userId: string, postId: string) {
  try {
    const { data: claimed } = await supabase.rpc("claim_social_post_tag_pushes", { _post_id: postId });
    const ids = ((claimed ?? []) as unknown[]).map((x) => (typeof x === "string" ? x : (x as Row)["claim_social_post_tag_pushes"] as string)).filter(Boolean);
    if (!ids.length) return;
    const [{ data: me }, { data: post }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
      supabase.from("social_posts").select("caption").eq("id", postId).maybeSingle(),
    ]);
    const { tagPushText } = await import("./post-tags");
    const { notifyUsers } = await import("./notify.server");
    const text = tagPushText((me?.["name"] as string | null) ?? "", (post?.["caption"] as string | null) ?? "");
    await notifyUsers(ids, { ...text, url: `/post/${postId}`, newUrl: `/post/${postId}`, actorUserId: userId } as Parameters<typeof notifyUsers>[1], "tags_enabled");
  } catch (e) {
    console.error("[posts] tag push failed", e);
  }
}

/** Step 2: media is up (live) or failed (Retry). */
export const finalizeSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; ok: boolean }) => ({ id: String(input.id), ok: !!input.ok }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { error } = await supabase.from("social_posts").update({ status: data.ok ? "live" : "failed" }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    if (data.ok) { await notifyCredit(supabase, context.userId, data.id); await notifyTags(supabase, context.userId, data.id); }
    return { ok: true };
  });

/** Your own posts, newest first (profile Posts). */
export const getMySocialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = sb(context.supabase);
    const { data } = await supabase.from("social_posts").select("*").eq("user_id", context.userId).neq("status", "failed").order("pinned_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(60);
    return stabilizeSignedUrls(await (await import("./social-post-load.server")).loadSocialPostsForViewer(supabase, context.userId, (data ?? []) as Row[]));
  });

/** Someone's live posts you're allowed to see (their profile Posts grid). RLS decides visibility, blocks included. */
export const getMemberSocialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { target: string }) => ({ target: String(input?.target ?? "") }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { data: rows } = await supabase.from("social_posts").select("*").eq("user_id", data.target).eq("status", "live").order("pinned_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(60);
    return stabilizeSignedUrls(await (await import("./social-post-load.server")).loadSocialPostsForViewer(supabase, context.userId, (rows ?? []) as Row[]));
  });

export const getSocialPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { data: row } = await supabase.from("social_posts").select("*").eq("id", data.id).maybeSingle();
    if (!row) return null;
    const [post] = await (await import("./social-post-load.server")).loadSocialPostsForViewer(supabase, context.userId, [row as Row]);
    return stabilizeSignedUrls(post ?? null);
  });

/** Live posts shared to this crew since a date (the crew Posts tab). */
export const getCrewSocialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; since: string }) => ({ groupId: String(input.groupId), since: String(input.since) }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { data: links } = await supabase.from("social_post_crews").select("post_id").eq("group_id", data.groupId).limit(500);
    const ids = ((links ?? []) as Row[]).map((l) => l["post_id"] as string);
    if (!ids.length) return [];
    const { data: rows } = await supabase.from("social_posts").select("*").in("id", ids).eq("status", "live").neq("audience", "only_me").gte("created_at", data.since).order("created_at", { ascending: false }).limit(100);
    return stabilizeSignedUrls(await (await import("./social-post-load.server")).loadSocialPostsForViewer(supabase, context.userId, (rows ?? []) as Row[]));
  });

/** Home feed: your own posts plus live posts shared to any of your crews, newest first, 20 a page. */
export const getHomeSocialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { before?: string | null }) => ({ before: input?.before ? String(input.before) : null }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { data: members } = await supabase.from("group_members").select("group_id").eq("user_id", context.userId);
    const groupIds = ((members ?? []) as Row[]).map((m) => m["group_id"] as string);
    const { data: links } = groupIds.length ? await supabase.from("social_post_crews").select("post_id").in("group_id", groupIds).limit(1000) : { data: [] };
    const crewIds = [...new Set(((links ?? []) as Row[]).map((l) => l["post_id"] as string))];
    let own = supabase.from("social_posts").select("*").eq("user_id", context.userId).neq("status", "failed");
    if (data.before) own = own.lt("created_at", data.before);
    const ownReq = own.order("created_at", { ascending: false }).limit(20);
    let crewReq = null as null | PromiseLike<{ data: unknown[] | null }>;
    if (crewIds.length) {
      let q = supabase.from("social_posts").select("*").in("id", crewIds).eq("status", "live").neq("audience", "only_me");
      if (data.before) q = q.lt("created_at", data.before);
      crewReq = q.order("created_at", { ascending: false }).limit(20);
    }
    const [{ data: mine }, crew] = await Promise.all([ownReq, crewReq ?? Promise.resolve({ data: [] as unknown[] })]);
    const byId = new Map<string, Row>();
    for (const r of [...((mine ?? []) as Row[]), ...((crew.data ?? []) as Row[])]) byId.set(r["id"] as string, r);
    const rows = [...byId.values()].sort((a, b) => String(b["created_at"]).localeCompare(String(a["created_at"]))).slice(0, 20);
    const posts = stabilizeSignedUrls(await (await import("./social-post-load.server")).loadSocialPostsForViewer(supabase, context.userId, rows));
    return { posts, next: rows.length === 20 ? (rows.at(-1)?.["created_at"] as string) : null };
  });

export const updateSocialPostCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; caption: string }) => ({ id: String(input.id), caption: String(input.caption ?? "").slice(0, 2200) }))
  .handler(async ({ context, data }) => {
    const { error } = await sb(context.supabase).from("social_posts").update({ caption: data.caption }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSocialPostContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; caption: string; workout: PostWorkoutChoice; keepWorkout?: boolean; mealId?: string | null }) => ({ id: String(input.id), caption: String(input.caption ?? "").slice(0, 2200), workout: input.workout, keepWorkout: input.keepWorkout === true, mealId: input.mealId }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    // Caption-only edits must not rebuild the posted snapshot from a changed template.
    const result = data.keepWorkout
      ? await supabase.from("social_posts").update({ caption: data.caption }).eq("id", data.id).eq("user_id", context.userId)
      : await (async () => {
        const snap = await snapshotWorkout(supabase, context.userId, data.workout);
        return supabase.rpc("set_social_post_content", { _post_id: data.id, _caption: data.caption, _workout: snap.workout, _workout_session_id: snap.sessionId, _workout_id: snap.workoutId, _credit_user_id: snap.creditUserId });
      })();
    const { error } = result;
    if (error) throw new Error(error.message);
    if (data.mealId !== undefined) {
      const { updatePostMealAttachment } = await import("./meals.server");
      await updatePostMealAttachment({ supabase, userId: context.userId }, data.id, data.mealId);
    }
    return { ok: true };
  });

export const toggleSocialPostPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; on: boolean }) => ({ id: String(input.id), on: !!input.on }))
  .handler(async ({ context, data }) => {
    const { error } = await sb(context.supabase).rpc("set_social_post_pin", { _post_id: data.id, _pinned: data.on });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { data: items } = await supabase.from("social_post_items").select("path, poster_path").eq("post_id", data.id);
    const { error } = await supabase.from("social_posts").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const paths = ((items ?? []) as Row[]).flatMap((i) => [i["path"], i["poster_path"]]).filter((p): p is string => typeof p === "string" && p.startsWith(`${context.userId}/`));
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    return { ok: true };
  });

export const toggleSocialPostCheer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; on: boolean }) => ({ id: String(input.id), on: !!input.on }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const t = supabase.from("social_post_cheers");
    const { error } = data.on ? await t.upsert({ post_id: data.id, user_id: context.userId }) : await t.delete().eq("post_id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSocialPostSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; on: boolean }) => ({ id: String(input.id), on: !!input.on }))
  .handler(async ({ context, data }) => {
    const t = sb(context.supabase).from("social_post_saves");
    const { error } = data.on ? await t.upsert({ post_id: data.id, user_id: context.userId }) : await t.delete().eq("post_id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSocialPostComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { data: rows } = await supabase.from("social_post_comments").select("id, user_id, body, created_at").eq("post_id", data.id).order("created_at").limit(200);
    const ids = [...new Set(((rows ?? []) as Row[]).map((r) => r["user_id"] as string))];
    const { data: people } = ids.length ? await supabase.from("profiles").select("id, name").in("id", ids) : { data: [] };
    const names = new Map(((people ?? []) as Row[]).map((p) => [p["id"] as string, (p["name"] as string) || "Member"]));
    return ((rows ?? []) as Row[]).map((r) => ({ id: r["id"] as string, name: r["user_id"] === context.userId ? "You" : names.get(r["user_id"] as string) ?? "Member", body: r["body"] as string, at: r["created_at"] as string }));
  });

export const addSocialPostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; body: string }) => ({ id: String(input.id), body: String(input.body ?? "").trim().slice(0, 1000) }))
  .handler(async ({ context, data }) => {
    if (!data.body) throw new Error("Write something first");
    const { error } = await sb(context.supabase).from("social_post_comments").insert({ post_id: data.id, user_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** People you can tag for this audience: crewmates of the chosen crews, plus people you follow for Everyone. The database rechecks every rule. */
export const getTaggablePeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audience: AudienceKind; crewIds: string[] }) => ({ audience: input?.audience ?? "only_me", crewIds: (input?.crewIds ?? []).map(String) }))
  .handler(async ({ context, data }) => {
    if (data.audience === "only_me") return [];
    const supabase = sb(context.supabase);
    const { data: rows, error } = await supabase.rpc("get_taggable_people", { _audience: data.audience, _group_ids: data.crewIds });
    if (error) throw new Error("Couldn't load people");
    const people = (rows ?? []) as unknown as TaggablePerson[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const avatars = await signAvatarThumbs(supabaseAdmin, people.map((p) => p.avatar));
    return people.map((p) => ({ ...p, avatar: p.avatar ? (p.avatar.startsWith("http") ? p.avatar : avatars.get(p.avatar) ?? null) : null }));
  });

/** Edit tags on your post: existing tags keep their notified state; only newly added people get a push. */
export const setSocialPostTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; tags: string[] }) => ({ id: String(input.id), tags: (input.tags ?? []).map(String).slice(0, 50) }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { error } = await supabase.rpc("set_social_post_tags", { _post_id: data.id, _tags: data.tags });
    if (error) throw new Error(error.message);
    await notifyTags(supabase, context.userId, data.id);
    return { ok: true };
  });

/** Remove me from this post: no confirm, the author isn't told. */
export const removeMeFromSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const { error } = await sb(context.supabase).rpc("remove_me_from_social_post", { _post_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Audience edits are atomic and recheck ownership, membership, age and video limits. */
export const updateSocialPostAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; audience: PostAudience }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await sb(context.supabase).rpc("set_social_post_audience", { _post_id: data.id, _audience: data.audience.kind, _group_ids: data.audience.crewIds });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Caption editor additions use the same exercise library, with no weight fields. */
export const searchPostExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => ({ query: String(input.query ?? "").replace(/[%_,()]/g, "").slice(0, 80) }))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await sb(context.supabase).from("exercises").select("id, name, image_start").or(`owner_id.is.null,owner_id.eq.${context.userId}`).ilike("name", `%${data.query}%`).order("name").limit(30);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Row[]).map(r => ({ exerciseId: r["id"] as string, name: r["name"] as string, imageStart: r["image_start"] as string | null, sets: 3, reps: 10 }));
  });

/** Activity rows for posts you're tagged in. Read live, so a removed tag, deleted, hidden or blocked post drops out. */
export const getTagActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = sb(context.supabase);
    const { data: tags } = await supabase.from("social_post_tags").select("post_id, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(60);
    const ids = ((tags ?? []) as Row[]).map((t) => t["post_id"] as string);
    if (!ids.length) return [];
    const [{ data: posts }, { data: hidden }, { data: items }] = await Promise.all([
      supabase.from("social_posts").select("id, user_id, status").in("id", ids).eq("status", "live"),
      supabase.from("hidden_posts").select("post_id").eq("user_id", context.userId).in("post_id", ids),
      supabase.from("social_post_items").select("post_id, kind, path, poster_path, position").in("post_id", ids).order("position"),
    ]);
    const hiddenIds = new Set(((hidden ?? []) as Row[]).map((h) => h["post_id"] as string));
    const live = new Map(((posts ?? []) as Row[]).filter((p) => p["user_id"] !== context.userId && !hiddenIds.has(p["id"] as string)).map((p) => [p["id"] as string, p["user_id"] as string]));
    const { blockedPairs } = await import("./safety.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const blocked = await blockedPairs(supabaseAdmin, context.userId);
    const authorIds = [...new Set([...live.values()])].filter((id) => !blocked.has(id));
    const { data: authors } = authorIds.length ? await supabaseAdmin.from("profiles").select("id, name, username, avatar_url").in("id", authorIds) : { data: [] };
    const byAuthor = new Map(((authors ?? []) as Row[]).map((a) => [a["id"] as string, a]));
    const firstItem = new Map<string, Row>();
    for (const i of (items ?? []) as Row[]) if (!firstItem.has(i["post_id"] as string)) firstItem.set(i["post_id"] as string, i);
    const thumbPaths = [...firstItem.values()].map((i) => (i["kind"] === "video" ? i["poster_path"] : i["path"]) as string | null).filter((p): p is string => !!p);
    const { signFeedMedia } = await import("./media-urls");
    const [signed, avatars] = await Promise.all([signFeedMedia(supabase, thumbPaths, "posts"), signAvatarThumbs(supabaseAdmin, ((authors ?? []) as Row[]).map((a) => a["avatar_url"] as string | null))]);
    return ((tags ?? []) as Row[]).flatMap((t) => {
      const postId = t["post_id"] as string;
      const authorId = live.get(postId);
      const a = authorId ? byAuthor.get(authorId) : undefined;
      if (!authorId || !a) return [];
      const item = firstItem.get(postId);
      const path = item ? ((item["kind"] === "video" ? item["poster_path"] : item["path"]) as string | null) : null;
      const av = (a["avatar_url"] as string | null) ?? null;
      return [{
        key: `tag:${postId}`, postId, actorId: authorId,
        actorName: ((a["name"] as string | null) ?? "").trim() || (a["username"] as string | null) || "Someone",
        avatar: av ? (av.startsWith("http") ? av : avatars.get(av) ?? null) : null,
        createdAt: t["created_at"] as string,
        media: path ? signed.get(path) ?? null : null,
        mediaKind: (item?.["kind"] as "photo" | "video" | undefined) ?? null,
      }];
    });
  });
