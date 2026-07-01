import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/plan")({
  component: PlanPage,
});

const PURPLE = "#7C3AED";
const BG = "#F5F2EC";
const INK = "#13131F";
const MUTED = "#5A5A66";
const ORANGE = "#C2410C";
const SERIF = "'Instrument Serif', 'Cormorant Garamond', Georgia, serif";

// Simulated trial state — replace with real subscription data when wired up
const TRIAL_TOTAL_DAYS = 7;
const TRIAL_DAYS_LEFT = 5;

function PlanPage() {
  const navigate = useNavigate();

  const features = [
    { label: "Free trial", monthly: "7 days", annual: "7 days" },
    { label: "Daily check-ins", monthly: true, annual: true },
    { label: "Photo check-ins", monthly: true, annual: true },
    { label: "Unlimited groups", monthly: true, annual: true },
    { label: "Streak freeze", monthly: true, annual: true },
    { label: "Back-to-back challenges", monthly: false, annual: true },
    { label: "Early feature access", monthly: false, annual: true },
  ] as const;

  const Cell = ({ v }: { v: boolean | string }) => {
    if (typeof v === "string")
      return <span className="text-[14px]" style={{ color: INK }}>{v}</span>;
    if (v) return <Check size={20} strokeWidth={2.5} style={{ color: ORANGE }} />;
    return <span style={{ color: "#C9C9D1" }}>—</span>;
  };

  const trialPct = Math.max(
    0,
    Math.min(100, ((TRIAL_TOTAL_DAYS - TRIAL_DAYS_LEFT) / TRIAL_TOTAL_DAYS) * 100),
  );

  return (
    <div
      className="min-h-[100dvh] w-full overflow-y-auto pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="px-6 pt-6 max-w-[480px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate({ to: "/profile" })}
            aria-label="Back"
            className="p-1 -ml-1"
          >
            <ChevronLeft size={26} style={{ color: INK }} />
          </button>
          <div className="text-[17px] font-semibold" style={{ color: INK }}>
            Plan
          </div>
        </div>

        {/* Current plan card */}
        <div
          className="rounded-[22px] bg-white p-6"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: PURPLE }} />
            <span
              className="text-[12px] font-bold tracking-[0.12em]"
              style={{ color: PURPLE }}
            >
              CURRENT PLAN
            </span>
          </div>
          <h2
            className="mt-2 text-[28px] leading-[1.05] tracking-tight"
            style={{ fontFamily: SERIF, color: INK }}
          >
            Free trial
          </h2>
          <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
            {TRIAL_DAYS_LEFT} of {TRIAL_TOTAL_DAYS} days left · then $12.99/mo
          </p>

          <div className="mt-4 h-2 w-full rounded-full" style={{ background: "#F1EEE8" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${trialPct}%`, background: PURPLE }}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              className="rounded-full py-3 text-[14px] font-semibold text-white"
              style={{ background: PURPLE }}
            >
              Upgrade now
            </button>
            <button
              className="rounded-full py-3 text-[14px] font-semibold"
              style={{ background: "#F1EEE8", color: INK }}
            >
              Manage
            </button>
          </div>
        </div>

        {/* Monthly Card */}
        <div
          className="mt-6 rounded-[22px] bg-white p-6"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[24px]">🔥</span>
            <span
              className="text-[24px] font-semibold tracking-tight"
              style={{ fontFamily: SERIF, color: INK }}
            >
              Monthly
            </span>
          </div>
          <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
            Unlimited groups. Cancel anytime.
          </p>
          <div className="mt-5 flex items-baseline gap-2">
            <span
              className="text-[44px] leading-none"
              style={{ fontFamily: SERIF, color: INK }}
            >
              $12.99
            </span>
            <span className="text-[16px]" style={{ color: MUTED }}>
              / month
            </span>
          </div>
          <ul className="mt-5 space-y-3">
            {["Unlimited groups", "Daily & photo check-ins", "Streak freeze (1× per week)"].map(
              (f) => (
                <li
                  key={f}
                  className="flex items-center gap-3 text-[15px]"
                  style={{ color: INK }}
                >
                  <Check size={18} strokeWidth={2.5} style={{ color: "#9A9AA5" }} />
                  {f}
                </li>
              ),
            )}
          </ul>
          <button
            className="mt-6 w-full rounded-full py-4 text-[16px] font-semibold"
            style={{ background: "#F1EEE8", color: INK }}
          >
            Choose Monthly
          </button>
        </div>

        {/* Annual Card */}
        <div
          className="mt-6 relative rounded-[22px] bg-white p-6"
          style={{ border: `2px solid ${ORANGE}` }}
        >
          <div
            className="absolute -top-3 right-4 px-3 py-1 rounded-full text-[12px] font-semibold text-white"
            style={{ background: ORANGE }}
          >
            Save 48%
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[24px]">⚡</span>
            <span
              className="text-[24px] font-semibold tracking-tight"
              style={{ fontFamily: SERIF, color: INK }}
            >
              Annual
            </span>
          </div>
          <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
            Unlimited groups, back-to-back challenges, all year.
          </p>
          <div className="mt-5 flex items-baseline gap-2">
            <span
              className="text-[44px] leading-none"
              style={{ fontFamily: SERIF, color: INK }}
            >
              $79.99
            </span>
            <span className="text-[16px]" style={{ color: MUTED }}>
              / year
            </span>
          </div>
          <p className="mt-2 text-[14px] font-semibold" style={{ color: ORANGE }}>
            Just $6.67/mo
          </p>
          <ul className="mt-5 space-y-3">
            {[
              "Everything in Monthly",
              "Run back-to-back challenges",
              "Early access to new features",
            ].map((f) => (
              <li
                key={f}
                className="flex items-center gap-3 text-[15px]"
                style={{ color: INK }}
              >
                <Check size={18} strokeWidth={2.5} style={{ color: ORANGE }} />
                {f}
              </li>
            ))}
          </ul>
          <button
            className="mt-6 w-full rounded-full py-4 text-[16px] font-semibold text-white"
            style={{ background: ORANGE }}
          >
            Choose Annual
          </button>
        </div>

        {/* Compare */}
        <h2
          className="mt-10 text-[28px] tracking-tight"
          style={{ fontFamily: SERIF, color: INK }}
        >
          Compare plans
        </h2>
        <div
          className="mt-4 rounded-[18px] bg-white overflow-hidden"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          <div
            className="grid grid-cols-[1.4fr_1fr_1fr] px-5 py-3"
            style={{ background: "#F7F4EE" }}
          >
            <div
              className="text-[12px] font-bold tracking-[0.1em]"
              style={{ color: "#8A8A95" }}
            >
              FEATURE
            </div>
            <div
              className="text-[12px] font-bold tracking-[0.1em] text-center"
              style={{ color: PURPLE }}
            >
              MONTHLY
            </div>
            <div
              className="text-[12px] font-bold tracking-[0.1em] text-center"
              style={{ color: ORANGE }}
            >
              ANNUAL
            </div>
          </div>
          {features.map((f, i) => (
            <div
              key={f.label}
              className="grid grid-cols-[1.4fr_1fr_1fr] items-center px-5 py-4"
              style={{ borderTop: i === 0 ? "none" : "1px solid #EFECE5" }}
            >
              <div className="text-[15px] font-semibold" style={{ color: INK }}>
                {f.label}
              </div>
              <div className="flex justify-center">
                <Cell v={f.monthly} />
              </div>
              <div className="flex justify-center">
                <Cell v={f.annual} />
              </div>
            </div>
          ))}
        </div>

        <p
          className="mt-8 text-center text-[13px] leading-[1.5]"
          style={{ color: MUTED }}
        >
          Prices in USD. Subscriptions renew automatically until cancelled.
          <br />
          Questions? Email us at{" "}
          <a
            href="mailto:hello@pactara.app"
            className="font-semibold"
            style={{ color: PURPLE }}
          >
            hello@pactara.app
          </a>
        </p>
      </div>
    </div>
  );
}
