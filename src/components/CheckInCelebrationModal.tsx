import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * CheckInCelebrationModal — Pactara
 *
 * Design POV: "pre-dawn light, you showed up anyway."
 * Not a neon energy-drink celebration. Quiet, disciplined, with one
 * signature moment: the streak number sits in a soft horizon of pre-dawn
 * sky bleeding into warm first light, with a thin sun-line behind it.
 *
 * Palette (named hex):
 *   --night     #0E1230  deep pre-dawn sky
 *   --indigo    #1E2350  upper sky
 *   --slate     #3A3F66  cool shadow
 *   --horizon   #C97B5C  warm horizon glow (signature)
 *   --first     #F4C28A  first light / highlight
 *   --paper     #F6F1E7  card "paper", off-white, not pure white
 *
 * Type:
 *   Display: "Fraunces" (serif w/ optical sizing, feels editorial, calm)
 *   Body:    "Inter"    (neutral, legible at small sizes)
 *
 * Signature moment: a thin horizontal "sun-line" sweeps behind the streak
 * number on mount, plus a subtle grain. No rainbow confetti — particles
 * are warm dust motes drifting upward, settling within ~600ms.
 *
 * NOTE on teammates: real implementation must gate teammate display on
 * group consent before rendering identifying info on a shareable card.
 * Placeholder data here uses initials / silhouettes only.
 */

const PALETTE = {
  night: "#0E1230",
  indigo: "#1E2350",
  slate: "#3A3F66",
  horizon: "#C97B5C",
  first: "#F4C28A",
  paper: "#F6F1E7",
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
  /** Copy shown under the share card. Caller decides escalation by streak. */
  streakCopy?: string;
  onShare: () => void;
  onDismiss: () => void;
  onInvite?: () => void;
  open?: boolean;
};

function defaultCopyForStreak(n: number) {
  if (n <= 1) return "Day one. The hardest one.";
  if (n < 7) return "Quietly stacking days.";
  if (n < 30) return "A week in. This is becoming who you are.";
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
  onShare,
  onDismiss,
  onInvite,
  open = true,
}: CheckInCelebrationModalProps) {
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useMemo(prefersReducedMotion, []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const shareBtnRef = useRef<HTMLButtonElement>(null);

  const checkedInCount = teammates.filter((t) => t.checkedIn).length;
  const copy = streakCopy ?? defaultCopyForStreak(streakCount);

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the primary action shortly after mount.
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

  // Pre-compute drifting dust motes (warm, low count, subtle).
  const motes = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: (i * 53) % 100,
        delay: (i % 7) * 60,
        size: 2 + (i % 3),
        drift: 40 + (i % 5) * 12,
      })),
    [],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Check-in celebration"
      ref={dialogRef}
      className="fixed inset-0 z-[110] flex items-stretch justify-center overflow-hidden"
      style={{
        background: `radial-gradient(120% 80% at 50% 110%, ${PALETTE.horizon}33 0%, ${PALETTE.indigo} 45%, ${PALETTE.night} 100%)`,
        fontFamily: "Inter, system-ui, sans-serif",
        color: PALETTE.paper,
      }}
    >
      {/* Subtle grain overlay (signature texture) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Dust motes — only when motion is allowed */}
      {!reduceMotion && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {motes.map((m, i) => (
            <span
              key={i}
              className="absolute bottom-0 rounded-full"
              style={{
                left: `${m.left}%`,
                width: m.size,
                height: m.size,
                background: PALETTE.first,
                opacity: 0,
                animation: `pactara-mote 1400ms ${m.delay}ms ease-out forwards`,
                ["--drift" as never]: `${m.drift}vh`,
              }}
            />
          ))}
        </div>
      )}

      {/* Top bar: wordmark + close */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
        <span
          className="text-[11px] font-semibold tracking-[0.22em] opacity-70 select-none"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          PACTARA
        </span>
        <button
          onClick={onDismiss}
          aria-label="Close"
          className="h-9 w-9 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: PALETTE.paper,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Centered content column */}
      <div
        className="relative z-[1] mx-auto flex w-full max-w-[420px] flex-col px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-20"
        style={{
          animation: reduceMotion
            ? "pactara-fade 240ms ease-out both"
            : "pactara-rise 520ms cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        {/* Share card — feels like a generated artifact */}
        <div
          className="relative mx-auto w-full overflow-hidden rounded-[22px] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.55)]"
          style={{
            background: PALETTE.paper,
            color: PALETTE.night,
            border: `1px solid ${PALETTE.first}55`,
          }}
        >
          {/* Signature sun-line behind the streak number */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0"
            style={{
              top: userPhoto ? 248 : 96,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${PALETTE.horizon}, transparent)`,
              transform: "scaleX(0)",
              transformOrigin: "center",
              animation: reduceMotion
                ? "none"
                : "pactara-sunline 700ms 120ms cubic-bezier(.2,.7,.2,1) forwards",
              opacity: reduceMotion ? 1 : 0,
            }}
          />

          {/* Photo */}
          <div className="px-4 pt-4">
            <div
              className="overflow-hidden rounded-[14px]"
              style={{
                aspectRatio: "4 / 5",
                background: `linear-gradient(160deg, ${PALETTE.indigo}, ${PALETTE.slate})`,
                border: `1px solid ${PALETTE.night}15`,
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
                <div
                  className="flex h-full w-full items-center justify-center text-[12px] tracking-widest"
                  style={{ color: `${PALETTE.paper}99` }}
                >
                  NO PHOTO
                </div>
              )}
            </div>
          </div>

          {/* Streak — dominant element */}
          <div className="px-5 pt-5 text-center">
            <div
              className="leading-none"
              style={{
                fontFamily: "Fraunces, 'Times New Roman', serif",
                fontWeight: 500,
                fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                fontSize: 88,
                letterSpacing: "-0.04em",
                color: PALETTE.night,
              }}
            >
              Day <span style={{ color: PALETTE.horizon }}>{streakCount}</span>
            </div>
            <p
              className="mx-auto mt-3 max-w-[28ch] text-[14px] leading-snug"
              style={{ color: `${PALETTE.night}B3` }}
            >
              {copy}
            </p>
          </div>

          {/* Group row */}
          <div
            className="mt-5 flex items-center justify-between px-5 py-4"
            style={{ borderTop: `1px solid ${PALETTE.night}10` }}
          >
            <div className="min-w-0">
              <div
                className="truncate text-[14px] font-semibold"
                style={{ color: PALETTE.night }}
              >
                {groupName}
              </div>
              <div
                className="text-[12px]"
                style={{ color: `${PALETTE.night}80` }}
              >
                {checkedInCount}/{teammates.length} in today
              </div>
            </div>
            <div className="flex items-center -space-x-1.5">
              {teammates.slice(0, 6).map((t, i) => (
                <span
                  key={i}
                  aria-label={t.checkedIn ? "Checked in" : "Not yet"}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: t.checkedIn ? PALETTE.horizon : "transparent",
                    color: t.checkedIn ? PALETTE.paper : `${PALETTE.night}66`,
                    border: t.checkedIn
                      ? `1px solid ${PALETTE.horizon}`
                      : `1px dashed ${PALETTE.night}33`,
                  }}
                >
                  {t.initial?.slice(0, 1).toUpperCase() || "•"}
                </span>
              ))}
            </div>
          </div>

          {/* Card footer brand */}
          <div
            className="flex items-center justify-between px-5 pb-4 pt-1 text-[10px] tracking-[0.18em]"
            style={{ color: `${PALETTE.night}66` }}
          >
            <span>PACTARA</span>
            <span>SHOW UP. EVERY DAY.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            ref={shareBtnRef}
            onClick={onShare}
            className="h-14 w-full rounded-2xl text-[16px] font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: PALETTE.paper,
              color: PALETTE.night,
              boxShadow: `0 10px 30px -10px ${PALETTE.first}66`,
            }}
          >
            Share win
          </button>
          <button
            onClick={onDismiss}
            className="h-14 w-full rounded-2xl text-[15px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "transparent",
              color: `${PALETTE.paper}CC`,
            }}
          >
            Keep it private
          </button>
          {onInvite && (
            <button
              onClick={onInvite}
              className="mx-auto mt-1 rounded-md px-2 py-1 text-[13px] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2"
              style={{ color: `${PALETTE.first}` }}
            >
              Invite a friend
            </button>
          )}
        </div>
      </div>

      {/* Scoped keyframes */}
      <style>{`
        @keyframes pactara-mote {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          15%  { opacity: 0.9; }
          100% { transform: translateY(calc(var(--drift) * -1)) translateX(8px); opacity: 0; }
        }
        @keyframes pactara-rise {
          0%   { transform: translateY(14px) scale(0.98); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pactara-fade {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes pactara-sunline {
          0%   { transform: scaleX(0); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-pactara-motes] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default CheckInCelebrationModal;
