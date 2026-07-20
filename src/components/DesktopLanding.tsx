import { Link } from "@tanstack/react-router";
import { CalendarCheck, Check, ChevronDown, Flame, HeartHandshake, ShieldCheck, Users, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import heroPhone from "@/assets/phone-mockup-transparent.png";
import featureCheckin from "@/assets/feature-checkin.png";

// Replace with the real App Store URL once the app is live.
const APP_STORE_URL = "https://apps.apple.com/app/pactara";

export function DesktopLanding() {
  return (
    <div
      className="min-h-[100dvh] w-full bg-background text-foreground"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <Nav />
      <Hero />
      <SocialProof />
      <Testimonials />
      <HowItWorks />
      <Includes />
      <WhyChoose />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ---------------- NAV ---------------- */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-[14px] font-medium text-muted-foreground md:flex">
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#why" className="hover:text-foreground">
            Why choose
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <AppStoreButton />
        </div>

      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="text-[22px] font-black tracking-tight">
      <span className="text-pactara-purple">P</span>
      <span className="text-foreground">actara</span>
    </Link>
  );
}

/* ---------------- HERO ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(1000px 500px at 85% -10%, rgba(124,58,237,0.18), transparent 60%), radial-gradient(700px 400px at 10% 10%, rgba(124,58,237,0.08), transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid w-full max-w-[1230px] grid-cols-1 items-center gap-16 px-6 py-24 lg:grid-cols-[1fr_1.2fr] lg:py-32">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-pactara-purple-soft px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-pactara-purple">
            <span className="h-1.5 w-1.5 rounded-full bg-pactara-purple" />
            Fitness accountability, done right
          </div>

          <h1 className="text-[64px] font-black leading-[0.98] tracking-[-0.035em] lg:text-[76px]">
            Accountability
            <br />
            that actually
            <br />
            <span className="text-pactara-purple">works.</span>
          </h1>

          <p className="mt-6 max-w-[520px] text-[19px] leading-[1.5] text-muted-foreground">
            Pactara puts you in a small group of people who show up every day.
            Daily check-ins. Real streaks. No hiding.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <AppStoreButton className="px-6 py-4" />
            <a
              href="#how"
              className="rounded-2xl border border-border bg-card px-6 py-4 text-[16px] font-semibold text-foreground hover:bg-muted"
            >
              See how it works
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3 text-[13px] text-muted-foreground">
            <div className="flex -space-x-2">
              <Avatar letter="J" size={28} />
              <Avatar letter="T" size={28} bg="#3B82F6" />
              <Avatar letter="M" size={28} bg="#EC4899" />
              <Avatar letter="S" size={28} bg="#EF4444" />
            </div>
            <span>Trusted by groups building daily habits together.</span>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[520px] w-[520px] rounded-full bg-pactara-purple/20 blur-3xl" />
          </div>
          <img
            src={heroPhone}
            alt="Pactara app showing group list and daily streaks"
            width={1024}
            height={1024}
            loading="eager"
            className="relative h-auto w-full max-w-[598px]"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------- SOCIAL PROOF ---------------- */

function SocialProof() {
  const items = [
    {
      icon: Users,
      title: "Groups of 3–5",
      body: "Small by design, so everyone is noticed.",
    },
    {
      icon: CalendarCheck,
      title: "Built for daily check-ins",
      body: "One promise. One check-in. Every day.",
    },
    {
      icon: Flame,
      title: "Daily",
      body: "Consistency matters more than streaks.",
    },
    {
      icon: ShieldCheck,
      title: "No excuses accepted",
      body: "The structure does the work willpower can't.",
    },
  ];
  return (
    <section className="border-y border-border bg-muted/60">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-pactara-purple-soft text-pactara-purple">
              <it.icon className="h-5 w-5" />
            </div>
            <div className="text-[15px] font-bold text-foreground">{it.title}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{it.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- TESTIMONIALS ---------------- */

function Testimonials() {
  const quotes = [
    {
      name: "Jamie R.",
      meta: "Lost 18 lbs in 90 days",
      letter: "J",
      color: "var(--pactara-purple)",
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
        <div className="mb-4 inline-block rounded-full bg-pactara-purple-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-pactara-purple">
          Real results
        </div>
        <h2 className="text-[42px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
          Real people. Real streaks.
        </h2>
        <p className="mt-4 text-[17px] text-muted-foreground">
          Not before/after photos. Just people who stopped restarting.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.name}
            className="flex flex-col rounded-3xl border border-border bg-card p-7"
          >
            <div className="tracking-[1px] text-pactara-purple">★★★★★</div>
            <blockquote className="mt-4 flex-1 text-[15px] leading-[1.55] text-card-foreground">
              “{q.quote}”
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
              <Avatar letter={q.letter} size={40} bg={q.color} />
              <div>
                <div className="text-[14px] font-bold">{q.name}</div>
                <div className="text-[12px] text-muted-foreground">{q.meta}</div>
              </div>
            </figcaption>
          </figure>
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
        "One habit. One check-in. Each person sets their own daily commitment.",
      emoji: "🎯",
    },
    {
      n: "03",
      title: "Check in every day",
      body:
        "A quick video recorded inside the app, a mood, a note. Your group sees it. You build the streak together.",
      emoji: "🔥",
    },
  ];

  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-4 inline-block rounded-full bg-pactara-purple-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-pactara-purple">
          How it works
        </div>
        <h2 className="text-[42px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
          Three steps.
          <br />
          Zero excuses.
        </h2>
        <p className="mt-4 text-[17px] text-muted-foreground">
          Pactara isn't another tracker. It's a group promise you can't quietly
          walk away from.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-3xl border border-border bg-card p-8 transition-shadow hover:shadow-[0_20px_60px_-30px_rgba(15,15,15,0.25)]"
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="text-[44px]">{s.emoji}</span>
              <span className="text-[13px] font-black tracking-widest text-pactara-purple">
                {s.n}
              </span>
            </div>
            <div className="text-[20px] font-bold tracking-tight text-card-foreground">
              {s.title}
            </div>
            <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- WHAT PACTARA INCLUDES ---------------- */

function Includes() {
  return (
    <section id="features" className="bg-muted/60 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-block rounded-full bg-pactara-purple-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-pactara-purple">
            What Pactara includes
          </div>
          <h2 className="text-[42px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
            Everything you need to stay consistent.
          </h2>
          <p className="mt-4 text-[17px] text-muted-foreground">
            No noise. Just the tools that make accountability real.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-6">
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
            className="md:col-span-3"
            title="Morning ritual"
            body="Post your plan. Now they're watching."
            visual={<MorningVisual />}
          />
          <FeatureCard
            className="md:col-span-3"
            visual={<CheckinImage />}
          />
        </div>
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
  title?: string;
  body?: string;
  visual: ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-8 ${className}`}
    >
      {title && (
        <div>
          <h3 className="text-[22px] font-bold tracking-tight text-card-foreground">
            {title}
          </h3>
          {body && <p className="mt-2 max-w-md text-[15px] text-muted-foreground">{body}</p>}
        </div>
      )}
      <div className={`flex flex-1 items-end ${title ? "mt-6" : ""}`}>{visual}</div>
    </div>
  );
}

function GroupVisual() {
  return (
    <div className="w-full rounded-2xl border border-pactara-purple/12 bg-gradient-to-br from-pactara-purple-soft to-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-bold text-card-foreground">Daily run</span>
        <span className="text-[12px] text-muted-foreground">2/3 today</span>
      </div>
      <div className="flex items-center gap-4">
        {[
          { l: "J", bg: "var(--pactara-purple)", done: true },
          { l: "T", bg: "#3B82F6", done: true },
          { l: "M", bg: "#EC4899", done: false },
        ].map((m, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar letter={m.l} size={54} bg={m.bg} />
              <span
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[12px] font-bold text-white"
                style={{ backgroundColor: m.done ? "#22C55E" : "#D6D3D1" }}
              >
                {m.done ? "✓" : "…"}
              </span>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
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
    <div className="w-full rounded-2xl bg-muted p-5 text-center">
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Current streak
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="text-[34px]">🔥</span>
        <span className="text-[52px] font-black tracking-[-0.02em] text-pactara-purple">
          21
        </span>
      </div>
      <div className="text-[12px] text-muted-foreground">days without missing</div>
    </div>
  );
}

function MorningVisual() {
  return (
    <div className="w-full rounded-2xl bg-card p-4 shadow-lg">
      <div className="flex items-center gap-2">
        <Avatar letter="A" size={28} />
        <div className="text-[12px] font-bold text-card-foreground">
          Alex — morning post
        </div>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
        Gym before work, meal prep after. No excuses today. 💪
      </p>
    </div>
  );
}

function CheckinImage() {
  return (
    <div className="flex w-full items-center justify-center">
      <img
        src={featureCheckin}
        alt="Pactara daily check-in screen with a 5-second countdown timer"
        width={1024}
        height={1024}
        loading="lazy"
        className="h-auto w-full max-w-[280px] rounded-2xl border border-border shadow-lg"
      />
    </div>
  );
}

/* ---------------- WHY CHOOSE PACTARA ---------------- */

function WhyChoose() {
  const items: { icon: LucideIcon; title: string; body: string }[] = [
    {
      icon: Users,
      title: "Built on social pressure",
      body: "You show up because your group is watching. Willpower is optional when accountability is real.",
    },
    {
      icon: Zap,
      title: "10-second daily check-in",
      body: "No hour-long tracking sessions. No complicated logging. Just check in and move on.",
    },
    {
      icon: HeartHandshake,
      title: "Real streaks with real people",
      body: "Every streak is earned in front of people you know. That makes it harder to break — and worth more.",
    },
  ];

  return (
    <section id="why" className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-4 inline-block rounded-full bg-pactara-purple-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-pactara-purple">
          Why choose Pactara
        </div>
        <h2 className="text-[42px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
          Built on social pressure. Not self-discipline.
        </h2>
        <p className="mt-4 text-[17px] text-muted-foreground">
          The apps that fail you assume you can motivate yourself. Pactara
          doesn't.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-3xl border border-border bg-card p-8"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pactara-purple-soft text-pactara-purple">
              <it.icon className="h-6 w-6" />
            </div>
            <h3 className="text-[20px] font-bold tracking-tight text-card-foreground">
              {it.title}
            </h3>
            <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- PRICING ---------------- */

function Pricing() {
  const perks = [
    "Full access to groups and check-ins",
    "Unlimited streaks and morning posts",
    "Cancel anytime in the App Store",
    "No credit card required to start",
  ];

  return (
    <section id="pricing" className="bg-muted/60 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-block rounded-full bg-pactara-purple-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-pactara-purple">
            Pricing
          </div>
          <h2 className="text-[42px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
            Start free. No surprises.
          </h2>
          <p className="mt-4 text-[17px] text-muted-foreground">
            7 days to see if accountability works for you. Cancel anytime.
          </p>
        </div>

        <div className="mt-14 mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
          <div className="text-[56px] font-black tracking-[-0.03em] text-pactara-purple">
            7 days
          </div>
          <p className="text-[17px] text-muted-foreground">free trial</p>

          <ul className="mt-6 space-y-3 text-left text-[15px] text-card-foreground">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-pactara-purple" />
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <AppStoreButton className="w-full justify-center px-6 py-4" />
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Subscription billed after trial. Pricing shown in the app.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function FAQ() {
  const questions = [
    {
      q: "How is Pactara different from a group chat?",
      a: "Group chats are easy to mute. Pactara is built around a daily promise: everyone checks in, everyone sees the streak, and missing is visible. The structure does the work that willpower can't.",
    },
    {
      q: "Who should be in my group?",
      a: "3–5 people who care enough to notice when you disappear. Friends, coworkers, gym partners — anyone chasing the same daily habit.",
    },
    {
      q: "What kind of habits work best?",
      a: "Anything you want to do daily: workouts, runs, yoga, nutrition, hydration, reading, writing. The key is consistency, not intensity.",
    },
    {
      q: "What happens after the free trial?",
      a: "You'll choose a subscription inside the app. You can cancel anytime in the App Store — no emails, no support tickets.",
    },
    {
      q: "Is my data private?",
      a: "Your check-ins are only visible to your group. We don't sell data, and we don't show ads.",
    },
  ];

  return (
    <section id="faq" className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-pactara-purple-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-pactara-purple">
            FAQ
          </div>
          <h2 className="text-[42px] font-black leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
            Questions, answered.
          </h2>
        </div>

        <div className="mt-12 space-y-4">
          {questions.map((q) => (
            <details
              key={q.q}
              className="group rounded-2xl border border-border bg-card open:bg-pactara-purple-soft/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between p-6 text-[17px] font-semibold text-card-foreground">
                {q.q}
                <ChevronDown className="h-5 w-5 text-pactara-purple transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-6 pb-6 text-[15px] leading-[1.6] text-muted-foreground">
                {q.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FINAL CTA ---------------- */

function FinalCTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-pactara-purple-deep to-pactara-purple px-8 py-20 text-center text-pactara-purple-foreground">
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
            Grab your group. Set the promise. See what happens when you show up every day.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <AppStoreButton variant="light" className="px-7 py-4" />
          </div>

        </div>
      </div>
    </section>
  );
}

/* ---------------- FOOTER ---------------- */

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-[13px] text-muted-foreground md:flex-row">
        <Wordmark />
        <div>© {new Date().getFullYear()} Pactara. Show up together.</div>
        <div className="flex flex-wrap justify-center gap-5">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link to="/support" className="hover:text-foreground">
            Support
          </Link>

        </div>
      </div>
    </footer>
  );
}


/* ---------------- SHARED ---------------- */

function AppStoreButton({
  className = "",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2.5 rounded-lg px-4 py-2.5 transition-transform hover:opacity-90 active:scale-[0.98] ${
        isLight
          ? "bg-white text-pactara-purple-deep"
          : "text-pactara-purple-foreground"
      } ${className}`}
      style={isLight ? undefined : { backgroundColor: "#000000" }}
    >
      <AppleIcon className="h-6 w-6" />
      <div className="flex flex-col leading-none">
        <span className="text-[10px] opacity-90">Download on the</span>
        <span className="text-[15px] font-semibold">App Store</span>
      </div>
    </a>
  );
}

function AppleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.09-.48-3.24 0-1.44.62-2.2.45-3.05-.4-2.61-2.67-3.85-7.5-1.78-10.74 1.01-1.7 2.54-2.76 4.21-2.76 1.29 0 2.43.57 3.29.57.82 0 2.13-.62 3.47-.52.61.03 2.33.25 3.44 1.86-.09.06-2.05 1.19-2.03 3.55.02 2.82 2.47 3.76 2.52 3.78-.02.1-.39 1.36-1.51 2.7-.91 1.08-1.84 2.04-3.24 2.04zm-3.23-15.6c.73-.88 1.22-2.1 1.08-3.32-1.05.04-2.32.7-3.07 1.58-.67.8-1.26 2.07-1.1 3.28 1.17.09 2.37-.59 3.09-1.54z" />
    </svg>
  );
}

function Avatar({
  letter,
  size = 32,
  bg = "var(--pactara-purple)",
}: {
  letter: string;
  size?: number;
  bg?: string;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 border-background font-semibold text-pactara-purple-foreground"
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
