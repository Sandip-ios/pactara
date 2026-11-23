import { beforeEach, describe, expect, it, vi } from "vitest";

type TapHandler = (event: { notification: { data: { url?: string } } }) => void;
let tapHandler: TapHandler | null = null;
let retainedTap: string | null = null;

vi.mock("@/lib/native", () => ({ isNative: () => true }));
vi.mock("@capacitor-firebase/messaging", () => ({
  FirebaseMessaging: {
    addListener: async (_name: string, fn: TapHandler) => {
      tapHandler = fn;
      // The plugin replays a tap that launched the app once someone listens.
      if (retainedTap) fn({ notification: { data: { url: retainedTap } } });
      return { remove: async () => undefined };
    },
  },
}));

async function freshModule() {
  vi.resetModules();
  return import("@/lib/launch-links");
}

beforeEach(() => {
  tapHandler = null;
  retainedTap = null;
});

describe("notification taps at launch", () => {
  it("a tap that cold-started the app becomes the launch destination", async () => {
    retainedTap = "https://pactara.lovable.app/home?group=g1&post=p1&comments=1";
    const links = await freshModule();
    expect(await links.takeLaunchLink()).toBe("/home?group=g1&post=p1&comments=1");
  });

  it("no tap means no launch link", async () => {
    const links = await freshModule();
    expect(await links.takeLaunchLink()).toBeNull();
  });

  it("the launch tap is not opened a second time once the router is wired", async () => {
    retainedTap = "/chat";
    const links = await freshModule();
    await links.takeLaunchLink();
    const go = vi.fn();
    links.setAppLinkNavigator(go);
    expect(go).not.toHaveBeenCalled();
  });

  it("a tap while the app is running navigates in place", async () => {
    const links = await freshModule();
    await links.takeLaunchLink();
    const go = vi.fn();
    links.setAppLinkNavigator(go);
    tapHandler?.({ notification: { data: { url: "/plans/build-muscle" } } });
    expect(go).toHaveBeenCalledWith("/plans/build-muscle");
  });

  it("a tap landing before the router is wired is opened once it is", async () => {
    const links = await freshModule();
    await links.takeLaunchLink();
    tapHandler?.({ notification: { data: { url: "/chat" } } });
    const go = vi.fn();
    links.setAppLinkNavigator(go);
    expect(go).toHaveBeenCalledWith("/chat");
  });
});

describe("the launch link replayed by iOS", () => {
  it("is not opened a second time", async () => {
    const links = await freshModule();
    await links.takeLaunchLink();
    const go = vi.fn();
    links.setAppLinkNavigator(go);
    links.noteLaunchLink("/chat");
    links.openAppLink("https://pactara.lovable.app/chat");
    expect(go).not.toHaveBeenCalled();
    links.openAppLink("/chat");
    expect(go).toHaveBeenCalledWith("/chat");
  });
});
