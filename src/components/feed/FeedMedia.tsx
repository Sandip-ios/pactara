import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { attachVideoDurationFix, effectiveDuration } from "@/lib/video-playback";
import { MemberPhoto } from "@/components/MemberPhoto";

const VIDEO_RE = /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i;
export const isVideoUrl = (url: string) => VIDEO_RE.test(url);

export function FeedAvatar({
  url,
  color,
  name,
  size,
  className = "",
}: {
  url: string | null;
  color: string;
  name: string;
  size: number;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${className}`}
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      <MemberPhoto src={url} name={name || "U"} />
    </span>
  );
}

function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function RetryBlock({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-800 text-center">
      <span className="text-[14px] font-semibold text-white/85">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className="h-9 rounded-full bg-white px-4 text-[13px] font-bold text-neutral-900 active:opacity-80"
      >
        Tap to retry
      </button>
    </div>
  );
}

/**
 * Feed video: muted autoplay while on screen, downloads only near the
 * viewport, poster frame first. Shows a blurred "Processing video…" state
 * instead of a black box, and a retry when loading fails.
 */
export function FeedVideo({ src, poster, onOpen }: { src: string; poster?: string | null; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const primedRef = useRef(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    primedRef.current = false;
    const detach = attachVideoDurationFix(v);
    const preloadObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          preloadObserver.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    preloadObserver.observe(v);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.4;
          visibleRef.current = visible;
          if (visible) {
            v.preload = "auto";
            v.play().catch(() => {});
          } else {
            v.preload = "metadata";
            if (!v.paused) v.pause();
          }
        }
      },
      { threshold: [0, 0.4, 0.75, 1] },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      preloadObserver.disconnect();
      detach();
    };
  }, [attempt]);

  // Only call it "processing" when the first frame is slow to arrive.
  useEffect(() => {
    if (!near || ready || failed) return;
    const t = window.setTimeout(() => setSlow(true), 1500);
    return () => window.clearTimeout(t);
  }, [near, ready, failed, attempt]);

  const processing = !ready && !failed && (!poster || (near && slow));
  const updateDuration = () => {
    const v = ref.current;
    if (!v) return;
    const d = effectiveDuration(v);
    if (d > 0 && Number.isFinite(d)) setDuration(d);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open video"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="relative aspect-square w-full overflow-hidden bg-neutral-800"
    >
      <video
        key={attempt}
        ref={ref}
        src={near ? src : undefined}
        poster={poster ?? undefined}
        muted={muted}
        playsInline
        preload="metadata"
        onLoadedMetadata={() => {
          setReady(true);
          updateDuration();
          const v = ref.current;
          if (!v || primedRef.current) return;
          primedRef.current = true;
          // iOS paints no first frame from preload alone: play briefly, then pause.
          if (visibleRef.current) {
            v.play().catch(() => {});
            return;
          }
          v.play()
            .then(() => {
              if (visibleRef.current) return;
              v.pause();
              try {
                v.currentTime = 0.1;
              } catch {}
            })
            .catch(() => {
              try {
                v.currentTime = 0.1;
              } catch {}
            });
        }}
        onDurationChange={updateDuration}
        onError={() => {
          if (near) setFailed(true);
        }}
        onEnded={() => {
          // Manual loop so a wrong header duration can't cut the clip short.
          window.setTimeout(() => {
            const el = ref.current;
            if (!el || !el.ended) return;
            try {
              el.currentTime = 0;
              if (visibleRef.current) void el.play().catch(() => {});
            } catch {}
          }, 300);
        }}
        className="pointer-events-none h-full w-full object-cover"
      />
      {processing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-stone-700 to-stone-500">
          {poster && (
            <img src={poster} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-md brightness-50" />
          )}
          <Loader2 size={22} className="relative animate-spin text-white" aria-hidden />
          <span className="relative text-[13px] font-semibold text-white">Processing video…</span>
        </div>
      )}
      {failed && (
        <RetryBlock
          label="Couldn't load video"
          onRetry={() => {
            setFailed(false);
            setReady(false);
            setSlow(false);
            setAttempt((a) => a + 1);
          }}
        />
      )}
      {!failed && (
        <button
          type="button"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          onClick={(e) => {
            e.stopPropagation();
            const v = ref.current;
            const next = !muted;
            setMuted(next);
            if (v) {
              v.muted = next;
              if (!next) void v.play().catch(() => {});
            }
          }}
          className="absolute bottom-1 left-1 flex h-11 w-11 items-center justify-center"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white">
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </span>
        </button>
      )}
      {!failed && duration !== null && (
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-semibold text-white">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}

export function FeedImage({ src, onOpen }: { src: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-[#EDE9E4]">
      <button type="button" onClick={onOpen} aria-label="Open photo" className="block h-full w-full">
        <img
          key={attempt}
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </button>
      {failed && (
        <RetryBlock
          label="Couldn't load photo"
          onRetry={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
        />
      )}
    </div>
  );
}
