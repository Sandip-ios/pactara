import { isNative } from "@/lib/native";

export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

async function copy(text: string): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { clipboard?: { writeText: (s: string) => Promise<void> } };
    if (!nav.clipboard) return false;
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Native share sheet in the app, the browser's share sheet on the web, and
 * copying the link where neither exists (or the browser refuses because the
 * tap was too long ago). "cancelled" = the member closed the sheet.
 */
export async function shareLink(payload: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: payload.title, text: payload.text, url: payload.url, dialogTitle: payload.title });
      return "shared";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return /cancel/i.test(msg) ? "cancelled" : (await copy(payload.url)) ? "copied" : "failed";
    }
  }
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
  if (nav?.share) {
    try {
      await nav.share(payload);
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // NotAllowedError (no recent tap) or unsupported data: copy instead.
    }
  }
  return (await copy(payload.url)) ? "copied" : "failed";
}
