import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Moon } from "lucide-react";
import type { FeedItem, FeedMember } from "@/lib/daily-posts.functions";
import { nudgeMember } from "@/lib/group-today.functions";
import { quietDayLine, timeLeftLabel, weekdayName } from "@/lib/feed-view";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { FeedAvatar } from "@/components/feed/FeedMedia";
import { useCommentsSheet, usePostQuickComment } from "@/components/feed/CommentsSheet";

const PURPLE = "#7C3AED";
const MUTED = "#57534E";

function clock(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
}

function Row({
  userId,
  isMe,
  name,
  avatarUrl,
  avatarColor,
  title,
  subline,
  right,
  style,
  className = "",
  avatar,
}: {
  userId: string;
  isMe: boolean;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  title: string;
  subline: React.ReactNode;
  right?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  avatar?: React.ReactNode;
}) {
  return (
    <div className={`mx-4 mt-2 flex items-center gap-3 rounded-2xl px-[14px] py-3 ${className}`} style={style}>
      {avatar ?? (
        <MemberProfileLink userId={userId} isYou={isMe} className="shrink-0">
          <span className="sr-only">{isMe ? "Your profile" : `${name}'s profile`}</span>
          <FeedAvatar url={avatarUrl} color={avatarColor} name={name} size={36} />
        </MemberProfileLink>
      )}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-neutral-900">{title}</div>
        <div className="truncate text-[13px]" style={{ color: MUTED }}>{subline}</div>
      </div>
      {right}
    </div>
  );
}

/** Today only: a crewmate whose day is still open. Nudge follows the usual once-a-day rule. */
export function NotYetRow({
  member,
  closesAt,
  nudgedAt,
  groupId,
}: {
  member: FeedMember;
  closesAt: string;
  nudgedAt: string | null;
  groupId: string;
}) {
  const queryClient = useQueryClient();
  const [sentAt, setSentAt] = useState<string | null>(nudgedAt);
  const [covered, setCovered] = useState(false);
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (sentAt || covered || sending) return;
    setSending(true);
    try {
      const result = await nudgeMember({ data: { groupId, userId: member.userId } });
      if (result.ok) {
        toast.success(result.message);
        setSentAt(new Date().toISOString());
      } else {
        toast.info(result.message);
        if (result.reason === "covered") setCovered(true);
        else setSentAt(new Date().toISOString());
      }
      queryClient.invalidateQueries({ queryKey: ["home-crew"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send that nudge");
    } finally {
      setSending(false);
    }
  };
  return (
    <Row
      userId={member.userId}
      isMe={false}
      name={member.name}
      avatarUrl={member.avatarUrl}
      avatarColor={member.avatarColor}
      title={`${member.firstName} hasn’t checked in yet`}
      className="border border-dashed bg-white"
      style={{ borderColor: "#D6D3D1" }}
      subline={
        sentAt ? (
          `You nudged them at ${clock(sentAt)}`
        ) : covered ? (
          `${member.firstName}'s covered today`
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={sending}
            aria-label={`Nudge ${member.firstName}`}
            className="relative font-semibold after:absolute after:-inset-y-3 after:inset-x-0 after:content-[''] disabled:opacity-60"
            style={{ color: PURPLE }}
          >
            {sending ? "Nudging…" : `Nudge ${member.firstName}`}
          </button>
        )
      }
      right={
        <span className="shrink-0 rounded-full bg-[#F4F2EF] px-2.5 py-1 text-[12px] font-semibold" style={{ color: MUTED }}>
          {timeLeftLabel(closesAt)}
        </span>
      }
    />
  );
}

export function RestedRow({ member, localDate }: { member: FeedMember; localDate: string }) {
  const first = member.firstName || (member.name || "").split(" ")[0] || "Member";
  return (
    <Row
      userId={member.userId}
      isMe={member.isMe}
      name={member.name}
      avatarUrl={member.avatarUrl}
      avatarColor={member.avatarColor}
      title={member.isMe ? "You rested" : `${first} rested`}
      subline={weekdayName(localDate)}
      className="bg-white"
      right={
        <span className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: "#F3EEFF", color: "#6D28D9" }}>
          <Moon size={13} />
          Streak kept
        </span>
      }
    />
  );
}

export function MissedRow({ item, localDate, autoOpenComments }: { item: FeedItem; localDate: string; autoOpenComments?: boolean }) {
  const first = (item.name || "").split(" ")[0] || "Member";
  const comments = useCommentsSheet(item);
  useEffect(() => {
    if (autoOpenComments) comments.openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenComments]);
  return (
    <>
      <Row
        userId={item.userId}
        isMe={item.isMe}
        name={item.name}
        avatarUrl={item.avatarUrl}
        avatarColor={item.avatarColor}
        title={item.isMe ? "You missed a check‑in" : `${first} missed a check‑in`}
        subline={weekdayName(localDate)}
        className="bg-white"
        right={
          item.isMe ? (
            item.commentCount > 0 ? (
              <button
                type="button"
                onClick={comments.openSheet}
                className="h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold text-neutral-800"
                style={{ borderColor: "#E7E3DE" }}
              >
                {item.commentCount} {item.commentCount === 1 ? "comment" : "comments"}
              </button>
            ) : null
          ) : (
            <button
              type="button"
              onClick={comments.openSheet}
              className="relative h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold text-neutral-900 after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] active:bg-neutral-50"
              style={{ borderColor: "#D6D3D1" }}
            >
              Cheer {first} on
            </button>
          )
        }
      />
      {comments.sheet}
    </>
  );
}

export function MilestoneRow({ member, streakDays, postId }: { member: FeedMember; streakDays: number; postId: string | null }) {
  const celebrate = usePostQuickComment(postId ?? "");
  const [done, setDone] = useState(false);
  return (
    <Row
      userId={member.userId}
      isMe={member.isMe}
      name={member.name}
      avatarUrl={member.avatarUrl}
      avatarColor={member.avatarColor}
      title={`${member.isMe ? "You" : member.firstName} hit a ${streakDays}-day streak`}
      subline="Badge unlocked"
      className="border"
      style={{ background: "#FFFBEB", borderColor: "#FCD34D" }}
      avatar={
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold text-white"
          style={{ background: "#F59E0B" }}
          aria-hidden
        >
          {streakDays}
        </span>
      }
      right={
        !member.isMe && postId ? (
          <button
            type="button"
            disabled={done || celebrate.isPending}
            onClick={() => {
              setDone(true);
              celebrate.mutate("🔥", { onError: () => setDone(false) });
            }}
            className="relative h-9 shrink-0 rounded-full bg-neutral-900 px-3.5 text-[13px] font-bold text-white after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] disabled:opacity-60"
          >
            {done ? "Celebrated" : "Celebrate"}
          </button>
        ) : null
      }
    />
  );
}

/** Opens the comments on a missed post a notification linked to. */
function AutoOpenComments({ item }: { item: FeedItem }) {
  const comments = useCommentsSheet(item);
  useEffect(() => {
    comments.openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  return <>{comments.sheet}</>;
}

/**
 * Past days: one calm row for everyone who missed or rested, e.g.
 * "Michele, Guy and you missed · Bertille rested".
 */
export function QuietDayRow({
  missed,
  rested,
  autoOpenItem,
}: {
  missed: FeedMember[];
  rested: FeedMember[];
  autoOpenItem?: FeedItem;
}) {
  const faces = [...missed, ...rested].slice(0, 3);
  return (
    <div className="mx-4 mt-2 flex items-center gap-3 rounded-2xl bg-white px-[14px] py-3">
      <span className="flex shrink-0 items-center" aria-hidden>
        {faces.map((m, i) => (
          <span key={m.userId} className="relative" style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}>
            <FeedAvatar url={m.avatarUrl} color={m.avatarColor} name={m.name} size={28} className="border-2 border-white" />
          </span>
        ))}
      </span>
      <p className="line-clamp-2 min-w-0 flex-1 text-[14px] font-medium leading-snug" style={{ color: MUTED }}>
        {quietDayLine(missed, rested)}
      </p>
      {autoOpenItem && <AutoOpenComments item={autoOpenItem} />}
    </div>
  );
}
