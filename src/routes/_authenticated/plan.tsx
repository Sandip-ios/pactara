import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Check, Sparkles, X, Apple, Smartphone, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import {
  getCustomerInfo,
  getOfferings,
  isSubscriptionActive,
  purchasePackage,
  restorePurchases,
  type CustomerInfo,
  type PactaraOfferings,
} from "@/lib/revenuecat";
import { isNative } from "@/lib/native";

export const Route = createFileRoute("/_authenticated/plan")({
  ssr: false,
  component: PlanPage,
});

const PURPLE = "#7C3AED";
const BG = "#F5F2EC";
const INK = "#13131F";
const MUTED = "#5A5A66";
const ORANGE = "#C2410C";
const SERIF = "'Instrument Serif', 'Cormorant Garamond', Georgia, serif";

const TRIAL_DAYS = 7;
const PLAN_PREF_KEY = "pactara:plan-preference";

type PlanChoice = "monthly" | "annual" | null;

function PlanPage() {
  const navigate = useNavigate();
  const annualRef = useRef<HTMLDivElement>(null);

  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>(null);
  const [pendingPlan, setPendingPlan] = useState<PlanChoice>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PactaraOfferings | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLAN_PREF_KEY);
      if (raw === "monthly" || raw === "annual") setSelectedPlan(raw);
    } catch {}
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("id", uid)
        .maybeSingle();
      if (profile?.created_at) setCreatedAt(new Date(profile.created_at));

      if (isNative()) {
        try {
          const [info, offers] = await Promise.all([getCustomerInfo(), getOfferings()]);
          setCustomerInfo(info);
          setOfferings(offers);
        } catch (err) {
          console.error("[plan] failed to load RevenueCat data", err);
          setError(
            err instanceof Error
              ? err.message
              : "Could not connect to the App Store. Please try again.",
          );
        } finally {
          setCheckingStatus(false);
        }
      } else {
        setCheckingStatus(false);
      }
    })();
  }, []);

  const { daysLeft, trialPct, isTrial } = useMemo(() => {
    if (!createdAt) return { daysLeft: TRIAL_DAYS, trialPct: 0, isTrial: true };
    const elapsedMs = Date.now() - createdAt.getTime();
    const elapsedDays = Math.floor(elapsedMs / 86400000);
    const left = Math.max(0, TRIAL_DAYS - elapsedDays);
    const pct = Math.min(100, Math.max(0, (elapsedDays / TRIAL_DAYS) * 100));
    return { daysLeft: left, trialPct: pct, isTrial: left > 0 };
  }, [createdAt]);

  const features = [
    { label: "Free trial", monthly: "7 days", annual: "7 days" },
    { label: "Daily check-ins", monthly: true, annual: true },
    { label: "Video check-ins", monthly: true, annual: true },
    { label: "Unlimited groups", monthly: true, annual: true },
    { label: "Streak freezes to start", monthly: "2", annual: "2" },
    { label: "Continue with your same group", monthly: false, annual: true },
    { label: "Early feature access", monthly: false, annual: true },
  ] as const;

  const Cell = ({ v }: { v: boolean | string }) => {
    if (typeof v === "string")
      return (
        <span className="text-[14px]" style={{ color: INK }}>
          {v}
        </span>
      );
    if (v) return <Check size={20} strokeWidth={2.5} style={{ color: ORANGE }} />;
    return <span style={{ color: "#C9C9D1" }}>—</span>;
  };

  const scrollToPlans = () => {
    annualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openConfirm = (plan: Exclude<PlanChoice, null>) => setPendingPlan(plan);
  const closeConfirm = () => setPendingPlan(null);

  const confirmPlan = async () => {
    if (!pendingPlan) return;
    const pkg = pendingPlan === "annual" ? offerings?.annual : offerings?.monthly;
    if (isNative()) {
      if (!pkg) {
        setError(
          "The App Store did not return this subscription. Close and reopen the app, then try again.",
        );
        setPendingPlan(null);
        return;
      }
      setPurchasing(true);
      setError(null);
      try {
        const result = await purchasePackage(pkg);
        if (result) {
          setSelectedPlan(pendingPlan);
          setCustomerInfo(result);
          try {
            localStorage.setItem(PLAN_PREF_KEY, pendingPlan);
          } catch {}
          toast.success(
            pendingPlan === "annual"
              ? "You're subscribed to Annual."
              : "You're subscribed to Monthly.",
          );
        }
      } catch (err: any) {
        setError(err?.message ?? "Purchase failed. Please try again.");
      } finally {
        setPurchasing(false);
      }
    } else {
      setSelectedPlan(pendingPlan);
      try {
        localStorage.setItem(PLAN_PREF_KEY, pendingPlan);
      } catch {}
      toast.success(
        pendingPlan === "annual"
          ? "You're on Annual. Billing starts after your 7-day trial."
          : "You're on Monthly. Billing starts after your 7-day trial.",
      );
    }
    setPendingPlan(null);
  };

  const cancelSelection = () => {
    setSelectedPlan(null);
    try {
      localStorage.removeItem(PLAN_PREF_KEY);
    } catch {}
    setManageOpen(false);
    toast.success("Plan selection cleared.");
  };

  const handleRestore = async () => {
    setError(null);
    try {
      const info = await restorePurchases();
      if (info) {
        setCustomerInfo(info);
        toast.success("Purchases restored successfully.");
      } else {
        toast.info("No purchases to restore.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not restore purchases.");
    }
  };

  const subscriptionActive = isSubscriptionActive(customerInfo);

  const currentLabel = subscriptionActive
    ? "Subscribed"
    : selectedPlan
      ? selectedPlan === "annual"
        ? "Annual (saved)"
        : "Monthly (saved)"
      : isTrial
        ? "Free trial"
        : "Trial ended";
  const currentSub = subscriptionActive
    ? "Your subscription is active."
    : selectedPlan
      ? selectedPlan === "annual"
        ? "$79.99/yr · billed after your 7-day trial"
        : "$12.99/mo · billed after your 7-day trial"
      : isTrial
        ? `${daysLeft} of ${TRIAL_DAYS} days left · then $12.99/mo`
        : "Choose a plan below to keep your progress.";

  const monthlyPrice = offerings?.monthly?.product?.priceString ?? "$12.99";
  const annualPrice = offerings?.annual?.product?.priceString ?? "$79.99";
  const annualMonthlyPrice = (() => {
    const annualPriceValue = offerings?.annual?.product?.price;
    if (typeof annualPriceValue === "number" && annualPriceValue > 0) {
      return `$${(annualPriceValue / 12).toFixed(2)}`;
    }
    return "$6.67";
  })();

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="px-6 pt-safe-6 max-w-[480px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
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
          <button onClick={() => setHelpOpen(true)} aria-label="Help" className="p-1 -mr-1">
            <HelpCircle size={22} style={{ color: MUTED }} />
          </button>
        </div>

        {/* Current plan card */}
        <div
          className="rounded-[22px] bg-white p-6"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: PURPLE }} />
            <span className="text-[12px] font-bold tracking-[0.12em]" style={{ color: PURPLE }}>
              CURRENT PLAN
            </span>
          </div>
          <h2
            className="mt-2 text-[28px] leading-[1.05] tracking-tight"
            style={{ fontFamily: SERIF, color: INK }}
          >
            {currentLabel}
          </h2>
          <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
            {currentSub}
          </p>

          {isTrial && !selectedPlan && (
            <div className="mt-4 h-2 w-full rounded-full" style={{ background: "#F1EEE8" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${trialPct}%`, background: PURPLE }}
              />
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={scrollToPlans}
              className="rounded-full py-3 text-[14px] font-semibold text-white active:opacity-80"
              style={{ background: PURPLE }}
            >
              {selectedPlan ? "Change plan" : "Upgrade now"}
            </button>
            <button
              onClick={() => setManageOpen(true)}
              className="rounded-full py-3 text-[14px] font-semibold active:opacity-80"
              style={{ background: "#F1EEE8", color: INK }}
            >
              Manage
            </button>
          </div>
        </div>

        {/* Monthly Card */}
        <PlanCard
          emoji="🔥"
          name="Monthly"
          tagline="Unlimited groups. Start a new challenge anytime."
          price={monthlyPrice}
          period="/ month"
          bullets={[
            "Unlimited groups",
            "Daily & video check-ins",
            "2 streak freezes to start",
            "New challenge = new group",
          ]}
          buttonLabel={selectedPlan === "monthly" ? "Selected" : "Choose Monthly"}
          buttonStyle={{ background: "#F1EEE8", color: INK }}
          checkColor="#9A9AA5"
          selected={selectedPlan === "monthly"}
          onSelect={() => openConfirm("monthly")}
        />

        {/* Annual Card */}
        <div ref={annualRef}>
          <PlanCard
            emoji="⚡"
            name="Annual"
            tagline="Unlimited groups, keep your streaks running all year."
            price={annualPrice}
            period="/ year"
            subPrice={`Just ${annualMonthlyPrice}/mo`}
            bullets={[
              "Everything in Monthly",
              "Restart challenges with your same group — no need to rebuild your crew",
              "Streaks and history carry over between challenges",
              "Early access to new features",
            ]}
            buttonLabel={selectedPlan === "annual" ? "Selected" : "Choose Annual"}
            buttonStyle={{ background: ORANGE, color: "#fff" }}
            checkColor={ORANGE}
            highlight
            badge="Save 48%"
            selected={selectedPlan === "annual"}
            onSelect={() => openConfirm("annual")}
          />
        </div>

        {/* Compare */}
        <h2 className="mt-10 text-[28px] tracking-tight" style={{ fontFamily: SERIF, color: INK }}>
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
            <div className="text-[12px] font-bold tracking-[0.1em]" style={{ color: "#8A8A95" }}>
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

        <p className="mt-8 text-center text-[13px] leading-[1.5]" style={{ color: MUTED }}>
          Prices in USD. Subscriptions renew automatically until cancelled.
          <br />
          Questions? Email us at{" "}
          <a href="mailto:hello@pactara.app" className="font-semibold" style={{ color: PURPLE }}>
            hello@pactara.app
          </a>
        </p>

        <div className="mt-4 flex items-center justify-center gap-4 text-[12px] font-medium">
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

        <StoreDiagnostics />

      </div>


      {/* Confirm plan sheet */}
      {pendingPlan && (
        <BottomSheet onClose={closeConfirm}>
          <div className="text-center">
            <div
              className="mx-auto h-14 w-14 rounded-full flex items-center justify-center"
              style={{ background: pendingPlan === "annual" ? "#FEF0E6" : "#F1EEE8" }}
            >
              <Smartphone size={26} style={{ color: pendingPlan === "annual" ? ORANGE : PURPLE }} />
            </div>
            <h3 className="mt-4 text-[24px]" style={{ fontFamily: SERIF, color: INK }}>
              Confirm your {pendingPlan === "annual" ? "Annual" : "Monthly"} plan
            </h3>
            <p className="mt-2 text-[15px] leading-[1.5]" style={{ color: MUTED }}>
              {pendingPlan === "annual"
                ? `${annualPrice} / year (just ${annualMonthlyPrice}/mo) after your 7-day trial.`
                : `${monthlyPrice} / month after your 7-day trial.`}{" "}
              Cancel anytime before your trial ends and you won't be charged.
            </p>
          </div>

          {error && (
            <p className="mt-4 text-center text-[13px]" style={{ color: "#B42318" }}>
              {error}
            </p>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={confirmPlan}
              disabled={purchasing}
              className="w-full rounded-full py-4 text-[16px] font-semibold text-white active:opacity-80 disabled:opacity-60"
              style={{ background: pendingPlan === "annual" ? ORANGE : PURPLE }}
            >
              {purchasing
                ? "Processing…"
                : `Confirm ${pendingPlan === "annual" ? "Annual" : "Monthly"}`}
            </button>
            <button
              onClick={closeConfirm}
              disabled={purchasing}
              className="w-full rounded-full py-4 text-[16px] font-semibold disabled:opacity-60"
              style={{ background: "#F1EEE8", color: INK }}
            >
              Not now
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Manage sheet */}
      {manageOpen && (
        <BottomSheet onClose={() => setManageOpen(false)}>
          <h3 className="text-[24px]" style={{ fontFamily: SERIF, color: INK }}>
            Manage subscription
          </h3>
          <p className="mt-2 text-[15px] leading-[1.5]" style={{ color: MUTED }}>
            Switch between Monthly and Annual anytime. To cancel, change, or refund, use iOS
            Settings → Apple ID → Subscriptions.
          </p>
          <div className="mt-5 space-y-3">
            <button
              onClick={() => {
                setManageOpen(false);
                scrollToPlans();
              }}
              className="w-full rounded-full py-4 text-[15px] font-semibold"
              style={{ background: "#F1EEE8", color: INK }}
            >
              Switch plan
            </button>
            <button
              onClick={handleRestore}
              disabled={purchasing}
              className="w-full rounded-full py-4 text-[15px] font-semibold disabled:opacity-60"
              style={{ background: "#F1EEE8", color: INK }}
            >
              Restore purchases
            </button>
            {selectedPlan && (
              <button
                onClick={cancelSelection}
                className="w-full rounded-full py-4 text-[15px] font-semibold"
                style={{ background: "#FCE9E9", color: "#B42318" }}
              >
                Clear plan selection
              </button>
            )}
            <a
              href="mailto:hello@pactara.app"
              className="block text-center w-full rounded-full py-4 text-[15px] font-semibold"
              style={{ background: "transparent", color: PURPLE }}
            >
              Contact support
            </a>
          </div>
        </BottomSheet>
      )}

      {/* Help sheet */}
      {helpOpen && (
        <BottomSheet onClose={() => setHelpOpen(false)}>
          <h3 className="text-[24px]" style={{ fontFamily: SERIF, color: INK }}>
            How billing works
          </h3>
          <ul className="mt-4 space-y-4 text-[15px] leading-[1.5]" style={{ color: INK }}>
            <li className="flex gap-3">
              <Check size={20} className="mt-0.5 shrink-0" style={{ color: PURPLE }} />
              <span>Your 7-day trial starts the day you sign up. No charge during the trial.</span>
            </li>
            <li className="flex gap-3">
              <Check size={20} className="mt-0.5 shrink-0" style={{ color: PURPLE }} />
              <span>Choose Monthly or Annual — billing begins the day your trial ends.</span>
            </li>
            <li className="flex gap-3">
              <Check size={20} className="mt-0.5 shrink-0" style={{ color: PURPLE }} />
              <span>Cancel anytime. You'll keep access until the end of your billing period.</span>
            </li>
          </ul>
          <button
            onClick={() => setHelpOpen(false)}
            className="mt-6 w-full rounded-full py-4 text-[16px] font-semibold text-white"
            style={{ background: PURPLE }}
          >
            Got it
          </button>
        </BottomSheet>
      )}
    </div>
  );
}

function PlanCard({
  emoji,
  name,
  tagline,
  price,
  period,
  subPrice,
  bullets,
  buttonLabel,
  buttonStyle,
  checkColor,
  highlight,
  badge,
  selected,
  onSelect,
}: {
  emoji: string;
  name: string;
  tagline: string;
  price: string;
  period: string;
  subPrice?: string;
  bullets: string[];
  buttonLabel: string;
  buttonStyle: React.CSSProperties;
  checkColor: string;
  highlight?: boolean;
  badge?: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="mt-6 relative rounded-[22px] bg-white p-6"
      style={
        highlight ? { border: `2px solid ${ORANGE}` } : { boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }
      }
    >
      {badge && (
        <div
          className="absolute -top-3 right-4 px-3 py-1 rounded-full text-[12px] font-semibold text-white"
          style={{ background: ORANGE }}
        >
          {badge}
        </div>
      )}
      {selected && (
        <div
          className="absolute -top-3 left-4 px-3 py-1 rounded-full text-[12px] font-semibold text-white"
          style={{ background: PURPLE }}
        >
          Selected
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="text-[24px]">{emoji}</span>
        <span
          className="text-[24px] font-semibold tracking-tight"
          style={{ fontFamily: SERIF, color: INK }}
        >
          {name}
        </span>
      </div>
      <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
        {tagline}
      </p>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-[44px] leading-none" style={{ fontFamily: SERIF, color: INK }}>
          {price}
        </span>
        <span className="text-[16px]" style={{ color: MUTED }}>
          {period}
        </span>
      </div>
      {subPrice && (
        <p className="mt-2 text-[14px] font-semibold" style={{ color: ORANGE }}>
          {subPrice}
        </p>
      )}
      <ul className="mt-5 space-y-3">
        {bullets.map((f) => (
          <li key={f} className="flex items-center gap-3 text-[15px]" style={{ color: INK }}>
            <Check size={18} strokeWidth={2.5} style={{ color: checkColor }} />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        disabled={selected}
        className="mt-6 w-full rounded-full py-4 text-[16px] font-semibold active:opacity-80 disabled:opacity-60"
        style={buttonStyle}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useHideBottomTabs();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-[480px] rounded-t-[24px] bg-white p-6 pb-sheet"
        style={{ animation: "sheetUp 0.22s ease-out" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center"
          style={{ background: "#F1EEE8" }}
        >
          <X size={16} style={{ color: INK }} />
        </button>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "#E5E1D8" }} />
        {children}
      </div>
      <style>{`@keyframes sheetUp { from { transform: translateY(100%);} to { transform: translateY(0);} }`}</style>
    </div>
  );
}
