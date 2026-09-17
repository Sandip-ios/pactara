import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/klipy";

export type GifItem = {
  id: string;
  url: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
  title: string;
};

function pickFile(file: any): { url: string; width: number | null; height: number | null } | null {
  if (!file || typeof file !== "object") return null;
  // Named sizes first (gifs/clips), then numeric keys (stickers).
  const order = ["md", "sm", "hd", "xs", "400", "320", "240"];
  const keys = [...order.filter((k) => file[k]), ...Object.keys(file).filter((k) => !order.includes(k))];
  for (const key of keys) {
    const variant = file[key];
    if (!variant) continue;
    for (const fmt of ["gif", "webp", "mp4"]) {
      const v = variant[fmt];
      if (v?.url) return { url: v.url, width: v.width ?? null, height: v.height ?? null };
    }
  }
  return null;
}

export const searchGifs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string; page?: number; kind?: "gifs" | "stickers" }) => ({
    query: (input?.query ?? "").trim().slice(0, 80),
    page: Math.min(Math.max(Number(input?.page ?? 1) || 1, 1), 20),
    kind: input?.kind === "stickers" ? ("stickers" as const) : ("gifs" as const),
  }))
  .handler(async ({ data, context }): Promise<{ items: GifItem[]; hasNext: boolean }> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const klipyKey = process.env["KLIPY_API_KEY"];
    if (!lovableKey || !klipyKey) throw new Error("GIF search is not configured");

    const params = new URLSearchParams({
      customer_id: context.userId,
      page: String(data.page),
      per_page: "24",
    });
    if (data.query) params.set("q", data.query);

    const endpoint = data.query ? "search" : "trending";
    const res = await fetch(`${GATEWAY_URL}/${data.kind}/${endpoint}?${params}`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": klipyKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[klipy] request failed [${res.status}]: ${body}`);
      throw new Error(`GIF search failed [${res.status}]`);
    }
    const json: any = await res.json();
    if (!json?.result) {
      console.error("[klipy] error body", JSON.stringify(json));
      throw new Error("GIF search failed");
    }

    const rows: any[] = json?.data?.data ?? [];
    const items: GifItem[] = [];
    for (const row of rows) {
      const picked = pickFile(row?.file);
      if (!picked) continue;
      items.push({
        id: String(row.id ?? row.slug ?? picked.url),
        url: picked.url,
        previewUrl: picked.url,
        width: picked.width,
        height: picked.height,
        title: String(row.title ?? "GIF"),
      });
    }
    return { items, hasNext: Boolean(json?.data?.has_next) };
  });
