import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

describe.skipIf(!process.env["SUPABASE_SERVICE_ROLE_KEY"])("library comment access", () => {
  it("reads allowed comments, skips blocked authors, and never reveals Only me comments", async () => {
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!key) throw new Error("Draft credentials missing");
    const accounts: { id: string; token: string }[] = [];
    async function request<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T> {
      const response = await fetch("http://127.0.0.1:8001" + path, { method, headers: { apikey: key ?? "", Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) throw new Error(`Draft test request failed: ${response.status}`);
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    }
    try {
      for (let i = 0; i < 3; i++) {
        const email = `${randomUUID()}@example.com`;
        const password = randomUUID();
        const user = await request<{ id: string }>("/auth/v1/admin/users", key, "POST", { email, password, email_confirm: true });
        accounts.push({ id: user.id, token: "" });
        const session = await request<{ access_token: string }>("/auth/v1/token?grant_type=password", key, "POST", { email, password });
        const account = accounts[i];
        if (account) account.token = session.access_token;
        await request(`/rest/v1/profiles?id=eq.${user.id}`, key, "PATCH", { app_version: "new", new_version_enabled: true, is_private: false, birthday: null });
      }
      const [author, viewer, blocked] = accounts;
      if (!author || !viewer || !blocked) throw new Error("Missing test accounts");
      const args = { _caption: "Comment access test", _audience: "everyone", _group_ids: [], _items: [], _workout: null, _workout_session_id: null, _workout_id: null, _credit_user_id: null, _comments_on: true, _tags: [], _skip_discover: false };
      const post = await request<string>("/rest/v1/rpc/create_library_post_v2", author.token, "POST", args);
      await request(`/rest/v1/social_posts?id=eq.${post}`, key, "PATCH", { status: "live" });
      await request("/rest/v1/social_post_comments", key, "POST", [{ post_id: post, user_id: author.id, body: "Visible" }, { post_id: post, user_id: blocked.id, body: "Hidden" }]);
      await request("/rest/v1/user_blocks", key, "POST", { blocker_id: blocked.id, blocked_id: viewer.id });
      const rows = await request<{ body: string }[]>(`/rest/v1/social_post_comments?post_id=eq.${post}&select=body`, viewer.token);
      expect(rows.map(r => r.body)).toEqual(["Visible"]);
      expect(await request<boolean>("/rest/v1/rpc/can_read_library_comment", viewer.token, "POST", { _post_id: post, _author_id: blocked.id })).toBe(false);
      const privatePost = await request<string>("/rest/v1/rpc/create_library_post_v2", author.token, "POST", { ...args, _audience: "only_me" });
      expect(await request<boolean>("/rest/v1/rpc/can_read_library_comment", viewer.token, "POST", { _post_id: privatePost, _author_id: author.id })).toBe(false);
    } finally {
      for (const account of accounts) await request(`/auth/v1/admin/users/${account.id}`, key, "DELETE");
    }
  });
});