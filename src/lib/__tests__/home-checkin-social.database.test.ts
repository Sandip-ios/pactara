import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkInSocialFor } from "../checkin-social";
import { cheeredByLine } from "../redesign-feed-view";
import { profileStats } from "../profile-tabs";

const base = "http://127.0.0.1:8001";
type Account = { id: string; token: string; name: string };
type HomeReaction = { checkInId: string | null; userId: string; name: string };
type HomeRow = {
  id: string;
  firstCheckInId: string | null;
  reactors: HomeReaction[];
  comments: { checkInId: string | null }[];
  workout: { prCount: number } | null;
};
type Detail = {
  summary: { prs: unknown[] };
  exercises: { exerciseId: string; sets: { weight: number | null; unit: string; reps: number | null; seconds: number | null; isPr: boolean }[] }[];
};

const key = () => {
  const value = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw Error("Draft credentials missing");
  return value;
};
async function req<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(base + path, {
    method,
    headers: { apikey: key(), Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const error = await response.json() as { message?: string; msg?: string };
    throw Error(error.message ?? error.msg ?? "Draft request failed");
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
const admin = <T>(path: string, method = "GET", body?: unknown) => req<T>(path, key(), method, body);
const rpc = <T>(account: Account, name: string, body: object) => req<T>("/rest/v1/rpc/" + name, account.token, "POST", body);

describe.skipIf(!process.env["PGHOST"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])("Home and Crew check-in social parity", () => {
  const users: Account[] = [];
  const groups: string[] = [];
  let owner: Account;
  let viewer: Account;
  let primrose: Account;
  let crewA = "";
  let crewB = "";
  let checkInA = "";
  let checkInALater = "";
  let checkInB = "";
  let dailyA = "";
  let dailyB = "";
  let sessionId = "";
  let exerciseId = "";

  beforeAll(async () => {
    async function make(name: string): Promise<Account> {
      const email = randomUUID() + "@example.com";
      const password = randomUUID();
      const user = await admin<{ id: string }>("/auth/v1/admin/users", "POST", { email, password, email_confirm: true, user_metadata: { name } });
      await admin("/rest/v1/profiles?id=eq." + user.id, "PATCH", { name, app_version: "new", new_version_enabled: true, is_private: false });
      const session = await req<{ access_token: string }>("/auth/v1/token?grant_type=password", key(), "POST", { email, password });
      const account = { id: user.id, token: session.access_token, name };
      users.push(account);
      return account;
    }
    owner = await make("Home Owner");
    viewer = await make("Home Viewer");
    primrose = await make("Primrose Example");
    for (const name of ["Social parity A", "Social parity B"]) {
      const rows = await admin<{ id: string }[]>("/rest/v1/groups", "POST", { name, owner_id: owner.id, frequency: "weekly", days_per_week: 3 });
      const id = rows[0]?.id;
      if (!id) throw Error("Crew missing");
      groups.push(id);
      for (const account of users) await admin("/rest/v1/group_members", "POST", { group_id: id, user_id: account.id });
      if (!crewA) crewA = id; else crewB = id;
    }
    const checkIns = await admin<{ id: string; group_id: string; created_at: string }[]>("/rest/v1/check_ins", "POST", [
      { user_id: owner.id, group_id: crewA, checkin_date: "2026-11-27", created_at: "2026-11-27T10:00:00Z", share_with_followers: true },
      { user_id: owner.id, group_id: crewA, checkin_date: "2026-11-27", created_at: "2026-11-27T11:00:00Z", share_with_followers: true },
      { user_id: owner.id, group_id: crewB, checkin_date: "2026-11-27", created_at: "2026-11-27T10:00:00Z", share_with_followers: true },
    ]);
    checkInA = checkIns.find((row) => row.group_id === crewA && row.created_at.startsWith("2026-11-27T10:00"))?.id ?? "";
    checkInALater = checkIns.find((row) => row.group_id === crewA && row.created_at.startsWith("2026-11-27T11:00"))?.id ?? "";
    checkInB = checkIns.find((row) => row.group_id === crewB)?.id ?? "";
    const daily = await admin<{ id: string; group_id: string }[]>("/rest/v1/daily_posts", "POST", [
      { user_id: owner.id, group_id: crewA, local_date: "2026-11-27", check_in_id: checkInA },
      { user_id: owner.id, group_id: crewB, local_date: "2026-11-27", check_in_id: checkInB },
    ]);
    dailyA = daily.find((row) => row.group_id === crewA)?.id ?? "";
    dailyB = daily.find((row) => row.group_id === crewB)?.id ?? "";
    await admin("/rest/v1/post_reactions", "POST", [
      { post_id: dailyA, user_id: primrose.id, emoji: "🔥", check_in_id: null },
      { post_id: dailyA, user_id: viewer.id, emoji: "🔥", check_in_id: checkInALater },
    ]);
    await admin("/rest/v1/post_comments", "POST", [
      { post_id: dailyA, user_id: primrose.id, body: "Legacy crew comment", check_in_id: null },
      { post_id: dailyA, user_id: viewer.id, body: "Later check-in comment", check_in_id: checkInALater },
    ]);
    const exercise = await admin<{ id: string }[]>("/rest/v1/exercises", "POST", { name: "Social parity squat", primary_muscles: ["quads"], equipment: "barbell", owner_id: owner.id, source: "custom" });
    exerciseId = exercise[0]?.id ?? "";
    const summary = { exercises: 1, sets: 1, minutes: 12, volume: 500, unit: "kg", items: [], prs: [{ exerciseId, name: "Social parity squat", weight: 100, unit: "kg", reps: 5, delta: 5 }] };
    const session = await admin<{ id: string }[]>("/rest/v1/workout_sessions", "POST", { user_id: owner.id, group_id: crewA, local_date: "2026-11-27", status: "ended_without_completion", title: "Social parity workout", logged_at: "2026-11-27T10:30:00Z", summary, check_in_ids: [checkInA, checkInALater, checkInB] });
    sessionId = session[0]?.id ?? "";
    await admin("/rest/v1/workout_set_logs", "POST", { user_id: owner.id, session_id: sessionId, exercise_id: exerciseId, position: 0, set_no: 1, weight: 100, unit: "kg", reps: 5, seconds: null, is_pr: true, local_date: "2026-11-27", done_at: "2026-11-27T10:30:00Z" });
  });

  afterAll(async () => {
    if (sessionId) await admin("/rest/v1/workout_sessions?id=eq." + sessionId, "DELETE");
    if (exerciseId) await admin("/rest/v1/exercises?id=eq." + exerciseId, "DELETE");
    for (const group of groups) await admin("/rest/v1/groups?id=eq." + group, "DELETE");
    for (const account of users) {
      await admin("/rest/v1/content_reports?or=(reporter_id.eq." + account.id + ",reported_user_id.eq." + account.id + ")", "DELETE");
      await admin("/rest/v1/subscriptions?user_id=eq." + account.id, "DELETE");
      await admin("/auth/v1/admin/users/" + account.id, "DELETE");
    }
    expect(await admin<unknown[]>("/rest/v1/profiles?id=in.(" + users.map((account) => account.id).join(",") + ")")).toEqual([]);
  });

  async function homeRows(ids: string[]) {
    return rpc<HomeRow[]>(viewer, "get_new_home_checkins", { _ids: ids });
  }
  async function crewRows(postId: string) {
    const reactions = await req<{ check_in_id: string | null; user_id: string }[]>(`/rest/v1/post_reactions?select=check_in_id,user_id&post_id=eq.${postId}&order=created_at.asc`, viewer.token);
    const comments = await req<{ check_in_id: string | null }[]>(`/rest/v1/post_comments?select=check_in_id&post_id=eq.${postId}&order=created_at.asc`, viewer.token);
    return {
      reactions: reactions.map((row) => ({ checkInId: row.check_in_id, userId: row.user_id })),
      comments: comments.map((row) => ({ checkInId: row.check_in_id })),
    };
  }
  function cheerLine(reactors: { userId: string; name?: string }[]) {
    return cheeredByLine(reactors.map((reactor) => {
      const name = reactor.name ?? users.find((account) => account.id === reactor.userId)?.name ?? "Member";
      return { firstName: name.split(" ")[0] || "Member", isMe: reactor.userId === viewer.id };
    }));
  }

  it("returns identical Home and Crew cheer lines, counts and comments, including legacy NULL rows", async () => {
    const [homeA] = await homeRows([checkInA]);
    if (!homeA) throw Error("Home check-in missing");
    const crew = await crewRows(dailyA);
    const homeSocial = checkInSocialFor(checkInA, homeA.firstCheckInId, homeA.reactors, homeA.comments);
    const crewSocial = checkInSocialFor(checkInA, checkInA, crew.reactions, crew.comments);
    expect(homeSocial.reactors.map((reactor) => reactor.userId)).toEqual(crewSocial.reactors.map((reactor) => reactor.userId));
    expect(homeSocial.reactors.map((reactor) => reactor.userId)).toEqual([primrose.id]);
    expect(cheerLine(homeSocial.reactors)).toBe("Primrose cheered");
    expect(cheerLine(crewSocial.reactors)).toBe(cheerLine(homeSocial.reactors));
    expect(homeSocial.commentCount).toBe(crewSocial.commentCount);
    expect(homeSocial.commentCount).toBe(1);
  });

  it("keeps later check-ins and multi-crew copies independently scoped", async () => {
    const rows = await homeRows([checkInA, checkInALater, checkInB]);
    const first = rows.find((row) => row.id === checkInA);
    const later = rows.find((row) => row.id === checkInALater);
    const otherCrew = rows.find((row) => row.id === checkInB);
    if (!first || !later || !otherCrew) throw Error("Home check-ins missing");
    const laterSocial = checkInSocialFor(later.id, later.firstCheckInId, later.reactors, later.comments);
    const otherSocial = checkInSocialFor(otherCrew.id, otherCrew.firstCheckInId, otherCrew.reactors, otherCrew.comments);
    expect(laterSocial.reactors.map((reactor) => reactor.userId)).toEqual([viewer.id]);
    expect(laterSocial.commentCount).toBe(1);
    expect(otherSocial.reactors).toEqual([]);
    expect(otherSocial.commentCount).toBe(0);
    const firstSocial = checkInSocialFor(first.id, first.firstCheckInId, first.reactors, first.comments);
    expect(firstSocial.reactors.map((reactor) => reactor.userId)).toEqual([primrose.id]);
  });

  it("returns the Crew card's real PR count, summary and per-set flags on Home", async () => {
    const [homeA] = await homeRows([checkInA]);
    if (!homeA) throw Error("Home check-in missing");
    const [crewSummary] = await rpc<{ summary: { prs: unknown[] } }[]>(viewer, "workout_summaries_for_check_ins", { _check_in_ids: [checkInA] });
    expect(homeA.workout?.prCount).toBe(1);
    expect(homeA.workout?.prCount).toBe(crewSummary?.summary.prs.length);
    const home = await rpc<{ workoutDetail: Detail }>(viewer, "get_home_checkin_social", { _id: checkInA });
    const crew = await rpc<{ summary: { prs: unknown[] }; sets: { exerciseId: string; weight: number | null; unit: string; reps: number | null; seconds: number | null; isPr: boolean }[] }>(viewer, "workout_detail_for_check_in", { _check_in_id: checkInA });
    expect(home.workoutDetail.summary.prs).toEqual(crew.summary.prs);
    const homeSets = home.workoutDetail.exercises.flatMap((exercise) => exercise.sets.map((set) => ({ exerciseId: exercise.exerciseId, ...set })));
    expect(homeSets).toEqual(crew.sets.map(({ exerciseId, weight, unit, reps, seconds, isPr }) => ({ exerciseId, weight, unit, reps, seconds, isPr })));
    expect(homeSets).toEqual([{ exerciseId, weight: 100, unit: "kg", reps: 5, seconds: null, isPr: true }]);
  });

  it("filters a blocked reactor and their comments from Home just as the Crew feed does", async () => {
    await req("/rest/v1/user_blocks", viewer.token, "POST", { blocker_id: viewer.id, blocked_id: primrose.id });
    const [homeA] = await homeRows([checkInA]);
    if (!homeA) throw Error("Home check-in missing");
    const social = checkInSocialFor(checkInA, homeA.firstCheckInId, homeA.reactors, homeA.comments);
    expect(social.reactors).toEqual([]);
    expect(social.commentCount).toBe(0);
  });

  it("lets the owner cheer and uncheer each crew copy and later check-in through Home", async () => {
    async function rewards() {
      const checks = await req<{ checkin_date: string }[]>(`/rest/v1/check_ins?user_id=eq.${owner.id}&select=checkin_date`, owner.token);
      const badges = await admin<unknown[]>(`/rest/v1/earned_badges?user_id=eq.${owner.id}`);
      const freezes = await admin<unknown[]>(`/rest/v1/profiles?id=eq.${owner.id}&select=streak_freezes_available`);
      return { badges, freezes, stats: profileStats({ joinedOn: "2026-11-23", today: "2026-11-27", checkIns: checks.map(c => c.checkin_date), covered: [], target: 3 }) };
    }
    const rewardsBefore = await rewards();
    expect(rewardsBefore.stats.totalCheckIns).toBe(1);
    expect(rewardsBefore.stats.best.count).toBe(1);
    for (const id of [checkInA, checkInALater, checkInB]) {
      const before = await rpc<{ cheers: number }>(owner, "get_home_checkin_social", { _id: id });
      await rpc(owner, "home_checkin_action", { _id: id, _action: "cheer" });
      const cheered = await rpc<{ cheers: number; cheered: boolean }>(owner, "get_home_checkin_social", { _id: id });
      expect(cheered.cheered).toBe(true);
      expect(cheered.cheers).toBe(before.cheers + 1);
      expect(await rewards()).toEqual(rewardsBefore);
      await rpc(owner, "home_checkin_action", { _id: id, _action: "cheer" });
      const undone = await rpc<{ cheers: number; cheered: boolean }>(owner, "get_home_checkin_social", { _id: id });
      expect(undone.cheered).toBe(false);
      expect(undone.cheers).toBe(before.cheers);
    }
  });

  it("allows owner reactions through the Crew/profile write path, including legacy NULL scope", async () => {
    for (const scope of [null, checkInALater]) {
      const [row] = await req<{ id: string }[]>("/rest/v1/post_reactions", owner.token, "POST", { post_id: dailyA, user_id: owner.id, emoji: "🔥", check_in_id: scope });
      if (!row) throw Error("Owner reaction missing");
      const id = scope ?? checkInA;
      const social = await rpc<{ cheered: boolean }>(owner, "get_home_checkin_social", { _id: id });
      expect(social.cheered).toBe(true);
      const [home] = await rpc<HomeRow[]>(owner, "get_new_home_checkins", { _ids: [id] });
      if (!home) throw Error("Owner check-in missing");
      const reactors = checkInSocialFor(id, home.firstCheckInId, home.reactors, home.comments).reactors;
      expect(reactors.filter(r => r.userId === owner.id)).toHaveLength(1);
      expect(cheeredByLine(reactors.map(r => ({ firstName: r.name.split(" ")[0] || "Member", isMe: r.userId === owner.id })))).toBe(scope ? "Home and you cheered" : "Primrose and you cheered");
      await req("/rest/v1/post_reactions?id=eq." + row.id, owner.token, "DELETE");
      expect((await rpc<{ cheered: boolean }>(owner, "get_home_checkin_social", { _id: id })).cheered).toBe(false);
    }
  });
});
