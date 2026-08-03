import { useEffect, useRef, useState } from "react";
import { Share2, X, Download } from "lucide-react";
import { MOODS, type MoodId } from "@/routes/_authenticated/check-in.index";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

const ACTIVITY_LABELS: Record<string, { emoji: string; label: string }> = {
  meal: { emoji: "🥗", label: "Meal" },
  workout: { emoji: "💪", label: "Workout" },
  run: { emoji: "🏃", label: "Run" },
  progress: { emoji: "📸", label: "Progress" },
  sleep: { emoji: "😴", label: "Sleep" },
  water: { emoji: "💧", label: "Water" },
  meditation: { emoji: "🧘", label: "Meditation" },
};

export const SHARE_HIDE_KEY = "checkin-share-hide";

export type CheckInShareData = {
  mood: MoodId | null;
  activity: string | null;
  note: string;
  photoUrl: string | null;
  photoBlob: Blob | null;
};

export function CheckInShareModal({
  data,
  onClose,
}: {
  data: CheckInShareData;
  onClose: () => void;
}) {
  useHideBottomTabs();
  const cardRef = useRef<HTMLDivElement>(null);
  const [hide, setHide] = useState(false);
  const [sharing, setSharing] = useState(false);

  const mood = MOODS.find((m) => m.id === data.mood) ?? MOODS[1];
  const activity = data.activity ? ACTIVITY_LABELS[data.activity] : null;
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const close = () => {
    if (hide) {
      try {
        localStorage.setItem(SHARE_HIDE_KEY, "1");
      } catch {}
    }
    onClose();
  };

  const renderCardToBlob = async (): Promise<Blob | null> => {
    try {
      const mod = await import("html-to-image");
      const node = cardRef.current;
      if (!node) return null;
      const dataUrl = await mod.toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0B0B12",
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (e) {
      console.error("render share card failed", e);
      return null;
    }
  };

  const shareText = `Checked in on Pactara — ${mood.label}${
    activity ? ` · ${activity.label}` : ""
  }`;

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await renderCardToBlob();
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };
      if (blob && nav.share) {
        const file = new File([blob], "pactara-checkin.png", { type: "image/png" });
        const payload: ShareData = { files: [file], text: shareText };
        if (!nav.canShare || nav.canShare(payload)) {
          await nav.share(payload);
          return;
        }
      }
      if (nav.share) {
        await nav.share({ text: shareText });
        return;
      }
      // Fallback: download
      if (blob) downloadBlob(blob);
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      console.error("share failed", e);
    } finally {
      setSharing(false);
    }
  };

  const onDownload = async () => {
    const blob = await renderCardToBlob();
    if (blob) downloadBlob(blob);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(8,8,16,0.7)", backdropFilter: "blur(6px)" }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-[420px] mx-auto px-4 pb-sheet pt-3"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-6 top-5 z-10 h-9 w-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 transition"
        >
          <X size={18} />
        </button>

        {/* Shareable card */}
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-[28px] shadow-2xl"
          style={{
            background: `linear-gradient(160deg, ${mood.color} 0%, #1A1530 55%, #0B0B12 100%)`,
            aspectRatio: "9 / 16",
            maxHeight: "78vh",
          }}
        >
          {/* Decorative blobs */}
          <div
            className="absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-50"
            style={{ background: `radial-gradient(circle, ${mood.color}, transparent 70%)` }}
          />
          <div
            className="absolute -bottom-20 -left-12 h-64 w-64 rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }}
          />

          <div className="relative h-full w-full flex flex-col p-6 text-white">
            {/* Header brand */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-white flex items-center justify-center text-[14px] font-black text-[#0B0B12]">
                  P
                </span>
                <span className="text-[13px] font-semibold tracking-wide opacity-90">
                  PACTARA
                </span>
              </div>
              <span className="text-[12px] opacity-70">{dateStr}</span>
            </div>

            {/* Photo */}
            {data.photoUrl && (
              <div className="mt-5 rounded-2xl overflow-hidden ring-1 ring-white/20">
                <img
                  src={data.photoUrl}
                  alt="Check-in"
                  className="w-full aspect-[4/5] object-cover"
                  crossOrigin="anonymous"
                />
              </div>
            )}

            {/* Mood block */}
            <div className={data.photoUrl ? "mt-5" : "mt-10 flex-1 flex flex-col justify-center"}>
              <div className="text-[64px] leading-none">{mood.emoji}</div>
              <div className="mt-2 text-[28px] font-black tracking-tight leading-tight">
                {mood.label}
              </div>
              {data.note && (
                <p className="mt-2 text-[15px] leading-snug opacity-90 line-clamp-3">
                  "{data.note}"
                </p>
              )}
              {activity && (
                <div className="mt-3 inline-flex self-start items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-[13px] font-medium">
                  <span>{activity.emoji}</span>
                  <span>{activity.label}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-5 flex items-center justify-between border-t border-white/15">
              <div className="text-[12px] opacity-80 leading-tight">
                <div className="font-semibold">Checked in on Pactara</div>
                <div className="opacity-70">Show up. Every day.</div>
              </div>
              <div className="text-[11px] font-semibold tracking-widest opacity-70">
                pactara.lovable.app
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onShare}
            disabled={sharing}
            className="flex-1 rounded-2xl py-3.5 text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "#7C3AED" }}
          >
            <Share2 size={18} />
            {sharing ? "Preparing…" : "Share"}
          </button>
          <button
            onClick={onDownload}
            aria-label="Download image"
            className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 transition"
          >
            <Download size={18} />
          </button>
        </div>

        {/* Don't show again */}
        <label className="mt-4 flex items-center justify-center gap-2 text-[13px] text-white/80 select-none">
          <input
            type="checkbox"
            checked={hide}
            onChange={(e) => setHide(e.target.checked)}
            className="h-4 w-4 rounded border-white/40 accent-[#7C3AED]"
          />
          Don't show me this again
        </label>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pactara-checkin.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
