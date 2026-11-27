import { Capacitor } from "@capacitor/core";
import { PactaraPhotoLibrary } from "@pactara/photo-library";
import type { LibraryAsset, LibraryPermission, NativeMediaFile } from "@pactara/photo-library";

export type { LibraryAsset, LibraryPermission };
const PLUGIN = "PactaraPhotoLibrary";

/** Availability is about this installed build, never just iOS vs web. */
export function postMediaCapabilities() {
  const available = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN);
  // Headers describe actual installed methods, not the JS proxy (which invents methods).
  const headers = typeof window === "undefined" ? undefined : (window as unknown as {
    Capacitor?: { PluginHeaders?: { name: string; methods: { name: string }[] }[] };
  }).Capacitor?.PluginHeaders;
  const header = headers?.find((h) => h.name === PLUGIN);
  const supports = (method: string) => available && (!header || header.methods.some((m) => m.name === method));
  return {
    library: supports("requestPermissions") && supports("getRecents") && supports("getMedia"),
    camera: supports("capture"),
    settings: supports("openSettings"),
  };
}

export function showLibraryFallback(available: boolean, permission: LibraryPermission | null, failed = false) {
  return !available || permission === "denied" || permission === "limited" || failed;
}

export async function loadPostRecents(): Promise<{ permission: LibraryPermission; assets: LibraryAsset[] } | null> {
  if (!postMediaCapabilities().library) return null;
  const { photos } = await PactaraPhotoLibrary.requestPermissions();
  if (photos === "denied") return { permission: photos, assets: [] };
  const { assets } = await PactaraPhotoLibrary.getRecents({ limit: 60 });
  return { permission: photos, assets: [...assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

async function readNativeFile(file: NativeMediaFile) {
  const response = await fetch(Capacitor.convertFileSrc(file.path));
  if (!response.ok) throw new Error("Could not load this photo or video");
  const data = await response.blob();
  return { blob: data.type === file.mimeType ? data : new Blob([data], { type: file.mimeType }), name: file.name };
}

export async function readPostAsset(id: string) {
  if (!postMediaCapabilities().library) return null;
  return readNativeFile(await PactaraPhotoLibrary.getMedia({ id }));
}

export async function capturePostMedia() {
  if (!postMediaCapabilities().camera) return null;
  const result = await PactaraPhotoLibrary.capture();
  return result.cancelled || !result.file ? [] : [await readNativeFile(result.file)];
}

export async function openPostPhotoSettings() {
  if (postMediaCapabilities().settings) {
    try { await PactaraPhotoLibrary.openSettings(); return; } catch { /* older bridge */ }
  }
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") window.location.href = "app-settings:";
}
