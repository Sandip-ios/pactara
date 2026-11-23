/**
 * Getting a rendered share video out of the app.
 *
 * - The `PactaraShare` native plugin (App Store build, see
 *   native-assets/ios/README.md) saves straight to Photos and hands the video
 *   + sticker to Instagram / Facebook Stories.
 * - Without it (current App Store build, mobile web) the iPhone share sheet
 *   gets the MP4 file, where "Save Video", Instagram, Messages etc. appear.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { META_APP_ID } from "@/lib/meta-config";

export type StoriesApp = "instagram" | "facebook";

type PactaraSharePlugin = {
  canShareToStories(o: { app: StoriesApp }): Promise<{ available: boolean }>;
  shareToStories(o: {
    app: StoriesApp;
    appId: string;
    backgroundVideo: string;
    stickerImage?: string;
    topColor: string;
    bottomColor: string;
  }): Promise<void>;
  saveVideo(o: { data: string; fileName: string }): Promise<void>;
};

const PactaraShare = registerPlugin<PactaraSharePlugin>("PactaraShare");

export function hasNativeShare(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PactaraShare");
  } catch {
    return false;
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(",") + 1);
}

export async function saveVideoToPhotos(blob: Blob, fileName: string): Promise<void> {
  await PactaraShare.saveVideo({ data: await toBase64(blob), fileName });
}

/** Stories sharing works only with the plugin, a Meta App ID and the app installed. */
export async function storiesReady(app: StoriesApp): Promise<boolean> {
  if (!hasNativeShare() || !META_APP_ID) return false;
  try {
    return (await PactaraShare.canShareToStories({ app })).available;
  } catch {
    return false;
  }
}

export async function shareToStories(app: StoriesApp, background: Blob, sticker: Blob | null): Promise<void> {
  await PactaraShare.shareToStories({
    app,
    appId: META_APP_ID,
    backgroundVideo: await toBase64(background),
    ...(sticker ? { stickerImage: await toBase64(sticker) } : {}),
    topColor: "#141218",
    bottomColor: "#141218",
  });
}

/** Opens Instagram's story camera / the Facebook app. */
export function openStoriesApp(app: StoriesApp) {
  const url = app === "instagram" ? "instagram://story-camera" : "fb://";
  try {
    window.location.href = url;
  } catch {
    /* not installed */
  }
}

export type SheetResult = "shared" | "cancelled" | "downloaded";

/**
 * The iPhone share sheet with the MP4 as a real video file (video/mp4, .mp4
 * name, no extra text item). Desktop browsers without file sharing download it.
 */
export async function shareVideoFile(blob: Blob, fileName: string): Promise<SheetResult> {
  const file = new File([blob], fileName, { type: "video/mp4" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const payload: ShareData = { files: [file] };
  if (typeof nav.share === "function" && (!nav.canShare || nav.canShare(payload))) {
    try {
      await nav.share(payload);
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
