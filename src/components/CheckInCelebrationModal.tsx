import { useEffect, useMemo, useRef } from "react";
import { Share as ShareIcon, X } from "lucide-react";
import { BADGE_META } from "@/lib/badges";

/**
 * CheckInCelebrationModal — Pactara
 *
 * Clean, white-sheet share artifact:
 *  - Pactara wordmark (blue) top-left, close (X) top-right
 *  - Large photo card with "Day N STREAK" overlaid bottom-left in white
 *    and a faint @PACTARA watermark top-right of the image
 *  - Group name + "X of Y teammates checked in today"
 *  - Row of small circular avatar markers: filled blue w/ green dot if
 *    checked in today; outlined gray if not yet. Initials only.
 *  - One short line of escalating copy
 *  - Primary blue "Share your win", secondary gray "Keep it private"
 *
 * NOTE: real implementation should gate teammate display on group consent
 * before rendering identifying info on a shareable card.
 */

const COLORS = {
  bg: "#FFFFFF",
  ink: "#0B1220",
  inkSoft: "#5B6573",
  border: "#E5E7EB",
  primary: "#1A73E8", // Pactara blue
  primaryHover: "#1565C9",
  secondary: "#EFF0F2",
  checked: "#1A73E8",
  checkedDot: "#22C55E",
  pendingBorder: "#D1D5DB",
  pendingText: "#9CA3AF",
};

export type Teammate = {
  initial: string;
  checkedIn: boolean;
};

export type CheckInCelebrationModalProps = {
  userPhoto: string | null;
  streakCount: number;
  groupName: string;
  teammates: Teammate[];
  streakCopy?: string;
  newBadges?: number[];
  onShare: () => void;
  onDismiss: () => void;
  onInvite?: () => void;
  open?: boolean;
};

function defaultCopyForStreak(n: number) {
  if (n <= 1) return "Day one. The hardest one.";
  if (n < 7) return "Quietly stacking days.";
  if (n < 30) return "One week strong. Your group sees you.";
  if (n < 100) return "A month of mornings nobody saw but you.";
  return "Triple digits. Identity, not effort.";
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function CheckInCelebrationModal({
  userPhoto,
  streakCount,
  groupName,
  teammates,
  streakCopy,
  newBadges,
  onShare,
  onDismiss,
  open = true,
}: CheckInCelebrationModalProps) {
  const reduceMotion = useMemo(prefersReducedMotion, []);
  const shareBtnRef = useRef<HTMLButtonElement>(null);

  const checkedInCount = teammates.filter((t) => t.checkedIn).length;
  const copy = streakCopy ?? defaultCopyForStreak(streakCount);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => shareBtnRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Check-in celebration"
      className="fixed inset-0 z-[110] flex flex-col overflow-y-auto"
      style={{
        background: COLORS.bg,
        color: COLORS.ink,
        fontFamily: "Inter, system-ui, sans-serif",
        animation: reduceMotion
          ? "pactara-fade 200ms ease-out both"
          : "pactara-fade 240ms ease-out both",
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5"
        style={{ paddingTop: 24, paddingBottom: 12 }}
      >
        <span
          className="text-[17px] font-bold tracking-tight"
          style={{ color: COLORS.primary }}
        >
          Pactara
        </span>
        <button
          onClick={onDismiss}
          aria-label="Close"
          className="h-9 w-9 rounded-full flex items-center justify-center"
          style={{ background: COLORS.secondary, color: COLORS.ink }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div
          className="overflow-hidden rounded-[20px]"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff" }}
        >
          {/* Photo with Day N overlay */}
          <div
            className="relative w-full overflow-hidden"
            style={{
              aspectRatio: "1 / 1",
              background: `linear-gradient(160deg, #1E2350, #3A3F66)`,
            }}
          >
            {userPhoto ? (
              <img
                src={userPhoto}
                alt="Your check-in"
                className="h-full w-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[12px] tracking-widest text-white/70">
                NO PHOTO
              </div>
            )}

            {/* @PACTARA watermark */}
            <span
              aria-hidden
              className="absolute right-3 top-3 text-[12px] font-semibold tracking-[0.18em] text-white/40"
            >
              @PACTARA
            </span>

            {/* gradient for legibility */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/2"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.45) 100%)",
              }}
            />

            {/* Day N STREAK */}
            <div className="absolute left-4 bottom-3 flex items-baseline gap-2 text-white">
              <span
                className="leading-none"
                style={{
                  fontWeight: 800,
                  fontSize: 44,
                  letterSpacing: "-0.02em",
                }}
              >
                Day {streakCount}
              </span>
              <span
                className="text-[11px] font-bold tracking-[0.18em]"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                STREAK
              </span>
            </div>
          </div>

          {/* Group block */}
          <div className="px-5 pt-4 pb-5">
            <div className="text-[17px] font-bold" style={{ color: COLORS.ink }}>
              {groupName}
            </div>
            <div className="mt-1 text-[14px]" style={{ color: COLORS.inkSoft }}>
              {checkedInCount} of {teammates.length} teammates checked in today
            </div>

            {/* Avatars row */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center -space-x-2">
                {teammates.slice(0, 6).map((t, i) => (
                  <span
                    key={i}
                    aria-label={t.checkedIn ? "Checked in" : "Not yet"}
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{
                      background: t.checkedIn ? COLORS.checked : "#fff",
                      color: t.checkedIn ? "#fff" : COLORS.pendingText,
                      border: t.checkedIn
                        ? `2px solid #fff`
                        : `1.5px solid ${COLORS.pendingBorder}`,
                      boxShadow: t.checkedIn
                        ? "0 0 0 1px rgba(0,0,0,0.04)"
                        : "none",
                    }}
                  >
                    {t.initial?.slice(0, 1).toUpperCase() || "•"}
                    {t.checkedIn && (
                      <span
                        aria-hidden
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
                        style={{
                          background: COLORS.checkedDot,
                          border: "2px solid #fff",
                        }}
                      />
                    )}
                  </span>
                ))}
              </div>
              <div className="text-[13px]" style={{ color: COLORS.inkSoft }}>
                {checkedInCount} checked in
              </div>
            </div>

            <div
              className="mt-4 border-t pt-4 text-[14px]"
              style={{ borderColor: COLORS.border, color: COLORS.inkSoft }}
            >
              {copy}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-3">
          <button
            ref={shareBtnRef}
            onClick={onShare}
            className="h-14 w-full rounded-2xl text-[16px] font-semibold flex items-center justify-center gap-2"
            style={{ background: COLORS.primary, color: "#fff" }}
          >
            <ShareIcon size={18} />
            Share your win
          </button>
          <button
            onClick={onDismiss}
            className="h-14 w-full rounded-2xl text-[16px] font-semibold"
            style={{ background: COLORS.secondary, color: COLORS.ink }}
          >
            Keep it private
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pactara-fade {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default CheckInCelebrationModal;
