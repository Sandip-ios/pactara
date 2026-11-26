import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { Home, Compass, Users, Plus, Zap, Camera, Dumbbell, CalendarDays, Utensils, ChevronRight } from "lucide-react";
import { getMyGroupStatus } from "@/lib/groups.functions";
import { checkInSkipsStartScreen, getActiveWorkout, markCameraDirect } from "@/lib/active-workout";
import { useToastAbove } from "@/lib/toast-offset";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

const ACTIVE = "#6D28D9";
const INACTIVE = "#57534E";
const PURPLE = "#7C3AED";

/** Redesign bottom nav. Classic members keep BottomTabs untouched. */
export function NewBottomTabs() {
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [createOpen, setCreateOpen] = useState(false);
  const { data: status } = useQuery({ queryKey: ["my-group-status"], queryFn: () => getMyGroupStatus(), staleTime: 60_000 });
  const navRef = useRef<HTMLElement>(null);
  useToastAbove(navRef);
  const initial = (status?.firstName || "U").slice(0, 1).toUpperCase();
  const isProfile = pathname === "/profile";
  const onHome = pathname === "/home" || pathname.startsWith("/home/");
  const onGroups = pathname.startsWith("/groups") || pathname.startsWith("/plans") || pathname.startsWith("/find-plan");
  const onCrews = pathname === "/crews" || pathname.startsWith("/crews/");
  const preload = (to: string) => () => { router.preloadRoute({ to }).catch(() => {}); };

  const checkIn = () => {
    setCreateOpen(false);
    // Same as the classic Check In tab.
    if (getActiveWorkout()) return navigate({ to: "/workout/log" });
    const direct = checkInSkipsStartScreen();
    markCameraDirect(direct);
    navigate({ to: direct ? "/check-in" : "/workout" });
  };
  const crewName = status?.group?.name ?? "your crew";

  return (
    <>
      <nav
        ref={navRef}
        data-bottom-tabs
        className="fixed bottom-0 left-0 right-0 z-[60] w-full bg-white px-2 pt-2 grid grid-cols-5 items-end"
        style={{ transform: "translateZ(0)", paddingBottom: "1.5rem", borderTop: "1px solid #E7E3DE", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <Tab icon={<Home size={22} />} label="Home" active={onHome} onPointerDown={preload("/home")} onClick={() => navigate({ to: "/home" })} />
        {/* Discover gets its own screen in phase 4. */}
        <Tab icon={<Compass size={22} />} label="Discover" active={onGroups} onPointerDown={preload("/groups")} onClick={() => navigate({ to: "/groups" })} />
        <button aria-label="Create" onClick={() => setCreateOpen(true)} className="flex items-center justify-center self-center">
          <span className="flex items-center justify-center" style={{ width: 52, height: 40, borderRadius: 14, background: PURPLE }}>
            <Plus size={22} color="#FFFFFF" />
          </span>
        </button>
        <Tab icon={<Users size={22} />} label="Crews" active={onCrews} onPointerDown={preload("/crews")} onClick={() => navigate({ to: "/crews" })} />
        <button onPointerDown={preload("/profile")} onClick={() => navigate({ to: "/profile" })} aria-label="Profile" aria-current={isProfile ? "page" : undefined} className="flex flex-col items-center" style={{ gap: 4 }}>
          <span className="flex items-center justify-center overflow-hidden rounded-full text-[11px] font-bold" style={{ width: 24, height: 24, background: PURPLE, color: "#FFFFFF", boxShadow: isProfile ? `0 0 0 2px ${ACTIVE}` : undefined }}>
            {status?.avatarUrl ? <img src={status.avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
          </span>
          <span className="text-[11px]" style={{ color: isProfile ? ACTIVE : INACTIVE, fontWeight: isProfile ? 700 : 500 }}>Profile</span>
        </button>
      </nav>
      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <DrawerContent className="border-0 bg-white pb-[max(16px,env(safe-area-inset-bottom))]" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
          <DrawerTitle className="px-4 pt-4 pb-2 text-[17px] font-bold" style={{ color: "#1C1917" }}>Create</DrawerTitle>
          <DrawerDescription className="sr-only">Pick what to create</DrawerDescription>
          <div className="px-2 pb-2">
            <CreateRow icon={<Zap size={20} />} title={`Check in to ${crewName}`} subtitle="5 seconds, live camera. Keeps your streak." onClick={checkIn} tileBg={PURPLE} tileFg="#FFFFFF" />
            <CreateRow icon={<Camera size={20} />} title="New post" subtitle="Photo or video, with a workout or meal if you want" soon />
            <CreateRow icon={<Dumbbell size={20} />} title="Build a workout" subtitle="One session people can save and do" soon />
            <CreateRow icon={<CalendarDays size={20} />} title="Build a plan" subtitle="A few weeks of your workouts, day by day" soon />
            <CreateRow icon={<Utensils size={20} />} title="Add a meal" subtitle="Breakfast, lunch, dinner or supplements" soon tileBg="#FFEDE0" tileFg="#EA580C" />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function Tab({ icon, label, active, onClick, onPointerDown }: { icon: ReactNode; label: string; active: boolean; onClick: () => void; onPointerDown: () => void }) {
  return (
    <button onPointerDown={onPointerDown} onClick={onClick} aria-current={active ? "page" : undefined} className="flex flex-col items-center" style={{ gap: 4, color: active ? ACTIVE : INACTIVE }}>
      {icon}
      <span className="text-[11px]" style={{ fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

function CreateRow({ icon, title, subtitle, onClick, soon, tileBg = "#EDE4FF", tileFg = PURPLE }: { icon: ReactNode; title: string; subtitle: string; onClick?: () => void; soon?: boolean; tileBg?: string; tileFg?: string }) {
  return (
    <button type="button" disabled={soon} onClick={onClick} className="w-full flex items-center gap-3 rounded-2xl px-2 py-3 text-left" style={{ opacity: soon ? 0.5 : 1 }}>
      <span className="flex shrink-0 items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, background: tileBg, color: tileFg }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold" style={{ color: "#1C1917" }}>{title}</span>
        <span className="block text-[13px]" style={{ color: "#57534E" }}>{subtitle}</span>
      </span>
      {soon ? (
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#F4F2EF", color: "#78716C" }}>Soon</span>
      ) : (
        <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} />
      )}
    </button>
  );
}
