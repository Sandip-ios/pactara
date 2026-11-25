import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Newspaper, CalendarDays, Compass, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { APP_PREFS_KEY } from "@/hooks/use-app-version";

/** Full-screen intro shown the first time someone lands in the new version. */
export function WhatsNewScreen({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      await supabase.from("profiles").update({ new_version_seen_at: new Date().toISOString() }).eq("id", auth.user.id);
    }
    await qc.invalidateQueries({ queryKey: APP_PREFS_KEY });
    setBusy(false);
    onClose?.();
    navigate({ to: "/home" });
  };
  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-white px-6 pt-[max(48px,calc(env(safe-area-inset-top)+24px))] pb-[max(16px,env(safe-area-inset-bottom))]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="text-[12px] font-extrabold tracking-[0.6px]" style={{ color: "#7C3AED" }}>WHAT'S NEW</div>
      <h1 className="mt-2 text-[30px] leading-tight" style={{ fontWeight: 800, color: "#1C1917" }}>Pactara has a new look</h1>
      <p className="mt-2 text-[15px]" style={{ color: "#57534E" }}>Your crews, streaks and check-ins didn't change. Here's what's new.</p>
      <div className="mt-8 flex flex-col gap-5">
        <Item icon={<Newspaper size={20} />} bg="#EDE4FF" fg="#7C3AED" title="A feed" line="Follow people and save the workouts and meals they post." />
        <Item icon={<CalendarDays size={20} />} bg="#DCFCE7" fg="#15803D" title="Plans from anyone" line="Start a plan, or build your own from your workouts." />
        <Item icon={<Compass size={20} />} bg="#E0F2FE" fg="#0369A1" title="Discover" line="Find posts, workouts and plans from people you don't follow yet." />
        <Item icon={<Users size={20} />} bg="#FEF3C7" fg="#B45309" title="Your crew, front and center" line="Check in from the Today card on Home." />
      </div>
      <div className="mt-auto pt-8">
        <button onClick={go} disabled={busy} className="w-full text-[16px] font-bold text-white disabled:opacity-60" style={{ height: 52, borderRadius: 26, background: "#7C3AED" }}>Let's go</button>
        <p className="mt-3 text-center text-[12px]" style={{ color: "#57534E" }}>Prefer the old app? Switch back any time in Settings › App version.</p>
      </div>
    </div>
  );
}

function Item({ icon, bg, fg, title, line }: { icon: ReactNode; bg: string; fg: string; title: string; line: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex shrink-0 items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, background: bg, color: fg }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[15px] font-bold" style={{ color: "#1C1917" }}>{title}</div>
        <div className="text-[14px]" style={{ color: "#57534E" }}>{line}</div>
      </div>
    </div>
  );
}
