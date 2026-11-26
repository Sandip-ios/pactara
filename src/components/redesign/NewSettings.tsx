import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Mail, Lock, Bell, Heart, Scale, Zap, Undo2, CircleHelp, Sparkles, Shield, LogOut, Info, Trash2, Loader2 } from "lucide-react";
import { setWeightUnit } from "@/lib/lifts.functions";
import { LIFT_HISTORY_KEY, useLiftHistory } from "@/lib/exercise-library";
import type { WeightUnit } from "@/lib/lift-rules";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/profile.functions";
import { OnboardingSheet } from "@/components/OnboardingSheet";
import { useAppleHealth } from "@/lib/use-apple-health";
import { SwitchToClassicSheet } from "./SwitchToClassicSheet";
import { WhatsNewScreen } from "./WhatsNewScreen";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const GRAY_SOFT = "#F4F2EF";
const MUTED = "#57534E";

export function NewSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const health = useAppleHealth();
  const [showGuide, setShowGuide] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const deleteFn = useServerFn(deleteMyAccount);
  const unitFn = useServerFn(setWeightUnit);
  const { data: lifts } = useLiftHistory();
  const [unitPick, setUnitPick] = useState<WeightUnit | null>(null);
  const unit: WeightUnit = unitPick ?? lifts?.unit ?? "lb";
  const changeUnit = useMutation({
    mutationFn: (u: WeightUnit) => unitFn({ data: { unit: u } }),
    onMutate: (u) => setUnitPick(u),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIFT_HISTORY_KEY }),
    onError: () => { setUnitPick(null); setErr("Couldn't change units. Check your connection and try again."); },
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
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
  const tile = (icon: ReactNode, bg = PURPLE_SOFT) => <span className="flex shrink-0 items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, background: bg }}>{icon}</span>;
  const p = (I: typeof Mail) => tile(<I size={18} style={{ color: PURPLE }} />);

  return (
    <div className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-[max(24px,env(safe-area-inset-bottom))]" style={{ background: "#F5F2EE", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header className="relative flex items-center justify-center bg-white px-4 pt-new-top pb-3">
        <button onClick={() => navigate({ to: "/profile" })} aria-label="Back" className="absolute left-4 bottom-3 flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: GRAY_SOFT }}>
          <ChevronLeft size={22} />
        </button>
        <div className="flex h-11 items-center text-[17px] font-bold">Settings</div>
      </header>

      <Section label="ACCOUNT">
        <Row icon={p(Mail)} title="Email" subtitle="Used to sign in" onClick={() => navigate({ to: "/account-settings/email" })} />
        <Row icon={p(Lock)} title="Password" subtitle="Change your password" onClick={() => navigate({ to: "/account-settings/password" })} />
      </Section>

      <Section label="PREFERENCES">
        <Row icon={p(Bell)} title="Notifications" subtitle="Likes, follows, comments, reminders" onClick={() => navigate({ to: "/account-settings/notifications" })} />
        {health.available && (
          <Row icon={tile(<Heart size={18} style={{ color: "#DC2626" }} />, "#FEE2E2")} title="Apple Health" subtitle="Workouts from your iPhone and Watch" onClick={() => navigate({ to: "/apple-health" })}
            trailing={health.connected ? <span className="text-[13px] font-bold" style={{ color: "#15803D" }}>Connected</span> : undefined} />
        )}
        <div className="flex items-center gap-3 py-3">
          {p(Scale)}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold" style={{ color: "#1C1917" }}>Weight units</span>
            <span className="block text-[13px]" style={{ color: MUTED }}>For logging workouts</span>
          </span>
          <div role="radiogroup" aria-label="Weight units" className="flex shrink-0 rounded-full p-1" style={{ background: "#F5F2EE" }}>
            {(["lb", "kg"] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => unit !== u && changeUnit.mutate(u)} className="h-9 min-w-[44px] rounded-full px-3 text-[14px] font-bold"
                style={unit === u ? { background: "#FFFFFF", color: PURPLE, boxShadow: "0 1px 2px rgba(20,18,24,.08)" } : { color: "#8A8580" }}>{u}</button>
            ))}
          </div>
        </div>
        <Row icon={p(Zap)} title="Subscription" subtitle="Your membership and billing" onClick={() => navigate({ to: "/plan" })} />
      </Section>

      <Section label="APP VERSION">
        <Row icon={tile(<Undo2 size={18} style={{ color: MUTED }} />, GRAY_SOFT)} title="Switch to classic Pactara" subtitle="The app before the redesign. Your data stays." onClick={() => setShowSwitch(true)} />
      </Section>

      <Section label="HELP">
        <Row icon={p(CircleHelp)} title="How Pactara works" subtitle="A quick guide to the app" onClick={() => setShowGuide(true)} />
        <Row icon={p(Sparkles)} title="What's new" subtitle="The latest in Pactara" onClick={() => setShowWhatsNew(true)} />
        <Row icon={p(Shield)} title="Community guidelines" subtitle="How we keep Pactara safe and kind" onClick={() => navigate({ to: "/support" })} />
        <Row icon={tile(<LogOut size={18} style={{ color: MUTED }} />, GRAY_SOFT)} title="Sign out" onClick={signOut} noChevron />
      </Section>

      <Section label="ABOUT">
        <a href="https://repdb.co" target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 py-3 text-left">
          {p(Info)}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold" style={{ color: "#1C1917" }}>Exercise data by RepDB</span>
            <span className="block text-[13px]" style={{ color: MUTED }}>repdb.co</span>
          </span>
          <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} />
        </a>
      </Section>

      <Section label="DANGER ZONE">
        {err && <div className="my-2 rounded-xl bg-red-100 px-3 py-2 text-[13px] text-red-800">{err}</div>}
        {!confirmDelete ? (
          <button onClick={() => { setErr(null); setConfirmDelete(true); }} className="flex w-full items-center gap-3 py-3 text-left">
            {tile(<Trash2 size={18} style={{ color: "#DC2626" }} />, "#FEE2E2")}
            <span className="flex-1 text-[15px] font-bold" style={{ color: "#DC2626" }}>Delete account</span>
            <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} />
          </button>
        ) : (
          <div className="space-y-3 py-3">
            <div className="text-[14px] font-semibold text-red-600">Permanently delete your account? This can't be undone.</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} disabled={deleteAccount.isPending} className="flex-1 rounded-full bg-neutral-200 py-3 text-[15px] font-semibold text-neutral-800">Cancel</button>
              <button onClick={() => deleteAccount.mutate()} disabled={deleteAccount.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 py-3 text-[15px] font-semibold text-white disabled:opacity-60">
                {deleteAccount.isPending && <Loader2 size={16} className="animate-spin" />}Yes, delete
              </button>
            </div>
          </div>
        )}
      </Section>

      <p className="px-6 pt-5 text-center text-[12px]" style={{ color: MUTED }}>Saved, privacy, comments and blocked people are in the ☰ menu on your profile.</p>

      {showGuide && <OnboardingSheet firstName="" onClose={() => setShowGuide(false)} />}
      <SwitchToClassicSheet open={showSwitch} onOpenChange={setShowSwitch} />
      {showWhatsNew && <WhatsNewScreen onClose={() => setShowWhatsNew(false)} />}
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <section>
      <div className="text-[13px]" style={{ fontWeight: 800, color: MUTED, letterSpacing: "0.6px", padding: "18px 16px 8px" }}>{label}</div>
      <div className="bg-white" style={{ borderRadius: 20, margin: "0 16px", padding: "2px 16px" }}>
        {items.map((c, i) => <div key={i} style={i ? { borderTop: "1px solid #F0EDE9" } : undefined}>{c}</div>)}
      </div>
    </section>
  );
}

function Row({ icon, title, subtitle, onClick, trailing, noChevron }: { icon: ReactNode; title: string; subtitle?: string; onClick: () => void; trailing?: ReactNode; noChevron?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold" style={{ color: "#1C1917" }}>{title}</span>
        {subtitle && <span className="block text-[13px]" style={{ color: MUTED }}>{subtitle}</span>}
      </span>
      {trailing}
      {!noChevron && <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} />}
    </button>
  );
}
