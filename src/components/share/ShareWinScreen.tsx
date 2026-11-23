import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, MoreHorizontal, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { useToastAbove } from "@/lib/toast-offset";
import {
  cardKind,
  cardToggles,
  formatClipDuration,
  loadCardPrefs,
  outputSize,
  saveCardPrefs,
  shareCardLines,
  shareFileName,
  type CardLine,
  type ShareCardInput,
  type ShareCardPrefs,
  type ShareFormat,
} from "@/lib/share-card";
import { drawCardOverlay, ensureCardFonts, overlayCanvas, stickerPng } from "@/lib/share-card-draw";
import { canRenderOnDevice, probeClip, renderShareVideo } from "@/lib/share-video-render";
import {
  hasNativeShare,
  openStoriesApp,
  saveVideoToPhotos,
  shareToStories,
  shareVideoFile,
  storiesReady,
  type StoriesApp,
} from "@/lib/native-share";
import { FacebookLogo, InstagramGlyph } from "./BrandIcons";

const BG = "#F5F2EE";
const INK = "#141218";
const PURPLE = "#7C3AED";
const DARK_TOAST = {
  background: "#141218",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 16,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "Inter, system-ui, sans-serif",
} as const;
const ERROR_COPY = "Couldn't prepare your video. Try again.";

type Action = "instagram" | "facebook" | "save" | "more";

function darkToast(message: string, ok = true) {
  toast(message, {
    position: "bottom-center",
    ...(ok ? { icon: <CheckCircle2 size={18} style={{ color: "#4ADE80" }} aria-hidden /> } : {}),
    style: DARK_TOAST,
  });
}

/**
 * "Share your win": the member's check-in video with a small card on top,
 * shared as a real MP4 rendered on the phone (Story 9:16 or Post 1:1).
 */
export function ShareWinScreen({
  video,
  input,
  onClose,
}: {
  video: Blob;
  input: ShareCardInput;
  onClose: () => void;
}) {
  useHideBottomTabs(true, false);
  const [format, setFormat] = useState<ShareFormat>("story");
  const [prefs, setPrefs] = useState<ShareCardPrefs>(() => loadCardPrefs());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<{ action: Action; progress: number } | null>(null);
  const [clip, setClip] = useState<{ width: number; height: number; duration: number } | null>(null);
  const [canRender, setCanRender] = useState<boolean | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const kind = cardKind(input);
  const lines = useMemo(() => shareCardLines(input, prefs), [input, prefs]);
  const toggles = useMemo(() => cardToggles(input), [input]);
  const fileName = shareFileName(input.streak);

  // Created in an effect so a remount never plays a revoked URL.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(video);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  useEffect(() => {
    let alive = true;
    void ensureCardFonts().then(() => alive && setFontsLoaded(true));
    void probeClip(video).then((c) => alive && setClip(c));
    void canRenderOnDevice().then((ok) => alive && setCanRender(ok));
    return () => {
      alive = false;
    };
  }, [video]);

  // Body stays still under the full-screen page.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const panelRef = useRef<HTMLDivElement>(null);
  useToastAbove(panelRef, !editing);

  // ---- preview box fitted into the space between the header and the buttons ----
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ratio = format === "story" ? 9 / 16 : 1;
  const boxW = Math.max(0, Math.floor(Math.min(area.w, area.h * ratio)));
  const boxH = Math.floor(boxW / ratio);

  // ---- overlay preview, drawn exactly like the rendered video ----
  const out = outputSize(format, clip ? Math.min(clip.width, clip.height) : 1080);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = out.width;
    c.height = out.height;
    drawCardOverlay(ctx, lines, out.width, out.height, { wordmark: true, gradient: true, block: true });
  }, [lines, out.width, out.height, fontsLoaded]);

  // ---- renders (cached per size + card) ----
  const cache = useRef(new Map<string, Promise<Blob>>());
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    return () => {
      ctrl.abort();
      cache.current.clear();
    };
  }, []);

  const prepared = useCallback(
    (variant: "full" | "background", onProgress: (p: number) => void): Promise<Blob> => {
      const key = `${format}|${variant}|${JSON.stringify(lines)}`;
      const hit = cache.current.get(key);
      if (hit) return hit;
      const parts = { wordmark: true, gradient: true, block: variant === "full" };
      const job = renderShareVideo({
        source: video,
        format,
        overlay: (w, h) => overlayCanvas(lines as CardLine[], w, h, parts),
        onProgress,
        ...(abort.current ? { signal: abort.current.signal } : {}),
      }).then((r) => {
        console.info(`[share] rendered ${format} ${r.width}x${r.height} in ${r.ms}ms`);
        return r.blob;
      });
      job.catch(() => cache.current.delete(key));
      cache.current.set(key, job);
      return job;
    },
    [format, lines, video],
  );

  /** The file to hand out: the rendered video, or the original clip on phones that can't render. */
  const fileFor = async (variant: "full" | "background", action: Action): Promise<{ blob: Blob; name: string }> => {
    if (canRender === false) {
      const ext = video.type.includes("webm") ? "webm" : video.type.includes("quicktime") ? "mov" : "mp4";
      return { blob: video, name: fileName.replace(/\.mp4$/, `.${ext}`) };
    }
    const blob = await prepared(variant, (p) => setBusy({ action, progress: p }));
    return { blob, name: fileName };
  };

  const run = async (action: Action) => {
    if (busy) return;
    setBusy({ action, progress: 0 });
    try {
      if (action === "save") {
        const { blob, name } = await fileFor("full", action);
        if (hasNativeShare()) {
          await saveVideoToPhotos(blob, name);
          darkToast("Saved to Photos");
        } else {
          // Current App Store build / web: the share sheet's "Save Video".
          const r = await shareVideoFile(blob, name);
          if (r === "downloaded") darkToast("Video downloaded");
        }
      } else if (action === "more") {
        const { blob, name } = await fileFor("full", action);
        const r = await shareVideoFile(blob, name);
        if (r === "downloaded") darkToast("Video downloaded");
      } else {
        const app: StoriesApp = action;
        if (canRender !== false && (await storiesReady(app))) {
          // Meta "Sharing to Stories": video behind, the card as a movable sticker.
          const bg = await prepared("background", (p) => setBusy({ action, progress: p }));
          const sticker = await stickerPng(lines, out.width);
          await shareToStories(app, bg, sticker);
        } else if (hasNativeShare()) {
          const { blob, name } = await fileFor("full", action);
          await saveVideoToPhotos(blob, name);
          darkToast("Saved to Photos. Pick it in your story.");
          openStoriesApp(app);
        } else {
          // No native plugin yet: the share sheet lists Instagram / Facebook.
          const { blob, name } = await fileFor("full", action);
          const r = await shareVideoFile(blob, name);
          if (r === "downloaded") darkToast("Video downloaded");
        }
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") {
        console.error("[share] failed", e);
        darkToast(ERROR_COPY, false);
      }
    } finally {
      setBusy(null);
    }
  };

  const setPref = (key: string, value: boolean) => {
    setPrefs((p) => {
      const next: ShareCardPrefs = { ...p, [kind]: { ...p[kind], [key]: value } } as ShareCardPrefs;
      saveCardPrefs(next);
      return next;
    });
  };

  const duration = clip?.duration ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your win"
      className="fixed inset-0 z-[120] flex flex-col"
      style={{ background: BG, color: INK, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div
        className="relative flex shrink-0 items-center justify-center px-4"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", height: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute left-3 flex h-11 w-11 items-center justify-center"
          style={{ bottom: 6 }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "#EAE6E1" }}>
            <X size={20} />
          </span>
        </button>
        <h1 className="text-[17px] font-extrabold tracking-tight">Share your win</h1>
      </div>

      {/* Story | Post */}
      <div className="shrink-0 px-4 pb-3">
        <div className="grid h-11 grid-cols-2 rounded-[12px] p-1" style={{ background: "#EAE6E1" }} role="tablist">
          {(["story", "post"] as const).map((f) => {
            const on = format === f;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={!!busy}
                onClick={() => setFormat(f)}
                className="rounded-[9px] text-[14px] font-bold transition-colors"
                style={{
                  background: on ? "#FFFFFF" : "transparent",
                  color: on ? INK : "#6B6570",
                  boxShadow: on ? "0 1px 2px rgba(20,18,24,.08)" : "none",
                }}
              >
                {f === "story" ? "Story" : "Post"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div ref={areaRef} className="relative mx-4 min-h-0 flex-1">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px]"
          style={{ width: boxW, height: boxH, background: INK }}
          data-testid="share-preview"
        >
          <video
            src={videoUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
          {duration != null && duration > 0 && (
            <span
              className="absolute right-3 top-3 rounded-full px-2 py-[3px] text-[11px] font-bold tabular-nums"
              style={{ background: "rgba(20,18,24,.6)", color: "#FFFFFF" }}
            >
              {formatClipDuration(duration)}
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <EditCardPanel
          toggles={toggles}
          values={prefs[kind] as Record<string, boolean>}
          onChange={setPref}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="flex shrink-0 flex-col items-center px-4 pt-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={!!busy}
              className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold"
              style={{ color: INK, boxShadow: "0 1px 2px rgba(20,18,24,.06)" }}
            >
              <SlidersHorizontal size={16} />
              Edit card
            </button>
            {canRender === false && (
              <p className="mt-2 text-center text-[12px]" style={{ color: "#6B6570" }}>
                This phone can't add the card to videos, so your clip is shared as is.
              </p>
            )}
          </div>
          <div
            ref={panelRef}
            className="mt-3 shrink-0 rounded-t-[24px] bg-white px-4 pt-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
          >
            <div className="grid grid-cols-4 gap-2">
              <ShareButton
                label="Instagram Stories"
                icon={<InstagramGlyph size={28} />}
                busy={busy?.action === "instagram" ? busy.progress : null}
                disabled={!!busy}
                onClick={() => void run("instagram")}
              />
              <ShareButton
                label="Facebook Stories"
                icon={<FacebookLogo size={30} />}
                busy={busy?.action === "facebook" ? busy.progress : null}
                disabled={!!busy}
                onClick={() => void run("facebook")}
              />
              <ShareButton
                label="Save video"
                icon={<Download size={24} color={INK} />}
                busy={busy?.action === "save" ? busy.progress : null}
                disabled={!!busy}
                onClick={() => void run("save")}
              />
              <ShareButton
                label="More"
                icon={<MoreHorizontal size={24} color={INK} />}
                busy={busy?.action === "more" ? busy.progress : null}
                disabled={!!busy}
                onClick={() => void run("more")}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ShareButton({
  label,
  icon,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  /** 0–1 while this button's video is being prepared. */
  busy: number | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const r = 29;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy != null}
      className="flex flex-col items-center gap-1.5 disabled:cursor-default"
      style={{ opacity: disabled && busy == null ? 0.45 : 1 }}
    >
      <span className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full" style={{ background: BG }}>
        {icon}
        {busy != null && (
          <>
            <span className="absolute inset-0 rounded-full" style={{ background: BG }} />
            <svg className="absolute inset-0 -rotate-90" width={60} height={60} viewBox="0 0 60 60" aria-hidden>
              <circle cx="30" cy="30" r={r} fill="none" stroke="#E4DDF7" strokeWidth="2.5" />
              <circle
                cx="30"
                cy="30"
                r={r}
                fill="none"
                stroke={PURPLE}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - Math.max(0.04, Math.min(1, busy)))}
                style={{ transition: "stroke-dashoffset 120ms linear" }}
              />
            </svg>
            <span className="absolute text-[11px] font-extrabold tabular-nums" style={{ color: PURPLE }}>
              {Math.round(Math.min(1, busy) * 100)}%
            </span>
          </>
        )}
      </span>
      <span className="text-center text-[11.5px] font-semibold leading-tight" style={{ color: INK }}>
        {busy != null ? "Preparing…" : label}
      </span>
    </button>
  );
}

function EditCardPanel({
  toggles,
  values,
  onChange,
  onDone,
}: {
  toggles: { key: string; label: string; hint: string }[];
  values: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  onDone: () => void;
}) {
  return (
    <div
      className="mt-3 shrink-0 rounded-t-[24px] bg-white px-4 pt-3"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        boxShadow: "0 -6px 24px rgba(20,18,24,.08)",
        animation: "share-sheet-up 200ms ease-out both",
      }}
      role="region"
      aria-label="Edit card"
    >
      <div className="mx-auto mb-2 h-1 w-9 rounded-full" style={{ background: "#E4E0DB" }} />
      <div className="flex h-11 items-center justify-between">
        <h2 className="text-[17px] font-extrabold">Edit card</h2>
        <button type="button" onClick={onDone} className="h-11 px-2 text-[15px] font-bold" style={{ color: PURPLE }}>
          Done
        </button>
      </div>
      <ul>
        {toggles.map((t) => (
          <li key={t.key} className="flex min-h-[56px] items-center gap-3 border-t" style={{ borderColor: "#F0EDE9" }}>
            <div className="min-w-0 flex-1 py-2">
              <div className="text-[15px] font-semibold">{t.label}</div>
              <div className="truncate text-[12.5px]" style={{ color: "#6B6570" }}>
                {t.hint}
              </div>
            </div>
            <Switch
              checked={!!values[t.key]}
              onCheckedChange={(v) => onChange(t.key, v)}
              aria-label={t.label}
              className="data-[state=checked]:bg-[#7C3AED]"
            />
          </li>
        ))}
      </ul>
      <style>{`@keyframes share-sheet-up { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}

export default ShareWinScreen;
