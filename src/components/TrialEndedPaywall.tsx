import { useState } from "react";
import { CheckCircle2, Star, Flame, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const PURPLE = "#7C3AED";
const BG = "#F5F2EC";
const INK = "#13131F";
const MUTED = "#5A5A66";
const ORANGE = "#C2410C";

type Props = {
  firstName?: string | null;
  daysActive?: number;
};

export function TrialEndedPaywall({ firstName, daysActive }: Props) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const testimonials = [
    {
      badge: "🔥 21 day streak",
      title: "Don't Lose Momentum",
      body: "I almost cancelled. So glad I didn't — my streak is the longest thing I've stuck to in years.",
      image:
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80",
    },
    {
      badge: "💪 +14 lbs lifted",
      title: "Worth Every Penny",
      body: "Seeing everyone's progress cards keeps me honest. First app that's actually stuck.",
      image:
        "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=600&q=80",
    },
    {
      badge: "⚖️ -12 lbs in 60 days",
      title: "My Pod Keeps Me Going",
      body: "The daily check-ins changed everything. I show up because they show up.",
      image:
        "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=600&q=80",
    },
  ];

  const keepFeatures = [
    { Icon: Flame, label: "Your streak & check-in history" },
    { Icon: Users, label: "Your pods and all your members" },
    { Icon: TrendingUp, label: "Every photo, ritual, and note" },
  ];

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div
      className="fixed inset-0 z-[100] w-full flex flex-col overflow-y-auto"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: INK }}
    >
      <div className="min-h-[100dvh] flex flex-col shrink-0">
        <div className="px-6 pt-10 text-center shrink-0">
          <div className="text-[11px] font-bold tracking-[0.18em]" style={{ color: PURPLE }}>
            YOUR TRIAL HAS ENDED
          </div>
          <h1
            className="mt-2 text-[34px] leading-[1.02] tracking-tight"
            style={{
              fontFamily: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
              color: INK,
            }}
          >
            Keep your
            <br />
            progress going
          </h1>
          <p className="mt-3 text-[14px] leading-[1.45]" style={{ color: MUTED }}>
            {firstName ? `${firstName}, you've ` : "You've "}
            built {daysActive ? `${daysActive} days of` : "real"} momentum.
            <br />
            Subscribe to keep showing up — <span className="font-semibold" style={{ color: INK }}>$12.99/month</span>.
          </p>
        </div>

        <div className="mt-6 mx-6 rounded-2xl bg-white p-4 shrink-0" style={{ boxShadow: "0 1px 2px rgba(15,15,30,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)" }}>
          <div className="text-[12px] font-semibold tracking-wide uppercase" style={{ color: MUTED }}>
            What you keep
          </div>
          <ul className="mt-3 space-y-2.5">
            {keepFeatures.map(({ Icon, label }, i) => (
              <li key={i} className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "#F1ECFF" }}
                >
                  <Icon size={16} style={{ color: PURPLE }} />
                </div>
                <span className="text-[14px]" style={{ color: INK }}>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="mt-6 flex-1 min-h-0 overflow-x-auto no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex gap-3 px-6 pb-2 h-full">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="shrink-0 rounded-2xl bg-white flex flex-col overflow-hidden h-full"
                style={{
                  width: 220,
                  boxShadow:
                    "0 1px 2px rgba(15,15,30,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)",
                }}
              >
                <div className="relative shrink-0 h-[182px] overflow-hidden">
                  <img src={t.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div
                    className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white"
                    style={{ background: INK }}
                  >
                    {t.badge}
                  </div>
                </div>
                <div className="px-3.5 pt-2.5 pb-3 shrink-0">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={12} fill="#F5B400" stroke="#F5B400" />
                    ))}
                  </div>
                  <div
                    className="mt-1.5 text-[15px] font-bold tracking-tight"
                    style={{ color: INK }}
                  >
                    {t.title}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-[1.4]" style={{ color: MUTED }}>
                    {t.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 shrink-0 mt-auto">
          <div
            className="flex items-center justify-center gap-2 text-[14px] font-semibold"
            style={{ color: ORANGE }}
          >
            <CheckCircle2 size={16} strokeWidth={2.25} />
            Cancel anytime in Settings
          </div>

          <button
            type="button"
            onClick={() => {
              // Payment integration not connected yet
              alert("Payments aren't connected yet — check back soon.");
            }}
            className="mt-3 w-full h-[54px] rounded-full text-white text-[16px] font-semibold"
            style={{ background: PURPLE }}
          >
            Subscribe — $9.99/month
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-3 w-full text-[14px] font-medium"
            style={{ color: MUTED }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
