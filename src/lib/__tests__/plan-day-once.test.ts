import { describe, expect, it } from "vitest";
import { localDayBounds } from "../local-day-bounds";
import { logPlanWorkout } from "../plan-progress.server";

// Tiny in-memory stand-in for the two tables logPlanWorkout touches.
function fakeDb(now: () => string) {
  const plan = { id: "up1", user_id: "u1", status: "active", current_week: 1, next_day: 1, plans: { slug: "p", name: "P", weeks: 4, days_per_week: 3 } };
  const logs: { user_plan_id: string; completed_at: string; check_in_id: string | null }[] = [];
  const q = (table: string) => {
    const f: [string, string, unknown][] = [];
    let patch: any = null;
    let ins: any[] | null = null;
    const rowsOf = () => (table === "user_plans" ? [plan] : logs) as any[];
    const match = (r: any) => f.every(([op, k, v]) => (op === "eq" ? r[k] === v : op === "gte" ? r[k] >= (v as string) : r[k] < (v as string)));
    const run = () => {
      if (ins) { for (const r of ins) logs.push({ ...r, completed_at: now() }); return { data: ins, error: null }; }
      const hit = rowsOf().filter(match);
      if (patch) { hit.forEach((r) => Object.assign(r, patch)); }
      return { data: hit, error: null };
    };
    const b: any = {
      select: () => b, limit: () => b,
      eq: (k: string, v: unknown) => (f.push(["eq", k, v]), b),
      gte: (k: string, v: string) => (f.push(["gte", k, v]), b),
      lt: (k: string, v: string) => (f.push(["lt", k, v]), b),
      update: (p: any) => ((patch = p), b),
      insert: (r: any[]) => ((ins = r), Promise.resolve(run())),
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      then: (res: any) => Promise.resolve(run()).then(res),
    };
    return b;
  };
  return { db: { from: q } as any, plan, logs };
}

describe("one plan day per local day per plan", () => {
  it("a deleted check-in does not free the day", async () => {
    const { db, plan, logs } = fakeDb(() => "2026-11-26T15:00:00.000Z");
    expect(await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 1 }, ["c1"], "2026-11-26", "UTC")).not.toBeNull();
    logs[0].check_in_id = null; // check-in deleted (ON DELETE SET NULL)
    expect(await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 2 }, ["c2"], "2026-11-26", "UTC")).toBeNull();
    expect(plan.next_day).toBe(2);
  });
  it("moves normally the next local day", async () => {
    let t = "2026-11-26T15:00:00.000Z";
    const { db, plan } = fakeDb(() => t);
    await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 1 }, ["c1"], "2026-11-26", "UTC");
    t = "2026-11-27T09:00:00.000Z";
    expect(await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 2 }, ["c2"], "2026-11-27", "UTC")).not.toBeNull();
    expect(plan.next_day).toBe(3);
  });
  it("same plan day posted twice advances once", async () => {
    let t = "2026-11-26T15:00:00.000Z";
    const { db, plan } = fakeDb(() => t);
    await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 1 }, ["c1"], "2026-11-26", "UTC");
    t = "2026-11-27T09:00:00.000Z";
    expect(await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 1 }, ["c2"], "2026-11-27", "UTC")).toBeNull();
    expect(plan.next_day).toBe(2);
  });
  it("uses the member's timezone, not UTC", async () => {
    // 03:00 UTC on the 27th is still the evening of the 26th in New York.
    let t = "2026-11-27T03:00:00.000Z";
    const { db, plan } = fakeDb(() => t);
    await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 1 }, ["c1"], "2026-11-26", "America/New_York");
    t = "2026-11-27T04:30:00.000Z"; // 23:30 on the 26th in New York
    expect(await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 2 }, ["c2"], "2026-11-26", "America/New_York")).toBeNull();
    t = "2026-11-27T06:00:00.000Z"; // 01:00 on the 27th in New York
    expect(await logPlanWorkout(db, "u1", { userPlanId: "up1", week: 1, day: 2 }, ["c3"], "2026-11-27", "America/New_York")).not.toBeNull();
    expect(plan.next_day).toBe(3);
    expect(localDayBounds("America/New_York", "2026-11-26")).toEqual({ start: "2026-11-26T05:00:00.000Z", end: "2026-11-27T05:00:00.000Z" });
  });
});
