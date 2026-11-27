import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bestExerciseMatch, parseCaptionMoves } from "./caption-workout";
import { isUnder18 } from "./redesign-profile";
import { signAvatarThumbs } from "./media-urls";
import { stabilizeSignedUrls } from "./stable-urls";
import type { PostItemInput, PostWorkout, PostWorkoutChoice, PostWorkoutMove, SocialPostView } from "./social-post-types";

/*
 * Camera-roll posts. These live only in social_posts and never write
 * check_ins, daily_posts, streaks, badges or crew check-in pushes.
 */

const BUCKET = "posts";
const TTL = 60 * 60;
type Row = Record<string, unknown>;
const sb = (c: unknown) => c as SupabaseClient;
const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "Member";

async function myCrews(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("group_members")
    .select("group_id, joined_at, groups!inner(id, name, ended_at)")
    .eq("user_id", userId)
    .is("groups.ended_at", null)
    .order("joined_at", { ascending: true });
  return ((data ?? []) as unknown as { group_id: string; groups: { name: string } }[]).map((r) => ({ id: r.group_id, name: r.groups.name }));
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
      supabase.from("profiles").select("name, birthday").eq("id", userId).maybeSingle(),
      supabase.from("workout_sessions").select("id, title, summary, logged_at").eq("user_id", userId).not("logged_at", "is", null).order("logged_at", { ascending: false }).limit(10),
      supabase.from("workouts").select("id, name, exercises").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
    ]);
    return {
      crews,
      under18: isUnder18((prof?.["birthday"] as string | null) ?? null),
      sessions: ((sessions ?? []) as Row[]).map((s) => {
        const sum = (s["summary"] ?? {}) as { exercises?: number; sets?: number; minutes?: number };
        return { id: s["id"] as string, title: (s["title"] as string) || "Workout", loggedAt: s["logged_at"] as string, exercises: sum.exercises ?? 0, sets: sum.sets ?? 0, minutes: sum.minutes ?? 0 };
      }),
      saved: ((saved ?? []) as Row[]).map((w) => {
        const list = (w["exercises"] ?? []) as { sets?: number }[];
        return { id: w["id"] as string, title: (w["name"] as string) || "Workout", exercises: list.length, sets: list.reduce((n, x) => n + (x.sets ?? 1), 0) };
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
    if (snap.creditUserId) {
      const { data: p } = await supabase.from("profiles").select("name").eq("id", snap.creditUserId).maybeSingle();
      credit = firstName(p?.["name"] as string | null);
    }
    return { title: snap.workout?.title ?? "Workout", minutes: snap.workout?.minutes ?? 0, sets: snap.workout?.sets ?? 0, prs: snap.workout?.prCount ?? 0, credit };
  });

/** Step 1 of posting: one atomic insert (audience, crews, items) while media uploads. */
export const createSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caption: string; everyone: boolean; crewIds: string[]; items: PostItemInput[]; workout: PostWorkoutChoice; commentsOn: boolean; tags: string[]; skipDiscover: boolean }) => input)
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const snap = await snapshotWorkout(supabase, context.userId, data.workout);
    const items = (data.items ?? []).slice(0, 10).map((i) => ({
      kind: i.kind, path: i.path, poster_path: i.posterPath, duration_s: i.duration, trim_start: i.trimStart, trim_end: i.trimEnd,
      muted: i.muted, cover_s: i.cover, crop: i.crop,
    }));
    const { data: id, error } = await supabase.rpc("create_social_post", {
      _caption: (data.caption ?? "").slice(0, 2200), _everyone: !!data.everyone, _group_ids: data.crewIds ?? [], _items: items,
      _workout: snap.workout, _workout_session_id: snap.sessionId, _workout_id: snap.workoutId, _credit_user_id: snap.creditUserId,
      _comments_on: data.commentsOn !== false, _tags: data.tags ?? [], _skip_discover: !!data.skipDiscover,
    });
    if (error || !id) throw new Error(error?.message ?? "Couldn't post");
    if (!items.length) await notifyCredit(supabase, context.userId, id as string);
    return { id: id as string };
  });

async function notifyCredit(supabase: SupabaseClient, userId: string, postId: string) {
  const { data: p } = await supabase.from("social_posts").select("credit_user_id, workout").eq("id", postId).maybeSingle();
  const credit = p?.["credit_user_id"] as string | null;
  if (!credit) return;
  try {
    const { data: me } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
    const { pushToUsers } = await import("./notify.server");
    const title = ((p?.["workout"] ?? {}) as { title?: string }).title ?? "your workout";
    await pushToUsers([credit], { title: "Pactara", body: `${firstName(me?.["name"] as string | null)} posted ${title} and credited you`, url: `/post/${postId}`, actorUserId: userId } as Parameters<typeof pushToUsers>[1]);
  } catch (e) {
    console.error("[posts] credit push failed", e);
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
    if (data.ok) await notifyCredit(supabase, context.userId, data.id);
    return { ok: true };
  });

async function loadPosts(supabase: SupabaseClient, userId: string, rows: Row[]): Promise<SocialPostView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r["id"] as string);
  const authorIds = [...new Set(rows.map((r) => r["user_id"] as string))];
  const [{ data: items }, { data: crews }, { data: cheers }, { data: comments }, { data: saves }, { data: authors }] = await Promise.all([
    supabase.from("social_post_items").select("*").in("post_id", ids).order("position"),
    supabase.from("social_post_crews").select("post_id, group_id").in("post_id", ids),
    supabase.from("social_post_cheers").select("post_id, user_id").in("post_id", ids),
    supabase.from("social_post_comments").select("post_id").in("post_id", ids),
    supabase.from("social_post_saves").select("post_id, user_id").in("post_id", ids),
    supabase.from("profiles").select("id, name, avatar_url, avatar_color").in("id", authorIds),
  ]);
  const paths = ((items ?? []) as Row[]).flatMap((i) => [i["path"] as string, i["poster_path"] as string | null].filter((p): p is string => !!p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls([...new Set(paths)], TTL);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const avatars = await signAvatarThumbs(supabase, ((authors ?? []) as Row[]).map((a) => a["avatar_url"] as string | null));
  const authorById = new Map(((authors ?? []) as Row[]).map((a) => [a["id"] as string, a]));
  return rows.map((r) => {
    const id = r["id"] as string;
    const mine = r["user_id"] === userId;
    const a = authorById.get(r["user_id"] as string);
    const av = (a?.["avatar_url"] as string | null) ?? null;
    let workout = (r["workout"] ?? null) as PostWorkout | null;
    if (workout && !mine) workout = { ...workout, prCount: 0, moves: workout.moves.map((m) => ({ ...m, sets: m.sets.map((s) => ({ ...s, isPr: false })) })) };
    return {
      id,
      author: { id: r["user_id"] as string, name: (a?.["name"] as string) || "Member", avatarUrl: av ? (av.startsWith("http") ? av : avatars.get(av) ?? null) : null, avatarColor: (a?.["avatar_color"] as string | null) ?? "#7C3AED" },
      isMine: mine,
      caption: (r["caption"] as string) ?? "",
      createdAt: r["created_at"] as string,
      status: r["status"] as SocialPostView["status"],
      everyone: !!r["audience_everyone"],
      crewIds: ((crews ?? []) as Row[]).filter((c) => c["post_id"] === id).map((c) => c["group_id"] as string),
      commentsOn: r["comments_on"] !== false,
      items: ((items ?? []) as Row[]).filter((i) => i["post_id"] === id).map((i) => ({
        id: i["id"] as string, kind: i["kind"] as "photo" | "video",
        url: signed.get(i["path"] as string) ?? null, posterUrl: i["poster_path"] ? signed.get(i["poster_path"] as string) ?? null : null,
        trimStart: i["trim_start"] == null ? null : Number(i["trim_start"]), trimEnd: i["trim_end"] == null ? null : Number(i["trim_end"]),
        muted: !!i["muted"], crop: (i["crop"] ?? null) as SocialPostView["items"][number]["crop"],
      })),
      workout,
      cheers: ((cheers ?? []) as Row[]).filter((c) => c["post_id"] === id).length,
      cheeredByMe: ((cheers ?? []) as Row[]).some((c) => c["post_id"] === id && c["user_id"] === userId),
      comments: ((comments ?? []) as Row[]).filter((c) => c["post_id"] === id).length,
      saves: ((saves ?? []) as Row[]).filter((c) => c["post_id"] === id).length,
      savedByMe: ((saves ?? []) as Row[]).some((c) => c["post_id"] === id && c["user_id"] === userId),
    };
  });
}

/** Your own posts, newest first (profile Posts). */
export const getMySocialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = sb(context.supabase);
    const { data } = await supabase.from("social_posts").select("*").eq("user_id", context.userId).neq("status", "failed").order("created_at", { ascending: false }).limit(60);
    return stabilizeSignedUrls(await loadPosts(supabase, context.userId, (data ?? []) as Row[]));
  });

export const getSocialPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ context, data }) => {
    const supabase = sb(context.supabase);
    const { data: row } = await supabase.from("social_posts").select("*").eq("id", data.id).maybeSingle();
    if (!row) return null;
    const [post] = await loadPosts(supabase, context.userId, [row as Row]);
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
    const { data: rows } = await supabase.from("social_posts").select("*").in("id", ids).eq("status", "live").gte("created_at", data.since).order("created_at", { ascending: false }).limit(100);
    return stabilizeSignedUrls(await loadPosts(supabase, context.userId, (rows ?? []) as Row[]));
  });

export const updateSocialPostCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; caption: string }) => ({ id: String(input.id), caption: String(input.caption ?? "").slice(0, 2200) }))
  .handler(async ({ context, data }) => {
    const { error } = await sb(context.supabase).from("social_posts").update({ caption: data.caption }).eq("id", data.id).eq("user_id", context.userId);
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
    const t = sb(context.supabase).from("social_post_cheers");
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

/** People you can tag: your crewmates (blocked pairs excluded by the profile read). */
export const getTaggablePeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = sb(context.supabase);
    const crews = await myCrews(supabase, context.userId);
    if (!crews.length) return [];
    const { data: members } = await supabase.from("group_members").select("user_id").in("group_id", crews.map((c) => c.id));
    const ids = [...new Set(((members ?? []) as Row[]).map((m) => m["user_id"] as string))].filter((id) => id !== context.userId);
    if (!ids.length) return [];
    const { blockedPairs } = await import("./safety.server");
    const blocked = await blockedPairs(supabase, context.userId);
    const { data: people } = await supabase.from("profiles").select("id, name").in("id", ids.filter((id) => !blocked.has(id)));
    return ((people ?? []) as Row[]).map((p) => ({ id: p["id"] as string, name: (p["name"] as string) || "Member" }));
  });
