import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, Check, Clock, Hourglass, Hand, Moon } from "lucide-react";
import { toast } from "sonner";
import { nudgeMember, type MemberToday, type MemberTodayStatus } from "@/lib/group-today.functions";

export const PURPLE = "#7C3AED";
export const PURPLE_DEEP = "#5B21B6";
export const PURPLE_SOFT = "#F3EEFF";
export const BG = "#F5F2EE";

export function MemberAvatar({
  member,
  size = 40,
}: {
  member: Pick<MemberToday, "name" | "avatarUrl" | "avatarColor">;
  size?: number;
}) {
  const initial = (member.name || "U").slice(0, 1).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold overflow-hidden shrink-0"
      style={{ background: member.avatarColor, height: size, width: size, fontSize: size * 0.36 }}
    >
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

export function statusLabel(status: MemberTodayStatus): string {
  switch (status) {
    case "done":
      return "Already checked in";
    case "working_out":
      return "Working out now";
    case "in_progress":
    case "committed":
      return "Waiting to check in";
    case "missed":
      return "Missed today";
    default:
      return "Not checked in yet";
  }
}

/** "Started 18 min ago" for a live workout session. */
export function elapsedLabel(startedAt: string | null): string | null {
  if (!startedAt) return null;
  const ms = Date.now() - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Started just now";
  if (minutes < 60) return `Started ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `Started ${hours} hr ago`
    : `Started ${hours} hr ${rest} min ago`;
}

/** Small pulsing green dot used wherever a live workout is shown. */
export function LiveDot({ size = 8 }: { size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ height: size, width: size }}>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ background: "#16A34A" }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{ height: size, width: size, background: "#16A34A" }}
      />
    </span>
  );
}

export function StatusPill({ status }: { status: MemberTodayStatus | "rest" }) {
  if (status === "rest") {
    return (
      <span className="flex items-center gap-1 text-[13px] font-semibold" style={{ color: "#7C5CD6" }}>
        <Moon size={13} style={{ color: "#A78BFA" }} aria-hidden />
        Resting today
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 text-[13px] font-semibold text-green-600">
        <Check size={15} strokeWidth={3} />
        Already checked in
      </span>
    );
  }
  if (status === "working_out") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-green-600">
        <LiveDot />
        Working out now
      </span>
    );
  }
  if (status === "committed" || status === "in_progress") {
    return (
      <span className="flex items-center gap-1 text-[13px] font-semibold text-amber-500">
        <Hourglass size={14} />
        Waiting to check in
      </span>
    );
  }
  return (
    <span className="text-[13px] font-semibold text-neutral-400">
      {status === "missed" ? "Missed today" : "Not checked in yet"}
    </span>
  );
}

export function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return null;
  }
}

export function GroupStreakChip({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold"
      style={{ background: "#FFF1E6", color: "#EA580C" }}
    >
      <Flame size={14} className="fill-orange-500 text-orange-500" />
      {streak} day group streak
    </span>
  );
}

export function MemberStreakChip({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-500">
      <Flame size={13} className="text-orange-500" />
      {streak}
    </span>
  );
}

/**
 * "We're waiting for you" — sends a supportive push to a member who hasn't
 * completed today's commitment.
 */
export function NudgeButton({
  groupId,
  member,
  variant = "solid",
  initialSent = false,
  compact = false,
}: {
  groupId: string;
  member: Pick<MemberToday, "userId" | "firstName">;
  variant?: "solid" | "ghost" | "pill";
  /** Already nudged today (e.g. before a reload). */
  initialSent?: boolean;
  /** Tighter padding/text so the pill fits a narrow crew column. */
  compact?: boolean;
}) {
  const [sent, setSent] = useState(initialSent);
  const [covered, setCovered] = useState(false);
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  const send = async () => {
    if (sent || sending) return;
    setSending(true);
    try {
      const result = await nudgeMember({ data: { groupId, userId: member.userId } });
      // Already nudged today or already covered: nothing more to send today.
      setSent(true);
      if (!result.ok && result.reason === "covered") setCovered(true);
      if (result.ok) toast.success(result.message);
      else toast.info(result.message);
      queryClient.invalidateQueries({ queryKey: ["groups-today"] });
      queryClient.invalidateQueries({ queryKey: ["home-crew"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send that nudge");
    } finally {
      setSending(false);
    }
  };

  const base = "rounded-full font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60";
  if (variant === "pill") {
    // 32px tall pill; the invisible ::after extends the touch target to 44px.
    return (
      <button
        type="button"
        onClick={send}
        disabled={sent || sending}
        aria-label={covered ? `${member.firstName} is covered today` : sent ? `Nudged ${member.firstName}` : `Nudge ${member.firstName}`}
        className={`relative flex h-8 items-center justify-center rounded-full font-bold after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] disabled:cursor-default ${
          compact ? "gap-[3px] px-1.5 text-[11px]" : "gap-1 px-3 text-[12px]"
        }`}
        style={
          sent
            ? { background: "#F4F1ED", color: "#8A8580" }
            : { background: PURPLE, color: "#FFFFFF" }
        }
      >
        {!sent && <Hand size={compact ? 12 : 13} strokeWidth={2.5} />}
        {covered ? "Covered" : sent ? "Nudged" : "Nudge"}
      </button>
    );
  }
  if (variant === "ghost") {
    return (
      <button
        onClick={send}
        disabled={sent || sending}
        className={`${base} px-3.5 py-1.5 text-[13px]`}
        style={{ background: sent ? "#F4F1ED" : PURPLE_SOFT, color: sent ? "#8A8580" : PURPLE }}
      >
        {covered ? "Covered" : sent ? "Nudged" : "Nudge"}
      </button>
    );
  }

  return (
    <button
      onClick={send}
      disabled={sent || sending}
      className={`${base} w-full py-3 text-[14px]`}
      style={{ background: sent ? "#F4F1ED" : PURPLE_SOFT, color: sent ? "#8A8580" : PURPLE }}
    >
      <Clock size={15} />
      {covered
        ? `${member.firstName}'s covered today`
        : sent
          ? `Nudged ${member.firstName}`
          : `Nudge ${member.firstName}`}
    </button>
  );
}
