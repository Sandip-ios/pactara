import { crewIsActive } from "./crew-lifecycle";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskGroupInput } from "@/lib/streak-risk-plan";

const PAGE = 1000;

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * Loads, in batches, every group of each user with their check-ins, rest rows
 * and freeze rows since `lookbackDays` ago — the inputs of streak-risk-plan.
 */
export async function loadRiskInputs(
  admin: SupabaseClient,
  userIds: string[],
  now: Date,
  lookbackDays: number,
): Promise<Map<string, RiskGroupInput[]>> {
  const result = new Map<string, RiskGroupInput[]>();
  if (userIds.length === 0) return result;
  const since = new Date(now.getTime() - lookbackDays * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [memberships, checkIns, freezes] = await Promise.all([
    fetchAll<{ user_id: string; group_id: string }>((from, to) =>
      admin.from("group_members").select("user_id, group_id").in("user_id", userIds).order("id").range(from, to),
    ),
    fetchAll<{ user_id: string; group_id: string; checkin_date: string }>((from, to) =>
      admin
        .from("check_ins")
        .select("user_id, group_id, checkin_date")
        .in("user_id", userIds)
        .gte("checkin_date", since)
        .order("id")
        .range(from, to),
    ),
    fetchAll<{ user_id: string; group_id: string; freeze_date: string; kind: string | null }>((from, to) =>
      admin
        .from("streak_freezes_used")
        .select("user_id, group_id, freeze_date, kind")
        .in("user_id", userIds)
        .gte("freeze_date", since)
        .order("id")
        .range(from, to),
    ),
  ]);

  const groupIds = [...new Set(memberships.map((m) => m.group_id))];
  const groups = groupIds.length
    ? await fetchAll<{ id: string; name: string; frequency: string | null; days_per_week: number | null; ended_at: string | null }>(
        (from, to) =>
          admin.from("groups").select("id, name, frequency, days_per_week, ended_at").is("ended_at", null).in("id", groupIds).order("id").range(from, to),
      )
    : [];
  const groupById = new Map(groups.filter(crewIsActive).map((g) => [g.id, g]));

  const byUser = new Map<string, Map<string, RiskGroupInput>>();
  for (const m of memberships) {
    const g = groupById.get(m.group_id);
    if (!g) continue;
    const byGroup = byUser.get(m.user_id) ?? new Map<string, RiskGroupInput>();
    byGroup.set(g.id, {
      groupId: g.id,
      name: g.name,
      schedule: { frequency: g.frequency, days_per_week: g.days_per_week },
      checkIns: new Set(),
      rests: new Set(),
      freezes: new Set(),
    });
    byUser.set(m.user_id, byGroup);
  }
  for (const c of checkIns) byUser.get(c.user_id)?.get(c.group_id)?.checkIns.add(c.checkin_date);
  for (const f of freezes) {
    const g = byUser.get(f.user_id)?.get(f.group_id);
    if (!g) continue;
    (f.kind === "rest" ? g.rests : g.freezes).add(f.freeze_date);
  }
  for (const [userId, byGroup] of byUser) result.set(userId, [...byGroup.values()]);
  return result;
}
