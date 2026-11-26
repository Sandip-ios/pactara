import { describe, expect, it } from "vitest";
import { crewIsActive } from "../crew-lifecycle";
import { requireCrewOwner } from "../crew-management";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRiskInputs } from "../streak-risk-inputs.server";
import { atRiskGroups, eveningReminderGroups, morningReminderGroups } from "../streak-risk-plan";

describe("ended crew rules", () => {
  it("keeps every existing crew with a null ending active", () => {
    expect(crewIsActive({ ended_at: null })).toBe(true);
  });
  it("excludes ended crews from active job inputs without changing their history", () => {
    const rows = [
      { id: "QA Crew", ended_at: null, checkIns: ["2026-11-26"] },
      { id: "QA End Test", ended_at: "2026-11-26T02:12:00Z", checkIns: ["2026-11-25"] },
    ];
    expect(rows.filter(crewIsActive).map(row => row.id)).toEqual(["QA Crew"]);
    expect(rows[1]?.checkIns).toEqual(["2026-11-25"]);
  });
  it("requires the current owner, not another member, to end a crew", () => {
    expect(() => requireCrewOwner("qa-owner", "qa-member")).toThrow();
    expect(() => requireCrewOwner("qa-owner", "qa-owner")).not.toThrow();
  });
  it("does not supply an ended crew to daily, evening or streak-risk reminders", async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      group_members: ["active", "ended"].map(group_id => ({ user_id: "qa-owner", group_id })),
      groups: [
        { id: "active", name: "QA Crew", frequency: "daily", days_per_week: 7, ended_at: null },
        { id: "ended", name: "QA End Test", frequency: "daily", days_per_week: 7, ended_at: "2026-11-26T02:12:00Z" },
      ],
      check_ins: ["active", "ended"].map(group_id => ({ user_id: "qa-owner", group_id, checkin_date: "2026-11-23" })),
      streak_freezes_used: ["active", "ended"].flatMap(group_id => ["2026-11-24", "2026-11-25"].map(freeze_date => ({ user_id: "qa-owner", group_id, freeze_date, kind: "rest" }))),
    };
    const client = {
      from: (table: string) => {
        const rows = tables[table] ?? [];
        const query = {
          select: () => query, in: () => query, gte: () => query, order: () => query,
          // Return all rows to test the shared loader's defensive lifecycle gate too.
          is: () => query,
          range: () => Promise.resolve({ data: rows, error: null }),
        };
        return query;
      },
    } as unknown as SupabaseClient;
    const now = new Date("2026-11-26T21:00:00Z");
    const inputs = (await loadRiskInputs(client, ["qa-owner"], now, 9)).get("qa-owner") ?? [];
    expect(inputs.map(group => group.groupId)).toEqual(["active"]);
    expect(morningReminderGroups("UTC", inputs, now).map(group => group.groupId)).toEqual(["active"]);
    expect(eveningReminderGroups(17, "UTC", inputs, now).map(group => group.groupId)).toEqual(["active"]);
    expect(atRiskGroups("UTC", inputs, now).map(group => group.groupId)).toEqual(["active"]);
  });
});