import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeStreaks(dates: string[]) {
  const set = new Set(dates);
  // current streak (ending today or yesterday)
  let current = 0;
  const today = new Date();
  let cursor = new Date(today);
  if (!set.has(ymd(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (set.has(ymd(cursor))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  // best streak
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const s of sorted) {
    const d = new Date(s + "T00:00:00Z");
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = d;
  }
  return { current, best };
}

export const getProfileOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_color")
      .eq("id", userId)
      .maybeSingle();

    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let groupName: string | null = null;
    if (membership) {
      const { data: g } = await supabase
        .from("groups")
        .select("name")
        .eq("id", membership.group_id)
        .maybeSingle();
      groupName = g?.name ?? null;
    }

    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("checkin_date")
      .eq("user_id", userId);

    const dates = (checkIns ?? []).map((c: { checkin_date: string }) => c.checkin_date);
    const { current, best } = computeStreaks(dates);

    // past 7 days (oldest -> newest)
    const past7: { date: string; checked: boolean }[] = [];
    const set = new Set(dates);
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const s = ymd(d);
      past7.push({ date: s, checked: set.has(s) });
    }

    return {
      name: profile?.name ?? "",
      avatarColor: profile?.avatar_color ?? "#7C3AED",
      groupName,
      totalCheckIns: dates.length,
      currentStreak: current,
      bestStreak: best,
      past7,
    };
  });
