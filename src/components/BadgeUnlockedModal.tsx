import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import streakFlame from "@/assets/pactara-streak-flame.png";

export type BadgeUnlockedModalProps = {
  badges: number[];
  onClose: () => void;
};

const MILESTONE_COPY: Record<
  number,
  { label: string; headline: string; support: string }
> = {
  3: {
    label: "3 DAY STREAK",
    headline: "3 days.\nYou showed up.",
    support: "You’re building something worth keeping.",
  },
  7: {
    label: "7 DAY STREAK",
    headline: "A full week of showing up.",
    support: "Seven days of keeping your commitment.",
  },
  14: {
    label: "14 DAY STREAK",
    headline: "Two weeks strong.",
    support: "Showing up is starting to become part of your routine.",
  },
  30: {
    label: "30 DAY STREAK",
    headline: "30 days.\nThat’s consistency.",
    support: "A month of doing what you said you would do.",
  },
};

const WEEK = ["Tu", "We", "Th", "Fr", "Sa", "Su", "Mo"];

export function BadgeUnlockedModal({ badges, onClose }: BadgeUnlockedModalProps) {
  useHideBottomTabs();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const primary = badges[badges.length - 1];
  const copy = MILESTONE_COPY[primary] ?? {
    label: `${primary} DAY STREAK`,
    headline: `${primary} days. You showed up.`,
    support: "You’re building something worth keeping.",
  };
  const completedDays = Math.min(primary, 7);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${primary} day streak celebration`}
      className="fixed inset-0 z-[120] overflow-y-auto bg-streak-celebration text-foreground"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[calc(env(safe-area-inset-top)+14px)]">
        <header className="flex h-11 shrink-0 items-center justify-between">
          <span className="text-[28px] font-black leading-none">pactara</span>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onClose}
            aria-label="Close celebration"
            className="h-10 w-10 rounded-full bg-streak-control text-foreground shadow-none hover:bg-streak-control"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </Button>
        </header>

        <main className="flex flex-1 flex-col items-center text-center">
          <div className="relative mt-2 h-[clamp(220px,35dvh,330px)] w-full shrink-0" aria-hidden="true">
            <img
              src={streakFlame}
              alt=""
              width={1024}
              height={1024}
              className="h-full w-full object-contain drop-shadow-streak-flame"
            />
            <span className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 text-[clamp(76px,24vw,112px)] font-black leading-none text-streak-number">
              {primary}
            </span>
          </div>

          <section className="mt-1 max-w-sm">
            <p className="text-[12px] font-bold tracking-[0.24em] text-pactara-purple">
              {copy.label}
            </p>
            <h1 className="mt-3 whitespace-pre-line text-[clamp(30px,8vw,40px)] font-black leading-[1.08]">
              {copy.headline}
            </h1>
            <p className="mx-auto mt-3 max-w-[340px] text-[17px] leading-6 text-muted-foreground">
              {copy.support}
            </p>
          </section>

          <section className="mt-6 w-full rounded-3xl border border-streak-card-border bg-streak-card px-5 py-5 shadow-streak-card" aria-label="Your streak progress">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold">Your streak</h2>
              <p className="text-[16px] font-semibold text-muted-foreground">🔥 {primary} days</p>
            </div>
            <div className="relative mt-5 grid grid-cols-7 gap-1">
              <div className="absolute left-[7%] right-[7%] top-[17px] h-0.5 bg-streak-track" aria-hidden="true" />
              {WEEK.map((day, index) => {
                const complete = index < completedDays;
                return (
                  <div key={day} className="relative flex min-w-0 flex-col items-center gap-2.5">
                    <span
                      className={complete
                        ? "z-10 flex h-9 w-9 items-center justify-center rounded-full bg-pactara-purple text-pactara-purple-foreground shadow-streak-day"
                        : "z-10 flex h-9 w-9 items-center justify-center rounded-full bg-streak-upcoming text-muted-foreground"}
                      aria-label={`${day}: ${complete ? "complete" : "upcoming"}`}
                    >
                      {complete ? <Check className="h-[18px] w-[18px]" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full border border-current" />}
                    </span>
                    <span className={complete ? "text-[13px] font-semibold text-foreground" : "text-[13px] font-medium text-muted-foreground"}>
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <Button
          type="button"
          onClick={onClose}
          className="mt-6 h-16 w-full shrink-0 rounded-[22px] bg-streak-cta text-[17px] font-bold text-pactara-purple-foreground shadow-streak-cta hover:bg-streak-cta"
        >
          Keep showing up
        </Button>
      </div>

      <style>{`
        @keyframes streak-arrive {
          0% { opacity: 0; transform: scale(0.96) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        [aria-label$="day streak celebration"] main {
          animation: streak-arrive 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-label$="day streak celebration"] main { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default BadgeUnlockedModal;
