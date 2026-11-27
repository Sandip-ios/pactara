export type LibraryPermission = "granted" | "limited" | "denied";
export type LibraryAsset = { id: string; thumbnail: string; kind: "photo" | "video"; createdAt: string; duration: number | null };
export type NativeMediaFile = { path: string; name: string; mimeType: string };
export interface PhotoLibraryPlugin {
  requestPermissions(): Promise<{ photos: LibraryPermission }>;
  getRecents(options: { limit: number }): Promise<{ assets: LibraryAsset[] }>;
  getMedia(options: { id: string }): Promise<NativeMediaFile>;
  capture(): Promise<{ cancelled: boolean; file?: NativeMediaFile }>;
  openSettings(): Promise<void>;
}
