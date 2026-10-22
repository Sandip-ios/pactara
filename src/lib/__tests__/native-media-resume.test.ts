import { afterEach, describe, expect, it } from "vitest";
import { focusManager, QueryClient, QueryObserver } from "@tanstack/react-query";

afterEach(() => focusManager.setFocused(undefined));

describe("native media resume", () => {
  it("refreshes a stale member photo when the native app returns from the background", async () => {
    const client = new QueryClient();
    client.mount();
    focusManager.setFocused(false);
    let requests = 0;
    const observer = new QueryObserver(client, {
      queryKey: ["group-member-streaks", "resume-test"],
      queryFn: async () => ({ avatarUrl: `photo-${++requests}` }),
      staleTime: 60_000,
      refetchOnWindowFocus: true,
    });
    client.setQueryData(observer.options.queryKey, { avatarUrl: "expired-photo" }, {
      updatedAt: Date.now() - 61 * 60_000,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await observer.refetch();
    client.setQueryData(observer.options.queryKey, { avatarUrl: "expired-photo" }, {
      updatedAt: Date.now() - 61 * 60_000,
    });
    const before = requests;
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toBe(before + 1);
    expect(client.getQueryData(observer.options.queryKey)).toEqual({ avatarUrl: `photo-${before + 1}` });
    unsubscribe();
    client.unmount();
    client.clear();
  });
});