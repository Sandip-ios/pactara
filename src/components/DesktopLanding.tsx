import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#F3EEFF";
const PURPLE_DEEP = "#5B21B6";
const INK = "#0A0A0A";

export function DesktopLanding() {
  return (
    <div
      className="min-h-[100dvh] w-full bg-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif", color: INK }}
    >
      <Nav />
      <Hero />
      <SocialProof />
      <HowItWorks />
      <FeatureGrid />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ---------------- NAV ---------------- */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-100 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-[14px] font-medium text-neutral-600 md:flex">
          <a href="#how" className="hover:text-neutral-900">How it works</a>
          <a href="#features" className="hover:text-neutral-900">Features</a>
          <a href="#stories" className="hover:text-neutral-900">Stories</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden text-[14px] font-semibold text-neutral-700 hover:text-neutral-900 sm:block"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white transition-transform active:scale-[0.98]"
            style={{
              backgroundColor: PURPLE,
              boxShadow: "0 6px 20px -8px rgba(124,58,237,0.6)",
            }}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="text-[22px] font-black tracking-tight">
      <span style={{ color: PURPLE }}>P</span>
      <span style={{ color: INK }}>actara</span>
    </Link>
  );
}

/* ---------------- HERO ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1000px 500px at 85% -10%, rgba(124,58,237,0.18), transparent 60%), radial-gradient(700px 400px at 10% 10%, rgba(124,58,237,0.08), transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 lg:grid-cols-[1.05fr_1fr] lg:py-32">
        <div>
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em]"
            style={{ backgroundColor: PURPLE_SOFT, color: PURPLE }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PURPLE }} />
            Fitness accountability, done right
          </div>

          <h1
            className="text-[64px] font-black leading-[0.98] tracking-[-0.035em] lg:text-[76px]"
            style={{ letterSpacing: "-0.035em" }}
          >
            Accountability
            <br />
            that actually
            <br />
            <span style={{ color: PURPLE }}>works.</span>
          </h1>

          <p className="mt-6 max-w-[520px] text-[19px] leading-[1.5] text-neutral-500">
            Pactara puts you in a small group of people who show up every day.
            Daily check-ins. Real streaks. No hiding.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/signup"
              className="rounded-2xl px-6 py-4 text-[16px] font-semibold text-white transition-transform active:scale-[0.98]"
              style={{
                backgroundColor: PURPLE,
                boxShadow: "0 12px 32px -12px rgba(124,58,237,0.65)",
              }}
            >
              Start your group — free
            </Link>
            <a
              href="#how"
              className="rounded-2xl border border-neutral-200 bg-white px-6 py-4 text-[16px] font-semibold text-neutral-800 hover:border-neutral-300"
            >
              See how it works
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3 text-[13px] text-neutral-500">
            <div className="flex -space-x-2">
              <Avatar letter="J" size={28} bg={PURPLE} />
              <Avatar letter="T" size={28} bg="#3B82F6" />
              <Avatar letter="M" size={28} bg="#EC4899" />
              <Avatar letter="S" size={28} bg="#EF4444" />
            </div>
            <span>Trusted by groups building daily habits together.</span>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="h-[520px] w-[520px] rounded-full blur-3xl"
              style={{ backgroundColor: "rgba(124,58,237,0.18)" }}
            />
          </div>
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}

function PhoneMock() {
  return (
    <div
      className="relative w-[300px] rounded-[44px] border-[10px] border-neutral-900 bg-white p-4 shadow-2xl"
      style={{
        boxShadow:
          "0 40px 80px -20px rgba(15,15,15,0.35), 0 12px 28px -12px rgba(124,58,237,0.35)",
      }}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[13px] font-bold">Your groups</span>
        <span
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ backgroundColor: PURPLE }}
        >
          + New
        </span>
      </div>

      <PhoneRow
        emoji="🏃"
        name="Daily run"
        members="3 members"
        streak={14}
        today="2/3 today"
        highlighted
      />
      <PhoneRow
        emoji="💪"
        name="Strength training"
        members="2 members"
        streak={7}
        today="2/2 today"
      />
      <PhoneRow
        emoji="🧘"
        name="Morning yoga"
        members="4 members"
        streak={21}
        today="3/4 today"
      />

      <div
        className="mt-4 rounded-2xl p-3"
        style={{ backgroundColor: PURPLE_SOFT }}
      >
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
          Today's streak
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[22px]">🔥</span>
          <span className="text-[26px] font-black" style={{ color: PURPLE }}>
            21
          </span>
          <span className="text-[12px] text-neutral-500">days in a row</span>
        </div>
      </div>
    </div>
  );
}

function PhoneRow({
  emoji,
  name,
  members,
  streak,
  today,
  highlighted,
}: {
  emoji: string;
  name: string;
  members: string;
  streak: number;
  today: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="mt-2 flex items-center gap-3 rounded-2xl px-3 py-2.5"
      style={{
        backgroundColor: highlighted ? PURPLE_SOFT : "#FAFAFA",
        border: highlighted
          ? "1px solid rgba(124,58,237,0.18)"
          : "1px solid transparent",
      }}
    >
      <span className="text-xl">{emoji}</span>
      <div className="flex-1">
        <div
          className="text-[13px] font-bold"
          style={{ color: highlighted ? PURPLE : INK }}
        >
          {name}
        </div>
        <div className="text-[10.5px] text-neutral-400">{members}</div>
      </div>
      <div className="text-right">
        <div className="flex items-center justify-end gap-1 text-[12px] font-bold">
          <span>🔥</span> {streak}
        </div>
        <div className="text-[10px] text-neutral-400">{today}</div>
      </div>
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
      className="flex items-center justify-center rounded-full border-2 border-white font-semibold text-white"
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

/* ---------------- SOCIAL PROOF ---------------- */

function SocialProof() {
  const items = [
    { value: "94%", label: "check in daily" },
    { value: "3–5", label: "friends per group" },
    { value: "21d", label: "avg streak" },
    { value: "0", label: "excuses accepted" },
  ];
  return (
    <section className="border-y border-neutral-100 bg-neutral-50/60">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <div
              className="text-[32px] font-black"
              style={{ color: PURPLE, letterSpacing: "-0.02em" }}
            >
              {it.value}
            </div>
            <div className="mt-1 text-[13px] font-medium text-neutral-500">
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- HOW IT WORKS ---------------- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Invite 3–5 friends",
      body:
        "Small groups only. The people who'll actually notice when you skip a day.",
      emoji: "👥",
    },
    {
      n: "02",
      title: "Set your daily promise",
      body:
        "One habit. One check-in. Everyone in the group commits to the same thing.",
      emoji: "🎯",
    },
    {
      n: "03",
      title: "Check in every day",
      body:
        "A quick photo, a mood, a note. Your group sees it. You build the streak together.",
      emoji: "🔥",
    },
  ];

  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="mb-4 inline-block rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ backgroundColor: PURPLE_SOFT, color: PURPLE }}
        >
          How it works
        </div>
        <h2 className="text-[42px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
          Three steps.
          <br />
          Zero excuses.
        </h2>
        <p className="mt-4 text-[17px] text-neutral-500">
          Pactara isn't another tracker. It's a group promise you can't quietly walk away from.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-3xl border border-neutral-100 bg-white p-8 transition-shadow hover:shadow-[0_20px_60px_-30px_rgba(15,15,15,0.25)]"
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="text-[44px]">{s.emoji}</span>
              <span
                className="text-[13px] font-black tracking-widest"
                style={{ color: PURPLE }}
              >
                {s.n}
              </span>
            </div>
            <div className="text-[20px] font-bold tracking-tight">{s.title}</div>
            <p className="mt-2 text-[15px] leading-[1.5] text-neutral-500">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- FEATURE GRID ---------------- */

function FeatureGrid() {
  return (
    <section id="features" className="bg-neutral-50/60 py-24">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 md:grid-cols-6">
        <FeatureCard
          className="md:col-span-4"
          title="A group that's actually watching"
          body="Not 5,000 strangers. 3–5 friends who'll text you when you miss."
          visual={<GroupVisual />}
        />
        <FeatureCard
          className="md:col-span-2"
          title="Streaks that mean something"
          body="Because you built them with people, not alone."
          visual={<StreakVisual />}
        />
        <FeatureCard
          className="md:col-span-2"
          title="Morning ritual"
          body="Post your plan. Now they're watching."
          visual={<MorningVisual />}
        />
        <FeatureCard
          className="md:col-span-4"
          title="Daily check-in in 10 seconds"
          body="Photo, mood, done. No streak-inflating fake habits."
          visual={<CheckinVisual />}
        />
      </div>
    </section>
  );
}

function FeatureCard({
  className = "",
  title,
  body,
  visual,
}: {
  className?: string;
  title: string;
  body: string;
  visual: ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-3xl border border-neutral-100 bg-white p-8 ${className}`}
    >
      <div>
        <h3 className="text-[22px] font-bold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-md text-[15px] text-neutral-500">{body}</p>
      </div>
      <div className="mt-6 flex flex-1 items-end">{visual}</div>
    </div>
  );
}

function GroupVisual() {
  return (
    <div
      className="w-full rounded-2xl p-5"
      style={{
        background: `linear-gradient(135deg, ${PURPLE_SOFT}, #fff)`,
        border: "1px solid rgba(124,58,237,0.12)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-bold">Daily run</span>
        <span className="text-[12px] text-neutral-500">2/3 today</span>
      </div>
      <div className="flex items-center gap-4">
        {[
          { l: "J", bg: PURPLE, done: true },
          { l: "T", bg: "#3B82F6", done: true },
          { l: "M", bg: "#EC4899", done: false },
        ].map((m, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar letter={m.l} size={54} bg={m.bg} />
              <span
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white"
                style={{
                  backgroundColor: m.done ? "#22C55E" : "#D6D3D1",
                  fontSize: 12,
                }}
              >
                {m.done ? "✓" : "…"}
              </span>
            </div>
            <span className="text-[11px] font-medium text-neutral-500">
              {m.done ? "Checked in" : "Pending"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreakVisual() {
  return (
    <div className="w-full rounded-2xl bg-neutral-50 p-5 text-center">
      <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
        Current streak
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="text-[34px]">🔥</span>
        <span className="text-[52px] font-black" style={{ color: PURPLE }}>
          21
        </span>
      </div>
      <div className="text-[12px] text-neutral-500">days without missing</div>
    </div>
  );
}

function MorningVisual() {
  return (
    <div className="w-full rounded-2xl bg-white p-4 shadow-[0_10px_30px_-15px_rgba(15,15,15,0.2)]">
      <div className="flex items-center gap-2">
        <Avatar letter="A" size={28} />
        <div className="text-[12px] font-bold">Alex — morning post</div>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-neutral-700">
        Gym before work, meal prep after. No excuses today. 💪
      </p>
    </div>
  );
}

function CheckinVisual() {
  return (
    <div className="grid w-full grid-cols-3 gap-3">
      {[
        { icon: "🔥", label: "Crushed it", active: true },
        { icon: "✅", label: "Got it done" },
        { icon: "😅", label: "Tough day" },
      ].map((o) => (
        <div
          key={o.label}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4"
          style={{
            backgroundColor: o.active ? PURPLE_SOFT : "#FAFAFA",
            borderColor: o.active ? PURPLE : "transparent",
          }}
        >
          <span className="text-2xl">{o.icon}</span>
          <span
            className="text-[12px] font-bold"
            style={{ color: o.active ? PURPLE : "#525252" }}
          >
            {o.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- TESTIMONIALS ---------------- */

function Testimonials() {
  const quotes = [
    {
      name: "Jamie R.",
      meta: "Lost 18 lbs in 90 days",
      letter: "J",
      color: PURPLE,
      quote:
        "I've tried Strava, Noom, three trainers, two gyms. Nothing stuck. Pactara is the first thing that's actually worked. When I don't check in, someone texts. That's the whole thing.",
    },
    {
      name: "Marcus T.",
      meta: "34-day run streak",
      letter: "M",
      color: "#3B82F6",
      quote:
        "The group is what makes it. I don't want to be the one who broke the streak, so I go. Even at 6am. Even in the rain.",
    },
    {
      name: "Priya K.",
      meta: "Never missed a check-in",
      letter: "P",
      color: "#EC4899",
      quote:
        "I finally stopped restarting. Because there's no restart button when four other people are counting on you.",
    },
  ];

  return (
    <section id="stories" className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[42px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
          Real people. Real streaks.
        </h2>
        <p className="mt-4 text-[17px] text-neutral-500">
          Not before/after photos. Just people who stopped restarting.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.name}
            className="flex flex-col rounded-3xl border border-neutral-100 bg-white p-7"
          >
            <div style={{ color: PURPLE, letterSpacing: 1 }}>★★★★★</div>
            <blockquote className="mt-4 flex-1 text-[15px] leading-[1.55] text-neutral-700">
              "{q.quote}"
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3 border-t border-neutral-100 pt-4">
              <Avatar letter={q.letter} size={40} bg={q.color} />
              <div>
                <div className="text-[14px] font-bold">{q.name}</div>
                <div className="text-[12px] text-neutral-500">{q.meta}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ---------------- FINAL CTA ---------------- */

function FinalCTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-24">
      <div
        className="relative overflow-hidden rounded-[36px] px-8 py-20 text-center text-white"
        style={{
          background: `linear-gradient(135deg, ${PURPLE_DEEP}, ${PURPLE})`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(600px 300px at 20% 20%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(500px 300px at 80% 80%, rgba(255,255,255,0.18), transparent 60%)",
          }}
        />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl text-[44px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[60px]">
            Stop restarting.
            <br />
            Start showing up.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] text-white/80">
            Grab your group. Set the promise. See what happens in 21 days.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/signup"
              className="rounded-2xl bg-white px-7 py-4 text-[16px] font-bold transition-transform active:scale-[0.98]"
              style={{ color: PURPLE_DEEP }}
            >
              Start your group — free
            </Link>
            <Link
              to="/login"
              className="rounded-2xl border border-white/30 px-7 py-4 text-[16px] font-semibold text-white hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FOOTER ---------------- */

function Footer() {
  return (
    <footer className="border-t border-neutral-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-[13px] text-neutral-500 md:flex-row">
        <Wordmark />
        <div>© {new Date().getFullYear()} Pactara. Show up together.</div>
        <div className="flex gap-5">
          <Link to="/login" className="hover:text-neutral-900">Log in</Link>
          <Link to="/signup" className="hover:text-neutral-900">Sign up</Link>
        </div>
      </div>
    </footer>
  );
}
