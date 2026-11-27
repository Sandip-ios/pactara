import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { WorkoutDetail } from "@/lib/lifts.functions";
import { cn } from "@/lib/utils";
import type { PostWorkout, SocialPostItem } from "@/lib/social-post-types";
import { workoutCardLine, type AttachedCard } from "@/lib/redesign-feed-view";
import { RedesignWorkoutSheet, type SheetAuthor } from "../RedesignCheckInSheets";
import { postVideoRatio } from "@/lib/post-video-layout";

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
    <div className={`relative overflow-hidden bg-[var(--new-library-video)] ${className}`}>
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
export function PostCarousel({ items, height = 420, aspectRatio }: { items: SocialPostItem[]; height?: number; aspectRatio?: "4 / 5" }) {
  const [index, setIndex] = useState(0);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const ref = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  const active = items[index] ?? items[0];
  const activeRatio = active?.kind === "video" ? (ratios[active.id] ?? 9 / 16) : aspectRatio;
  return (
    <div className="relative w-full">
      <div
        ref={ref}
        onScroll={(e) => { const el = e.currentTarget; setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={activeRatio ? { aspectRatio: activeRatio } : { height }}
      >
        {items.map((m) => {
          const pos = m.crop?.aspect === "4:5" ? `50% ${Math.round((m.crop.y ?? 0.5) * 100)}%` : undefined;
          return (
            <div key={m.id} className="h-full w-full shrink-0 snap-center">
              {!m.url ? <div className="h-full w-full bg-neutral-200" /> : m.kind === "video" ? (
                <PostVideo src={m.url} poster={m.posterUrl} trimStart={m.trimStart} trimEnd={m.trimEnd} muted={m.muted} onDimensions={(width, height) => {
                  const ratio = postVideoRatio(width, height);
                  setRatios((old) => old[m.id] === ratio ? old : { ...old, [m.id]: ratio });
                }} />
              ) : (
                <img src={m.url} alt="" className="h-full w-full object-cover" style={pos || aspectRatio ? { objectPosition: pos, objectFit: "cover" } : { objectFit: "contain", background: "#0C0A09" }} />
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

/** "2 exercises · 7 sets · 46 min"; caption workouts have no time, so no minutes. */
export function postWorkoutLine(w: PostWorkout): string {
  const line = workoutCardLine({ title: w.title, exercises: w.moves.length, sets: w.sets, minutes: w.minutes, prCount: w.prCount });
  return w.minutes > 0 ? line : line.replace(/ · \d+ min$/, "");
}

function toDetail(w: PostWorkout, isMine: boolean): WorkoutDetail {
  return {
    title: w.title,
    summary: { exercises: w.moves.length, sets: w.sets, minutes: w.minutes, volume: 0, unit: "kg", items: [], prs: [] },
    exercises: w.moves.map((m) => ({
      exerciseId: m.exerciseId, name: m.name, imageStart: m.imageStart, logType: m.logType, equipment: "",
      sets: m.sets.map((s) => ({ weight: null, reps: s.reps, seconds: s.seconds, unit: "kg" as const, isPr: s.isPr })),
    })),
    isMine,
    dayLabel: null,
    savedWorkoutId: null,
  };
}

/** The 1d compact "WORKOUT" card; opens the sets-and-reps sheet. */
export function PostWorkoutCard({ workout, isMine, author, postId }: { workout: PostWorkout; isMine: boolean; author: SheetAuthor | null; postId: string }) {
  const [open, setOpen] = useState(false);
  const card: AttachedCard = {
    kind: "workout",
    label: "WORKOUT",
    title: workout.title || "Workout",
    line: postWorkoutLine(workout),
    pr: isMine && workout.prCount > 0,
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-[calc(100%-24px)] items-center gap-3 rounded-[16px] text-left active:opacity-80"
        style={{ margin: "10px 12px 0", padding: "12px 14px", background: "#F7F5F2", color: INK }}
        aria-label={`${card.label}: ${card.title}. ${card.line}. Show details`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-extrabold" style={{ letterSpacing: "0.6px", color: PURPLE }}>{card.label}</span>
          <span className="block truncate text-[16px] font-extrabold leading-snug">{card.title}</span>
          <span className="block truncate text-[12px]" style={{ color: MUTED }}>{card.line}</span>
          {card.pr && <span className="mt-1.5 inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-extrabold" style={{ background: "#FEF3C7", color: "#A16207" }}>🏆 New PR</span>}
        </span>
        <ChevronRight size={18} className="shrink-0" style={{ color: "#8A847E" }} aria-hidden />
      </button>
      <RedesignWorkoutSheet open={open} onOpenChange={setOpen} checkInId={`post-${postId}`} card={card} author={author} isMine={isMine} planSlug={null} detail={toDetail(workout, isMine)} />
    </>
  );
}
