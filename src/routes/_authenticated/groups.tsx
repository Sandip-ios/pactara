import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useState } from "react";
import {
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
  Mail,
  MessageCircle,
  Share2,
} from "lucide-react";
import { listMyGroups, renameGroup, updateGroupCommitment, deleteGroup } from "@/lib/groups.functions";
import { PullToRefresh } from "@/components/PullToRefresh";
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

type GroupMember = {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  isYou: boolean;
  isAdmin: boolean;
};

type GroupItem = {
  id: string;
  name: string;
  emoji: string;
  goal?: string | null;
  isAdmin: boolean;
  memberCount: number;
  members?: GroupMember[];
  createdAt?: string;
  durationDays?: number;
  startDate?: string | null;
  frequency?: "daily" | "weekly" | "specific";
  daysPerWeek?: number;
};

function GroupsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
  });

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");


  if (isLoading || !data) {
    return <div className="fixed inset-0 w-full overflow-hidden" style={{ background: BG }} />;
  }

  const groups = data.groups;
  const count = groups.length;

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28"
      style={{
        background: BG,
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#0A0A0A",
      }}
    >
      <header className="bg-white px-6 pt-5 pb-4">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span>
          <span>actara</span>
        </div>
      </header>
      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0];
              return k === "my-groups" || k === "my-group-status";
            },
          })
        }
      >


      <div className="px-6 pt-5 text-[14px] text-neutral-500">
        {count} {count === 1 ? "group" : "groups"} · Free trial
      </div>

      {/* Action cards */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate({ to: "/new-pactara" })}
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
            <div className="text-[16px] font-bold leading-tight">Start a new challenge</div>
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
            onClick={() => {
              const match = joinUrl.trim().match(/\/join\/([^/?#]+)/i);
              const id = match?.[1] ?? joinUrl.trim();
              if (!id) return;
              navigate({ to: "/join/$groupId", params: { groupId: id } });
            }}
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
          <GroupCard key={g.id} group={g} avatarColor={data.avatarColor} firstName={data.firstName} avatarUrl={data.avatarUrl ?? null} />
        ))}
      </div>


      </PullToRefresh>
    </div>
  );
}


function GroupCard({
  group,
  avatarColor,
  firstName,
  avatarUrl,
}: {
  group: GroupItem;
  avatarColor: string;
  firstName: string;
  avatarUrl: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const queryClient = useQueryClient();

  // Shared challenge timeframe stored on the group.
  const duration = group.durationDays ?? 30;
  const frequency: "daily" | "specific" =
    group.frequency === "specific" || group.frequency === "weekly" ? "specific" : "daily";
  const daysPerWeek = group.daysPerWeek ?? 7;

  const inviteLink = `https://pactara.lovable.app/join/${group.id}`;
  const shareText = `Join me on Pactara — we're keeping each other accountable.`;
  const shareTitle = `Join my ${group.name}`;

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

  const canUseNativeShare = () => {
    if (typeof navigator === "undefined" || !("share" in navigator)) return false;
    // Permissions-Policy in iframes (e.g. Lovable preview) blocks web-share.
    try {
      if (window.self !== window.top) return false;
    } catch {
      return false;
    }
    return true;
  };

  const handleInvite = async () => {
    if (canUseNativeShare()) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: inviteLink });
        return;
      } catch {
        // user cancelled or share failed — fall through to custom sheet
      }
    }
    setShareOpen(true);
  };

  // Shared countdown: derived from the group's start_date + duration_days,
  // so every member sees the same "days left" regardless of when they joined.
  const dayNumber = (() => {
    const startSource = group.startDate ?? group.createdAt;
    if (!startSource) return 1;
    const start = group.startDate
      ? new Date(`${group.startDate}T00:00:00`)
      : new Date(group.createdAt as string);
    const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.floor((todayLocal.getTime() - startLocal.getTime()) / 86400000);
    return Math.min(duration, Math.max(1, diff + 1));
  })();
  const daysLeft = Math.max(0, duration - dayNumber);
  const initials = (firstName || "U").slice(0, 1).toUpperCase();
  const summary = `${duration}d · ${frequency === "daily" ? "daily" : `${daysPerWeek}/wk`}`;

  return (
    <div className="mx-4 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div
        className="relative px-5 pt-5 pb-4"
        style={{ background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
      >
        {group.isAdmin && (
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
              <MenuButton
                icon={<Pencil size={18} style={{ color: PURPLE }} />}
                label="Rename group"
                onClick={() => {
                  setMenuOpen(false);
                  setRenameOpen(true);
                }}
              />
              <Divider />
              <MenuButton
                icon={<SlidersHorizontal size={18} style={{ color: PURPLE }} />}
                label="Edit commitment"
                onClick={() => {
                  setMenuOpen(false);
                  setCommitmentOpen(true);
                }}
              />
              <Divider />
              <MenuButton
                icon={<Trash2 size={18} className="text-red-500" />}
                label="Delete group"
                danger
              />
            </PopoverContent>
          </Popover>
        )}

        <div className="min-h-[88px] flex items-end gap-3">
          <span className="text-[28px] leading-none">{group.emoji || "🔥"}</span>
          <div className="flex-1">
            <div className="text-white text-[22px] font-bold leading-tight">{group.name}</div>
            {group.goal && (
              <div className="text-white/80 text-[13px] mt-0.5">{group.goal}</div>
            )}
          </div>
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/15 text-white text-[12px] font-medium px-2.5 py-1 rounded-full">
          <SlidersHorizontal size={12} />
          {summary}
        </div>
      </div>

      {/* Member rows */}
      <div className="divide-y divide-neutral-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1 text-[14px] text-neutral-600">
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[12px] font-semibold" style={{ color: PURPLE }}>
            <CalendarDays size={12} />
            {daysLeft}d left
          </div>
        </div>

        {(group.members ?? []).map((m) => (
          <div key={m.id} className="px-4 py-3 flex items-center gap-3">
            <Avatar
              color={m.avatarColor}
              initials={(m.name || "U").slice(0, 1).toUpperCase()}
              url={m.avatarUrl}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold leading-tight truncate">
                {m.isYou ? "You" : m.name}
              </div>
              <div className="text-[12px] text-neutral-500">
                {m.isAdmin ? "Admin" : "Member"}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[14px] font-semibold" style={{ color: PURPLE }}>
              <Flame size={16} className="text-orange-500" />
              0
            </div>
          </div>
        ))}
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

      <RenameGroupDrawer
        open={renameOpen}
        onOpenChange={setRenameOpen}
        groupId={group.id}
        currentName={group.name}
        emoji={group.emoji}
      />
      <EditCommitmentDrawer
        open={commitmentOpen}
        onOpenChange={setCommitmentOpen}
        duration={duration}
        frequency={frequency}
        daysPerWeek={daysPerWeek}
        onSave={async (d, f, dpw) => {
          try {
            await updateGroupCommitment({
              data: {
                groupId: group.id,
                durationDays: d,
                frequency: f === "specific" ? "specific" : "daily",
                daysPerWeek: dpw,
              },
            });
            await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
          } finally {
            setCommitmentOpen(false);
          }
        }}
      />
      <ShareInviteDrawer
        open={shareOpen}
        onOpenChange={setShareOpen}
        groupName={group.name}
        inviteLink={inviteLink}
        shareText={shareText}
        onCopy={handleCopy}
        copied={copied}
      />
    </div>
  );
}

function RenameGroupDrawer({
  open,
  onOpenChange,
  groupId,
  currentName,
  emoji,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  currentName: string;
  emoji: string;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await renameGroup({ data: { groupId, name: name.trim() } });
      await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      onOpenChange(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setName(currentName);
      }}
    >
      <DrawerContent className="px-6 pb-8 pt-2">
        <DrawerHeader className="px-0 pt-2">
          <DrawerTitle className="text-[22px] font-black tracking-tight">
            Rename group
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Update the name of your group
          </DrawerDescription>
        </DrawerHeader>

        <div
          className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-4"
          style={{ background: "#F4F1ED" }}
        >
          <span className="text-[22px] leading-none">{emoji || "🔥"}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="flex-1 bg-transparent text-[17px] font-semibold outline-none placeholder:text-neutral-400"
            autoFocus
          />
        </div>

        <div className="mt-6 grid grid-cols-[1fr_2fr] gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-2xl py-4 text-[15px] font-semibold bg-neutral-100 text-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="rounded-2xl py-4 text-white text-[15px] font-bold disabled:opacity-50"
            style={{
              background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
              boxShadow: "0 12px 24px -10px rgba(124, 58, 237, 0.55)",
            }}
          >
            {saving ? "Saving…" : "Save name"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function EditCommitmentDrawer({
  open,
  onOpenChange,
  duration,
  frequency,
  daysPerWeek,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  duration: number;
  frequency: "daily" | "specific";
  daysPerWeek: number;
  onSave: (duration: number, frequency: "daily" | "specific", daysPerWeek: number) => void;
}) {
  const [localDuration, setLocalDuration] = useState(duration);
  const [localFreq, setLocalFreq] = useState<"daily" | "specific">(frequency);
  const [localDaysPerWeek, setLocalDaysPerWeek] = useState(daysPerWeek);

  const presets = [30, 60, 90];

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setLocalDuration(duration);
          setLocalFreq(frequency);
          setLocalDaysPerWeek(daysPerWeek);
        }
      }}
    >
      <DrawerContent className="px-6 pb-8 pt-2">
        <div className="relative">
          <DrawerHeader className="px-0 pt-2 pr-12">
            <DrawerTitle className="text-[26px] font-black tracking-tight">
              Commitment
            </DrawerTitle>
            <DrawerDescription className="text-[14px] text-neutral-500">
              Set your group's duration and check-in schedule
            </DrawerDescription>
          </DrawerHeader>
          <button
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-0 h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4">
          <div className="text-[12px] font-bold tracking-[0.12em] text-neutral-400">
            DURATION
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {presets.map((d) => {
              const active = localDuration === d;
              return (
                <button
                  key={d}
                  onClick={() => setLocalDuration(d)}
                  className="rounded-2xl py-4 text-[16px] font-bold"
                  style={{
                    background: active ? PURPLE_TINT : "#F4F1ED",
                    border: active ? `1.5px solid ${PURPLE}` : "1.5px solid transparent",
                    color: active ? PURPLE : "#0A0A0A",
                  }}
                >
                  {d} days
                </button>
              );
            })}
          </div>
          <div
            className="mt-3 rounded-2xl px-5 py-4 flex items-center"
            style={{ background: "#F4F1ED" }}
          >
            <input
              type="number"
              min={1}
              max={365}
              value={localDuration}
              onChange={(e) => setLocalDuration(Math.max(1, Math.min(365, Number(e.target.value) || 0)))}
              className="flex-1 bg-transparent text-[18px] font-bold outline-none"
            />
            <span className="text-[14px] text-neutral-500">days</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-[12px] font-bold tracking-[0.12em] text-neutral-400">
            CHECK-IN FREQUENCY
          </div>
          <div className="mt-3 space-y-3">
            <FrequencyOption
              active={localFreq === "daily"}
              onClick={() => setLocalFreq("daily")}
              title="Every day"
              subtitle="Check in daily"
            />
            <FrequencyOption
              active={localFreq === "specific"}
              onClick={() => setLocalFreq("specific")}
              title="Specific days"
              subtitle="Choose days per week"
            />
          </div>
        </div>

        {localFreq === "specific" && (
          <div className="mt-5">
            <div className="text-[12px] font-bold tracking-[0.12em] text-neutral-400">
              DAYS PER WEEK
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const active = localDaysPerWeek === d;
                return (
                  <button
                    key={d}
                    onClick={() => setLocalDaysPerWeek(d)}
                    className="aspect-square rounded-xl text-[16px] font-bold flex items-center justify-center"
                    style={{
                      background: active ? PURPLE : "#F4F1ED",
                      color: active ? "#FFFFFF" : "#0A0A0A",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-neutral-100">
          <button
            onClick={() => onSave(localDuration, localFreq, localDaysPerWeek)}
            className="w-full rounded-2xl py-4 text-white text-[16px] font-bold"
            style={{
              background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
              boxShadow: "0 12px 24px -10px rgba(124, 58, 237, 0.55)",
            }}
          >
            Save commitment
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function FrequencyOption({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl px-5 py-4 flex items-center text-left"
      style={{
        background: active ? PURPLE_TINT : "#F4F1ED",
        border: active ? `1.5px solid ${PURPLE}` : "1.5px solid transparent",
      }}
    >
      <div className="flex-1">
        <div
          className="text-[16px] font-bold leading-tight"
          style={{ color: active ? PURPLE : "#0A0A0A" }}
        >
          {title}
        </div>
        <div className="text-[13px] text-neutral-500 mt-0.5">{subtitle}</div>
      </div>
      {active && (
        <span
          className="h-6 w-6 rounded-full flex items-center justify-center text-white"
          style={{ background: PURPLE }}
        >
          <Check size={14} />
        </span>
      )}
    </button>
  );
}

function Avatar({ color, initials, url }: { color: string; initials: string; url?: string | null }) {
  return (
    <div
      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-[14px] overflow-hidden"
      style={{ background: color }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
        Start a new challenge or join via an invite link.
      </div>
    </div>
  );
}

function ShareInviteDrawer({
  open,
  onOpenChange,
  groupName,
  inviteLink,
  shareText,
  onCopy,
  copied,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupName: string;
  inviteLink: string;
  shareText: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const fullMessage = `${shareText} ${inviteLink}`;
  const encoded = encodeURIComponent(fullMessage);
  const subject = encodeURIComponent(`Join my ${groupName} on Pactara`);

  const options: { label: string; icon: React.ReactNode; href?: string; onClick?: () => void }[] = [
    {
      label: copied ? "Copied!" : "Copy link",
      icon: copied ? <Check size={20} /> : <Copy size={20} />,
      onClick: onCopy,
    },
    {
      label: "Messages",
      icon: <MessageCircle size={20} />,
      href: `sms:&body=${encoded}`,
    },
    {
      label: "WhatsApp",
      icon: <Share2 size={20} />,
      href: `https://wa.me/?text=${encoded}`,
    },
    {
      label: "Email",
      icon: <Mail size={20} />,
      href: `mailto:?subject=${subject}&body=${encoded}`,
    },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-6 pb-8 pt-2">
        <DrawerHeader className="px-0 pt-2">
          <DrawerTitle className="text-[22px] font-black tracking-tight">
            Invite people
          </DrawerTitle>
          <DrawerDescription className="text-[14px] text-neutral-500">
            Share this link to invite friends to {groupName}.
          </DrawerDescription>
        </DrawerHeader>

        <div
          className="mt-2 rounded-2xl px-4 py-3 text-[13px] text-neutral-700 break-all"
          style={{ background: "#F4F1ED" }}
        >
          {inviteLink}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          {options.map((opt) => {
            const inner = (
              <>
                <span
                  className="h-14 w-14 rounded-2xl flex items-center justify-center"
                  style={{ background: PURPLE_SOFT, color: PURPLE }}
                >
                  {opt.icon}
                </span>
                <span className="text-[12px] font-semibold text-neutral-700 text-center leading-tight">
                  {opt.label}
                </span>
              </>
            );
            const className = "flex flex-col items-center gap-2";
            if (opt.href) {
              return (
                <a key={opt.label} href={opt.href} target="_blank" rel="noreferrer" className={className}>
                  {inner}
                </a>
              );
            }
            return (
              <button key={opt.label} onClick={opt.onClick} className={className}>
                {inner}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onOpenChange(false)}
          className="mt-6 w-full rounded-2xl py-4 text-[15px] font-semibold bg-neutral-100 text-neutral-700"
        >
          Close
        </button>
      </DrawerContent>
    </Drawer>
  );
}


