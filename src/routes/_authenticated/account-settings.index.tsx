import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Mail,
  Lock,
  Bell,
  Trash2,
  Loader2,
  Zap,
  LogOut,
  HelpCircle,
  Scale,
  Info,
  Sparkles,
  Ban,
} from "lucide-react";
import { setWeightUnit } from "@/lib/lifts.functions";
import { LIFT_HISTORY_KEY, useLiftHistory } from "@/lib/exercise-library";
import type { WeightUnit } from "@/lib/lift-rules";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/profile.functions";
import { OnboardingSheet } from "@/components/OnboardingSheet";
import { WhatsNewSheet } from "@/components/whats-new/WhatsNewSheet";
import { useSafetyState } from '@/components/safety/SafetyActions';

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const RED_SOFT = "#FEE2E2";
const BG = "#F5F2EE";
const LABEL = "#8A8580";

export const Route = createFileRoute("/_authenticated/account-settings/")({
  head: () => ({ meta: [
    { title: 'Account settings · Pactara' },
    { name: 'description', content: 'Your Pactara account, preferences and privacy settings.' },
    { property: 'og:title', content: 'Account settings · Pactara' },
    { property: 'og:description', content: 'Your Pactara account, preferences and privacy settings.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: AccountSettingsHub,
});

function AccountSettingsHub() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: safety } = useSafetyState();
  const blockedCount = safety?.own.length ?? 0;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  const deleteFn = useServerFn(deleteMyAccount);
  const unitFn = useServerFn(setWeightUnit);
  const { data: lifts } = useLiftHistory();
  const [unitPick, setUnitPick] = useState<WeightUnit | null>(null);
  const unit: WeightUnit = unitPick ?? lifts?.unit ?? "lb";
  const changeUnit = useMutation({
    mutationFn: (u: WeightUnit) => unitFn({ data: { unit: u } }),
    onMutate: (u) => setUnitPick(u),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIFT_HISTORY_KEY }),
    onError: () => {
      setUnitPick(null);
      setErr("Couldn't change units. Check your connection and try again.");
    },
  });
  const deleteAccount = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/login", replace: true });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white px-4 pt-safe-5 pb-4 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/profile" })}
          aria-label="Back"
          className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-[18px] font-bold">Account settings</div>
      </header>

      <section className="px-5 pt-5">
        <div
          className="text-[12px] font-semibold tracking-wider mb-3 px-1"
          style={{ color: LABEL }}
        >
          ACCOUNT
        </div>
        <div className="rounded-2xl bg-white overflow-hidden">
          <Row
            icon={<UserIcon size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Name"
            subtitle="How you appear in your crew"
            onClick={() => navigate({ to: "/account-settings/name" })}
          />
          <Divider />
          <Row
            icon={<Mail size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Email"
            subtitle="Used to sign in"
            onClick={() => navigate({ to: "/account-settings/email" })}
          />
          <Divider />
          <Row
            icon={<Lock size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Password"
            subtitle="Change your password"
            onClick={() => navigate({ to: "/account-settings/password" })}
          />
        </div>
      </section>

      <section className="px-5 pt-6">
        <div
          className="text-[12px] font-semibold tracking-wider mb-3 px-1"
          style={{ color: LABEL }}
        >
          PREFERENCES
        </div>
        <div className="rounded-2xl bg-white overflow-hidden">
          <Row
            icon={<Bell size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Notifications"
            subtitle="Push and reminders"
            onClick={() => navigate({ to: "/account-settings/notifications" })}
          />
          <Divider />
          <Row
            icon={<Zap size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Plan"
            subtitle="Subscription and billing"
            onClick={() => navigate({ to: "/plan" })}
          />
          <Divider />
          <div className="flex items-center gap-4 px-4 py-4">
            <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: PURPLE_SOFT }}>
              <Scale size={18} style={{ color: PURPLE }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-bold text-neutral-900">Weight units</span>
              <span className="block text-[13px] text-neutral-500 truncate">For logging workouts</span>
            </span>
            <div role="radiogroup" aria-label="Weight units" className="flex shrink-0 rounded-full p-1" style={{ background: BG }}>
              {(["lb", "kg"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={unit === u}
                  onClick={() => unit !== u && changeUnit.mutate(u)}
                  className="h-9 min-w-[44px] rounded-full px-3 text-[14px] font-bold"
                  style={unit === u ? { background: "#FFFFFF", color: PURPLE, boxShadow: "0 1px 2px rgba(20,18,24,.08)" } : { color: LABEL }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <Divider />
          <Row
            icon={<HelpCircle size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="How Pactara works"
            subtitle="A quick guide to the app"
            onClick={() => setShowGuide(true)}
          />
          <Divider />
          <Row
            icon={<Sparkles size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="What's new"
            subtitle="The latest in Pactara"
            onClick={() => setShowWhatsNew(true)}
          />
          <Divider />
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-4 py-4 text-left"
          >
            <span
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: PURPLE_SOFT }}
            >
              <LogOut size={18} style={{ color: PURPLE }} />
            </span>
            <span className="flex-1 text-[16px] font-semibold text-neutral-900">Sign out</span>
          </button>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="text-[12px] font-semibold tracking-wider mb-3 px-1 flex items-center gap-2" style={{ color: LABEL }}>
          PRIVACY &amp; SAFETY <span className="safety-new">NEW</span>
        </div>
        <div className="rounded-2xl bg-white overflow-hidden">
          <Row icon={<Ban size={18} style={{ color: PURPLE }} />} iconBg={PURPLE_SOFT} title="Blocked people" subtitle={blockedCount === 0 ? 'No one' : blockedCount === 1 ? '1 person' : `${blockedCount} people`} onClick={() => navigate({ to: '/account-settings/blocked' })} />
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="text-[12px] font-semibold tracking-wider mb-3 px-1" style={{ color: LABEL }}>
          ABOUT
        </div>
        <div className="rounded-2xl bg-white overflow-hidden">
          <a href="https://repdb.co" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-4 px-4 py-4 text-left">
            <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: PURPLE_SOFT }}>
              <Info size={18} style={{ color: PURPLE }} />
            </span>
            <span className="flex-1 min-w-0 text-[15px] text-neutral-700">
              Exercise data by <span className="font-semibold underline" style={{ color: PURPLE }}>RepDB (repdb.co)</span>
            </span>
          </a>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div
          className="text-[12px] font-semibold tracking-wider mb-3 px-1"
          style={{ color: LABEL }}
        >
          DANGER ZONE
        </div>
        <div className="rounded-2xl bg-white p-4">
          {err && (
            <div className="mb-3 rounded-xl px-3 py-2 text-[13px] bg-red-100 text-red-800">
              {err}
            </div>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => {
                setErr(null);
                setConfirmDelete(true);
              }}
              className="w-full flex items-center gap-3 py-1 text-left"
            >
              <span
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: RED_SOFT }}
              >
                <Trash2 size={18} className="text-red-500" />
              </span>
              <span className="flex-1 text-[16px] font-semibold text-red-500">
                Delete account
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-[14px] font-semibold text-red-600">
                Permanently delete your account? This can't be undone.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleteAccount.isPending}
                  className="flex-1 rounded-full bg-neutral-200 text-neutral-800 py-3 font-semibold text-[15px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteAccount.mutate()}
                  disabled={deleteAccount.isPending}
                  className="flex-1 rounded-full bg-red-600 text-white py-3 font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleteAccount.isPending && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  Yes, delete
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      {showGuide && <OnboardingSheet firstName="" onClose={() => setShowGuide(false)} />}
      <WhatsNewSheet open={showWhatsNew} onOpenChange={setShowWhatsNew} />
    </div>
  );
}

function Row({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-4 text-left">
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-bold text-neutral-900">{title}</span>
        <span className="block text-[13px] text-neutral-500 truncate">{subtitle}</span>
      </span>
      <ChevronRight size={20} className="text-neutral-300 shrink-0" />
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-neutral-100 ml-[68px]" />;
}
