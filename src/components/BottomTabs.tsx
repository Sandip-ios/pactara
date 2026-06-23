import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Users, Zap, MessageCircle } from "lucide-react";
import { getMyGroupStatus } from "@/lib/groups.functions";


const PURPLE = "#7C3AED";
const AVATAR_BG = "#22C55E";

export function BottomTabs() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: status } = useQuery({
    queryKey: ["my-group-status"],
    queryFn: () => getMyGroupStatus(),
    staleTime: 60_000,
  });
  const initial = (status?.firstName || "U").slice(0, 1).toUpperCase();
  const isProfile = pathname === "/profile";



  const isActive = (path: string) =>
    path === "/home" ? pathname === "/home" || pathname === "/invite" : pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-neutral-200 px-2 pt-2 pb-6 grid grid-cols-5 items-end">
      <TabItem
        icon={<Home size={22} />}
        label="Home"
        active={isActive("/home")}
        onClick={() => navigate({ to: "/home" })}
      />
      <TabItem
        icon={<Users size={22} />}
        label="Groups"
        active={isActive("/groups")}
        onClick={() => navigate({ to: "/groups" })}
      />
      <button
        onClick={() => navigate({ to: "/check-in" })}
        className="flex flex-col items-center gap-1 -mt-6"
      >
        <span
          className="h-14 w-14 rounded-full flex items-center justify-center text-white"
          style={{ background: PURPLE }}
        >
          <Zap size={24} />
        </span>
        <span className="text-[11px] font-medium">Check In</span>
      </button>
      <TabItem icon={<MessageCircle size={22} />} label="Chat" active={isActive("/chat")} />
      <button
        onClick={() => navigate({ to: "/profile" })}
        className="flex flex-col items-center gap-1"
        aria-label="Profile"
      >
        <span
          className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
          style={{ background: isProfile ? PURPLE : AVATAR_BG }}
        >
          {initial}
        </span>
        <span className="text-[11px] font-medium" style={{ color: isProfile ? PURPLE : "#A3A3A3" }}>Profile</span>
      </button>
    </nav>
  );
}

function TabItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1"
      style={{ color: active ? PURPLE : "#A3A3A3" }}
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
