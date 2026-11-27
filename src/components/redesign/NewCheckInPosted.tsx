import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play, Share, Volume2, VolumeX, X } from "lucide-react";
import type { GroupToday } from "@/lib/group-today.functions";
import { BADGE_META } from "@/lib/badges";
import { highestPostedBadge, postedCrew, postedCrewChip, postedMediaHeight, postedStreak } from "@/lib/new-posted";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { CrewAvatarOverlap } from "./CrewAvatars";

const VIDEO_WORDMARK = "/brand/pactara-wordmark-video.png";

function useReducedMotion() {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function PostedMedia({ src, isVideo, height, counted, streak }: {
  src: string | null;
  isVideo: boolean;
  height: number;
  counted: boolean;
  streak: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [sound, setSound] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const label = postedStreak(streak, counted);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduced === null) return;
    if (reduced) {
      video.pause();
      video.currentTime = 0;
      setPlaying(false);
    } else {
      void video.play().catch(() => setPlaying(false));
    }
  }, [reduced, src]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    if (videoRef.current) videoRef.current.muted = !next;
  };

  return <div className="relative w-full shrink-0 overflow-hidden bg-[var(--new-ink-deep)]" style={{ height }}>
    {src && isVideo ? <video
      ref={videoRef}
      src={src}
      autoPlay={reduced === false}
      loop
      muted={!sound}
      playsInline
      preload="auto"
      aria-label="Your check-in"
      className="h-full w-full object-cover"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onTimeUpdate={(event) => {
        const video = event.currentTarget;
        setProgress(video.duration ? video.currentTime / video.duration : 0);
      }}
    /> : src ? <img src={src} alt="Your check-in" className="h-full w-full object-cover" /> : null}

    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{ background: "linear-gradient(rgba(0,0,0,0.38), transparent)" }} />
    <img src={VIDEO_WORDMARK} alt="Pactara" className="absolute right-[14px] top-[14px] h-[17px] w-auto" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }} />
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[110px]" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.35))" }} />

    <div className="absolute bottom-[22px] left-4 text-[var(--new-white)]" style={{ textShadow: label.counted ? "0 2px 8px rgba(0,0,0,0.4)" : "none" }}>
      {label.counted ? <div className="flex items-baseline">
        <span className="text-[52px] font-extrabold leading-none tracking-[-1.5px]">Day {label.day}</span>
        <span className="ml-2 text-[13px] font-extrabold tracking-[2px]">STREAK</span>
      </div> : <span className="flex h-[30px] items-center rounded-[15px] bg-[rgba(0,0,0,0.5)] px-3 text-[14px] font-bold">{label.text}</span>}
    </div>

    {isVideo && <>
      <button type="button" onClick={toggleSound} aria-label={sound ? "Turn sound off" : "Turn sound on"} className="absolute bottom-6 right-[14px] flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(0,0,0,0.5)] text-[var(--new-white)]">
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <div aria-hidden className="pointer-events-none absolute inset-x-4 bottom-[10px] h-[3px] overflow-hidden rounded-[3px] bg-[rgba(255,255,255,0.35)]">
        <div className="h-full rounded-[3px] bg-[var(--new-white)]" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
      </div>
      {reduced === true && !playing && <button type="button" aria-label="Play video" onClick={() => void videoRef.current?.play()} className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(0,0,0,0.5)] text-[var(--new-white)]">
        <Play size={24} fill="currentColor" />
      </button>}
    </>}
  </div>;
}

export function NewCheckInPosted({ groups, countedByGroup, streakByGroup, badgesByGroup, streak, mediaUrl, isVideo, description, onShare, onDone }: {
  groups: GroupToday[];
  countedByGroup: Record<string, boolean>;
  streakByGroup: Record<string, number>;
  badgesByGroup: Record<string, number[]>;
  streak: number;
  mediaUrl: string | null;
  isVideo: boolean;
  description: string;
  onShare?: () => void;
  onDone: () => void;
}) {
  useHideBottomTabs(true, false);
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  const badgeRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [mediaHeight, setMediaHeight] = useState(430);
  const crew = postedCrew(groups, countedByGroup);
  const counted = Object.values(countedByGroup).some(Boolean);
  const shownStreak = (crew && streakByGroup[crew.id]) || streak;
  const badge = highestPostedBadge(crew ? badgesByGroup[crew.id] ?? [] : []);
  const badgeMeta = badge === null ? null : BADGE_META[badge] ?? null;
  const crewChip = postedCrewChip(groups.length);
  const avatars = (crew?.members ?? []).map((member) => ({ id: member.userId, name: member.name, avatarUrl: member.avatarUrl, avatarColor: member.avatarColor }));
  const hasBadge = badge !== null && !!badgeMeta;

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const update = () => {
      const badgeHeight = badgeRef.current ? badgeRef.current.offsetHeight + 14 : 0;
      const detailsHeight = detailsRef.current?.offsetHeight ?? 0;
      setMediaHeight(postedMediaHeight(scroller.clientHeight - badgeHeight - detailsHeight - 14));
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(scroller);
    if (badgeRef.current) observer?.observe(badgeRef.current);
    if (detailsRef.current) observer?.observe(detailsRef.current);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [hasBadge, scrollRef]);

  return <div role="dialog" aria-modal="true" aria-label="Posted" className="redesign-step3 fixed inset-0 z-40 flex flex-col bg-[var(--new-bg)] text-[var(--new-ink)]">
    <header className="shrink-0 px-5 pt-new-top">
      <div className="flex h-14 items-center justify-between">
        <span aria-label="Pactara" className="text-[26px] font-extrabold tracking-[-0.5px]"><span className="text-[var(--new-purple-text)]">P</span>actara</span>
        <button type="button" onClick={onDone} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0EDE8] text-[var(--new-ink-deep)]"><X size={20} /></button>
      </div>
    </header>

    <div ref={scrollRef} data-scroll-root className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {badge !== null && badgeMeta && <div ref={badgeRef} className="mx-4 mt-3.5 flex shrink-0 items-center gap-3 rounded-[18px] px-4 py-3" style={{ background: "linear-gradient(90deg,#FFF1E7,#EDE4FF)" }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--new-white)]"><img src={badgeMeta.image} alt="" className="h-8 w-8 object-contain" /></span>
        <div className="min-w-0"><p className="text-[11px] font-extrabold tracking-[1px] text-[var(--new-purple-text)]">NEW BADGE UNLOCKED</p><p className="text-[17px] font-extrabold">{badgeMeta.title}</p></div>
      </div>}

      <section className="mx-4 mt-3.5 shrink-0 overflow-hidden rounded-[22px] bg-[var(--new-white)]">
        <PostedMedia src={mediaUrl} isVideo={isVideo} height={mediaHeight} counted={counted} streak={shownStreak} />
        <div ref={detailsRef} className="px-4 pb-4 pt-3.5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><h1 className="min-w-0 truncate text-[18px] font-extrabold">{crew?.name ?? "Your crew"}</h1>{crewChip && <span className="flex h-[22px] shrink-0 items-center rounded-[11px] bg-[#F0EDE8] px-2 text-[12px] font-bold text-[var(--new-muted)]">{crewChip}</span>}</div>
              <p className="mt-0.5 text-[14px] text-[var(--new-muted)]">{crew?.doneCount ?? 0} of {crew?.memberCount ?? 0} checked in today</p>
            </div>
            <CrewAvatarOverlap members={avatars} size={32} limit={4} />
          </div>
          {description && <><div className="mt-3 h-px bg-[#F0EDE8]" /><p className="mt-3 whitespace-pre-wrap break-words text-[15px] text-[var(--new-muted)]">{description}</p></>}
        </div>
      </section>
    </div>

    <div className="z-50 flex shrink-0 flex-col gap-2.5 bg-[var(--new-bg)] px-4 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 30px)" }}>
      {onShare && <button type="button" onClick={onShare} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[27px] bg-[var(--new-purple)] text-[16px] font-bold text-[var(--new-white)]"><Share size={18} />Share your win</button>}
      <button type="button" onClick={onDone} className="h-[50px] w-full rounded-[25px] bg-[#EDE9FE] text-[16px] font-bold text-[var(--new-purple-text)]">Done</button>
    </div>
  </div>;
}
