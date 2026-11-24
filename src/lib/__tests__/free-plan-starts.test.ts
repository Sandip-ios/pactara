import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { planStartAction } from "../workout-plans";

const root = new URL("../../../", import.meta.url);

// Exercise the actual event handlers without rendering the full route or
// replacing their decisions with a test-only copy. A reintroduced membership
// branch receives an unsubscribed account and must fail these action assertions.
function handler(path: string, start: string, end: string, scope: Record<string, unknown>) {
  const source = readFileSync(new URL(path, root), "utf8");
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Missing handler boundaries in ${path}`);
  return new Function(...Object.keys(scope), `return ${source.slice(from + start.length, to).trim().replace(/;$/, "")}`)(...Object.values(scope)) as (...args: unknown[]) => Promise<unknown>;
}

function unpaidScope() {
  return {
    supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "unpaid", user_metadata: {} } } }) } },
    hasActiveMembership: vi.fn().mockResolvedValue(false),
    setPaywall: vi.fn(),
  };
}

describe("free plan starts for an account without a trial or subscription", () => {
  for (const fresh of [false, true]) {
    it(`starts or resumes a plan directly (fresh=${fresh})`, async () => {
      const scope = {
        ...unpaidScope(), onThisPlan: false, checking: false, starting: false,
        active: null, setChecking: vi.fn(), setConfirmSwitch: vi.fn(), doStart: vi.fn(),
      };
      await handler("src/routes/_authenticated/plans.$slug.tsx", "const onStartTap = ", "\n\n  const schedule", scope)(fresh);
      expect(scope.doStart).toHaveBeenCalledExactlyOnceWith(fresh);
      expect(scope.setPaywall).not.toHaveBeenCalled();
      expect(scope.hasActiveMembership).not.toHaveBeenCalled();
    });
    it(`confirms a switch without a membership gate (fresh=${fresh})`, async () => {
      const scope = {
        ...unpaidScope(), onThisPlan: false, checking: false, starting: false,
        active: { planId: "other" }, setChecking: vi.fn(), setConfirmSwitch: vi.fn(), doStart: vi.fn(),
      };
      await handler("src/routes/_authenticated/plans.$slug.tsx", "const onStartTap = ", "\n\n  const schedule", scope)(fresh);
      expect(scope.setConfirmSwitch).toHaveBeenCalledExactlyOnceWith({ fresh });
      expect(scope.doStart).not.toHaveBeenCalled();
      expect(scope.setPaywall).not.toHaveBeenCalled();
    });
  }

  it("starts a plan workout directly without an active plan", async () => {
    const scope = {
      ...unpaidScope(), busy: false, day: { dayNumber: 1 }, onThisPlan: false,
      active: null, getActiveWorkout: () => null, setBusy: vi.fn(),
      setConfirmSwitch: vi.fn(), beginPlanThenLaunch: vi.fn(),
    };
    await handler("src/routes/_authenticated/plans.$slug_.day.tsx", "const onStart = ", "\n\n  return (", scope)();
    expect(scope.beginPlanThenLaunch).toHaveBeenCalledOnce();
    expect(scope.setPaywall).not.toHaveBeenCalled();
    expect(scope.hasActiveMembership).not.toHaveBeenCalled();
  });

  it("confirms a switch before launching another plan's workout", async () => {
    const scope = {
      ...unpaidScope(), busy: false, day: { dayNumber: 1 }, onThisPlan: false,
      active: { planId: "other" }, getActiveWorkout: () => null, setBusy: vi.fn(),
      setConfirmSwitch: vi.fn(), beginPlanThenLaunch: vi.fn(),
    };
    await handler("src/routes/_authenticated/plans.$slug_.day.tsx", "const onStart = ", "\n\n  return (", scope)();
    expect(scope.setConfirmSwitch).toHaveBeenCalledExactlyOnceWith(true);
    expect(scope.beginPlanThenLaunch).not.toHaveBeenCalled();
    expect(scope.setPaywall).not.toHaveBeenCalled();
  });

  it("launches the existing plan's workout without membership", async () => {
    const active = { planId: "current" };
    const scope = {
      ...unpaidScope(), busy: false, day: { dayNumber: 1 }, onThisPlan: true,
      active, getActiveWorkout: () => null, setBusy: vi.fn(), launch: vi.fn(),
    };
    await handler("src/routes/_authenticated/plans.$slug_.day.tsx", "const onStart = ", "\n\n  return (", scope)();
    expect(scope.launch).toHaveBeenCalledExactlyOnceWith(active);
    expect(scope.hasActiveMembership).not.toHaveBeenCalled();
  });

  it("the server creates an unpaid member's plan without consulting subscriptions", async () => {
    const insert = vi.fn();
    const from = vi.fn((table: string) => {
      if (!["plans", "user_plans"].includes(table)) throw new Error(`Unexpected gated table: ${table}`);
      type Query = {
        select: () => Query;
        eq: () => Query;
        maybeSingle: () => Promise<{ data: { id: string } }>;
        insert: (value: unknown) => Query;
        single: () => Promise<{ data: { id: string }; error: null }>;
        then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
      };
      const query: Query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { id: "plan" } }),
        insert: (value: unknown) => { insert(value); return query; },
        single: async () => ({ data: { id: "run" }, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return query;
    });
    const source = readFileSync(new URL("src/lib/plans.functions.ts", root), "utf8").split("export const startPlan = ")[1];
    if (!source) throw new Error("Missing startPlan");
    const match = source.match(/\.handler\(async \(\{ data, context \}\) => \{([\s\S]*?)\n  \}\);/);
    if (!match?.[1]) throw new Error("Missing startPlan handler");
    // Remove only the type cast in the production handler's row mapping.
    const body = match[1].replace(' as UserPlanRow["status"]', "");
    const run = new Function("planStartAction", `return async ({data, context}) => {${body}}`)(planStartAction);
    expect(await run({ data: { planId: "plan", fresh: false }, context: { supabase: { from }, userId: "unpaid" } })).toEqual({ userPlanId: "run" });
    expect(insert).toHaveBeenCalledExactlyOnceWith({ user_id: "unpaid", plan_id: "plan" });
  });
});