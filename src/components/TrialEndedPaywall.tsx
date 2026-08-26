import { useEffect, useState } from "react";
import { CheckCircle2, Star, Flame, TrendingUp, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  type PactaraOfferings,
} from "@/lib/revenuecat";

const PURPLE = "#7C3AED";
const BG = "#F5F2EC";
const INK = "#13131F";
const MUTED = "#5A5A66";
const ORANGE = "#C2410C";

type Mode = "intro" | "blocked";

type Props = {
  firstName?: string | null;
  daysActive?: number;
  mode?: Mode;
  onDismiss?: () => void;
};

export function TrialEndedPaywall({ firstName, daysActive, mode = "blocked", onDismiss }: Props) {
  useHideBottomTabs();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [plan, setPlan] = useState<"yearly" | "monthly">("yearly");
  const [offerings, setOfferings] = useState<PactaraOfferings | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isIntro = mode === "intro";

  useEffect(() => {
    let cancelled = false;
    // Never let a slow/hanging offerings fetch keep the CTA disabled.
    const safety = setTimeout(() => {
      if (!cancelled) setLoadingOfferings(false);
    }, 4000);
    (async () => {
      try {
        setLoadingOfferings(true);
        const result = await getOfferings();
        if (!cancelled) setOfferings(result);
      } catch (err) {
        console.error("[paywall] failed to load offerings", err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not connect to the App Store. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setLoadingOfferings(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, []);

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
    { Icon: TrendingUp, label: "Every photo, commitment, and note" },
  ];

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  async function handleSubscribe() {
    if (purchasing) return;
    const pkg = plan === "yearly" ? annualPkg : monthlyPkg;
    if (!pkg) {
      setError(
        "The App Store did not return this subscription. Close and reopen the app, then try again.",
      );
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      const customerInfo = await purchasePackage(pkg);
      if (customerInfo) {
        if (isIntro && onDismiss) {
          onDismiss();
        } else {
          // Blocked paywall: reload so the auth layout sees the active entitlement.
          window.location.reload();
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    try {
      const customerInfo = await restorePurchases();
      if (customerInfo) {
        window.location.reload();
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not restore purchases.");
    }
  }

  const eyebrow = isIntro ? "START YOUR 7-DAY FREE TRIAL" : "YOUR TRIAL HAS ENDED";
  const heading = isIntro ? (
    <>
      Try Pactara
      <br />
      free for 7 days
    </>
  ) : (
    <>
      Keep your
      <br />
      progress going
    </>
  );
  const sub = isIntro ? (
    <>
      {firstName ? `${firstName}, get ` : "Get "} full access — cancel anytime.
      <br />
      No charge until your trial ends.
    </>
  ) : (
    <>
      {firstName ? `${firstName}, you've ` : "You've "}
      built {daysActive ? `${daysActive} days of` : "real"} momentum.
      <br />
      Subscribe to keep showing up.
    </>
  );

  const monthlyPkg = offerings?.monthly;
  const annualPkg = offerings?.annual;

  const priceMonthly = monthlyPkg?.product?.priceString ?? "$12.99";
  const priceYearly = annualPkg?.product?.priceString ?? "$79.99";
  const yearlyMonthly = (() => {
    const annualPrice = annualPkg?.product?.price;
    if (typeof annualPrice === "number" && annualPrice > 0) {
      return `$${(annualPrice / 12).toFixed(2)}`;
    }
    return "$6.67";
  })();
  const ctaLabel =
    plan === "yearly"
      ? isIntro
        ? `Start free trial — then ${priceYearly}/year`
        : `Subscribe — ${priceYearly}/year`
      : isIntro
        ? `Start free trial — then ${priceMonthly}/month`
        : `Subscribe — ${priceMonthly}/month`;

  return (
    <div
      className="fixed inset-0 z-[100] w-full flex flex-col overflow-y-auto"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: INK }}
    >
      <div className="min-h-[100dvh] flex flex-col shrink-0">
        {isIntro && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center z-10"
            style={{ color: MUTED }}
          >
            <X size={18} />
          </button>
        )}
        <div className="px-6 pt-10 text-center shrink-0">
          <div className="mt-8 text-[11px] font-bold tracking-[0.18em]" style={{ color: PURPLE }}>
            {eyebrow}
          </div>
          <h1
            className="mt-2 text-[34px] leading-[1.02] tracking-tight"
            style={{
              fontFamily: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
              color: INK,
            }}
          >
            {heading}
          </h1>
          <p className="mt-3 text-[14px] leading-[1.45]" style={{ color: MUTED }}>
            {sub}
          </p>
        </div>

        <div
          className="mt-6 mx-6 rounded-2xl bg-white p-4 shrink-0"
          style={{
            boxShadow: "0 1px 2px rgba(15,15,30,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)",
          }}
        >
          <div
            className="text-[12px] font-semibold tracking-wide uppercase"
            style={{ color: MUTED }}
          >
            {isIntro ? "What you get" : "What you keep"}
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

        <div className="mt-4 mx-6 grid grid-cols-2 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setPlan("yearly")}
            className="relative rounded-2xl bg-white p-3 text-left transition-all"
            style={{
              border: `2px solid ${plan === "yearly" ? PURPLE : "transparent"}`,
              boxShadow: "0 1px 2px rgba(15,15,30,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)",
            }}
          >
            <div
              className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ background: PURPLE }}
            >
              SAVE 49%
            </div>
            <div className="text-[11px] font-bold tracking-wide" style={{ color: MUTED }}>
              YEARLY
            </div>
            <div className="mt-1 text-[18px] font-bold" style={{ color: INK }}>
              {yearlyMonthly}
              <span className="text-[12px] font-medium" style={{ color: MUTED }}>
                /mo
              </span>
            </div>
            <div className="text-[11px]" style={{ color: MUTED }}>
              {priceYearly} billed yearly
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPlan("monthly")}
            className="rounded-2xl bg-white p-3 text-left transition-all"
            style={{
              border: `2px solid ${plan === "monthly" ? PURPLE : "transparent"}`,
              boxShadow: "0 1px 2px rgba(15,15,30,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)",
            }}
          >
            <div className="text-[11px] font-bold tracking-wide" style={{ color: MUTED }}>
              MONTHLY
            </div>
            <div className="mt-1 text-[18px] font-bold" style={{ color: INK }}>
              {priceMonthly}
              <span className="text-[12px] font-medium" style={{ color: MUTED }}>
                /mo
              </span>
            </div>
            <div className="text-[11px]" style={{ color: MUTED }}>
              Billed monthly
            </div>
          </button>
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
                  boxShadow: "0 1px 2px rgba(15,15,30,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)",
                }}
              >
                <div className="relative shrink-0 h-[182px] overflow-hidden">
                  <img
                    src={t.image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
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

          {error && (
            <p className="mt-3 text-center text-[13px]" style={{ color: "#B42318" }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubscribe}
            disabled={purchasing}
            className="mt-3 w-full h-[54px] rounded-full text-white text-[15px] font-semibold px-4 disabled:opacity-60"
            style={{ background: PURPLE }}
          >
            {purchasing ? "Processing…" : ctaLabel}
          </button>

          {!isIntro && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={purchasing}
              className="mt-3 w-full text-[14px] font-medium disabled:opacity-60"
              style={{ color: MUTED }}
            >
              Restore purchases
            </button>
          )}

          {isIntro ? (
            <button
              type="button"
              onClick={onDismiss}
              disabled={purchasing}
              className="mt-3 w-full text-[14px] font-medium disabled:opacity-60"
              style={{ color: MUTED }}
            >
              Maybe later
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut || purchasing}
              className="mt-3 w-full text-[14px] font-medium disabled:opacity-60"
              style={{ color: MUTED }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}

          <p className="mt-4 text-center text-[11px] leading-relaxed" style={{ color: MUTED }}>
            Payment is charged to your Apple ID at confirmation of purchase. Subscriptions renew
            automatically unless canceled at least 24 hours before the end of the current period.
            Manage or cancel in your Apple ID settings.
          </p>
          <div className="mt-2 flex items-center justify-center gap-4 text-[12px] font-medium">
            <a
              href="https://pactara.lovable.app/terms"
              target="_blank"
              rel="noreferrer"
              style={{ color: MUTED, textDecoration: "underline" }}
            >
              Terms of Use (EULA)
            </a>
            <a
              href="https://pactara.lovable.app/privacy"
              target="_blank"
              rel="noreferrer"
              style={{ color: MUTED, textDecoration: "underline" }}
            >
              Privacy Policy
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
