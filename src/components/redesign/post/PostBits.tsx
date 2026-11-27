import { useEffect, useRef, useState, type ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SocialPostItem } from "@/lib/social-post-types";

export const INK = "#1C1917";
export const MUTED = "#57534E";
export const PURPLE = "#7C3AED";
export const LINE = "#EFEAE4";

/** Full-screen header: left action, centered title, right action. */
export function PostTopBar({ title, left, right, dark = false, compose = false }: { title: string; left: ReactNode; right?: ReactNode; dark?: boolean; compose?: boolean }) {
  if (compose) return (
    <header className="pt-new-top sticky top-0 z-10 grid grid-cols-[70px_1fr_70px] items-center border-b border-[var(--new-profile-track)] bg-[var(--new-white)] px-4 pb-3">
      {left}
      <h1 className="m-0 text-center text-[17px] font-bold text-[var(--new-ink-deep)]">{title}</h1>
      {right}
    </header>
  );
  return (
    <header className="pt-new-top sticky top-0 z-10" style={{ background: dark ? "#0C0A09" : "var(--new-white)" }}>
      <div className="grid h-12 grid-cols-[88px_1fr_88px] items-center px-2">
        <div className="flex justify-start">{left}</div>
        <h1 className="text-center text-[17px] font-extrabold" style={{ color: dark ? "#FFFFFF" : INK }}>{title}</h1>
        <div className="flex justify-end">{right}</div>
      </div>
    </header>
  );
}

export function TextAction({ children, onClick, disabled, tone = "ink", dark = false, className }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: "ink" | "purple" | "muted"; dark?: boolean; className?: string }) {
  const color = disabled ? (dark ? "#57534E" : "#A8A29E") : tone === "purple" ? (dark ? "#C4B5FD" : PURPLE) : tone === "muted" ? MUTED : dark ? "#FFFFFF" : INK;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("flex h-11 min-w-11 items-center justify-center px-2 text-[16px] font-bold", className)} style={{ color }}>
      {children}
    </button>
  );
}

/** "Who sees it" chip. */
export function AudienceChip({ label, on, onClick, disabled }: { label: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 max-w-full items-center rounded-full px-3.5 text-[14px] font-semibold"
      style={on ? { background: "var(--new-soft)", border: `1px solid ${PURPLE}`, color: "var(--new-purple-text)" } : { background: "#FFFFFF", border: "1px solid #E7E3DE", color: INK }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Muted loop inside the trim window, with a progress bar and the sound button. */
export function PostVideo({ src, poster, trimStart, trimEnd, muted: mutedByPoster, className = "h-full w-full", onDimensions }: {
  src: string; poster?: string | null; trimStart?: number | null; trimEnd?: number | null; muted?: boolean; className?: string; onDimensions?: (width: number, height: number) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const start = trimStart ?? 0;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) void v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`relative overflow-hidden bg-[var(--new-post-letterbox)] ${className}`}>
      {poster && <img src={poster} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-contain" onLoad={(e) => onDimensions?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} />}
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted={muted || mutedByPoster}
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          onDimensions?.(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
          if (start > 0) e.currentTarget.currentTime = start;
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          const end = trimEnd ?? v.duration;
          if (end && v.currentTime >= end) { v.currentTime = start; void v.play().catch(() => {}); }
          const len = (end || 0) - start;
          setProgress(len > 0 ? Math.min(1, Math.max(0, (v.currentTime - start) / len)) : 0);
        }}
        onEnded={(e) => { e.currentTarget.currentTime = start; void e.currentTarget.play().catch(() => {}); }}
        className="relative h-full w-full object-contain object-center"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" style={{ background: "rgba(255,255,255,0.3)" }}>
        <div className="h-full" style={{ width: `${progress * 100}%`, background: "#FFFFFF" }} />
      </div>
      {!mutedByPoster && (
        <button
          type="button"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
          className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </span>
        </button>
      )}
    </div>
  );
}

/** Swipeable media with a "1/3" counter and dots. */
export function PostCarousel({ items, aspectRatio = "3 / 4" }: { items: SocialPostItem[]; aspectRatio?: "4 / 5" | "3 / 4" }) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  return (
    <div className="relative w-full">
      <div
        ref={ref}
        onScroll={(e) => { const el = e.currentTarget; setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ aspectRatio }}
      >
        {items.map((m) => {
          return (
            <div key={m.id} className="h-full w-full shrink-0 snap-center">
              {!m.url ? <div className="h-full w-full bg-neutral-200" /> : m.kind === "video" ? (
                <PostVideo src={m.url} poster={m.posterUrl} trimStart={m.trimStart} trimEnd={m.trimEnd} muted={m.muted} />
              ) : (
                <img src={m.url} alt="" className="h-full w-full object-cover object-center" />
              )}
            </div>
          );
        })}
      </div>
      {items.length > 1 && (
        <>
          <span className="pointer-events-none absolute right-3 top-3 flex h-6 items-center rounded-[12px] px-2 text-[12px] font-bold text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
            {index + 1}/{items.length}
          </span>
          <div className="flex justify-center gap-1.5 pt-2.5" aria-hidden>
            {items.map((m, i) => <span key={m.id} className="h-1.5 w-1.5 rounded-full" style={{ background: i === index ? PURPLE : "#D6D3D1" }} />)}
          </div>
        </>
      )}
    </div>
  );
}

export { PostWorkoutCard } from "./PostSections";
