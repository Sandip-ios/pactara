/**
 * Draws the "Share your win" overlay on a canvas. The preview on screen, the
 * burned-in video and the Stories sticker all come from this one drawing, so
 * the preview is exactly what gets shared. Browser-only (canvas).
 *
 * Layout is in units of a 360-wide frame, scaled to the output size.
 */
import type { CardLine } from "@/lib/share-card";

const BASE = 360;
const PAD_X = 16;
const PAD_BOTTOM = 20;
const FONT = "Inter, system-ui, -apple-system, sans-serif";
const INK = "#FFFFFF";

export type OverlayParts = { wordmark: boolean; gradient: boolean; block: boolean; wordmarkImage?: HTMLImageElement | null };

const TROPHY = [
  "M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978",
  "M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978",
  "M18 9h1.5a1 1 0 0 0 0-5H18",
  "M4 22h16",
  "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",
  "M6 9H4.5a1 1 0 0 1 0-5H6",
];

let fontsReady: Promise<void> | null = null;
/** Inter must be loaded before drawing, or the canvas falls back to a system font. */
export function ensureCardFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    try {
      await Promise.all(
        ["900 22px Inter", "800 12px Inter", "700 13px Inter", "600 13px Inter"].map((f) =>
          document.fonts.load(f),
        ),
      );
    } catch {
      /* system font fallback */
    }
  })();
  return fontsReady;
}

type Ctx = CanvasRenderingContext2D;

function lineHeight(l: CardLine): number {
  switch (l.kind) {
    case "pill":
      return 24;
    case "kicker":
      return 14;
    case "title":
      return 27;
    default:
      return 18;
  }
}

function gapAfter(l: CardLine): number {
  if (l.kind === "pill") return 8;
  if (l.kind === "kicker") return 5;
  return 3;
}

/** Block height in units (0 when there are no lines). */
export function blockHeight(lines: CardLine[]): number {
  return lines.reduce((h, l, i) => h + lineHeight(l) + (i < lines.length - 1 ? gapAfter(l) : 0), 0);
}

function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function spaced(ctx: Ctx, text: string, x: number, y: number, spacing: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function shadow(ctx: Ctx, s: number, strong: boolean) {
  ctx.shadowColor = strong ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.28)";
  ctx.shadowBlur = (strong ? 8 : 4) * s;
  ctx.shadowOffsetY = 1 * s;
}

function noShadow(ctx: Ctx) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function pill(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the block with its top-left at (x, y) in pixels. */
function drawBlock(ctx: Ctx, lines: CardLine[], x: number, y: number, s: number, maxW: number, strongShadow: boolean) {
  let cy = y;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  for (const l of lines) {
    const h = lineHeight(l) * s;
    if (l.kind === "pill") {
      ctx.font = `800 ${12 * s}px ${FONT}`;
      const icon = 12 * s;
      const padX = 10 * s;
      const text = fit(ctx, l.text, maxW - padX * 2 - icon - 5 * s);
      const w = padX * 2 + icon + 5 * s + ctx.measureText(text).width;
      noShadow(ctx);
      ctx.fillStyle = "#FCD34D";
      pill(ctx, x, cy, w, h);
      ctx.fill();
      // trophy (lucide, 24-unit box)
      ctx.save();
      ctx.translate(x + padX, cy + (h - icon) / 2);
      ctx.scale(icon / 24, icon / 24);
      ctx.strokeStyle = "#422006";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const d of TROPHY) ctx.stroke(new Path2D(d));
      ctx.restore();
      ctx.fillStyle = "#422006";
      ctx.fillText(text, x + padX + icon + 5 * s, cy + h / 2 + 4.3 * s);
    } else if (l.kind === "kicker") {
      shadow(ctx, s, strongShadow);
      ctx.font = `800 ${11 * s}px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      spaced(ctx, l.text, x, cy + 11 * s, 1.3 * s);
    } else if (l.kind === "title") {
      shadow(ctx, s, strongShadow);
      ctx.font = `900 ${22 * s}px ${FONT}`;
      ctx.fillStyle = INK;
      ctx.fillText(fit(ctx, l.text, maxW), x, cy + 21 * s);
    } else if (l.kind === "sub") {
      shadow(ctx, s, strongShadow);
      ctx.font = `${l.weight} ${13 * s}px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(fit(ctx, l.text, maxW), x, cy + 13.5 * s);
    } else {
      shadow(ctx, s, strongShadow);
      ctx.font = `600 ${13 * s}px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      const dotsW = 7 * 8 * s + 6 * 4 * s;
      const text = fit(ctx, l.text, maxW - dotsW - 8 * s);
      ctx.fillText(text, x, cy + 13.5 * s);
      let dx = x + ctx.measureText(text).width + 8 * s;
      const r = 4 * s;
      const midY = cy + 9 * s;
      for (const st of l.days) {
        ctx.beginPath();
        ctx.arc(dx + r, midY, st === "none" ? r - 0.75 * s : r, 0, Math.PI * 2);
        if (st === "checked") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
        } else if (st === "rest") {
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.fill();
        } else {
          noShadow(ctx);
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 1.5 * s;
          ctx.stroke();
          shadow(ctx, s, strongShadow);
        }
        dx += 8 * s + 4 * s;
      }
    }
    cy += h + gapAfter(l) * s;
  }
  noShadow(ctx);
}

function drawWordmark(ctx: Ctx, s: number, image?: HTMLImageElement | null) {
  if (image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width && height) {
      shadow(ctx, s, false);
      const h = 17 * s;
      ctx.drawImage(image, PAD_X * s, 14 * s, h * (width / height), h);
      noShadow(ctx);
    }
    return;
  }
  ctx.font = `900 ${18 * s}px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  shadow(ctx, s, false);
  const x = PAD_X * s;
  const y = (16 + 15) * s;
  ctx.fillStyle = "#A78BFA";
  ctx.fillText("P", x, y);
  const pw = ctx.measureText("P").width;
  ctx.fillStyle = INK;
  ctx.fillText("actara", x + pw - 0.4 * s, y);
  noShadow(ctx);
}

/** Paints the overlay (transparent elsewhere) onto a canvas of the output size. */
export function drawCardOverlay(ctx: Ctx, lines: CardLine[], width: number, height: number, parts: OverlayParts) {
  const s = width / BASE;
  ctx.clearRect(0, 0, width, height);
  if (parts.gradient) {
    const top = height * 0.6;
    const g = ctx.createLinearGradient(0, top, 0, height);
    g.addColorStop(0, "rgba(20,18,24,0)");
    g.addColorStop(1, "rgba(20,18,24,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, top, width, height - top);
  }
  if (parts.wordmark) drawWordmark(ctx, s, parts.wordmarkImage);
  if (parts.block && lines.length) {
    const h = blockHeight(lines) * s;
    drawBlock(ctx, lines, PAD_X * s, height - PAD_BOTTOM * s - h, s, width - PAD_X * 2 * s, false);
  }
}

export function overlayCanvas(lines: CardLine[], width: number, height: number, parts: OverlayParts): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (ctx) drawCardOverlay(ctx, lines, width, height, parts);
  return c;
}

/**
 * The block alone on a transparent background, for Instagram/Facebook Stories
 * stickers (the member can move and resize it there). `frameWidth` is the
 * story width so the sticker matches the card's scale.
 */
export async function stickerPng(lines: CardLine[], frameWidth: number): Promise<Blob | null> {
  if (!lines.length) return null;
  const s = frameWidth / BASE;
  const pad = 12 * s;
  const w = Math.round(frameWidth - PAD_X * 2 * s + pad * 2);
  const h = Math.round(blockHeight(lines) * s + pad * 2);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  drawBlock(ctx, lines, pad, pad, s, w - pad * 2, true);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}
