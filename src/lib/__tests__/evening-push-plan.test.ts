import { describe, expect, it, vi } from "vitest";
import {
  canClaimEveningPush,
  dailyReminderEveningPlan,
  isEveningPushHour,
  planEveningPush,
  sendEveningPush,
  type EveningPushDeps,
  type EveningPushRecord,
} from "../evening-push-plan";
import type { RiskGroupInput } from "../streak-risk-plan";

// Saturday Nov 21 2026 in Chicago (week Nov 16–22): 8 PM = 02:00 UTC, 9 PM = 03:00 UTC on Nov 22.
const TZ = "America/Chicago";
const eightPm = new Date("2026-11-22T02:00:00Z");
const ninePm = new Date("2026-11-22T03:00:00Z");
const daily = { frequency: "daily", days_per_week: 7 };

/** Needs a check-in tonight (both rest days used) but has no streak to lose → 8 PM group. */
const lastCall = (groupId: string, name: string): RiskGroupInput => ({
  groupId,
  name,
  schedule: daily,
  checkIns: new Set(),
  rests: new Set(["2026-11-16", "2026-11-17"]),
  freezes: new Set(),
});
/** 5-day streak, no rest days left, nothing today → 9 PM "streak at risk" group. */
const atRisk = (groupId: string, name: string): RiskGroupInput => ({
  groupId,
  name,
  schedule: daily,
  checkIns: new Set(["2026-11-16", "2026-11-17", "2026-11-18"]),
  rests: new Set(["2026-11-19", "2026-11-20"]),
  freezes: new Set(),
});

/** In-memory evening_push_sends with the same claim rule as the database function. */
function ledger(delivered = 1) {
  const rows = new Map<string, EveningPushRecord>();
  const push = vi.fn(async () => ({ webSent: 0, fcmSent: delivered }));
  const deps: EveningPushDeps = {
    claim: async (userId, localDate, hour) => {
      const key = `${userId}:${localDate}`;
      if (!canClaimEveningPush(rows.get(key), hour)) return false;
      rows.set(key, { hour, status: "sending" });
      return true;
    },
    finish: async (userId, localDate, status) => {
      const row = rows.get(`${userId}:${localDate}`);
      if (row) row.status = status;
    },
    push,
  };
  return { rows, push, deps };
}

describe("one evening push per member per local day", () => {
  it("8 PM sent → the 9 PM push is skipped that night", async () => {
    const { push, deps, rows } = ledger();
    const eight = planEveningPush({ hour: 20, timezone: TZ, groups: [lastCall("g1", "Fit Uxers")], hasFreeze: false, now: eightPm });
    expect(eight?.message.title).toBe("Last call to check in 🌙");
    expect(await sendEveningPush(deps, "u1", TZ, eight!, eightPm)).toEqual({ claimed: true, delivered: 1 });
    expect(rows.get("u1:2026-11-21")).toEqual({ hour: 20, status: "sent" });

    // By 9 PM a group is at risk (e.g. joined a crew in between) — still no second push.
    const nine = planEveningPush({ hour: 21, timezone: TZ, groups: [atRisk("g2", "Runners")], hasFreeze: false, now: ninePm });
    expect(nine).not.toBeNull();
    expect(await sendEveningPush(deps, "u1", TZ, nine!, ninePm)).toEqual({ claimed: false, delivered: 0 });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("a failed 8 PM push doesn't block the 9 PM one", async () => {
    const failed = ledger(0);
    const eight = planEveningPush({ hour: 20, timezone: TZ, groups: [lastCall("g1", "Fit Uxers")], hasFreeze: false, now: eightPm })!;
    await sendEveningPush(failed.deps, "u1", TZ, eight, eightPm);
    expect(failed.rows.get("u1:2026-11-21")?.status).toBe("failed");
    const nine = planEveningPush({ hour: 21, timezone: TZ, groups: [atRisk("g2", "Runners")], hasFreeze: false, now: ninePm })!;
    expect((await sendEveningPush(failed.deps, "u1", TZ, nine, ninePm)).claimed).toBe(true);
    expect(failed.push).toHaveBeenCalledTimes(2);
  });

  it("only the 9 PM push goes out when the 8 PM one didn't apply (every crew at risk)", async () => {
    const { push, deps } = ledger();
    const groups = [atRisk("g1", "Fit Uxers")];
    expect(planEveningPush({ hour: 20, timezone: TZ, groups, hasFreeze: false, now: eightPm })).toBeNull();
    const nine = planEveningPush({ hour: 21, timezone: TZ, groups, hasFreeze: false, now: ninePm })!;
    expect(nine.message.title).toBe("Your 5-day streak in Fit Uxers is at risk 🔥");
    expect((await sendEveningPush(deps, "u1", TZ, nine, ninePm)).claimed).toBe(true);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("mixed crews: one 8 PM push names all crews, at-risk first, and the 9 PM push is skipped", async () => {
    const { push, deps } = ledger();
    const groups = [lastCall("g2", "Runners"), atRisk("g1", "Fit Uxers")];
    const eight = planEveningPush({ hour: 20, timezone: TZ, groups, hasFreeze: false, now: eightPm })!;
    expect(eight.groupIds).toEqual(["g1", "g2"]);
    expect(eight.message.body).toBe("Your Fit Uxers streak is on the line. Runners is waiting on you too.");
    expect((await sendEveningPush(deps, "u1", TZ, eight, eightPm)).claimed).toBe(true);
    const nine = planEveningPush({ hour: 21, timezone: TZ, groups, hasFreeze: false, now: ninePm })!;
    expect((await sendEveningPush(deps, "u1", TZ, nine, ninePm)).claimed).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("two groups → one push naming both (8 PM and 9 PM)", async () => {
    const eight = planEveningPush({
      hour: 20,
      timezone: TZ,
      groups: [lastCall("g1", "Fit Uxers"), lastCall("g2", "Runners")],
      hasFreeze: false,
      now: eightPm,
    })!;
    expect(eight.groupIds).toEqual(["g1", "g2"]);
    expect(eight.message.body).toBe("Check in for Fit Uxers and Runners before bed.");

    const { push, deps } = ledger();
    const nine = planEveningPush({
      hour: 21,
      timezone: TZ,
      groups: [atRisk("g1", "Fit Uxers"), atRisk("g2", "Runners")],
      hasFreeze: false,
      now: ninePm,
    })!;
    expect(nine.message.title).toBe("2 streaks are at risk 🔥");
    await sendEveningPush(deps, "u1", TZ, nine, ninePm);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("a job running twice (or two runs overlapping) sends one push", async () => {
    const { push, deps } = ledger();
    const nine = planEveningPush({ hour: 21, timezone: TZ, groups: [atRisk("g1", "Fit Uxers")], hasFreeze: false, now: ninePm })!;
    const [a, b] = await Promise.all([
      sendEveningPush(deps, "u1", TZ, nine, ninePm),
      sendEveningPush(deps, "u1", TZ, nine, ninePm),
    ]);
    const again = await sendEveningPush(deps, "u1", TZ, nine, ninePm);
    expect([a.claimed, b.claimed, again.claimed].filter(Boolean)).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("the next local day starts fresh", async () => {
    const { push, deps } = ledger();
    const nine = planEveningPush({ hour: 21, timezone: TZ, groups: [atRisk("g1", "Fit Uxers")], hasFreeze: false, now: ninePm })!;
    await sendEveningPush(deps, "u1", TZ, nine, ninePm);
    await sendEveningPush(deps, "u1", TZ, nine, new Date("2026-11-23T03:00:00Z"));
    expect(push).toHaveBeenCalledTimes(2);
  });
});

describe("personal daily reminder set between 8:00 and 9:59 PM", () => {
  const reminder = { title: "Time to check in ✅", body: "Log today's check-in for Fit Uxers. 🔥", url: "/check-in?group=g1" };

  it("only 8 PM and 9 PM reminder hours share the evening slot", () => {
    expect([19, 20, 21, 22, 9].map(isEveningPushHour)).toEqual([false, true, true, false, false]);
    expect(dailyReminderEveningPlan(9, ["g1"], reminder)).toBeNull();
    expect(dailyReminderEveningPlan(19, ["g1"], reminder)).toBeNull();
    expect(dailyReminderEveningPlan(22, ["g1"], reminder)).toBeNull();
  });

  it("a reminder at 8:30 PM went out → the 8 PM and 9 PM pushes are skipped that night", async () => {
    const { push, deps, rows } = ledger();
    const own = dailyReminderEveningPlan(20, ["g1"], reminder)!;
    expect((await sendEveningPush(deps, "u1", TZ, own, eightPm)).claimed).toBe(true);
    const eight = planEveningPush({ hour: 20, timezone: TZ, groups: [lastCall("g1", "Fit Uxers")], hasFreeze: false, now: eightPm })!;
    const nine = planEveningPush({ hour: 21, timezone: TZ, groups: [atRisk("g1", "Fit Uxers")], hasFreeze: false, now: ninePm })!;
    expect((await sendEveningPush(deps, "u1", TZ, eight, eightPm)).claimed).toBe(false);
    expect((await sendEveningPush(deps, "u1", TZ, nine, ninePm)).claimed).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
    expect(rows.get("u1:2026-11-21")?.status).toBe("sent");
  });

  it("8 PM push went out → a reminder set for 9:15 PM is skipped", async () => {
    const { push, deps } = ledger();
    const eight = planEveningPush({ hour: 20, timezone: TZ, groups: [lastCall("g1", "Fit Uxers")], hasFreeze: false, now: eightPm })!;
    await sendEveningPush(deps, "u1", TZ, eight, eightPm);
    const own = dailyReminderEveningPlan(21, ["g1"], reminder)!;
    expect((await sendEveningPush(deps, "u1", TZ, own, ninePm)).claimed).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("a reminder at 9 PM after a failed 8 PM push still goes out, and the 9 PM job then skips", async () => {
    const { push, deps } = ledger(0);
    const eight = planEveningPush({ hour: 20, timezone: TZ, groups: [lastCall("g1", "Fit Uxers")], hasFreeze: false, now: eightPm })!;
    await sendEveningPush(deps, "u1", TZ, eight, eightPm);
    const own = dailyReminderEveningPlan(21, ["g1"], reminder)!;
    expect((await sendEveningPush(deps, "u1", TZ, own, ninePm)).claimed).toBe(true);
    const nine = planEveningPush({ hour: 21, timezone: TZ, groups: [atRisk("g1", "Fit Uxers")], hasFreeze: false, now: ninePm })!;
    expect((await sendEveningPush(deps, "u1", TZ, nine, ninePm)).claimed).toBe(false);
    expect(push).toHaveBeenCalledTimes(2);
  });
});
