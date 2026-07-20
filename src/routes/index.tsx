import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DesktopLanding } from "@/components/DesktopLanding";


export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/check-in" });
  },
  head: () => ({
    meta: [
      { title: "Pactara — Fitness accountability with your group" },
      {
        name: "description",
        content:
          "Pactara keeps you accountable with a small group of people who actually show up — every single day.",
      },
      { property: "og:title", content: "Pactara" },
      {
        property: "og:description",
        content: "Daily check-ins. Real accountability. With a group that's watching.",
      },
    ],
  }),
  component: Index,
});

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#F3EEFF";
const PURPLE_DEEP = "#5B21B6";

type Slide = {
  eyebrow: string;
  title: ReactNode;
  body: string;
  cta: string;
  visual: ReactNode;
};

function Index() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const slides = useSlides();
  const total = slides.length;


  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);

  const goTo = useCallback(
    (i: number) => setIndex(Math.max(0, Math.min(i, total - 1))),
    [total],
  );

  // Swipe handling
  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -40) {
      if (index < total - 1) goNext();
      else navigate({ to: "/signup" });
    } else if (dx > 40) {
      goTo(index - 1);
    }
    startX.current = null;
  };

  return (
    <div
      className="min-h-[100dvh] w-full bg-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#0A0A0A" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col px-6 pb-8 pt-14">
        {/* Header */}
        <header className="mb-2 flex items-center justify-between">
          <Wordmark />
          <span
            className="text-[11px] font-bold tracking-[0.16em]"
            style={{ color: PURPLE }}
          >
            {slides[index].eyebrow}
          </span>
        </header>

        {/* Slide content */}
        <main className="flex flex-1 flex-col justify-center">

          <div key={index} className="animate-[fadeUp_400ms_ease-out]">
            <div className="mb-8 flex items-center justify-center">
              {slides[index].visual}
            </div>
            <h1
              className="text-[40px] font-black leading-[1.05] tracking-[-0.03em]"
              style={{ letterSpacing: "-0.03em" }}
            >
              {slides[index].title}
            </h1>
            <p className="mt-4 text-[16px] leading-[1.5] text-neutral-500">
              {slides[index].body}
            </p>
          </div>
        </main>

        {/* Dots */}
        <div className="mb-5 mt-4 flex items-center justify-start gap-2 px-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="h-[6px] rounded-full transition-all duration-300"
              style={{
                width: i === index ? 28 : 6,
                backgroundColor: i === index ? PURPLE : "#D6D3D1",
              }}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => (index < total - 1 ? goNext() : navigate({ to: "/signup" }))}
            className="w-full rounded-2xl py-5 text-[17px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.6)] transition-transform active:scale-[0.98]"
            style={{ backgroundColor: PURPLE }}
          >
            {slides[index].cta}
          </button>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="text-[15px] font-medium text-neutral-400 hover:text-neutral-600"
          >
            Log in
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="text-[22px] font-black tracking-tight">
      <span style={{ color: PURPLE }}>P</span>
      <span style={{ color: "#0A0A0A" }}>actara</span>
    </div>
  );
}

/* ---------- Visual cards (one per slide) ---------- */

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-full rounded-3xl bg-white p-5"
      style={{
        boxShadow:
          "0 1px 0 rgba(0,0,0,0.04), 0 24px 48px -24px rgba(15,15,15,0.18), 0 8px 20px -12px rgba(15,15,15,0.08)",
      }}
    >
      {children}
    </div>
  );
}

function Avatar({
  letter,
  size = 32,
  bg = PURPLE,
}: {
  letter: string;
  size?: number;
  bg?: string;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: size * 0.42,
      }}
    >
      {letter}
    </div>
  );
}

/* Slide 1 — Groups list */
function GroupsCard() {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[15px] font-bold">Your groups</span>
        <span
          className="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white"
          style={{ backgroundColor: PURPLE }}
        >
          + New
        </span>
      </div>

      {/* Selected row */}
      <div
        className="mb-2.5 flex items-center gap-3 rounded-2xl border px-3.5 py-3"
        style={{ backgroundColor: PURPLE_SOFT, borderColor: "rgba(124,58,237,0.18)" }}
      >
        <span className="text-2xl">🏃</span>
        <div className="flex-1">
          <div className="text-[15px] font-bold" style={{ color: PURPLE }}>
            Daily run
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Avatar letter="J" size={20} />
            <Avatar letter="T" size={20} />
            <Avatar letter="M" size={20} />
            <span className="ml-1 text-[12px] text-neutral-400">3 members</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-[14px] font-bold">
            <span>🔥</span> 14
          </div>
          <div className="text-[11px] text-neutral-400">2/3 today</div>
        </div>
      </div>

      {/* Other rows */}
      <GroupRow
        emoji="💪"
        name="Strength training"
        avatars={["A", "S"]}
        members="2 members"
        streak={7}
        today="2/2 today"
      />
      <GroupRow
        emoji="🧘"
        name="Morning yoga"
        avatars={["R", "K", "L", "P"]}
        members="4 members"
        streak={21}
        today="3/4 today"
      />
    </Card>
  );
}

function GroupRow({
  emoji,
  name,
  avatars,
  members,
  streak,
  today,
}: {
  emoji: string;
  name: string;
  avatars: string[];
  members: string;
  streak: number;
  today: string;
}) {
  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-neutral-50 px-3.5 py-3">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <div className="text-[15px] font-bold text-neutral-900">{name}</div>
        <div className="mt-1 flex items-center gap-1.5">
          {avatars.map((a) => (
            <Avatar key={a} letter={a} size={20} bg="#D6D3D1" />
          ))}
          <span className="ml-1 text-[12px] text-neutral-400">{members}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1 text-[14px] font-bold">
          <span>🔥</span> {streak}
        </div>
        <div className="text-[11px] text-neutral-400">{today}</div>
      </div>
    </div>
  );
}

/* Slide 2 — Check-in card */
function CheckinCard() {
  return (
    <Card>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
        Today's check-in
      </div>
      <div className="mb-4 text-[16px] font-bold">How did today go?</div>

      <div
        className="mb-2.5 flex items-center justify-between rounded-2xl border-2 px-4 py-3.5"
        style={{ backgroundColor: PURPLE_SOFT, borderColor: PURPLE }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🔥</span>
          <span className="text-[15px] font-bold" style={{ color: PURPLE }}>
            Crushed it
          </span>
        </div>
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: PURPLE, fontSize: 12 }}
        >
          ✓
        </div>
      </div>

      <OptionRow icon="✅" label="Got it done" iconBg="#22C55E" />
      <OptionRow icon="😅" label="Tough day" />

      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
        style={{ backgroundColor: PURPLE }}
      >
        Share with group <span>→</span>
      </button>
    </Card>
  );
}

function OptionRow({
  icon,
  label,
  iconBg,
}: {
  icon: string;
  label: string;
  iconBg?: string;
}) {
  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3.5">
      {iconBg ? (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: iconBg, fontSize: 16 }}
        >
          {icon}
        </span>
      ) : (
        <span className="text-xl">{icon}</span>
      )}
      <span className="text-[15px] font-medium text-neutral-500">{label}</span>
    </div>
  );
}

/* Slide 3 — Morning ritual post */
function MorningPostCard() {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <Avatar letter="A" size={44} />
        <div>
          <div className="text-[15px] font-bold">Alex (you)</div>
          <div className="text-[12px] text-neutral-400">
            🌅 Morning post · just now
          </div>
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-[1.45] text-neutral-800">
        Today I'm hitting the gym before work and meal prepping for the week. No
        excuses — my group is watching. 💪
      </p>

      <div className="mt-4 flex items-center gap-5 border-t border-neutral-100 pt-3 text-[13px] text-neutral-500">
        <span className="flex items-center gap-1.5">🔥 4 reactions</span>
        <span className="flex items-center gap-1.5">💬 2 replies</span>
      </div>

      <div
        className="-mx-5 -mb-5 mt-3 flex items-center gap-3 rounded-b-3xl px-5 py-3"
        style={{ backgroundColor: PURPLE_SOFT }}
      >
        <div className="flex -space-x-2">
          <Avatar letter="J" size={26} bg={PURPLE} />
          <Avatar letter="T" size={26} bg="#3B82F6" />
          <Avatar letter="M" size={26} bg="#EC4899" />
          <Avatar letter="S" size={26} bg="#EF4444" />
        </div>
        <span className="text-[13px] text-neutral-500">Your group sees this</span>
      </div>
    </Card>
  );
}

/* Slide 4 — Streaks */
function StreaksCard() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
            This week
          </div>
          <div className="mt-1 text-[16px] font-bold">Your streak</div>
        </div>
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ backgroundColor: PURPLE_SOFT }}
        >
          <span>🔥</span>
          <span className="text-[20px] font-black" style={{ color: PURPLE }}>
            21
          </span>
          <span className="text-[12px] text-neutral-400">days</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-bold text-neutral-400">
            {d}
          </div>
        ))}
        {days.map((_, i) => {
          const filled = i < 6;
          return (
            <div
              key={`c-${i}`}
              className="flex aspect-square items-center justify-center rounded-lg text-white"
              style={
                filled
                  ? { backgroundColor: PURPLE, fontSize: 16, fontWeight: 700 }
                  : {
                      backgroundColor: PURPLE_SOFT,
                      border: "1.5px dashed rgba(124,58,237,0.35)",
                      color: "rgba(124,58,237,0.5)",
                      fontSize: 14,
                    }
              }
            >
              {filled ? "✓" : "?"}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat icon="🏆" label="Best streak" value="34 days" />
        <MiniStat icon="📅" label="This month" value="26 / 31" />
      </div>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-3.5 py-3">
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-[11px] text-neutral-400">{label}</div>
        <div className="text-[14px] font-bold">{value}</div>
      </div>
    </div>
  );
}

/* Slide 5 — Testimonial */
function TestimonialCard() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar letter="J" size={44} />
          <div>
            <div className="text-[15px] font-bold">Jamie R.</div>
            <div className="text-[12px] text-neutral-400">Lost 18 lbs in 90 days</div>
          </div>
        </div>
        <div style={{ color: PURPLE, letterSpacing: 1 }}>★★★★★</div>
      </div>

      <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
        <p className="text-[14px] italic leading-[1.45] text-neutral-600">
          "I've tried everything — Strava, Noom, three different trainers, two
          gym memberships I never used. Nothing stuck. Pactara is the first
          thing that's actually worked, and honestly it's not even close.
          When my group sees I didn't check in, someone texts. That's it.
          That's the whole thing. 90 days in and I haven't missed once."
        </p>

      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <StatBox value="90" label="day streak" />
        <StatBox value="18" label="lbs lost" />
        <StatBox value="0" label="missed" />
      </div>
    </Card>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="rounded-2xl px-2 py-3 text-center"
      style={{ backgroundColor: PURPLE_SOFT }}
    >
      <div className="text-[24px] font-black" style={{ color: PURPLE }}>
        {value}
      </div>
      <div className="text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}

/* ---------- Slide definitions (order matches dot positions in designs) ---------- */

function useSlides(): Slide[] {
  return [
    {
      eyebrow: "SOUND FAMILIAR?",
      title: (
        <>
          Can't stick to
          <br />
          your fitness goals?
        </>
      ),
      body:
        "You're not lazy. You just don't have anyone holding you to them. Pactara fixes that.",
      cta: "Continue",
      visual: <GroupsCard />,
    },
    {
      eyebrow: "THE FIX",
      title: (
        <>
          Invite 3–5 friends.
          <br />
          Hold each other
          <br />
          accountable.
        </>
      ),
      body: "Daily check-ins, everyone watching. No hiding.",
      cta: "Continue",
      visual: <CheckinCard />,
    },
    {
      eyebrow: "MORNING RITUAL",
      title: (
        <>
          Start every morning
          <br />
          with your plan.
        </>
      ),
      body:
        "Post what you're doing today. Your group sees it — and now they're watching.",
      cta: "Continue",
      visual: <MorningPostCard />,
    },
    {
      eyebrow: "STREAKS",
      title: (
        <>
          Build streaks.
          <br />
          Stay consistent.
        </>
      ),
      body:
        "Watch your streak grow every day you check in. Your group is watching too.",
      cta: "Continue",
      visual: <StreaksCard />,
    },
    {
      eyebrow: "REAL RESULTS",
      title: (
        <>
          Jamie lost
          <br />
          18 lbs.
        </>
      ),
      body:
        "90 days. Never missed a check-in. Her group wouldn't let her quit.",
      cta: "Get started",
      visual: <TestimonialCard />,
    },
  ];
}

// keep PURPLE_DEEP referenced for potential future use without TS unused error
void PURPLE_DEEP;
