import type { FeedItem } from "@/lib/daily-posts.functions";
import { Hourglass, Flame, Share2, MessageCircle, ChevronDown } from "lucide-react";

const PURPLE = "#7C3AED";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

const MOOD_META: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  crushed: { label: "Crushed it", emoji: "🏆", color: "#16A34A", bg: "#ECFDF3", border: "#D1FADF" },
  showed: { label: "Showed up", emoji: "💪", color: PURPLE, bg: "#F4EEFF", border: "#E5D9FE" },
  struggled: { label: "Struggled", emoji: "😤", color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" },
};

function ReactionBar({ commentsOpen = false }: { commentsOpen?: boolean }) {
  return (
    <div className="border-t border-neutral-100 px-4 pt-3 pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {["🔥", "💪", "❤️", "👏"].map((e) => (
            <button
              key={e}
              type="button"
              className="h-9 px-3 rounded-full bg-neutral-100 text-[16px] leading-none flex items-center justify-center active:scale-95 transition"
            >
              {e}
            </button>
          ))}
        </div>
        <button type="button" className="flex items-center gap-1.5 text-neutral-500 text-[14px] font-medium">
          <Share2 size={16} />
          Share
        </button>
      </div>
      <button type="button" className="mt-1 -ml-2 flex items-center gap-1.5 px-2 py-2 text-neutral-500 text-[14px] font-medium">
        <MessageCircle size={16} />
        Comment
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

export function TimelineCard({ item }: { item: FeedItem }) {
  const initials = (item.name || "U").slice(0, 1).toUpperCase();
  const ritualNode = item.ritual
    ? {
        emoji: "🌅",
        label: "Morning Ritual",
        labelColor: PURPLE,
        bg: "#F4EEFF",
        border: "#E5D9FE",
        body: item.ritual.text,
        time: timeAgo(item.ritual.postedAt),
        dot: { fill: PURPLE, ring: PURPLE },
        lineFromHere: PURPLE,
      }
    : item.ritualMissed
      ? {
          emoji: "😴",
          label: "Missed Morning Ritual",
          labelColor: "#B45309",
          bg: "#FEF6E4",
          border: "#FBE4B6",
          body: "No plan was set for today",
          time: timeAgo(item.updatedAt),
          dot: { fill: "#F59E0B", ring: "#F59E0B" },
          lineFromHere: item.checkInMissed ? "#DC2626" : "#F59E0B",
        }
      : null;

  const mood = item.checkIn?.mood ? MOOD_META[item.checkIn.mood] : null;
  const checkNode = item.checkIn
    ? {
        emoji: mood?.emoji ?? "✅",
        label: mood?.label ?? "Checked in",
        labelColor: mood?.color ?? "#16A34A",
        bg: mood?.bg ?? "#ECFDF3",
        border: mood?.border ?? "#D1FADF",
        body: item.checkIn.note ?? "",
        photoUrl: item.checkIn.photoUrl,
        activity: item.checkIn.activity,
        time: timeAgo(item.checkIn.createdAt),
        dot: { fill: mood?.color ?? "#16A34A", ring: mood?.color ?? "#16A34A" },
      }
    : item.checkInMissed
      ? {
          emoji: "❌",
          label: "Missed Check-in",
          labelColor: "#DC2626",
          bg: "#FEF2F2",
          border: "#FECACA",
          body: "No check-in was recorded for this day",
          time: timeAgo(item.updatedAt),
          dot: { fill: "#FFFFFF", ring: "#DC2626" },
        }
      : { pending: true as const };

  const topMissed = item.ritualMissed && !item.ritual;
  const headerSuffix = topMissed
    ? { text: "missed morning ritual", color: "#B45309" }
    : item.checkInMissed && !item.checkIn
      ? { text: "missed check-in", color: "#DC2626" }
      : null;

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4">
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-[18px]"
            style={{ background: item.avatarColor || "#22C55E" }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[17px] font-bold text-neutral-900">{item.isMe ? "You" : item.name}</span>
            {headerSuffix && (
              <span className="text-[15px] font-medium" style={{ color: headerSuffix.color }}>
                {headerSuffix.text}
              </span>
            )}
          </div>
          <div className="text-[13px] text-neutral-400 mt-0.5">{timeAgo(item.updatedAt)}</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 pt-3 pb-3 relative">
        {/* Vertical line */}
        <div
          className="absolute left-[31px] top-[36px] bottom-[36px] w-[3px] rounded-full"
          style={{ background: ritualNode?.lineFromHere ?? "#E5E7EB" }}
        />

        {/* Row 1: ritual */}
        {ritualNode && (
          <div className="flex gap-3 items-start">
            <div className="relative w-6 h-6 mt-3 shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: ritualNode.dot.fill,
                  boxShadow: `0 0 0 3px ${ritualNode.dot.ring}`,
                  border: "3px solid white",
                }}
              />
            </div>
            <div
              className="flex-1 rounded-2xl border p-3"
              style={{ background: ritualNode.bg, borderColor: ritualNode.border }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[18px] leading-none">{ritualNode.emoji}</span>
                  <span className="text-[15px] font-bold truncate" style={{ color: ritualNode.labelColor }}>
                    {ritualNode.label}
                  </span>
                </div>
                <span className="text-[12px] text-neutral-400 shrink-0">{ritualNode.time}</span>
              </div>
              {ritualNode.body && <div className="mt-1 text-[15px] text-neutral-900">{ritualNode.body}</div>}
            </div>
          </div>
        )}

        {/* Row 2: check-in / pending / missed */}
        <div className={`flex gap-3 items-start ${ritualNode ? "mt-3" : ""}`}>
          <div className="relative w-6 h-6 mt-3 shrink-0">
            {"pending" in checkNode ? (
              <div
                className="absolute inset-0 rounded-full bg-white"
                style={{ boxShadow: `0 0 0 3px #D4D4D4`, border: "3px solid white" }}
              />
            ) : (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: checkNode.dot.fill,
                  boxShadow: `0 0 0 3px ${checkNode.dot.ring}`,
                  border: "3px solid white",
                }}
              />
            )}
          </div>
          {"pending" in checkNode ? (
            <div className="flex-1 rounded-2xl border border-dashed border-neutral-300 p-3 flex items-center gap-2">
              <Hourglass size={18} className="text-neutral-400" />
              <span className="text-[15px] text-neutral-400">Check-in pending…</span>
            </div>
          ) : (
            <div
              className="flex-1 rounded-2xl border p-3"
              style={{ background: checkNode.bg, borderColor: checkNode.border }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[18px] leading-none">{checkNode.emoji}</span>
                  <span className="text-[15px] font-bold truncate" style={{ color: checkNode.labelColor }}>
                    {checkNode.label}
                  </span>
                </div>
                <span className="text-[12px] text-neutral-400 shrink-0">{checkNode.time}</span>
              </div>
              {checkNode.body && <div className="mt-1 text-[15px] text-neutral-900">{checkNode.body}</div>}
              {"photoUrl" in checkNode && checkNode.photoUrl && (
                <div className="mt-2 relative">
                  <img src={checkNode.photoUrl} alt="" className="w-full rounded-xl object-cover max-h-[360px]" />
                  {checkNode.activity && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-[13px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
                      <Flame size={14} />
                      {checkNode.activity[0].toUpperCase() + checkNode.activity.slice(1)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ReactionBar />
    </div>
  );
}
