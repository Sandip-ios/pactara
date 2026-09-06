import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, Check, Clock, Hourglass } from "lucide-react";
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
      return "Showed up";
    case "in_progress":
      return "Almost there";
    case "committed":
      return "Waiting for check-in";
    case "missed":
      return "Missed today";
    default:
      return "No commitment yet";
  }
}

export function StatusPill({ status }: { status: MemberTodayStatus }) {
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 text-[13px] font-semibold text-green-600">
        <Check size={15} strokeWidth={3} />
        Done
      </span>
    );
  }
  if (status === "missed") {
    return <span className="text-[13px] font-semibold text-neutral-400">Missed</span>;
  }
  if (status === "committed" || status === "in_progress") {
    return (
      <span className="flex items-center gap-1 text-[13px] font-semibold text-amber-500">
        <Hourglass size={14} />
        Waiting
      </span>
    );
  }
  return <span className="text-[13px] font-semibold text-neutral-400">Not yet</span>;
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
}: {
  groupId: string;
  member: Pick<MemberToday, "userId" | "firstName">;
  variant?: "solid" | "ghost";
}) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  const send = async () => {
    if (sent || sending) return;
    setSending(true);
    try {
      await nudgeMember({ data: { groupId, userId: member.userId } });
      setSent(true);
      toast.success("👋 Nudge sent");
      queryClient.invalidateQueries({ queryKey: ["groups-today"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send that nudge");
    } finally {
      setSending(false);
    }
  };

  const base = "rounded-full font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60";
  if (variant === "ghost") {
    return (
      <button
        onClick={send}
        disabled={sent || sending}
        className={`${base} px-3.5 py-1.5 text-[13px]`}
        style={{ background: sent ? "#F4F1ED" : PURPLE_SOFT, color: sent ? "#8A8580" : PURPLE }}
      >
        {sent ? "Nudged" : "Nudge"}
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
      {sent ? `Nudged ${member.firstName}` : `Nudge ${member.firstName}`}
    </button>
  );
}
