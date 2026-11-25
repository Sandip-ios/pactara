import { useState } from "react";
import { Check, Shield, Archive } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { nativePlatform } from "@/lib/native";
import { useSetAppVersion } from "@/hooks/use-app-version";

const PURPLE = "#7C3AED";
const REASONS = ["Too busy", "Hard to find things", "I just want my crew", "Something's broken"] as const;

export function SwitchToClassicSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setVersion = useSetAppVersion();

  const doSwitch = async () => {
    setBusy(true);
    setErr(null);
    try {
      await setVersion("classic");
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await supabase.from("app_events").insert({ user_id: auth.user.id, event: "switch_to_classic", platform: nativePlatform(), properties: reason ? { reason } : {} });
      }
      window.location.replace("/home");
    } catch {
      setErr("Couldn't switch. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-0 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))]" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
        <DrawerTitle className="pt-4 text-[20px] font-bold" style={{ color: "#1C1917" }}>Which Pactara do you want?</DrawerTitle>
        <DrawerDescription className="mt-1 text-[14px]" style={{ color: "#57534E" }}>You can switch back any time in Settings.</DrawerDescription>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <VersionCard title="New Pactara" sub="Feed, plans, creators" preview={<NewPreview />} />
          <VersionCard title="Classic" sub="Crews and check-ins" preview={<ClassicPreview />} selected />
        </div>
        <div className="mt-4 flex flex-col gap-3 text-[13px]" style={{ color: "#44403C" }}>
          <div className="flex gap-2"><Shield size={16} className="mt-0.5 shrink-0" style={{ color: "#15803D" }} />Your crews, streaks, check-ins and workouts stay exactly the same.</div>
          <div className="flex gap-2"><Archive size={16} className="mt-0.5 shrink-0" style={{ color: "#57534E" }} />Classic doesn't have the feed, Discover or plans from creators. Your posts and plans are kept for when you come back.</div>
        </div>
        <div className="mt-5 text-[14px] font-bold" style={{ color: "#1C1917" }}>What made you switch? (optional)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {REASONS.map((r) => {
            const on = reason === r;
            return (
              <button key={r} type="button" aria-pressed={on} onClick={() => setReason(on ? null : r)} className="rounded-full px-3 text-[13px] font-semibold" style={{ minHeight: 36, background: on ? "#EDE4FF" : "#F4F2EF", color: on ? "#6D28D9" : "#44403C", border: on ? `1px solid ${PURPLE}` : "1px solid transparent" }}>{r}</button>
            );
          })}
        </div>
        {err && <div className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-[13px] text-red-800">{err}</div>}
        <button onClick={doSwitch} disabled={busy} className="mt-5 w-full text-[16px] font-bold text-white disabled:opacity-60" style={{ height: 52, borderRadius: 26, background: PURPLE }}>Switch to classic</button>
      </DrawerContent>
    </Drawer>
  );
}

function VersionCard({ title, sub, preview, selected }: { title: string; sub: string; preview: React.ReactNode; selected?: boolean }) {
  return (
    <div className="relative p-2" style={{ borderRadius: 16, border: selected ? `2px solid ${PURPLE}` : "1px solid #E7E3DE" }}>
      {selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: PURPLE }}><Check size={14} color="#FFFFFF" strokeWidth={3} /></span>}
      <div className="overflow-hidden" style={{ borderRadius: 10, background: "#F5F2EE" }}>{preview}</div>
      <div className="mt-2 px-1 text-[15px] font-bold" style={{ color: "#1C1917" }}>{title}</div>
      <div className="px-1 pb-1 text-[12px]" style={{ color: "#57534E" }}>{sub}</div>
    </div>
  );
}

function NewPreview() {
  return (
    <svg viewBox="0 0 120 80" className="block w-full" aria-hidden>
      <rect x="10" y="8" width="100" height="40" rx="6" fill="#DDD6FE" />
      <circle cx="18" cy="56" r="4" fill="#A78BFA" />
      <rect x="26" y="53" width="50" height="6" rx="3" fill="#D6D3D1" />
      <rect x="10" y="66" width="100" height="10" rx="3" fill="#FFFFFF" />
      <rect x="54" y="67" width="12" height="8" rx="3" fill="#7C3AED" />
    </svg>
  );
}
function ClassicPreview() {
  return (
    <svg viewBox="0 0 120 80" className="block w-full" aria-hidden>
      <rect x="10" y="8" width="100" height="26" rx="6" fill="#FFFFFF" />
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={26 + i * 22} cy="21" r="7" fill={i < 2 ? "#7C3AED" : "#D6D3D1"} />)}
      <rect x="10" y="40" width="100" height="22" rx="6" fill="#FFFFFF" />
      <rect x="18" y="47" width="60" height="6" rx="3" fill="#D6D3D1" />
      <rect x="10" y="66" width="100" height="10" rx="3" fill="#FFFFFF" />
    </svg>
  );
}
