import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateFor } from "@/lib/daily-posts.functions";
import { localDayBounds } from "@/lib/local-day-bounds";

export type NewHomePlanStatus = {
  doneNotCheckedIn: boolean;
  checkedInToday: boolean;
};

/** Today's plan completion, kept separate from the crew feed so either can retry alone. */
export const getNewHomePlanStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NewHomePlanStatus> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: runs, error: runsError }] = await Promise.all([
      supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
      supabase
        .from("user_plans")
        .select("id, status, current_week, next_day, plans(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    if (runsError) throw new Error("Could not load today's plan");

    const rows = runs ?? [];
    const timezone = (profile?.timezone as string | null | undefined) || "UTC";
    const today = localDateFor(timezone);
    const { start, end } = localDayBounds(timezone, today);
    const runIds = rows.map((row) => row.id);
    const { data: logs, error: logsError } = runIds.length
      ? await supabase
          .from("plan_workout_logs")
          .select("id, user_plan_id")
          .in("user_plan_id", runIds)
          .gte("completed_at", start)
          .lt("completed_at", end)
          .limit(1)
      : { data: [], error: null };
    if (logsError) throw new Error("Could not load today's plan");
    const checkedInToday = (logs ?? []).length > 0;
    const active = rows.find((row) => row.status === "active");
    if (!active || checkedInToday) return { doneNotCheckedIn: false, checkedInToday };

    const { data: sessions, error: sessionsError } = await supabase
      .from("workout_sessions")
      .select("summary")
      .eq("user_id", userId)
      .gte("logged_at", start)
      .lt("logged_at", end)
      .not("summary", "is", null)
      .limit(20);
    if (sessionsError) throw new Error("Could not load today's plan");
    const plan = (active as typeof active & { plans?: { name?: string } | null }).plans;
    const doneNotCheckedIn = (sessions ?? []).some((session) => {
      const summary = session.summary as { plan?: { name?: string; week?: number; day?: number } } | null;
      return summary?.plan?.name === plan?.name
        && summary.plan.week === active.current_week
        && summary.plan.day === active.next_day;
    });
    return { doneNotCheckedIn, checkedInToday };
  });

/** A conscious check-in removes today's own rest/freeze cover before the camera opens. */
export const cancelNewHomeRest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ groupIds: z.array(z.string().uuid()).max(20) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!data.groupIds.length) return { ok: true };
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
    const today = localDateFor((profile?.timezone as string | null | undefined) || "UTC");
    const { error } = await supabase
      .from("streak_freezes_used")
      .delete()
      .eq("user_id", userId)
      .eq("freeze_date", today)
      .in("group_id", data.groupIds);
    if (error) throw new Error("Could not open check-in");
    return { ok: true };
  });
