import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Copy,
  Check,
  UserPlus,
  SlidersHorizontal,
  Pencil,
  Trash2,
  X,
  Mail,
  MessageCircle,
  Share2,
} from "lucide-react";
import { renameGroup, updateGroupCommitment, deleteGroup } from "@/lib/groups.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

export const PURPLE = "#7C3AED";
export const PURPLE_DEEP = "#5B21B6";
export const PURPLE_SOFT = "#F3EEFF";
const PURPLE_TINT = "#FDF4F5";

export function inviteLinkFor(groupId: string) {
  return `https://pactara.lovable.app/join/${groupId}`;
}

/**
 * Administrative actions for a group, tucked behind the overflow (…) button
 * so the accountability content stays the focus of the Groups experience.
 */
export function GroupOverflowMenu({
  groupId,
  groupName,
  emoji,
  isAdmin,
  duration,
  frequency,
  daysPerWeek,
  tone = "onPurple",
  onDeleted,
}: {
  groupId: string;
  groupName: string;
  emoji: string;
  isAdmin: boolean;
  duration: number;
  frequency: "daily" | "weekly" | "specific";
  daysPerWeek: number;
  tone?: "onPurple" | "onLight";
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = inviteLinkFor(groupId);
  const shareText = "Accept your invite to my Pactara group!";
  const normalizedFreq: "daily" | "specific" =
    frequency === "specific" || frequency === "weekly" ? "specific" : "daily";

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey[0];
        return k === "my-groups" || k === "groups-today" || k === "my-group-status";
      },
    });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  const canUseNativeShare = () => {
    if (typeof navigator === "undefined" || !("share" in navigator)) return false;
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
        await navigator.share({ title: shareText, text: shareText, url: link });
        return;
      } catch {
        // fall through to the custom sheet
      }
    }
    setShareOpen(true);
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label={`${groupName} options`}
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={
              tone === "onPurple"
                ? { background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }
                : { background: "#F4F1ED", color: "#57534E" }
            }
          >
            <MoreHorizontal size={18} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 rounded-2xl p-1 border-0 shadow-xl">
          <MenuButton
            icon={copied ? <Check size={18} style={{ color: PURPLE }} /> : <Copy size={18} style={{ color: PURPLE }} />}
            label={copied ? "Copied!" : "Copy invite link"}
            onClick={handleCopy}
          />
          <Divider />
          <MenuButton
            icon={<UserPlus size={18} style={{ color: PURPLE }} />}
            label="Invite members"
            onClick={() => {
              setMenuOpen(false);
              handleInvite();
            }}
          />
          {isAdmin && (
            <>
              <Divider />
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
                label="Edit challenge"
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
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteErr(null);
                  setDeleteOpen(true);
                }}
              />
            </>
          )}
        </PopoverContent>
      </Popover>

      <RenameGroupDrawer
        open={renameOpen}
        onOpenChange={setRenameOpen}
        groupId={groupId}
        currentName={groupName}
        emoji={emoji}
        onSaved={refresh}
      />
      <EditCommitmentDrawer
        open={commitmentOpen}
        onOpenChange={setCommitmentOpen}
        duration={duration}
        frequency={normalizedFreq}
        daysPerWeek={daysPerWeek}
        onSave={async (d, f, dpw) => {
          try {
            await updateGroupCommitment({
              data: { groupId, durationDays: d, frequency: f === "specific" ? "specific" : "daily", daysPerWeek: dpw },
            });
            await refresh();
          } finally {
            setCommitmentOpen(false);
          }
        }}
      />
      <ShareInviteDrawer
        open={shareOpen}
        onOpenChange={setShareOpen}
        groupName={groupName}
        inviteLink={link}
        shareText={shareText}
        onCopy={handleCopy}
        copied={copied}
      />
      <Drawer open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <DrawerContent className="rounded-t-3xl">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-[20px] font-bold">Delete {groupName}?</DrawerTitle>
            <DrawerDescription>
              This permanently deletes the group, its messages, and all check-ins. This can't be undone.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-sheet space-y-3">
            {deleteErr && (
              <div className="rounded-xl px-3 py-2 text-[13px] bg-red-100 text-red-800">{deleteErr}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="flex-1 rounded-full bg-neutral-200 text-neutral-800 py-3 font-semibold text-[15px]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  setDeleteErr(null);
                  try {
                    await deleteGroup({ data: { groupId } });
                    await refresh();
                    setDeleteOpen(false);
                    onDeleted?.();
                  } catch (e) {
                    setDeleteErr(e instanceof Error ? e.message : "Failed to delete");
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 rounded-full bg-red-600 text-white py-3 font-semibold text-[15px] disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function RenameGroupDrawer({
  open,
  onOpenChange,
  groupId,
  currentName,
  emoji,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  currentName: string;
  emoji: string;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await renameGroup({ data: { groupId, name: name.trim() } });
      await onSaved();
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
      <DrawerContent className="px-6 pb-sheet pt-2">
        <DrawerHeader className="px-0 pt-2">
          <DrawerTitle className="text-[22px] font-black tracking-tight">Rename group</DrawerTitle>
          <DrawerDescription className="sr-only">Update the name of your group</DrawerDescription>
        </DrawerHeader>

        <div className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-4" style={{ background: "#F4F1ED" }}>
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
      <DrawerContent className="px-6 pb-sheet pt-2">
        <div className="relative">
          <DrawerHeader className="px-0 pt-2 pr-12">
            <DrawerTitle className="text-[26px] font-black tracking-tight">Commitment</DrawerTitle>
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
          <div className="text-[12px] font-bold tracking-[0.12em] text-neutral-400">DURATION</div>
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
          <div className="mt-3 rounded-2xl px-5 py-4 flex items-center" style={{ background: "#F4F1ED" }}>
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
          <div className="text-[12px] font-bold tracking-[0.12em] text-neutral-400">CHECK-IN FREQUENCY</div>
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
            <div className="text-[12px] font-bold tracking-[0.12em] text-neutral-400">DAYS PER WEEK</div>
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
        <div className="text-[16px] font-bold leading-tight" style={{ color: active ? PURPLE : "#0A0A0A" }}>
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

export function ShareInviteDrawer({
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
  const subject = encodeURIComponent(`Accept your invite to my ${groupName} on Pactara`);

  const options: { label: string; icon: React.ReactNode; href?: string; onClick?: () => void }[] = [
    {
      label: copied ? "Copied!" : "Copy link",
      icon: copied ? <Check size={20} /> : <Copy size={20} />,
      onClick: onCopy,
    },
    { label: "Messages", icon: <MessageCircle size={20} />, href: `sms:&body=${encoded}` },
    { label: "WhatsApp", icon: <Share2 size={20} />, href: `https://wa.me/?text=${encoded}` },
    { label: "Email", icon: <Mail size={20} />, href: `mailto:?subject=${subject}&body=${encoded}` },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-6 pb-sheet pt-2">
        <DrawerHeader className="px-0 pt-2">
          <DrawerTitle className="text-[22px] font-black tracking-tight">Invite people</DrawerTitle>
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
