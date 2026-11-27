import { afterEach, describe, expect, it, vi } from "vitest";
import { postItemCrop, postVideoRatio, trimFrames, trimFrameTime } from "../post-video-layout";
import { defaultEdit } from "../post-draft";

describe("uncropped library video", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("ignores a saved 4:5 crop for video but preserves the photo crop", () => {
    const saved = { aspect: "4:5" as const, y: 0.9 };
    expect(postItemCrop("video", saved)).toBeNull();
    expect(postItemCrop("photo", saved)).toEqual(saved);
  });
  it("keeps a 1080x1920 phone video's 9:16 shape", () => {
    expect(postVideoRatio(1080, 1920)).toBe(9 / 16);
  });
  it("keeps landscape's own shape", () => {
    expect(postVideoRatio(1920, 1080)).toBe(16 / 9);
  });
  it("caps ultra-wide at 1.91:1 and ultra-tall at 9:16 for bars", () => {
    expect(postVideoRatio(3840, 1080)).toBe(1.91);
    expect(postVideoRatio(1080, 2400)).toBe(9 / 16);
  });
  it("defaults video to original and photos to centered 3:4", () => {
    const media = { id: "phone", file: new Blob(), url: "blob:test", duration: 10, name: "phone.mp4" };
    expect(defaultEdit({ ...media, kind: "video" }).crop.aspect).toBe("original");
    expect(defaultEdit({ ...media, kind: "photo" }).crop).toEqual({ aspect: "3:4", y: 0.5 });
    expect(postItemCrop("video", { aspect: "3:4", y: 0.5 })).toBeNull();
  });
  it("seeks the first trim thumbnail to 0.1s and subsequent frames across the video", () => {
    expect(trimFrameTime(10, 0)).toBe(0.1);
    expect(Array.from({ length: 10 }, (_, i) => trimFrameTime(10, i))).toEqual([0.1, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("decodes all ten frame images with one decoder, including the nonzero first frame", async () => {
    const seeks: number[] = [];
    const drawImage = vi.fn();
    class Decoder extends EventTarget {
      videoWidth = 1080;
      videoHeight = 1920;
      duration = 10;
      src = "";
      set currentTime(time: number) {
        seeks.push(time);
        queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
      }
      load() { if (this.src) queueMicrotask(() => this.dispatchEvent(new Event("loadeddata"))); }
      removeAttribute() { this.src = ""; }
    }
    let decoders = 0;
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("document", { createElement: (tag: string) => {
      if (tag === "video") { decoders++; return new Decoder(); }
      return { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL: () => `data:image/jpeg;frame=${seeks.at(-1)}` };
    } });
    const frames = await trimFrames("blob:phone", 10, new AbortController().signal);
    expect(decoders).toBe(1);
    expect(seeks).toEqual([0.1, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(drawImage).toHaveBeenCalledTimes(10);
    expect(frames).toHaveLength(10);
    expect(frames[0]).toBe("data:image/jpeg;frame=0.1");
  });
});