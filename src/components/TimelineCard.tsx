import type { FeedItem, TimelineNode } from "@/lib/daily-posts.functions";
import { Hourglass, Flame, Share2, MessageCircle, ChevronDown, MessageSquare } from "lucide-react";

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

type Visual = {
  emoji: string;
  label: string;
  labelColor: string;
  bg: string;
  border: string;
  dot: { fill: string; ring: string };
  body?: string | null;
  photoUrl?: string | null;
  activity?: string | null;
  time?: string;
};

function nodeVisual(node: TimelineNode): Visual | null {
  switch (node.kind) {
    case "ritual":
      return {
        emoji: "🌅",
        label: "Morning Ritual",
        labelColor: PURPLE,
        bg: "#F4EEFF",
        border: "#E5D9FE",
        body: node.text,
        time: timeAgo(node.at),
        dot: { fill: PURPLE, ring: PURPLE },
      };
    case "ritual_missed":
      return {
        emoji: "😴",
        label: "Missed Morning Ritual",
        labelColor: "#B45309",
        bg: "#FEF6E4",
        border: "#FBE4B6",
        body: "No plan was set for today",
        time: timeAgo(node.at),
        dot: { fill: "#F59E0B", ring: "#F59E0B" },
      };
    case "thought":
      return {
        emoji: "💭",
        label: "Update",
        labelColor: "#0F766E",
        bg: "#ECFEFF",
        border: "#CFFAFE",
        body: node.text,
        photoUrl: node.photoUrl,
        time: timeAgo(node.at),
        dot: { fill: "#0F766E", ring: "#0F766E" },
      };
    case "check_in": {
      const mood = node.mood ? MOOD_META[node.mood] : null;
      return {
        emoji: mood?.emoji ?? "✅",
        label: mood?.label ?? "Checked in",
        labelColor: mood?.color ?? "#16A34A",
        bg: mood?.bg ?? "#ECFDF3",
        border: mood?.border ?? "#D1FADF",
        body: node.note,
        photoUrl: node.photoUrl,
        activity: node.activity,
        time: timeAgo(node.at),
        dot: { fill: mood?.color ?? "#16A34A", ring: mood?.color ?? "#16A34A" },
      };
    }
    case "check_in_missed":
      return {
        emoji: "❌",
        label: "Missed Check-in",
        labelColor: "#DC2626",
        bg: "#FEF2F2",
        border: "#FECACA",
        body: "No check-in was recorded for this day",
        time: timeAgo(node.at),
        dot: { fill: "#FFFFFF", ring: "#DC2626" },
      };
    case "pending":
      return null;
  }
}

function ReactionBar() {
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
  const nodes = item.nodes;

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
          </div>
          <div className="text-[13px] text-neutral-400 mt-0.5">{timeAgo(item.updatedAt)}</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 pt-3 pb-3 relative">
        {nodes.length > 1 && (
          <div
            className="absolute top-[36px] bottom-[36px] w-[3px] -translate-x-1/2 rounded-full"
            style={{ left: "28px", background: "#E5E7EB" }}
          />
        )}

        {nodes.map((node, idx) => {
          const visual = nodeVisual(node);
          const isPending = node.kind === "pending";
          return (
            <div key={node.id} className={`flex gap-3 items-start ${idx > 0 ? "mt-3" : ""}`}>
              <div className="relative w-6 h-6 mt-3 shrink-0">
                {isPending || !visual ? (
                  <div
                    className="absolute inset-0 rounded-full bg-white"
                    style={{ boxShadow: `0 0 0 3px #D4D4D4`, border: "3px solid white" }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: visual.dot.fill,
                      boxShadow: `0 0 0 3px ${visual.dot.ring}`,
                      border: "3px solid white",
                    }}
                  />
                )}
              </div>

              {isPending || !visual ? (
                <div className="flex-1 rounded-2xl border border-dashed border-neutral-300 p-3 flex items-center gap-2">
                  <Hourglass size={18} className="text-neutral-400" />
                  <span className="text-[15px] text-neutral-400">Check-in pending…</span>
                </div>
              ) : (
                <div
                  className="flex-1 rounded-2xl border p-3"
                  style={{ background: visual.bg, borderColor: visual.border }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[18px] leading-none">{visual.emoji}</span>
                      <span className="text-[15px] font-bold truncate" style={{ color: visual.labelColor }}>
                        {visual.label}
                      </span>
                    </div>
                    {visual.time && (
                      <span className="text-[12px] text-neutral-400 shrink-0">{visual.time}</span>
                    )}
                  </div>
                  {visual.body && <div className="mt-1 text-[15px] text-neutral-900">{visual.body}</div>}
                  {visual.photoUrl && (
                    <div className="mt-2 relative">
                      <img src={visual.photoUrl} alt="" className="w-full rounded-xl object-cover max-h-[360px]" />
                      {visual.activity && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-[13px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
                          <Flame size={14} />
                          {visual.activity[0].toUpperCase() + visual.activity.slice(1)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Hint shown when only a pending node renders. */}
        {nodes.length === 0 && (
          <div className="flex items-center gap-2 text-neutral-400 text-[14px]">
            <MessageSquare size={16} />
            Nothing shared yet
          </div>
        )}
      </div>

      <ReactionBar />
    </div>
  );
}
