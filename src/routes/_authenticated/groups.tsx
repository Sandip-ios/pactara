import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Home,
  Users,
  Zap,
  MessageCircle,
  User as UserIcon,
  Plus,
  Link as LinkIcon,
  MoreHorizontal,
  Copy,
  UserPlus,
  Check,
  SlidersHorizontal,
  Pencil,
  Trash2,
  CalendarDays,
  Flame,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyGroups, renameGroup } from "@/lib/groups.functions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const PURPLE_SOFT = "#F3EEFF";
const PURPLE_TINT = "#FDF4F5";
const BG = "#F5F2EE";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
});

type GroupItem = {
  id: string;
  name: string;
  emoji: string;
  isAdmin: boolean;
  memberCount: number;
};

function GroupsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
  });

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");

  if (isLoading || !data) {
    return <div className="min-h-[100dvh] w-full" style={{ background: BG }} />;
  }

  const groups = data.groups;
  const count = groups.length;

  return (
    <div
      className="min-h-[100dvh] w-full pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: "#0A0A0A" }}
    >
      <header className="bg-white px-6 pt-5 pb-6">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span>
          <span>actara</span>
        </div>
      </header>

      <div className="px-6 pt-5 text-[14px] text-neutral-500">
        {count} {count === 1 ? "group" : "groups"} · Free trial
      </div>

      {/* Action cards */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-3">
        <button
          className="rounded-2xl p-4 text-left text-white min-h-[140px] flex flex-col justify-between"
          style={{
            background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
            boxShadow: "0 14px 30px -16px rgba(124, 58, 237, 0.55)",
          }}
        >
          <span className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Plus size={20} />
          </span>
          <div>
            <div className="text-[16px] font-bold leading-tight">Start a new Pactara</div>
            <div className="text-[12px] text-white/80 mt-1">New group, new commitment</div>
          </div>
        </button>

        <button
          onClick={() => setJoinOpen((v) => !v)}
          className="rounded-2xl p-4 text-left min-h-[140px] flex flex-col justify-between bg-white"
          style={{
            border: joinOpen ? `1px solid ${PURPLE}` : "1px solid transparent",
            background: joinOpen ? PURPLE_SOFT : "#FFFFFF",
          }}
        >
          <span className="h-10 w-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-500">
            <LinkIcon size={18} />
          </span>
          <div>
            <div className="text-[16px] font-bold leading-tight">Join via link</div>
            <div className="text-[12px] text-neutral-500 mt-1">Paste an invite URL</div>
          </div>
        </button>
      </div>

      {/* Join input — appears when Join via link is tapped */}
      {joinOpen && (
        <div className="px-4 mt-3 flex gap-2">
          <input
            value={joinUrl}
            onChange={(e) => setJoinUrl(e.target.value)}
            placeholder="https://pactara.app/join/..."
            className="flex-1 rounded-2xl bg-white px-4 py-3 text-[15px] outline-none placeholder:text-neutral-400 border border-neutral-200 focus:border-purple-300"
          />
          <button
            disabled={!joinUrl.trim()}
            className="px-5 rounded-2xl text-white text-[15px] font-semibold disabled:opacity-50"
            style={{ background: PURPLE }}
          >
            Join
          </button>
        </div>
      )}

      {/* Groups list */}
      <div className="mt-4 space-y-4">
        {groups.length === 0 && <EmptyGroups />}
        {groups.map((g) => (
          <GroupCard key={g.id} group={g} avatarColor={data.avatarColor} firstName={data.firstName} />
        ))}
      </div>

      {/* Subscription banner */}
      <div className="mx-4 mt-4 rounded-2xl p-5 flex items-center gap-4" style={{ background: "#EAE4DC" }}>
        <div className="flex-1">
          <div className="text-[16px] font-bold">Keep your streak going</div>
          <div className="text-[13px] text-neutral-600 mt-1 leading-snug">
            After your 7-day trial, subscribe to keep checking in — $9.99/month.
          </div>
        </div>
        <button
          className="px-5 py-2.5 rounded-full text-white text-[14px] font-semibold whitespace-nowrap"
          style={{ background: PURPLE }}
        >
          Subscribe
        </button>
      </div>

      <BottomTabs />
    </div>
  );
}

function GroupCard({
  group,
  avatarColor,
  firstName,
}: {
  group: GroupItem;
  avatarColor: string;
  firstName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const inviteLink =
    typeof window !== "undefined" ? `${window.location.origin}/join/${group.id}` : "";

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleInvite = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `Join my ${group.name}`,
          text: `Join me on Pactara — we're keeping each other accountable.`,
          url: inviteLink,
        });
        return;
      } catch {
        // fall through to copy
      }
    }
    handleCopy();
  };

  // Presentation-only: commitment metadata isn't stored yet
  const duration = "30d · daily";
  const daysLeft = 29;
  const initials = (firstName || "U").slice(0, 1).toUpperCase();

  return (
    <div className="mx-4 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div
        className="relative px-5 pt-5 pb-4"
        style={{ background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
      >
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Group menu"
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/15 flex items-center justify-center text-white"
            >
              <MoreHorizontal size={18} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-56 rounded-2xl p-1 border-0 shadow-xl"
          >
            <MenuButton icon={<Pencil size={18} style={{ color: PURPLE }} />} label="Rename group" />
            <Divider />
            <MenuButton
              icon={<SlidersHorizontal size={18} style={{ color: PURPLE }} />}
              label="Edit commitment"
            />
            <Divider />
            <MenuButton
              icon={<Trash2 size={18} className="text-red-500" />}
              label="Delete group"
              danger
            />
          </PopoverContent>
        </Popover>

        <div className="min-h-[88px] flex items-end gap-3">
          <span className="text-[28px] leading-none">{group.emoji || "🔥"}</span>
          <div className="flex-1">
            <div className="text-white text-[22px] font-bold leading-tight">{group.name}</div>
            <div className="text-white/80 text-[13px] mt-0.5">Lose weight</div>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/15 text-white text-[12px] font-medium px-2.5 py-1 rounded-full">
          <SlidersHorizontal size={12} />
          {duration}
        </div>
      </div>

      {/* Member rows */}
      <div className="divide-y divide-neutral-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <Avatar color={avatarColor} initials={initials} />
          <div className="flex-1 text-[14px] text-neutral-600">
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[12px] font-semibold" style={{ color: PURPLE }}>
            <CalendarDays size={12} />
            {daysLeft}d left
          </div>
          <div className="flex items-center gap-1 ml-2 text-[14px] font-semibold" style={{ color: PURPLE }}>
            <Flame size={16} className="text-orange-500" />
            0
          </div>
        </div>

        <div className="px-4 py-3 flex items-center gap-3">
          <Avatar color={avatarColor} initials={initials} />
          <div className="flex-1">
            <div className="text-[15px] font-bold leading-tight">You</div>
            <div className="text-[12px] text-neutral-500">{group.isAdmin ? "Admin" : "Member"}</div>
          </div>
          <div className="flex items-center gap-1 text-[14px] font-semibold" style={{ color: PURPLE }}>
            <Flame size={16} className="text-orange-500" />
            0
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pt-2 pb-3 grid grid-cols-2 gap-2">
        <button
          onClick={handleCopy}
          className="rounded-full py-3 flex items-center justify-center gap-2 text-[14px] font-semibold"
          style={{ background: PURPLE_SOFT, color: PURPLE }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          onClick={handleInvite}
          className="rounded-full py-3 flex items-center justify-center gap-2 text-[14px] font-semibold text-white"
          style={{ background: PURPLE }}
        >
          <UserPlus size={16} />
          Invite people
        </button>
      </div>
    </div>
  );
}

function Avatar({ color, initials }: { color: string; initials: string }) {
  return (
    <div
      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-[14px]"
      style={{ background: color }}
    >
      {initials}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-neutral-50"
      style={{ color: danger ? "#DC2626" : "#0A0A0A" }}
    >
      {icon}
      <span className="text-[15px] font-semibold">{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-neutral-100 mx-3" />;
}

function EmptyGroups() {
  return (
    <div className="mx-4 rounded-2xl bg-white p-8 text-center">
      <div className="text-[16px] font-bold">No groups yet</div>
      <div className="text-[13px] text-neutral-500 mt-1">
        Start a new Pactara or join via an invite link.
      </div>
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
    <nav className="fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-neutral-200 px-2 pt-2 pb-6 grid grid-cols-5 items-end">
      <TabItem icon={<Home size={22} />} label="Home" onClick={() => navigate({ to: "/home" })} />
      <TabItem icon={<Users size={22} />} label="Groups" active />
      <button className="flex flex-col items-center gap-1 -mt-6">
        <span
          className="h-14 w-14 rounded-full flex items-center justify-center text-white"
          style={{ background: PURPLE }}
        >
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
