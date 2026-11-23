import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateIn } from "@/lib/streak-rules";
import type { LogType, WeightUnit } from "@/lib/lift-rules";
import { bestSetLabel, liftChange30, weekStats, type DatedSet } from "@/lib/workouts-tab";
import type { WorkoutSummary } from "@/lib/lifts.functions";

export type RecentSession = {
  id: string;
  title: string;
  localDate: string;
  minutes: number;
  exercises: number;
  sets: number;
  prs: number;
  plan: { name: string; week: number } | null;
  /** Sheet rows: "Dumbbell bench press" · "3 × 8 · 55 lb". */
  items: { exerciseId: string; name: string; line: string }[];
  /** For "Do this workout again": the same moves and set counts, in order. */
  again: { exerciseId: string; sets: number }[];
  workoutId: string | null;
};

export type LiftRow = { exerciseId: string; best: string | null; change: string | null; lastAt: string };

export type WorkoutsOverview = {
  timezone: string;
  today: string;
  unit: WeightUnit;
  week: { workouts: number; minutes: number; prs: number };
  recent: RecentSession[];
  lifts: LiftRow[];
};

/** Everything the Workouts tab shows below the plan card (own rows only, RLS). */
export const getWorkoutsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkoutsOverview> => {
    const { supabase, userId } = context;
    const [{ data: prof }, sessionsRes, logsRes] = await Promise.all([
      supabase.from("profiles").select("timezone, weight_unit").eq("id", userId).maybeSingle(),
      supabase
        .from("workout_sessions")
        .select("id, title, logged_at, started_at, duration_seconds, summary, check_in_ids, workout_id")
        .eq("user_id", userId)
        .not("logged_at", "is", null)
        .order("logged_at", { ascending: false })
        .limit(60),
      supabase
        .from("workout_set_logs")
        .select("exercise_id, session_id, set_no, position, weight, unit, reps, seconds, local_date, done_at")
        .eq("user_id", userId)
        .order("done_at", { ascending: false })
        .limit(5000),
    ]);
    if (sessionsRes.error) throw new Error(sessionsRes.error.message);
    if (logsRes.error) throw new Error(logsRes.error.message);
    const timezone = (prof?.timezone as string | undefined) ?? "UTC";
    const unit: WeightUnit = prof?.weight_unit === "kg" ? "kg" : "lb";
    const today = localDateIn(timezone);
    const logs = logsRes.data ?? [];

    const sessions = (sessionsRes.data ?? []).map((s) => {
      const summary = (s.summary ?? null) as WorkoutSummary | null;
      const minutes = summary?.minutes ?? Math.round((s.duration_seconds ?? 0) / 60);
      return { row: s, summary, minutes, localDate: localDateIn(timezone, new Date(s.logged_at as string)) };
    });
    const week = weekStats(
      sessions.map((s) => ({ localDate: s.localDate, minutes: s.minutes, prs: s.summary?.prs?.length ?? 0 })),
      today,
    );

    // Plan tags on the 5 most recent: via the check-ins they were posted as.
    const top = sessions.slice(0, 5);
    const checkInIds = top.flatMap((s) => (s.row.check_in_ids as string[] | null) ?? []);
    const planByCheckIn = new Map<string, { name: string; week: number }>();
    if (checkInIds.length) {
      const { data: tags } = await supabase
        .from("plan_workout_logs")
        .select("check_in_id, week, user_plans(plans(name))")
        .in("check_in_id", checkInIds);
      for (const t of tags ?? []) {
        const name = (t as any).user_plans?.plans?.name as string | undefined;
        if (t.check_in_id && name) planByCheckIn.set(t.check_in_id, { name, week: t.week });
      }
    }
    const savedIds = new Set<string>();
    const wanted = top.map((s) => s.row.workout_id).filter((x): x is string => !!x);
    if (wanted.length) {
      const { data: w } = await supabase.from("workouts").select("id").eq("user_id", userId).in("id", wanted);
      for (const r of w ?? []) savedIds.add(r.id);
    }
    const recent: RecentSession[] = top.map(({ row, summary, minutes, localDate }) => {
      const own = logs.filter((l) => l.session_id === row.id);
      const again: RecentSession["again"] = [];
      for (const l of [...own].sort((a, b) => a.position - b.position || a.set_no - b.set_no)) {
        const last = again[again.length - 1];
        if (last && last.exerciseId === l.exercise_id) last.sets += 1;
        else again.push({ exerciseId: l.exercise_id, sets: 1 });
      }
      const plan = ((row.check_in_ids as string[] | null) ?? []).map((id) => planByCheckIn.get(id)).find(Boolean) ?? null;
      return {
        id: row.id,
        title: (row.title as string | null) || "Workout",
        localDate,
        minutes,
        exercises: summary?.exercises ?? again.length,
        sets: summary?.sets ?? own.length,
        prs: summary?.prs?.length ?? 0,
        plan,
        items: summary?.items ?? [],
        again,
        workoutId: row.workout_id && savedIds.has(row.workout_id) ? row.workout_id : null,
      };
    });

    // Your lifts: every exercise logged, most recent first.
    const byEx = new Map<string, { sets: DatedSet[]; lastAt: string }>();
    for (const l of logs) {
      const e = byEx.get(l.exercise_id) ?? { sets: [], lastAt: l.done_at };
      if (l.done_at > e.lastAt) e.lastAt = l.done_at;
      e.sets.push({
        weight: l.weight == null ? null : Number(l.weight),
        reps: l.reps,
        seconds: l.seconds,
        unit: l.unit === "kg" ? "kg" : "lb",
        localDate: l.local_date,
      });
      byEx.set(l.exercise_id, e);
    }
    const ids = [...byEx.keys()];
    const types = new Map<string, LogType>();
    if (ids.length) {
      const { data: ex } = await supabase.from("exercises").select("id, log_type").in("id", ids);
      for (const r of ex ?? []) types.set(r.id, r.log_type === "timed" ? "timed" : "reps");
    }
    const lifts: LiftRow[] = [...byEx.entries()]
      .sort((a, b) => b[1].lastAt.localeCompare(a[1].lastAt))
      .map(([exerciseId, e]) => {
        const logType = types.get(exerciseId) ?? "reps";
        return { exerciseId, lastAt: e.lastAt, best: bestSetLabel(e.sets, unit, logType), change: liftChange30(e.sets, today, unit, logType) };
      });

    return { timezone, today, unit, week, recent, lifts };
  });
