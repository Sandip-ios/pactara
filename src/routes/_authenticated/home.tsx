import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Home, Users, Zap, MessageCircle, User as UserIcon, MoreVertical, Share2, MessageSquare, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyGroupStatus } from "@/lib/groups.functions";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { data: status, isLoading } = useQuery({
    queryKey: ["my-group-status"],
    queryFn: () => getMyGroupStatus(),
  });

  useEffect(() => {
    if (status && (!status.hasGroup || status.memberCount <= 1)) {
      navigate({ to: "/invite", replace: true });
    }
  }, [status, navigate]);

  if (isLoading || !status) {
    return <div className="min-h-[100dvh] w-full" style={{ background: BG }} />;
  }
  const initials = (status.firstName || "U").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-[100dvh] w-full pb-24" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <header className="bg-white px-6 pt-14 pb-4">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span><span>actara</span>
        </div>
      </header>

      <div className="px-6 pt-4 flex items-center justify-between text-[13px]">
        <span className="font-semibold">Day 1 of 30</span>
        <span className="text-neutral-400">29d left</span>
      </div>

      <div className="mx-4 mt-3 rounded-2xl bg-white p-3 flex items-center gap-3 shadow-sm">
        <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#22C55E" }}>
          {initials}
        </div>
        <div className="flex-1 rounded-full bg-neutral-100 px-4 py-3 text-[15px] text-neutral-400">
          What's on your mind, {status.firstName}?
        </div>
        <button className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center" aria-label="Add photo">
          <ImageIcon size={20} className="text-green-600" />
        </button>
      </div>

      <div className="px-6 pt-6">
        <div className="text-[15px] font-bold">Waiting to check in <span className="text-neutral-400 font-normal">1</span></div>
      </div>

      <div className="px-4 mt-3">
        <div className="w-[160px] rounded-2xl bg-white border border-purple-100 p-4 flex flex-col items-center">
          <div className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: "#22C55E" }}>
            {initials}
          </div>
          <div className="mt-2 text-[15px] font-semibold">You</div>
          <button className="mt-3 w-full rounded-full py-2 text-white text-[14px] font-semibold" style={{ background: PURPLE }}>
            Check in
          </button>
        </div>
      </div>

      <div className="mx-4 mt-6 rounded-2xl bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#22C55E" }}>
            {initials}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold">{status.firstName} <span className="font-medium text-orange-600">joined {status.group?.name}</span></div>
            <div className="text-[12px] text-neutral-400">just now</div>
          </div>
          <MoreVertical size={18} className="text-neutral-400" />
        </div>
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="text-[14px] font-bold text-orange-700">{status.group?.emoji} {status.group?.name}</div>
          <div className="text-[13px] text-orange-700/80 mt-0.5">Day 1 — let's get started</div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
          <div className="flex items-center gap-2">
            {["🔥","💪","❤️","👏"].map(e => (
              <button key={e} className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-[15px]">{e}</button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 text-[13px] text-neutral-500"><Share2 size={14}/>Share</button>
        </div>
        <button className="mt-2 flex items-center gap-2 text-[13px] text-neutral-500"><MessageSquare size={14}/>Comment</button>
      </div>

      <BottomTabs />
    </div>
  );
}

function BottomTabs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 px-2 pt-2 pb-6 grid grid-cols-5 items-end">
      <TabItem icon={<Home size={22} />} label="Home" active />
      <TabItem icon={<Users size={22} />} label="Groups" />
      <button className="flex flex-col items-center gap-1 -mt-6">
        <span className="h-14 w-14 rounded-full flex items-center justify-center text-white" style={{ background: PURPLE }}>
          <Zap size={24} />
        </span>
        <span className="text-[11px] font-medium">Check In</span>
      </button>
      <TabItem icon={<MessageCircle size={22} />} label="Chat" />
      <button onClick={handleSignOut} className="flex flex-col items-center gap-1 text-neutral-400">
        <UserIcon size={22} />
        <span className="text-[11px] font-medium">Profile</span>
      </button>
    </nav>
  );
}

function TabItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className="flex flex-col items-center gap-1" style={{ color: active ? PURPLE : "#A3A3A3" }}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
