import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({
  requestPermissions: vi.fn(), getRecents: vi.fn(), getMedia: vi.fn(), capture: vi.fn(), openSettings: vi.fn(),
}));
const native = vi.hoisted(() => ({ native: true, available: false }));
vi.mock("@capacitor/core", () => ({ Capacitor: {
  isNativePlatform: () => native.native,
  isPluginAvailable: (name: string) => native.available && name === "PactaraPhotoLibrary",
  getPlatform: () => "ios", convertFileSrc: (path: string) => path,
} }));
vi.mock("@pactara/photo-library", () => ({ PactaraPhotoLibrary: bridge }));
import { capturePostMedia, loadPostRecents, postMediaCapabilities, readPostAsset, showLibraryFallback } from "../post-native-media";

beforeEach(() => { vi.clearAllMocks(); native.native = true; native.available = false; });
afterEach(() => vi.unstubAllGlobals());
describe("New post installed native capabilities", () => {
  it("native without the plugin exposes Library and calls no native methods", async () => {
    expect(postMediaCapabilities()).toEqual({ library: false, camera: false, settings: false });
    expect(showLibraryFallback(false, null)).toBe(true);
    expect(await loadPostRecents()).toBeNull();
    expect(await capturePostMedia()).toBeNull();
    expect(await readPostAsset("missing")).toBeNull();
    for (const method of Object.values(bridge)) expect(method).not.toHaveBeenCalled();
  });
  it("web never calls native even if a JS plugin proxy exists", async () => {
    native.native = false; native.available = true;
    expect(await loadPostRecents()).toBeNull();
    expect(bridge.requestPermissions).not.toHaveBeenCalled();
  });
  it("available plugin requests permission first and sorts newest first", async () => {
    native.available = true;
    const older = { id: "old", createdAt: "2026-11-25T10:00:00Z" };
    const newest = { id: "new", createdAt: "2026-11-27T10:00:00Z" };
    bridge.requestPermissions.mockResolvedValue({ photos: "granted" });
    bridge.getRecents.mockResolvedValue({ assets: [older, newest] });
    expect(await loadPostRecents()).toEqual({ permission: "granted", assets: [newest, older] });
    expect(bridge.requestPermissions.mock.invocationCallOrder[0]).toBeLessThan(bridge.getRecents.mock.invocationCallOrder[0] ?? 0);
    expect(bridge.getRecents).toHaveBeenCalledWith({ limit: 60 });
    expect(showLibraryFallback(true, "granted")).toBe(false);
  });
  it("denied permission shows fallback without loading photos", async () => {
    native.available = true;
    bridge.requestPermissions.mockResolvedValue({ photos: "denied" });
    expect(await loadPostRecents()).toEqual({ permission: "denied", assets: [] });
    expect(bridge.getRecents).not.toHaveBeenCalled();
    expect(showLibraryFallback(true, "denied")).toBe(true);
  });
  it("limited permission loads accessible Recents and keeps Library fallback", async () => {
    native.available = true;
    bridge.requestPermissions.mockResolvedValue({ photos: "limited" });
    bridge.getRecents.mockResolvedValue({ assets: [] });
    expect((await loadPostRecents())?.permission).toBe("limited");
    expect(bridge.getRecents).toHaveBeenCalledOnce();
    expect(showLibraryFallback(true, "limited")).toBe(true);
  });
  it("partial native headers never call methods not present", async () => {
    native.available = true;
    vi.stubGlobal("window", { Capacitor: { PluginHeaders: [{ name: "PactaraPhotoLibrary", methods: [{ name: "capture" }] }] } });
    expect(postMediaCapabilities()).toEqual({ library: false, camera: true, settings: false });
    expect(await loadPostRecents()).toBeNull();
    expect(bridge.requestPermissions).not.toHaveBeenCalled();
  });
  it("camera cancel does not trigger a fallback or import", async () => {
    native.available = true; bridge.capture.mockResolvedValue({ cancelled: true });
    expect(await capturePostMedia()).toEqual([]);
    expect(bridge.capture).toHaveBeenCalledOnce();
  });
  it("native read failure retains a working Library fallback", () => {
    expect(showLibraryFallback(true, "granted", true)).toBe(true);
  });
});
