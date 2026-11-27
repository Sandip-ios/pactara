import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { homePage, type HomeRef } from "../home-feed";
const base = "http://127.0.0.1:8001";
type Account = { id: string; token: string };
let viewer: Account | undefined;
let author: Account | undefined;
const users: string[] = [];
const groups: string[] = [];
const posts: string[] = [];
let checkin = "";
const key = () => {
  const value = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw Error("Draft credentials missing");
  return value;
};
async function req<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(base + path, {
    method,
    headers: {
      apikey: key(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!r.ok) {
    const e = (await r.json()) as { message?: string; msg?: string };
    throw Error(e.message ?? e.msg ?? "Draft request failed");
  }
  const text = await r.text();
  return (text ? JSON.parse(text) : null) as T;
}
const admin = <T>(path: string, method = "GET", body?: unknown) =>
  req<T>(path, key(), method, body);
const rpc = <T>(a: Account, name: string, body: object) =>
  req<T>("/rest/v1/rpc/" + name, a.token, "POST", body);
const people = () => {
  if (!viewer || !author) throw Error("Accounts missing");
  return { v: viewer, a: author };
};
const workout = {
  source: "caption",
  title: "A long full-body workout name that is much longer than the saved workout limit allows",
  minutes: 45,
  sets: 12,
  prCount: 0,
  moves: Array.from({ length: 4 }, (_, i) => ({
    exerciseId: `test-exercise-${i}`,
    name: `Exercise ${i}`,
    imageStart: null,
    logType: "reps",
    sets: Array.from({ length: 3 }, () => ({ reps: 10, seconds: null, isPr: false })),
  })),
};
async function post(a: Account, caption: string) {
  const id = await rpc<string>(a, "create_library_post_v2", {
    _caption: caption,
    _audience: "everyone",
    _group_ids: [],
    _items: [],
    _workout: workout,
    _workout_session_id: null,
    _workout_id: null,
    _credit_user_id: null,
    _comments_on: true,
    _tags: [],
    _skip_discover: false,
  });
  posts.push(id);
  return id;
}
describe.skipIf(!process.env["PGHOST"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])(
  "New Home real audience and save rules",
  () => {
    beforeAll(async () => {
      async function make() {
        const email = randomUUID() + "@example.com";
        const password = randomUUID();
        const u = await admin<{ id: string }>("/auth/v1/admin/users", "POST", {
          email,
          password,
          email_confirm: true,
        });
        users.push(u.id);
        await admin("/rest/v1/profiles?id=eq." + u.id, "PATCH", {
          app_version: "new",
          new_version_enabled: true,
          is_private: false,
        });
        const s = await req<{ access_token: string }>(
          "/auth/v1/token?grant_type=password",
          key(),
          "POST",
          { email, password },
        );
        return { id: u.id, token: s.access_token };
      }
      viewer = await make();
      author = await make();
    });
    afterAll(async () => {
      for (const group of groups) await admin("/rest/v1/groups?id=eq." + group, "DELETE");
      for (const id of users) {
        await admin(
          "/rest/v1/content_reports?or=(reporter_id.eq." + id + ",reported_user_id.eq." + id + ")",
          "DELETE",
        );
        await admin("/rest/v1/subscriptions?user_id=eq." + id, "DELETE");
        await admin("/auth/v1/admin/users/" + id, "DELETE");
      }
      expect(await admin<unknown[]>("/rest/v1/profiles?id=in.(" + users.join(",") + ")")).toEqual(
        [],
      );
    });
    it("returns a stable 20-item page plus lookahead without losing timestamp ties", async () => {
      const { v, a } = people();
      for (let i = 0; i < 23; i++) await post(a, "Home pagination " + i);
      await admin("/rest/v1/social_posts?id=in.(" + posts.join(",") + ")", "PATCH", {
        created_at: "2099-01-01T00:00:00Z",
      });
      const raw = await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "for-you" });
      const first = homePage(raw.filter((r) => posts.includes(r.id)));
      expect(first.page).toHaveLength(20);
      expect(first.next).not.toBeNull();
      if (!first.next) throw Error("Cursor missing");
      const second = await rpc<HomeRef[]>(v, "get_new_home_refs", {
        _tab: "for-you",
        _before: first.next,
      });
      const ids = second.filter((r) => posts.includes(r.id)).map((r) => r.id);
      expect(ids).toHaveLength(3);
      expect(ids.some((id) => first.page.some((r) => r.id === id))).toBe(false);
    });
    it("only Following contains own posts and accepted follows, not For you", async () => {
      const { v, a } = people();
      const own = await post(v, "Own Home post");
      await admin("/rest/v1/social_posts?id=eq." + own, "PATCH", {
        created_at: "2100-01-01T00:00:00Z",
      });
      let refs = await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "for-you" });
      expect(refs.some((r) => r.id === own)).toBe(false);
      await rpc(v, "follow_user", { target: a.id });
      refs = await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "following" });
      expect(refs.some((r) => r.id === own)).toBe(true);
      expect(refs.some((r) => posts.includes(r.id) && r.id !== own)).toBe(true);
      refs = await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "for-you" });
      expect(refs.some((r) => posts.includes(r.id))).toBe(false);
      await rpc(v, "unfollow_user", { target: a.id });
    });
    it("saves a long workout once, fits the existing 60-character name rule and reverses it", async () => {
      const { v } = people();
      const id = posts[0];
      if (!id) throw Error("Post missing");
      const args = { _post_id: id, _kind: "workout", _on: true };
      const one = await rpc<string>(v, "toggle_post_attachment", args);
      expect(await rpc<string>(v, "toggle_post_attachment", args)).toBe(one);
      const saved = await req<{ name: string; exercises: unknown[] }[]>(
        "/rest/v1/workouts?id=eq." + one,
        v.token,
      );
      expect(saved[0]?.name).toHaveLength(60);
      expect(saved[0]?.exercises).toHaveLength(4);
      expect(JSON.stringify(saved[0]?.exercises)).not.toContain("weight");
      expect(await rpc(v, "toggle_post_attachment", { ...args, _on: false })).toBeNull();
      expect(await req<unknown[]>("/rest/v1/workouts?id=eq." + one, v.token)).toEqual([]);
    });
    it("saves/removes meal copies and refuses own-post attachment saves", async () => {
      const { v } = people();
      const id = posts[0];
      if (!id) throw Error("Post missing");
      await admin("/rest/v1/social_posts?id=eq." + id, "PATCH", {
        meal: {
          title: "Lunch",
          items: [{ name: "Salmon", amount: "180 g" }],
          calories: 640,
          protein: 62,
        },
      });
      const one = await rpc<string>(v, "toggle_post_attachment", {
        _post_id: id,
        _kind: "meal",
        _on: true,
      });
      expect(
        await rpc(v, "toggle_post_attachment", { _post_id: id, _kind: "meal", _on: true }),
      ).toBe(one);
      await rpc(v, "toggle_post_attachment", { _post_id: id, _kind: "meal", _on: false });
      expect(await req<unknown[]>("/rest/v1/meals?select=id&id=eq." + one, v.token)).toEqual([]);
      const own = await post(v, "Own attachment");
      await expect(
        rpc(v, "toggle_post_attachment", { _post_id: own, _kind: "workout", _on: true }),
      ).rejects.toThrow("Post unavailable");
    });
    it("public and private shared check-ins obey explicit sharing and crew visibility", async () => {
      const { v, a } = people();
      const group = await admin<{ id: string }[]>("/rest/v1/groups", "POST", {
        name: "Home test crew",
        owner_id: a.id,
        frequency: "weekly",
        days_per_week: 3,
      });
      const g = group[0]?.id;
      if (!g) throw Error("Crew missing");
      groups.push(g);
      await admin("/rest/v1/group_members", "POST", { group_id: g, user_id: a.id });
      const rows = await admin<{ id: string }[]>("/rest/v1/check_ins", "POST", {
        user_id: a.id,
        group_id: g,
        checkin_date: "2026-11-27",
        share_with_followers: false,
        created_at: "2101-01-01T00:00:00Z",
      });
      checkin = rows[0]?.id ?? "";
      expect(checkin).not.toBe("");
      await admin("/rest/v1/daily_posts", "POST", {
        user_id: a.id,
        group_id: g,
        local_date: "2026-11-27",
        check_in_id: checkin,
      });
      expect(
        (await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "for-you" })).some(
          (r) => r.id === checkin,
        ),
      ).toBe(false);
      await admin("/rest/v1/group_members", "POST", { group_id: g, user_id: v.id });
      expect(
        (await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "following" })).some(
          (r) => r.id === checkin && r.crew_name === "Home test crew",
        ),
      ).toBe(true);
      await admin("/rest/v1/group_members?group_id=eq." + g + "&user_id=eq." + v.id, "DELETE");
      await admin("/rest/v1/check_ins?id=eq." + checkin, "PATCH", { share_with_followers: true });
      expect(
        (await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "for-you" })).some(
          (r) => r.id === checkin,
        ),
      ).toBe(true);
      await admin("/rest/v1/profiles?id=eq." + a.id, "PATCH", { is_private: true });
      expect(
        (await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "for-you" })).some(
          (r) => r.id === checkin,
        ),
      ).toBe(false);
      const request = await rpc<{ status: string }>(v, "follow_user", { target: a.id });
      expect(request.status).toBe("requested");
      expect(
        (await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "following" })).some(
          (r) => r.id === checkin,
        ),
      ).toBe(false);
      await rpc(a, "respond_follow_request", { follower: v.id, accept: true });
      expect(
        (await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: "following" })).some(
          (r) => r.id === checkin,
        ),
      ).toBe(true);
      await rpc(v, "unfollow_user", { target: a.id });
      await admin("/rest/v1/profiles?id=eq." + a.id, "PATCH", { is_private: false });
    });
    it("shared comments, cheers and bookmarks read back and contain no weights", async () => {
      const { v } = people();
      await rpc(v, "home_checkin_action", { _id: checkin, _action: "comment", _body: "Good work" });
      await rpc(v, "home_checkin_action", { _id: checkin, _action: "cheer" });
      await rpc(v, "home_checkin_action", { _id: checkin, _action: "save" });
      const social = await rpc<{ cheered: boolean; saved: boolean; comments: { body: string }[] }>(
        v,
        "get_home_checkin_social",
        { _id: checkin },
      );
      expect(social.cheered).toBe(true);
      expect(social.saved).toBe(true);
      expect(social.comments[0]?.body).toBe("Good work");
    });
    it("reports public posts and rejects spoofed authors", async () => {
      const { v, a } = people();
      const id = posts[0];
      if (!id) throw Error("Post missing");
      await rpc(v, "report_new_home_post", {
        _id: id,
        _reported: a.id,
        _reason: "spam_or_fake",
        _details: "Example report",
        _block: false,
      });
      await expect(
        rpc(v, "report_new_home_post", {
          _id: id,
          _reported: v.id,
          _reason: "spam_or_fake",
          _details: "",
          _block: false,
        }),
      ).rejects.toThrow("Invalid target");
    });
    it("hidden and blocked content disappears from both tabs and blocks new interaction", async () => {
      const { v, a } = people();
      await req("/rest/v1/hidden_posts", v.token, "POST", { user_id: v.id, post_id: checkin });
      for (const tab of ["following", "for-you"])
        expect(
          (await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: tab })).some(
            (r) => r.id === checkin,
          ),
        ).toBe(false);
      await req("/rest/v1/user_blocks", v.token, "POST", { blocker_id: v.id, blocked_id: a.id });
      for (const tab of ["following", "for-you"]) {
        const refs = await rpc<HomeRef[]>(v, "get_new_home_refs", { _tab: tab });
        expect(refs.some((r) => r.id === checkin)).toBe(false);
        expect(refs.some((r) => posts.slice(0, 23).includes(r.id))).toBe(false);
      }
      await expect(
        rpc(v, "home_checkin_action", { _id: checkin, _action: "comment", _body: "Blocked" }),
      ).rejects.toThrow("Check-in unavailable");
      const id = posts[0];
      if (!id) throw Error("Post missing");
      await expect(
        rpc(v, "toggle_post_attachment", { _post_id: id, _kind: "workout", _on: true }),
      ).rejects.toThrow("Post unavailable");
    });
  },
);
