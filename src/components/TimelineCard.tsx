import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FeedItem, TimelineNode } from "@/lib/daily-posts.functions";
import { MediaLightbox } from "@/components/MediaLightbox";
import {
  togglePostReaction,
  setPostReaction,
  addPostComment,
  getPostComments,
  deleteCheckIn,
} from "@/lib/daily-posts.functions";
import {
  Hourglass,
  Flame,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Send,
  Loader2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PURPLE = "#7C3AED";
const REACTION_EMOJIS = ["🔥", "💪", "❤️", "👏"];
const noSelectTouchStyle = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
  touchAction: "manipulation",
} as CSSProperties & { WebkitTouchCallout?: string; WebkitUserSelect?: string };

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

function nodeVisual(node: TimelineNode, firstName?: string): Visual | null {
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
        body: `Your group is already moving${firstName ? `, ${firstName}` : ""}. Jump in.`,
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
        body: "Your group missed you yesterday. They're showing up again today.",
        time: timeAgo(node.at),
        dot: { fill: "#FFFFFF", ring: "#DC2626" },
      };
    case "pending":
      return null;
  }
}

function ReactionBar({
  item,
  onToggleComments,
  onPrefetchComments,
}: {
  item: FeedItem;
  onToggleComments: () => void;
  onPrefetchComments: () => void;
  commentsOpen?: boolean;
}) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  // Optimistic override of my reaction for instant UI feedback
  const [override, setOverride] = useState<{ emoji: string | null } | null>(null);

  const serverMyEmoji = item.reactions.find((r) => r.mine)?.emoji ?? null;
  const myEmoji = override ? override.emoji : serverMyEmoji;

  const reactions = (() => {
    if (!override) return item.reactions;
    const map = new Map(item.reactions.map((r) => [r.emoji, { ...r }]));
    if (serverMyEmoji) {
      const prev = map.get(serverMyEmoji);
      if (prev) {
        prev.mine = false;
        prev.count = Math.max(0, prev.count - 1);
        if (prev.count === 0) map.delete(serverMyEmoji);
        else map.set(serverMyEmoji, prev);
      }
    }
    if (override.emoji) {
      const cur = map.get(override.emoji) ?? { emoji: override.emoji, count: 0, mine: false };
      map.set(override.emoji, { ...cur, count: cur.count + 1, mine: true });
    }
    return Array.from(map.values());
  })();

  const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);
  const iLiked = !!myEmoji;

  const toggle = useMutation({
    mutationFn: (emoji: string) => togglePostReaction({ data: { postId: item.id, emoji } }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["group-feed"] }).then(() => setOverride(null));
    },
  });
  const setReactionM = useMutation({
    mutationFn: (emoji: string) => setPostReaction({ data: { postId: item.id, emoji } }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["group-feed"] }).then(() => setOverride(null));
    },
  });

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const clearNativeSelection = () => {
    window.getSelection()?.removeAllRanges();
  };

  const toggleCurrentReaction = () => {
    const emoji = myEmoji ?? "🔥";
    setOverride({ emoji: myEmoji ? null : "🔥" });
    toggle.mutate(emoji);
  };

  const handlePressStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    longPressedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    longPressTimer.current = window.setTimeout(() => {
      longPressedRef.current = true;
      clearNativeSelection();
      setPickerOpen(true);
    }, 350);
  };
  const handlePressEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    clearLongPressTimer();
    clearNativeSelection();
    if (!longPressedRef.current) toggleCurrentReaction();
  };
  const handlePressCancel = () => {
    clearLongPressTimer();
    clearNativeSelection();
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCurrentReaction();
    }
  };
  const selectEmoji = (emoji: string) => {
    clearNativeSelection();
    setOverride({ emoji });
    setReactionM.mutate(emoji);
    setPickerOpen(false);
  };


  const stackEmojis = reactions
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="border-t border-neutral-100 px-4 py-3 flex items-center justify-between select-none" style={noSelectTouchStyle}>
      <div className="flex items-center gap-5">
        <div className="relative">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverAnchor className="absolute inset-0 pointer-events-none" />
            <PopoverContent
              side="top"
              align="start"
              onOpenAutoFocus={(event) => event.preventDefault()}
              className="w-auto p-2 rounded-full border-neutral-200 shadow-lg"
              style={noSelectTouchStyle}
            >
              <div className="flex items-center gap-1">
                {REACTION_EMOJIS.map((e) => {
                  const r = item.reactions.find((x) => x.emoji === e);
                  const mine = r?.mine;
                  return (
                    <button
                      key={e}
                      type="button"
                      aria-label={`React with ${e}`}
                      onPointerDown={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        selectEmoji(e);
                      }}
                      onClick={(ev) => ev.preventDefault()}
                      onContextMenu={(ev) => ev.preventDefault()}
                      className={`h-11 w-11 rounded-full flex items-center justify-center text-[24px] active:scale-90 transition ${
                        mine ? "bg-[#F4EEFF]" : "hover:bg-neutral-100"
                      }`}
                      style={noSelectTouchStyle}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            aria-label="React to post"
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerCancel={handlePressCancel}
            onLostPointerCapture={handlePressCancel}
            onKeyDown={handleKeyDown}
            onContextMenu={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 text-neutral-700 text-[15px] font-semibold active:scale-95 transition select-none"
            style={{ ...noSelectTouchStyle, color: iLiked ? PURPLE : "#404040" }}
          >
            {myEmoji ? (
              <span className="text-[20px] leading-none">{myEmoji}</span>
            ) : (
              <Flame size={20} strokeWidth={2} />
            )}
            {totalCount > 0 && <span>{totalCount}</span>}
          </button>
        </div>

        <button
          type="button"
          aria-label="Open comments"
          onClick={onToggleComments}
          onPointerDown={onPrefetchComments}
          onMouseEnter={onPrefetchComments}
          className="flex items-center gap-1.5 text-neutral-700 text-[15px] font-semibold active:scale-95 transition"
        >
          <MessageCircle size={20} strokeWidth={2} />
          {item.commentCount > 0 && <span>{item.commentCount}</span>}
        </button>
      </div>

      {stackEmojis.length > 0 && (
        <div className="flex items-center gap-1">
          {stackEmojis.map((r) => (
            <span
              key={r.emoji}
              className="text-[18px] leading-none"
            >
              {r.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const commentsQueryOptions = (postId: string) => ({
  queryKey: ["post-comments", postId] as const,
  queryFn: () => getPostComments({ data: { postId } }),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
});

function CommentSection({ postId }: { postId: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const { data, isLoading } = useQuery(commentsQueryOptions(postId));
  const add = useMutation({
    mutationFn: (body: string) => addPostComment({ data: { postId, body } }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    },
  });

  const submit = (e: FormEvent) => {
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
      <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100 bg-white">
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

function CheckInMenu({ checkInId }: { checkInId: string }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => deleteCheckIn({ data: { checkInId: checkInId.replace(/^c-/, "") } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
      setConfirmOpen(false);
      toast.success("Check-in deleted");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Couldn't delete check-in");
    },
  });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Check-in options"
            className="h-7 w-7 -mr-1 rounded-full flex items-center justify-center text-neutral-500 hover:bg-black/5 active:scale-95 transition"
          >
            <MoreHorizontal size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            className="text-red-600 focus:text-red-600"
          >
            Delete check-in
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove it from your timeline and your group's feed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                del.mutate();
              }}
              disabled={del.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TimelineCard({ item }: { item: FeedItem }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; kind: "image" | "video" } | null>(null);
  const initials = (item.name || "U").slice(0, 1).toUpperCase();
  const nodes = item.nodes;
  const queryClient = useQueryClient();
  const prefetchComments = () => {
    queryClient.prefetchQuery(commentsQueryOptions(item.id));
  };

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white shadow-sm overflow-hidden select-none" style={noSelectTouchStyle}>
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
          const visual = nodeVisual(node, item.isMe ? (item.name || "").split(" ")[0] : undefined);
          const isPending = node.kind === "pending";
          const canDelete = item.isMe && node.kind === "check_in";
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
                    <div className="flex items-center gap-1 shrink-0">
                      {visual.time && (
                        <span className="text-[12px] text-neutral-400">{visual.time}</span>
                      )}
                      {canDelete && (
                        <CheckInMenu checkInId={node.id} />
                      )}
                    </div>
                  </div>
                  {visual.body && <ExpandableText text={visual.body} />}
                  {visual.photoUrl && (() => {
                    const isVideo = /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(visual.photoUrl);
                    const src = visual.photoUrl;
                    return (
                      <div className="mt-2 relative">
                        <button
                          type="button"
                          onClick={() => setLightbox({ src, kind: isVideo ? "video" : "image" })}
                          aria-label={isVideo ? "View video" : "View photo"}
                          className="block w-full p-0 border-0 bg-transparent"
                        >
                          {isVideo ? (
                            <video
                              src={src}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full rounded-xl object-cover max-h-[360px] bg-black pointer-events-none"
                            />
                          ) : (
                            <img src={src} alt="" className="w-full rounded-xl object-cover max-h-[360px]" />
                          )}
                          {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="h-14 w-14 rounded-full bg-black/60 flex items-center justify-center">
                                <div className="w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-white ml-1" />
                              </div>
                            </div>
                          )}
                        </button>
                        {visual.activity && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-[13px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 pointer-events-none">
                            <Flame size={14} />
                            {visual.activity[0].toUpperCase() + visual.activity.slice(1)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
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

      <ReactionBar item={item} onToggleComments={() => { prefetchComments(); setCommentsOpen(true); }} onPrefetchComments={prefetchComments} commentsOpen={commentsOpen} />
      <Drawer open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DrawerContent className="h-[85vh] flex flex-col p-0">
          <DrawerHeader className="border-b border-neutral-100 py-3">
            <DrawerTitle className="text-center text-[17px] font-bold">Comments</DrawerTitle>
          </DrawerHeader>
          <CommentSection postId={item.id} />
        </DrawerContent>
      </Drawer>
      {lightbox && (
        <MediaLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function ExpandableText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const prev = el.style.webkitLineClamp;
      el.style.webkitLineClamp = "2";
      setOverflows(el.scrollHeight > el.clientHeight + 1);
      el.style.webkitLineClamp = prev;
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div className="mt-1">
      <div
        ref={ref}
        className="text-[15px] text-neutral-900 whitespace-pre-wrap break-words"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {text}
      </div>
      {overflows && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-[14px] font-semibold text-neutral-500 active:opacity-70"
        >
          See more
        </button>
      )}
      {overflows && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1 text-[14px] font-semibold text-neutral-500 active:opacity-70"
        >
          See less
        </button>
      )}
    </div>
  );
}

