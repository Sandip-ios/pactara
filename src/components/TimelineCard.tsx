import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeedItem, TimelineNode } from "@/lib/daily-posts.functions";
import {
  togglePostReaction,
  addPostComment,
  getPostComments,
} from "@/lib/daily-posts.functions";
import {
  Hourglass,
  Flame,
  Share2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  Loader2,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const PURPLE = "#7C3AED";
const REACTION_EMOJIS = ["🔥", "💪", "❤️", "👏"];

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

function ReactionBar({ item, onToggleComments, commentsOpen }: { item: FeedItem; onToggleComments: () => void; commentsOpen: boolean }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (emoji: string) => togglePostReaction({ data: { postId: item.id, emoji } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group-feed"] }),
  });

  return (
    <div className="border-t border-neutral-100 px-4 pt-3 pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {REACTION_EMOJIS.map((e) => {
            const r = item.reactions.find((x) => x.emoji === e);
            const mine = r?.mine;
            const count = r?.count ?? 0;
            return (
              <button
                key={e}
                type="button"
                onClick={() => toggle.mutate(e)}
                disabled={toggle.isPending}
                className={`h-9 px-3 rounded-full text-[15px] leading-none flex items-center gap-1 active:scale-95 transition ${
                  mine ? "border" : ""
                }`}
                style={{
                  background: mine ? "#F4EEFF" : "#F5F5F5",
                  borderColor: mine ? PURPLE : "transparent",
                  color: mine ? PURPLE : "#111",
                }}
              >
                <span>{e}</span>
                {count > 0 && <span className="text-[13px] font-semibold">{count}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className="flex items-center gap-1.5 text-neutral-500 text-[14px] font-medium">
          <Share2 size={16} />
          Share
        </button>
      </div>
      <button
        type="button"
        onClick={onToggleComments}
        className="mt-1 -ml-2 flex items-center gap-1.5 px-2 py-2 text-neutral-500 text-[14px] font-medium"
      >
        <MessageCircle size={16} />
        {item.commentCount > 0 ? `${item.commentCount} ${item.commentCount === 1 ? "comment" : "comments"}` : "Comment"}
        {commentsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </div>
  );
}

function CommentSection({ postId }: { postId: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => getPostComments({ data: { postId } }),
  });
  const add = useMutation({
    mutationFn: (body: string) => addPostComment({ data: { postId, body } }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || add.isPending) return;
    add.mutate(body);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="text-[13px] text-neutral-400">Loading…</div>
        ) : (
          <ul className="space-y-4">
            {(data?.comments ?? []).map((c) => {
              const initial = (c.authorName || "U").slice(0, 1).toUpperCase();
              return (
                <li key={c.id} className="flex gap-3 items-start">
                  {c.authorAvatarUrl ? (
                    <img src={c.authorAvatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                      style={{ background: c.authorColor }}
                    >
                      {initial}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-bold text-neutral-900">
                        {c.isMine ? "You" : c.authorName}
                      </span>
                      <span className="text-[12px] text-neutral-400">{timeAgo(c.createdAt)}</span>
                    </div>
                    <div className="text-[15px] text-neutral-800 whitespace-pre-wrap break-words mt-0.5">{c.body}</div>
                  </div>
                </li>
              );
            })}
            {(data?.comments ?? []).length === 0 && (
              <li className="text-[14px] text-neutral-400 text-center py-8">No comments yet. Be the first to say something.</li>
            )}
          </ul>
        )}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100 bg-white pb-[env(safe-area-inset-bottom)]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          maxLength={1000}
          className="flex-1 h-10 rounded-full bg-neutral-100 border border-transparent px-4 text-[14px] outline-none focus:border-[#7C3AED] focus:bg-white"
        />
        <button
          type="submit"
          disabled={!text.trim() || add.isPending}
          aria-label="Post comment"
          className="h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-50"
          style={{ background: text.trim() ? PURPLE : "#E5E5E5" }}
        >
          {add.isPending ? (
            <Loader2 size={16} className="text-white animate-spin" />
          ) : (
            <Send size={16} className={text.trim() ? "text-white" : "text-neutral-400"} />
          )}
        </button>
      </form>
      {add.isError && <div className="text-[12px] text-red-500 px-4 pb-2">{(add.error as Error).message}</div>}
    </div>
  );
}

export function TimelineCard({ item }: { item: FeedItem }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
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

        {nodes.length === 0 && (
          <div className="flex items-center gap-2 text-neutral-400 text-[14px]">
            <MessageSquare size={16} />
            Nothing shared yet
          </div>
        )}
      </div>

      <ReactionBar item={item} onToggleComments={() => setCommentsOpen((v) => !v)} commentsOpen={commentsOpen} />
      {commentsOpen && <CommentSection postId={item.id} />}
    </div>
  );
}
