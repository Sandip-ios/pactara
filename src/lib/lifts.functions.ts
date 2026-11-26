import { mergeTemplate } from "@/lib/workout-update";
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateIn } from "@/lib/streak-rules";
import { feedDayNumber } from "@/lib/feed-view";
import { clampSets, sortMyWorkouts } from "@/lib/workout-builder";
import { postDayLabel } from "@/lib/workout-share";
import {
  bestOf,
  convertWeight,
  markPrs,
  setsShort,
  workoutTotals,
  type Equipment,
  type LastSession,
  type LogType,
  type SetEntry,
  type WeightUnit,
} from "@/lib/lift-rules";

/** One exercise's history, for prefill, "Last: …" and personal bests. */
export type ExerciseHistory = {
  last: LastSession;
  /** Heaviest set ever (ties: more reps), in the unit it was logged in. */
  best: SetEntry | null;
  sessions: number;
  lastDoneAt: string;
};

export type LiftHistory = {
  unit: WeightUnit;
  today: string;
  /** The member's timezone (dates on screen use it, not the device's). */
  timezone: string;
  byExercise: Record<string, ExerciseHistory>;
  /** Exercise ids, most recently done first. */
  recent: string[];
  everLogged: boolean;
};

type LogRow = {
  exercise_id: string;
  session_id: string | null;
  set_no: number;
  position: number;
  weight: number | null;
  unit: string;
  reps: number | null;
  seconds: number | null;
  local_date: string;
  done_at: string;
  is_pr: boolean;
};

const toSet = (r: Pick<LogRow, "weight" | "unit" | "reps" | "seconds">): SetEntry => ({
  weight: r.weight == null ? null : Number(r.weight),
  reps: r.reps,
  seconds: r.seconds,
  unit: r.unit === "kg" ? "kg" : "lb",
});

/** Groups set rows (newest first) into sessions per exercise. */
function sessionsOf(rows: LogRow[]) {
  const byEx = new Map<string, Map<string, { date: string; at: string; rows: LogRow[] }>>();
  for (const r of rows) {
    const key = r.session_id ?? `d-${r.local_date}`;
    const m = byEx.get(r.exercise_id) ?? new Map();
    const s = m.get(key) ?? { date: r.local_date, at: r.done_at, rows: [] as LogRow[] };
    if (r.done_at > s.at) s.at = r.done_at;
    s.rows.push(r);
    m.set(key, s);
    byEx.set(r.exercise_id, m);
  }
  return byEx;
}

async function profileOf(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("timezone, weight_unit").eq("id", userId).maybeSingle();
  return {
    timezone: (data?.timezone as string | undefined) ?? "UTC",
    unit: ((data?.weight_unit as string | undefined) === "kg" ? "kg" : "lb") as WeightUnit,
  };
}

/** Everything the picker, logger and profile need about past lifts. */
export const getLiftHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LiftHistory> => {
    const { supabase, userId } = context;
    const [prof, logs] = await Promise.all([
      profileOf(supabase as SupabaseClient, userId),
      supabase
        .from("workout_set_logs")
        .select("exercise_id, session_id, set_no, position, weight, unit, reps, seconds, local_date, done_at, is_pr")
        .eq("user_id", userId)
        .order("done_at", { ascending: false })
        .limit(5000),
    ]);
    if (logs.error) throw new Error(logs.error.message);
    const rows = (logs.data ?? []) as LogRow[];
    const byExercise: Record<string, ExerciseHistory> = {};
    const lastAt: [string, string][] = [];
    for (const [exId, sessions] of sessionsOf(rows)) {
      const list = [...sessions.values()].sort((a, b) => b.at.localeCompare(a.at));
      const latest = list[0]!;
      const all = rows.filter((r) => r.exercise_id === exId).map(toSet);
      const best = bestOf(all);
      byExercise[exId] = {
        last: { date: latest.date, sets: [...latest.rows].sort((a, b) => a.set_no - b.set_no).map(toSet) },
        best: best ? { weight: best.weight, reps: best.reps, seconds: null, unit: best.unit } : null,
        sessions: list.length,
        lastDoneAt: latest.at,
      };
      lastAt.push([exId, latest.at]);
    }
    lastAt.sort((a, b) => b[1].localeCompare(a[1]));
    return {
      unit: prof.unit,
      today: localDateIn(prof.timezone),
      timezone: prof.timezone,
      byExercise,
      recent: lastAt.slice(0, 8).map(([id]) => id),
      everLogged: rows.length > 0,
    };
  });

export type SavedWorkout = {
  id: string;
  name: string;
  /** `seconds`: timed moves copied from a crewmate keep their time as the target. */
  exercises: { exerciseId: string; sets: number; restSeconds?: number; seconds?: number; reps?: string; tip?: string }[];
  lastDoneAt: string | null;
  createdAt: string;
};

export const getMyWorkouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedWorkout[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workouts")
      .select("id, name, exercises, last_done_at, created_at")
      .eq("user_id", userId)
      .order("last_done_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return sortMyWorkouts(
      (data ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        exercises: (Array.isArray(w.exercises) ? w.exercises : []) as SavedWorkout["exercises"],
        lastDoneAt: w.last_done_at,
        createdAt: w.created_at,
      })),
    );
  });

/**
 * Saves a workout built ahead of time (New / Edit workout). Doesn't count as
 * doing it: "last done" is left alone.
 */
export const saveBuiltWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    workoutId?: string | null;
    name: string;
    exercises: { exerciseId: string; sets: number; restSeconds?: number; seconds?: number; reps?: string; tip?: string }[];
    /** New-version builder only; classic never sends it, so it stays as it was. */
    equipment?: "gym" | "dumbbells" | "home" | null;
  }) => {
    const name = String(input?.name ?? "").trim().slice(0, 60);
    if (!name) throw new Error("Give your workout a name");
    const exercises = (Array.isArray(input?.exercises) ? input.exercises : []).slice(0, 40).map((e) => {
      const out: SavedWorkout["exercises"][number] = {
        exerciseId: String(e.exerciseId).slice(0, 120),
        sets: clampSets(Number(e.sets) || 3),
      };
      if (e.restSeconds != null) out.restSeconds = Math.max(15, Math.min(600, Math.round(Number(e.restSeconds) || 90)));
      if (e.seconds != null && Number(e.seconds) > 0) out.seconds = Math.min(86400, Math.round(Number(e.seconds)));
      const reps = typeof e.reps === "string" ? e.reps.trim().slice(0, 20) : "";
      if (reps) out.reps = reps;
      const tip = typeof e.tip === "string" ? e.tip.trim().slice(0, 120) : "";
      if (tip) out.tip = tip;
      return out;
    });
    if (!exercises.length) throw new Error("Add at least one exercise");
    const eq = input?.equipment;
    const equipment = eq === "gym" || eq === "dumbbells" || eq === "home" ? eq : eq === null ? null : undefined;
    return { workoutId: input?.workoutId ?? null, name, exercises, ...(equipment !== undefined ? { equipment } : {}) };
  })
  .handler(async ({ context, data }): Promise<{ workout: SavedWorkout }> => {
    const { supabase, userId } = context;
    const cols = "id, name, exercises, last_done_at, created_at";
    const res = data.workoutId
      ? await supabase
          .from("workouts")
          .update({ name: data.name, exercises: data.exercises as never, ...("equipment" in data ? { equipment: data.equipment } : {}), updated_at: new Date().toISOString() })
          .eq("id", data.workoutId)
          .eq("user_id", userId)
          .select(cols)
          .maybeSingle()
      : await supabase.from("workouts").insert({ user_id: userId, name: data.name, exercises: data.exercises as never, ...("equipment" in data ? { equipment: data.equipment } : {}) }).select(cols).single();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error("That workout is gone. Go back and build it again.");
    const w = res.data;
    return {
      workout: {
        id: w.id,
        name: w.name,
        exercises: (Array.isArray(w.exercises) ? w.exercises : []) as SavedWorkout["exercises"],
        lastDoneAt: w.last_done_at,
        createdAt: w.created_at,
      },
    };
  });

/** Takes a workout off My workouts. Logged sets and personal bests stay. */
export const deleteSavedWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workoutId: string }) => ({ workoutId: String(input?.workoutId ?? "") }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("workouts").delete().eq("id", data.workoutId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function resolveGroup(supabase: SupabaseClient, userId: string, groupId: string | null) {
  if (groupId) {
    const { data } = await supabase
      .from("group_members")
      .select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .maybeSingle();
    if (data?.group_id) return data.group_id as string;
  }
  const { data } = await supabase
    .from("group_members")
    .select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.group_id as string | undefined) ?? null;
}

/**
 * Starts the live session for a logged workout, so the crew sees you
 * working out. Reuses today's open session; never sends a push.
 */
export const startLoggedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId?: string | null; title: string; workoutId?: string | null }) => ({
    groupId: input?.groupId ?? null,
    title: String(input?.title ?? "Workout").slice(0, 60),
    workoutId: input?.workoutId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as SupabaseClient;
    const groupId = await resolveGroup(sb, userId, data.groupId);
    if (!groupId) return { sessionId: null as string | null };
    const { timezone } = await profileOf(sb, userId);
    const today = localDateIn(timezone);
    const { data: existing } = await supabase
      .from("workout_sessions")
      .select("id, logged_at")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .eq("local_date", today)
      .eq("status", "active")
      .maybeSingle();
    if (existing && !existing.logged_at) {
      await supabase
        .from("workout_sessions")
        .update({ title: data.title, workout_id: data.workoutId, started_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { sessionId: existing.id as string };
    }
    const { data: row, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userId,
        group_id: groupId,
        local_date: today,
        status: "active",
        title: data.title,
        workout_id: data.workoutId,
        start_notification_sent: true,
      })
      .select("id")
      .maybeSingle();
    if (error || !row) {
      console.warn("[lifts] start session failed", error);
      return { sessionId: null as string | null };
    }
    return { sessionId: row.id as string };
  });

export type FinishInput = {
  sessionId?: string | null;
  groupId?: string | null;
  title: string;
  workoutId?: string | null;
  /** The plan day this workout was started from (only the plan's next day). */
  plan?: { name: string; week: number; day: number } | null;
  startedAt: string;
  exercises: {
    exerciseId: string;
    sets: { weight: number | null; unit: WeightUnit; reps: number | null; seconds: number | null; doneAt: string }[];
  }[];
};

export type WorkoutPr = {
  exerciseId: string;
  name: string;
  weight: number;
  unit: WeightUnit;
  reps: number;
  /** Heavier than the previous best by this much (0 = more reps at the same weight). */
  delta: number;
};

export type WorkoutSummary = {
  exercises: number;
  sets: number;
  minutes: number;
  volume: number;
  unit: WeightUnit;
  items: { exerciseId: string; name: string; line: string }[];
  prs: WorkoutPr[];
  /** Set when the workout was a plan day, so history can say "{Plan} · week N" even if it was never posted. */
  plan?: { name: string; week: number; day: number };
};

const num = (v: unknown, max: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : null;
  return n == null ? null : Math.max(0, Math.min(max, n));
};

/** Saves a finished workout's sets, marks personal bests and returns the summary. */
export const finishLoggedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FinishInput): FinishInput => ({
    sessionId: input?.sessionId ?? null,
    groupId: input?.groupId ?? null,
    title: String(input?.title ?? "Workout").trim().slice(0, 60) || "Workout",
    workoutId: input?.workoutId ?? null,
    plan:
      input?.plan && Number.isFinite(input.plan.week) && Number.isFinite(input.plan.day)
        ? { name: String(input.plan.name).slice(0, 80), week: Math.max(1, Math.round(input.plan.week)), day: Math.max(1, Math.round(input.plan.day)) }
        : null,
    startedAt: String(input?.startedAt ?? new Date().toISOString()),
    exercises: (Array.isArray(input?.exercises) ? input.exercises : []).slice(0, 40).map((e) => ({
      exerciseId: String(e.exerciseId).slice(0, 120),
      sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 30).map((s) => ({
        weight: num(s.weight, 2000),
        unit: (s.unit === "kg" ? "kg" : "lb") as WeightUnit,
        reps: num(s.reps, 1000) == null ? null : Math.round(num(s.reps, 1000)!),
        seconds: num(s.seconds, 86400) == null ? null : Math.round(num(s.seconds, 86400)!),
        doneAt: String(s.doneAt ?? new Date().toISOString()),
      // A set with no reps and no time isn't a logged set.
      })).filter((s) => (s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0),
    })).filter((e) => e.sets.length > 0),
  }))
  .handler(async ({ context, data }): Promise<{ sessionId: string | null; summary: WorkoutSummary; prSets: Record<string, boolean[]>; localDate: string }> => {
    const { supabase, userId } = context;
    const sb = supabase as SupabaseClient;
    const { timezone, unit } = await profileOf(sb, userId);
    const today = localDateIn(timezone);
    const now = new Date();

    // Already saved (a retry after a flaky connection): return what's stored.
    if (data.sessionId) {
      const { data: done } = await supabase
        .from("workout_sessions")
        .select("id, logged_at, summary")
        .eq("id", data.sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (done?.logged_at && done.summary) {
        return { sessionId: done.id, summary: done.summary as unknown as WorkoutSummary, prSets: {}, localDate: localDateIn(timezone, new Date(done.logged_at)) };
      }
    }

    const ids = data.exercises.map((e) => e.exerciseId);
    const [{ data: exRows }, { data: past }] = await Promise.all([
      supabase.from("exercises").select("id, name, log_type").in("id", ids),
      supabase
        .from("workout_set_logs")
        .select("exercise_id, weight, unit, reps, seconds")
        .eq("user_id", userId)
        .in("exercise_id", ids)
        .limit(5000),
    ]);
    const exInfo = new Map((exRows ?? []).map((e) => [e.id, e]));
    const exercises = data.exercises.filter((e) => exInfo.has(e.exerciseId));
    const history = new Map<string, SetEntry[]>();
    for (const r of (past ?? []) as LogRow[]) {
      const list = history.get(r.exercise_id) ?? [];
      list.push(toSet(r));
      history.set(r.exercise_id, list);
    }

    const prSets: Record<string, boolean[]> = {};
    const prs: WorkoutPr[] = [];
    const items: WorkoutSummary["items"] = [];
    for (const e of exercises) {
      const info = exInfo.get(e.exerciseId)!;
      const logType = info.log_type as LogType;
      const sets = e.sets.map((s) => ({ weight: s.weight, reps: s.reps, seconds: s.seconds, unit: s.unit }));
      const flags = logType === "reps" ? markPrs(history.get(e.exerciseId) ?? [], sets) : sets.map(() => false);
      prSets[e.exerciseId] = flags;
      items.push({ exerciseId: e.exerciseId, name: info.name, line: summaryItemLine(sets, unit, logType) });
      const prIdx = flags.lastIndexOf(true);
      if (prIdx >= 0) {
        const s = sets[prIdx]!;
        const before = bestOf(history.get(e.exerciseId) ?? []);
        const w = s.weight ? convertWeight(s.weight, s.unit, unit) : 0;
        const prevW = before ? convertWeight(before.weight, before.unit, unit) : 0;
        prs.push({ exerciseId: e.exerciseId, name: info.name, weight: w, unit, reps: s.reps ?? 0, delta: Math.max(0, Math.round((w - prevW) * 100) / 100) });
      }
    }

    const minutes = (now.getTime() - Date.parse(data.startedAt)) / 60000;
    const totals = workoutTotals(
      exercises.map((e) => ({ logType: exInfo.get(e.exerciseId)!.log_type as LogType, sets: e.sets.map((s) => ({ ...s, done: true })) })),
      Number.isFinite(minutes) ? Math.min(minutes, 600) : 0,
      unit,
    );
    const summary: WorkoutSummary = { ...totals, unit, items, prs, ...(data.plan ? { plan: data.plan } : {}) };

    // The session row: today's live one, or a new one when that never started.
    let sessionId = data.sessionId ?? null;
    if (sessionId) {
      const { data: own } = await supabase.from("workout_sessions").select("id").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      if (!own) sessionId = null;
    }
    const durationSeconds = Math.max(0, Math.round((now.getTime() - Date.parse(data.startedAt)) / 1000));
    const patch = {
      title: data.title,
      workout_id: data.workoutId,
      logged_at: now.toISOString(),
      summary: summary as never,
      ended_at: now.toISOString(),
      duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    };
    if (sessionId) {
      const { data: cur } = await supabase.from("workout_sessions").select("status").eq("id", sessionId).maybeSingle();
      await supabase
        .from("workout_sessions")
        .update({ ...patch, ...(cur?.status === "active" ? { status: "ended_without_completion" } : {}) })
        .eq("id", sessionId);
    } else {
      const groupId = await resolveGroup(sb, userId, data.groupId ?? null);
      if (groupId) {
        const { data: row } = await supabase
          .from("workout_sessions")
          .insert({
            user_id: userId,
            group_id: groupId,
            local_date: today,
            status: "ended_without_completion",
            started_at: data.startedAt,
            start_notification_sent: true,
            ...patch,
          })
          .select("id")
          .maybeSingle();
        sessionId = (row?.id as string | undefined) ?? null;
      }
    }

    const rows = exercises.flatMap((e, position) =>
      e.sets.map((s, i) => ({
        user_id: userId,
        session_id: sessionId,
        exercise_id: e.exerciseId,
        position,
        set_no: i + 1,
        weight: s.weight,
        unit: s.unit,
        reps: s.reps,
        seconds: s.seconds,
        is_pr: prSets[e.exerciseId]?.[i] ?? false,
        local_date: today,
        done_at: s.doneAt,
      })),
    );
    if (rows.length) {
      const { error } = await supabase.from("workout_set_logs").insert(rows);
      if (error) throw new Error(error.message);
    }
    if (data.workoutId) {
      await supabase.from("workouts").update({ last_done_at: now.toISOString() }).eq("id", data.workoutId).eq("user_id", userId);
    }
    // The member's own calendar day (saved timezone), not the phone clock.
    return { sessionId, summary, prSets, localDate: today };
  });

function summaryItemLine(sets: SetEntry[], unit: WeightUnit, logType: LogType): string {
  if (logType === "timed") return setsShort(sets, unit, "timed");
  const reps = sets.map((s) => s.reps ?? 0);
  const ws = sets.map((s) => (s.weight ? convertWeight(s.weight, s.unit, unit) : 0));
  const sameReps = reps.every((r) => r === reps[0]);
  const sameW = ws.every((w) => w === ws[0]);
  if (sameReps && sameW) return ws[0] ? `${sets.length} × ${reps[0]} · ${ws[0]} ${unit}` : `${sets.length} × ${reps[0]}`;
  return setsShort(sets, unit, "reps");
}

/** Saves (or updates) a reusable workout from what was just done. */
export const saveWorkoutTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workoutId?: string | null; name: string; sessionId?: string | null; exercises: { exerciseId: string; sets: number; restSeconds?: number }[] }) => {
    const name = String(input?.name ?? "").trim().slice(0, 60);
    if (!name) throw new Error("Give your workout a name");
    return {
      workoutId: input?.workoutId ?? null,
      sessionId: input?.sessionId ?? null,
      name,
      exercises: (Array.isArray(input?.exercises) ? input.exercises : []).slice(0, 40).map((e) => ({
        exerciseId: String(e.exerciseId).slice(0, 120),
        sets: Math.max(1, Math.min(20, Math.round(Number(e.sets) || 3))),
        restSeconds: Math.max(15, Math.min(600, Math.round(Number(e.restSeconds) || 90))),
      })),
    };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    let workoutId = data.workoutId;
    if (workoutId) {
      // Merge, never overwrite: builder reps/seconds/tips survive; equipment is left alone.
      const { data: current } = await supabase.from("workouts").select("exercises").eq("id", workoutId).eq("user_id", userId).maybeSingle();
      let exercises: SavedWorkout["exercises"] = data.exercises;
      if (current) {
        const saved = (Array.isArray(current.exercises) ? current.exercises : []) as SavedWorkout["exercises"];
        const known = new Set(saved.map((e) => e.exerciseId));
        const fresh = data.exercises.map((e) => e.exerciseId).filter((id) => !known.has(id));
        const timed = new Set<string>();
        if (fresh.length) {
          const { data: ex } = await supabase.from("exercises").select("id, log_type").in("id", fresh);
          for (const e of ex ?? []) if (e.log_type === "timed") timed.add(e.id);
        }
        exercises = mergeTemplate(saved, data.exercises, (id) => (timed.has(id) ? "timed" : "reps"));
      }
      const { data: row, error } = await supabase
        .from("workouts")
        .update({ name: data.name, exercises: exercises as never, last_done_at: now })
        .eq("id", workoutId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) workoutId = null;
    }
    if (!workoutId) {
      const { data: row, error } = await supabase
        .from("workouts")
        .insert({ user_id: userId, name: data.name, exercises: data.exercises as never, last_done_at: now })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      workoutId = row.id;
    }
    if (data.sessionId) {
      await supabase.from("workout_sessions").update({ workout_id: workoutId, title: data.name }).eq("id", data.sessionId).eq("user_id", userId);
    }
    return { workoutId };
  });

export type ExerciseProgress = {
  unit: WeightUnit;
  today: string;
  sessions: { date: string; sets: (SetEntry & { isPr: boolean })[] }[];
};

/** Every logged session of one exercise, newest first. */
export const getExerciseProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { exerciseId: string }) => ({ exerciseId: String(input?.exerciseId ?? "").slice(0, 120) }))
  .handler(async ({ context, data }): Promise<ExerciseProgress> => {
    const { supabase, userId } = context;
    const [prof, logs] = await Promise.all([
      profileOf(supabase as SupabaseClient, userId),
      supabase
        .from("workout_set_logs")
        .select("exercise_id, session_id, set_no, position, weight, unit, reps, seconds, local_date, done_at, is_pr")
        .eq("user_id", userId)
        .eq("exercise_id", data.exerciseId)
        .order("done_at", { ascending: false })
        .limit(2000),
    ]);
    const rows = (logs.data ?? []) as LogRow[];
    const sessions = [...(sessionsOf(rows).get(data.exerciseId)?.values() ?? [])]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((s) => ({
        date: s.date,
        sets: [...s.rows].sort((a, b) => a.set_no - b.set_no).map((r) => ({ ...toSet(r), isPr: r.is_pr })),
      }));
    return { unit: prof.unit, today: localDateIn(prof.timezone), sessions };
  });

/** Adds a member's own exercise (only they can see it). */
export const createCustomExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; muscle: string; equipment: Equipment; logType?: LogType }) => {
    const name = String(input?.name ?? "").trim().slice(0, 80);
    if (!name) throw new Error("Give your exercise a name");
    const muscles = ["shoulders", "chest", "back", "traps", "biceps", "triceps", "forearms", "abs", "quads", "hamstrings", "glutes", "calves"];
    const muscle = muscles.includes(input?.muscle) ? input.muscle : "abs";
    const equipments: Equipment[] = ["dumbbell", "barbell", "cable", "machine", "bodyweight", "band", "kettlebell", "other"];
    const equipment = equipments.includes(input?.equipment) ? input.equipment : "other";
    return { name, muscle, equipment, logType: (input?.logType === "timed" ? "timed" : "reps") as LogType };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("exercises")
      .insert({
        name: data.name,
        primary_muscles: [data.muscle],
        equipment: data.equipment,
        log_type: data.logType,
        owner_id: userId,
        source: "custom",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const setWeightUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { unit: WeightUnit }) => ({ unit: (input?.unit === "kg" ? "kg" : "lb") as WeightUnit }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({ weight_unit: data.unit }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { unit: data.unit };
  });

export type WorkoutDetail = {
  title: string | null;
  summary: WorkoutSummary | null;
  exercises: { exerciseId: string; name: string; imageStart: string | null; logType: LogType; equipment: string; sets: (SetEntry & { isPr: boolean })[] }[];
  /** The poster's own post: no Save button. */
  isMine: boolean;
  /** "Today", "Yesterday", "Tuesday", "Nov 3" from the viewer's today. */
  dayLabel: string | null;
  /** Already in the viewer's My workouts (saved from this post). */
  savedWorkoutId: string | null;
};

/** The read-only workout behind a feed post (crewmates of that post only). */
export const getWorkoutDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { checkInId: string }) => ({ checkInId: String(input?.checkInId ?? "") }))
  .handler(async ({ context, data }): Promise<WorkoutDetail | null> => {
    const { supabase, userId } = context;
    const { data: res, error } = await supabase.rpc("workout_detail_for_check_in", { _check_in_id: data.checkInId });
    if (error || !res) return null;
    const raw = res as { title: string | null; summary: WorkoutSummary | null; sessionId?: string; userId?: string; checkinDate?: string; sets: { exerciseId: string; name: string; imageStart: string | null; logType: LogType; equipment: string; position: number; weight: number | null; unit: string; reps: number | null; seconds: number | null; isPr: boolean }[] };
    const out: WorkoutDetail["exercises"] = [];
    for (const s of raw.sets ?? []) {
      let ex = out.find((e, i) => e.exerciseId === s.exerciseId && i === out.length - 1);
      if (!ex) {
        ex = { exerciseId: s.exerciseId, name: s.name, imageStart: s.imageStart, logType: s.logType, equipment: s.equipment, sets: [] };
        out.push(ex);
      }
      ex.sets.push({ ...toSet(s), isPr: s.isPr });
    }
    const isMine = raw.userId === userId;
    const [prof, saved] = await Promise.all([
      profileOf(supabase as SupabaseClient, userId),
      !isMine && raw.sessionId
        ? supabase.from("workouts").select("id").eq("user_id", userId).eq("source_session_id", raw.sessionId).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const dayLabel = raw.checkinDate ? postDayLabel(raw.checkinDate, localDateIn(prof.timezone)) : null;
    return {
      title: raw.title,
      summary: raw.summary,
      exercises: out,
      isMine,
      dayLabel,
      savedWorkoutId: (saved.data?.id as string | undefined) ?? null,
    };
  });

/** "Day n" for the "Your crew will see" preview: the streak once today is checked in. */
export const getPostPreviewDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({ groupId: input?.groupId ?? null }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as SupabaseClient;
    const groupId = await resolveGroup(sb, userId, data.groupId);
    const { timezone } = await profileOf(sb, userId);
    const today = localDateIn(timezone);
    if (!groupId) return { dayNumber: 1 };
    const [{ data: ci }, { data: fr }] = await Promise.all([
      supabase.from("check_ins").select("checkin_date").eq("user_id", userId).eq("group_id", groupId).lte("checkin_date", today).order("checkin_date", { ascending: false }).limit(400),
      supabase.from("streak_freezes_used").select("freeze_date").eq("user_id", userId).eq("group_id", groupId).lte("freeze_date", today).limit(400),
    ]);
    // Same Day N the feed will print on today's post (the check-in lands today).
    const checkIns = [...(ci ?? []).map((r) => r.checkin_date as string), today];
    return { dayNumber: feedDayNumber(checkIns, (fr ?? []).map((r) => r.freeze_date as string), today) };
  });
