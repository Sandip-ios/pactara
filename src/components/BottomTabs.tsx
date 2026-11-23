import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Home, Compass, Zap } from "lucide-react";
import { getMyGroupStatus } from "@/lib/groups.functions";
import { checkInSkipsStartScreen, getActiveWorkout, markCameraDirect } from "@/lib/active-workout";
import { useToastAbove } from "@/lib/toast-offset";

const PURPLE = "#6D28D9";
const AVATAR_BG = "#7C3AED";

/** Simple dumbbell for the Workouts tab. */
function DumbbellIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.5 7v10" />
      <path d="M17.5 7v10" />
      <path d="M3.5 9.5v5" />
      <path d="M20.5 9.5v5" />
      <path d="M6.5 12h11" />
    </svg>
  );
}

export function BottomTabs() {
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: status } = useQuery({
    queryKey: ["my-group-status"],
    queryFn: () => getMyGroupStatus(),
    staleTime: 60_000,
  });
  const navRef = useRef<HTMLElement>(null);
  useToastAbove(navRef);
  const initial = (status?.firstName || "U").slice(0, 1).toUpperCase();
  const isProfile = pathname === "/profile";



  const isActive = (path: string) =>
    path === "/home" || path === "/workout" ? pathname === path || pathname.startsWith(`${path}/`) : pathname.startsWith(path);

  // Warm every tab's code so switching is instant, not a chunk download.
  useEffect(() => {
    const warm = () => {
      for (const to of ["/home", "/groups", "/workout", "/check-in", "/workouts", "/profile"]) {
        router.preloadRoute({ to }).catch(() => {});
      }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(warm);
    else setTimeout(warm, 500);
  }, [router]);

  const preload = (to: string) => () => {
    router.preloadRoute({ to }).catch(() => {});
  };

  return (
    <nav
      ref={navRef}
      data-bottom-tabs
      className="fixed bottom-0 left-0 right-0 z-[60] w-full bg-white border-t border-neutral-200 px-2 pt-2 grid grid-cols-5 items-end"
      style={{ transform: "translateZ(0)", paddingBottom: "1.5rem" }}
    >

      <TabItem
        icon={<Home size={22} />}
        label="Home"
        active={isActive("/home")}
        onPointerDown={preload("/home")}
        onClick={() => navigate({ to: "/home" })}
      />
      <TabItem
        icon={<Compass size={22} />}
        label="Discover"
        active={isActive("/groups") || isActive("/plans")}
        onPointerDown={preload("/groups")}
        onClick={() => navigate({ to: "/groups" })}
      />
      <TabItem
        icon={<Zap size={22} />}
        label="Check In"
        active={isActive("/check-in") || isActive("/workout")}
        onPointerDown={preload("/workout")}
        onClick={() => {
          // A workout in progress resumes; video-only regulars go straight to the camera.
          if (getActiveWorkout()) return navigate({ to: "/workout/log" });
          const direct = checkInSkipsStartScreen();
          markCameraDirect(direct);
          navigate({ to: direct ? "/check-in" : "/workout" });
        }}
      />
      <TabItem
        icon={<DumbbellIcon size={22} />}
        label="Workouts"
        active={pathname === "/workouts"}
        onPointerDown={preload("/workouts")}
        onClick={() => navigate({ to: "/workouts" })}
      />
      <button
        onPointerDown={preload("/profile")}
        onClick={() => navigate({ to: "/profile" })}
        className="flex flex-col items-center gap-1"
        aria-label="Profile"
      >
        <span
          className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[13px] font-bold overflow-hidden"
          style={{ background: isProfile ? PURPLE : AVATAR_BG }}
        >
          {status?.avatarUrl ? (
            <img src={status.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
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
  onPointerDown,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  onPointerDown?: () => void;
}) {
  return (
    <button
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="flex flex-col items-center gap-1"
      style={{ color: active ? PURPLE : "#A3A3A3" }}
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
