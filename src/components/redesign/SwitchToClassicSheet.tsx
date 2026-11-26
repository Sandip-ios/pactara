import { useState } from "react";
import { Check, EyeOff } from "lucide-react";
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
          <div className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0" style={{ color: "#15803D" }} />Your crews, streaks, check-ins and workouts stay exactly the same.</div>
          <div className="flex gap-2"><EyeOff size={16} className="mt-0.5 shrink-0" style={{ color: "#57534E" }} />Classic doesn't have the feed, Discover or plans from creators. Your posts and plans are kept for when you come back.</div>
        </div>
        <div className="mt-5 text-[14px] font-bold" style={{ color: "#1C1917" }}>What made you switch? (optional)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {REASONS.map((r) => {
            const on = reason === r;
            return (
              <button key={r} type="button" aria-pressed={on} onClick={() => setReason(on ? null : r)} className="rounded-full px-3 text-[13px] font-semibold" style={{ minHeight: 36, background: on ? "#EDE4FF" : "#FFFFFF", color: on ? "#6D28D9" : "#1C1917", border: on ? `1px solid ${PURPLE}` : "1px solid #E7E3DE" }}>{r}</button>
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
      <div className="overflow-hidden" style={{ borderRadius: 10, background: "#F4F2EF" }}>{preview}</div>
      <div className="mt-2 px-1 text-[15px] font-bold" style={{ color: "#1C1917" }}>{title}</div>
      <div className="px-1 pb-1 text-[12px]" style={{ color: "#57534E" }}>{sub}</div>
    </div>
  );
}

function NewPreview() {
  return (
    <svg viewBox="0 0 120 80" className="block w-full" aria-hidden>
      <defs>
        <linearGradient id="new-preview-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1C1917" />
          <stop offset="1" stopColor="#44403C" />
        </linearGradient>
      </defs>
      <rect x="10" y="5" width="100" height="70" rx="7" fill="#F4F2EF" />
      <rect x="15" y="10" width="25" height="4" rx="2" fill="#1C1917" />
      <rect x="15" y="18" width="90" height="14" rx="4" fill="#FFFFFF" />
      <rect x="15" y="36" width="90" height="25" rx="6" fill="url(#new-preview-card)" />
      <circle cx="36" cy="69" r="2.5" fill="#A8A29E" />
      <circle cx="46" cy="69" r="2.5" fill="#A8A29E" />
      <rect x="54" y="66" width="24" height="6" rx="3" fill="#7C3AED" />
      <circle cx="86" cy="69" r="2.5" fill="#A8A29E" />
      <circle cx="96" cy="69" r="2.5" fill="#A8A29E" />
    </svg>
  );
}
function ClassicPreview() {
  return (
    <svg viewBox="0 0 120 80" className="block w-full" aria-hidden>
      <rect x="10" y="5" width="100" height="70" rx="7" fill="#F4F2EF" />
      <rect x="15" y="10" width="90" height="14" rx="5" fill="#7C3AED" />
      <rect x="15" y="30" width="90" height="16" rx="5" fill="#FFFFFF" />
      <rect x="15" y="52" width="90" height="11" rx="4" fill="#FFFFFF" />
      <rect x="15" y="69" width="90" height="5" rx="2.5" fill="#FFFFFF" />

    </svg>
  );
}
