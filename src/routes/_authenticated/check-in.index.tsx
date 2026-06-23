import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Users, Zap, MessageCircle, User as UserIcon, ArrowRight, Check } from "lucide-react";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";

export const MOODS = [
  { id: "crushed", emoji: "🚀", label: "Crushed it", sub: "Absolutely nailed it", color: "#16A34A", bg: "#E8F7EE", ring: "#16A34A" },
  { id: "showed", emoji: "💪", label: "Showed up", sub: "Showed up and did the work", color: PURPLE, bg: "#EFE9FB", ring: PURPLE },
  { id: "struggled", emoji: "😤", label: "Struggled", sub: "Tough day, but still here", color: "#F59E0B", bg: "#FDF1DD", ring: "#F59E0B" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

export const Route = createFileRoute("/_authenticated/check-in/")({
  component: CheckInMood,
});

function CheckInMood() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<MoodId | null>(null);
  const mood = MOODS.find((m) => m.id === selected);

  const onContinue = () => {
    if (!selected) return;
    sessionStorage.setItem("checkin-mood", selected);
    sessionStorage.removeItem("checkin-photo");
    navigate({ to: "/check-in/camera" });
  };

  return (
    <div className="min-h-[100dvh] w-full pb-40" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="px-6 pt-10">
        <h1 className="text-[34px] font-black leading-tight tracking-tight">Let's check you in</h1>
        <p className="text-neutral-500 text-[15px] mt-1">How did today go?</p>
      </div>

      <div className="px-4 mt-8 space-y-3">
        {MOODS.map((m) => {
          const active = selected === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className="w-full rounded-2xl p-4 flex items-center gap-4 text-left transition"
              style={{
                background: active ? m.bg : "#FFFFFF",
                boxShadow: active ? `0 0 0 2px ${m.ring}` : "none",
              }}
            >
              <span className="text-[32px] leading-none">{m.emoji}</span>
              <span className="flex-1">
                <span className="block text-[18px] font-bold" style={{ color: active ? m.color : "#0A0A0A" }}>
                  {m.label}
                </span>
                <span className="block text-[14px] text-neutral-500">{m.sub}</span>
              </span>
              {active && (
                <span className="h-7 w-7 rounded-full flex items-center justify-center text-white" style={{ background: m.color }}>
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="fixed inset-x-0 px-4 z-50" style={{ bottom: "calc(env(safe-area-inset-bottom) + 140px)" }}>
        <button
          onClick={onContinue}
          disabled={!selected}
          className="w-full rounded-2xl py-4 text-white text-[16px] font-semibold flex items-center justify-center gap-2 disabled:text-neutral-500"
          style={{
            background: selected ? PURPLE : "#D9D6D1",
            boxShadow: selected ? `0 12px 30px -10px ${mood?.color ?? PURPLE}80` : "none",
          }}
        >
          Continue <ArrowRight size={18} />
        </button>
      </div>

      <BottomTabs />
    </div>
  );
}

function BottomTabs() {
  const navigate = useNavigate();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-neutral-200 px-2 pt-2 pb-6 grid grid-cols-5 items-end">
      <TabItem icon={<Home size={22} />} label="Home" onClick={() => navigate({ to: "/home" })} />
      <TabItem icon={<Users size={22} />} label="Groups" onClick={() => navigate({ to: "/groups" })} />
      <button className="flex flex-col items-center gap-1 -mt-6">
        <span className="h-14 w-14 rounded-full flex items-center justify-center text-white" style={{ background: PURPLE }}>
          <Zap size={24} />
        </span>
        <span className="text-[11px] font-medium" style={{ color: PURPLE }}>Check In</span>
      </button>
      <TabItem icon={<MessageCircle size={22} />} label="Chat" />
      <TabItem icon={<UserIcon size={22} />} label="Profile" badge />
    </nav>
  );
}

function TabItem({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick?: () => void; badge?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 text-neutral-400">
      {badge ? (
        <span className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: PURPLE }}>J</span>
      ) : icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
