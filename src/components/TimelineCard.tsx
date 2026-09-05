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
  toggleCommentLike,
  deleteCheckIn,
} from "@/lib/daily-posts.functions";
import { hapticLight } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import {
  Hourglass,
  Flame,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Send,
  Loader2,
  ImagePlus,
  Heart,
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

function formatClockTime(d: Date) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const clock = formatClockTime(d);
  if (d >= startOfToday) return `Today at ${clock}`;
  if (d >= startOfYesterday) return `Yesterday at ${clock}`;
  const weekAgo = new Date(startOfToday.getTime() - 6 * 86400000);
  if (d >= weekAgo) {
    return `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${clock}`;
  }
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${clock}`;
}


function VideoThumb({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="auto"
      // iOS Safari won't paint a first frame from preload alone or from a
      // bare currentTime seek. Briefly play muted then pause so the frame
      // is rendered; without this the thumbnail stays solid black.
      onLoadedMetadata={() => {
        const v = ref.current;
        if (!v || primedRef.current) return;
        primedRef.current = true;
        v.play()
          .then(() => {
            v.pause();
            try {
              v.currentTime = 0.1;
            } catch {}
          })
          .catch(() => {
            try {
              v.currentTime = 0.1;
            } catch {}
          });
      }}
      className="w-full h-full object-cover pointer-events-none"
    />
  );
}


function VideoBlock({ src }: { src: string }) {
  return (
    <div className="w-full aspect-square rounded-xl overflow-hidden bg-black relative">
      <VideoThumb src={src} />
    </div>
  );
}


const MOOD_META: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  crushed: { label: "Crushed it", emoji: "🏆", color: "#16A34A", bg: "#ECFDF3", border: "#D1FADF" },
  showed: { label: "Showed up", emoji: "💪", color: PURPLE, bg: "#F4EEFF", border: "#E5D9FE" },
  struggled: { label: "Struggled", emoji: "😤", color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" },
};

type Visual = {
  emoji: string;
  emojiColor?: string;
  emojiSize?: number;
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
        label: "Today's Commitment",
        labelColor: PURPLE,
        bg: "#F4EEFF",
        border: "#E5D9FE",
        body: node.text,
        time: timeLabel(node.at),
        dot: { fill: PURPLE, ring: PURPLE },
      };
    case "ritual_missed":
      return {
        emoji: "😴",
        label: "Missed commitment",
        labelColor: "#B45309",
        bg: "#FEF6E4",
        border: "#FBE4B6",
        body: `Your group is already moving${firstName ? `, ${firstName}` : ""}. Jump in.`,
        time: timeLabel(node.at),
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
        time: timeLabel(node.at),
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
        time: timeLabel(node.at),
        dot: { fill: mood?.color ?? "#16A34A", ring: mood?.color ?? "#16A34A" },
      };
    }
    case "check_in_missed":
      return {
        emoji: "○",
        emojiColor: "#9CA3AF",
        emojiSize: 22,
        label: "Missed Check-in",
        labelColor: "#DC2626",
        bg: "#FEF2F2",
        border: "#FECACA",
        body: "Your group missed you yesterday. They're showing up again today.",
        time: timeLabel(node.at),
        dot: { fill: "#FFFFFF", ring: "#DC2626" },
      };
    case "pending":
      return null;
  }
}

const seenKey = (postId: string) => `post-comments-seen:${postId}`;

export function getSeenCommentCount(postId: string): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(seenKey(postId));
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function markCommentsSeen(postId: string, count: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(seenKey(postId), String(count));
}

function ReactionBar({
  item,
  onToggleComments,
  onPrefetchComments,
  unreadComments = 0,
}: {
  item: FeedItem;
  onToggleComments: () => void;
  onPrefetchComments: () => void;
  commentsOpen?: boolean;
  unreadComments?: number;
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
    void hapticLight();
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
    void hapticLight();
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
              onCloseAutoFocus={(event) => event.preventDefault()}
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
          className="relative flex items-center gap-1.5 text-neutral-700 text-[15px] font-semibold active:scale-95 transition"
        >
          <MessageCircle size={20} strokeWidth={2} />
          {item.commentCount > 0 && <span>{item.commentCount}</span>}
          {unreadComments > 0 && (
            <span
              className="absolute -top-1.5 -left-2 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
              style={{ background: PURPLE }}
              aria-label={`${unreadComments} new comments`}
            >
              {unreadComments > 9 ? "9+" : unreadComments}
            </span>
          )}
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

function CommentLikeButton({ comment, postId }: { comment: { id: string; likeCount: number; likedByMe: boolean }; postId: string }) {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<{ liked: boolean; count: number } | null>(null);
  const liked = optimistic ? optimistic.liked : comment.likedByMe;
  const count = optimistic ? optimistic.count : comment.likeCount;
  const like = useMutation({
    mutationFn: () => toggleCommentLike({ data: { commentId: comment.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
    },
    onError: () => {
      setOptimistic(null);
      toast.error("Couldn't update like");
    },
  });

  return (
    <button
      type="button"
      aria-label={liked ? "Unlike comment" : "Like comment"}
      aria-pressed={liked}
      onClick={() => {
        if (like.isPending) return;
        hapticLight();
        setOptimistic({ liked: !liked, count: count + (liked ? -1 : 1) });
        like.mutate();
      }}
      className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-neutral-400 active:opacity-60"
    >
      <Heart
        className={liked ? "h-4 w-4 text-rose-500" : "h-4 w-4"}
        fill={liked ? "currentColor" : "none"}
      />
      {count > 0 && <span className={liked ? "text-rose-500 font-semibold" : ""}>{count}</span>}
    </button>
  );
}

function CommentSection({ postId, groupId }: { postId: string; groupId: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; kind: "image" | "video" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery(commentsQueryOptions(postId));
  const add = useMutation({
    mutationFn: (vars: { body: string; mediaUrl?: string | null; mediaType?: string | null }) =>
      addPostComment({ data: { postId, ...vars } }),
    onSuccess: () => {
      setText("");
      clearPending();
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    },
  });

  const clearPending = () => {
    setPendingFile(null);
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File is too large (max 50MB)");
      return;
    }
    setUploadError(null);
    setPendingFile(file);
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (add.isPending || uploading) return;
    if (!body && !pendingFile) return;

    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    if (pendingFile) {
      setUploading(true);
      setUploadError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error("Not signed in");
        const mime = pendingFile.type || "image/jpeg";
        const ext = (pendingFile.name.split(".").pop() || (mime.startsWith("video/") ? "mp4" : "jpg")).toLowerCase();
        const path = `${groupId}/${userId}-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-photos")
          .upload(path, pendingFile, { contentType: mime, upsert: false });
        if (upErr) throw upErr;
        mediaUrl = path;
        mediaType = mime;
      } catch (err) {
        setUploadError((err as Error).message || "Upload failed");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    add.mutate({ body, mediaUrl, mediaType });
  };

  const busy = add.isPending || uploading;
  const canSend = (!!text.trim() || !!pendingFile) && !busy;

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
                    {c.body && (
                      <div className="text-[15px] text-neutral-800 whitespace-pre-wrap break-words mt-0.5">{c.body}</div>
                    )}
                    {c.mediaUrl && (
                      <button
                        type="button"
                        onClick={() => setLightbox({ src: c.mediaUrl!, kind: c.mediaKind === "video" ? "video" : "image" })}
                        className="mt-2 block rounded-xl overflow-hidden bg-neutral-100 max-w-[220px]"
                      >
                        {c.mediaKind === "video" ? (
                          <video src={c.mediaUrl} className="w-full max-h-64 object-cover" muted playsInline preload="metadata" />
                        ) : (
                          <img src={c.mediaUrl} alt="" className="w-full max-h-64 object-cover" />
                        )}
                      </button>
                    )}
                    <CommentLikeButton comment={c} postId={postId} />
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
      {pendingPreview && (
        <div className="px-4 pt-3 flex items-center gap-3">
          <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-neutral-100">
            {pendingFile?.type.startsWith("video/") ? (
              <video src={pendingPreview} className="h-full w-full object-cover" muted playsInline />
            ) : (
              <img src={pendingPreview} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <button type="button" onClick={clearPending} className="text-[13px] text-neutral-500 underline">
            Remove
          </button>
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100 bg-white mb-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Add photo or video"
          className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0"
        >
          <ImagePlus size={18} className="text-neutral-500" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          maxLength={1000}
          className="flex-1 h-10 rounded-full bg-neutral-100 border border-transparent px-4 text-[16px] outline-none focus:border-[#7C3AED] focus:bg-white"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Post comment"
          className="h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-50 shrink-0"
          style={{ background: canSend ? PURPLE : "#E5E5E5" }}
        >
          {busy ? (
            <Loader2 size={16} className="text-white animate-spin" />
          ) : (
            <Send size={16} className={canSend ? "text-white" : "text-neutral-400"} />
          )}
        </button>
      </form>
      {(add.isError || uploadError) && (
        <div className="text-[12px] text-red-500 px-4 pb-2">{uploadError ?? (add.error as Error)?.message}</div>
      )}
      {lightbox && <MediaLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />}
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

export function TimelineCard({ item, autoOpenComments }: { item: FeedItem; autoOpenComments?: boolean }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  useEffect(() => {
    setSeenCount(getSeenCommentCount(item.id));
  }, [item.id]);
  useEffect(() => {
    if (autoOpenComments) setCommentsOpen(true);
  }, [autoOpenComments]);
  const unreadComments = Math.max(0, item.commentCount - seenCount);
  const openComments = () => {
    markCommentsSeen(item.id, item.commentCount);
    setSeenCount(item.commentCount);
    setCommentsOpen(true);
  };
  useEffect(() => {
    if (commentsOpen) {
      markCommentsSeen(item.id, item.commentCount);
      setSeenCount(item.commentCount);
    }
  }, [commentsOpen, item.id, item.commentCount]);
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
          <div className="text-[13px] text-neutral-400 mt-0.5">{(() => {
            const c = nodes.filter((n) => n.kind !== "pending").length;
            return `${c} ${c === 1 ? "update" : "updates"}`;
          })()}</div>

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
                      <span className="text-[18px] leading-none" style={visual.emojiColor ? { color: visual.emojiColor, fontSize: visual.emojiSize ?? 18 } : undefined}>{visual.emoji}</span>
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
                            <VideoBlock src={src} />
                          ) : (
                            <img src={src} alt="" className="w-full rounded-xl object-cover max-h-[360px]" />
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

      <ReactionBar item={item} unreadComments={unreadComments} onToggleComments={() => { prefetchComments(); openComments(); }} onPrefetchComments={prefetchComments} commentsOpen={commentsOpen} />
      <Drawer open={commentsOpen} onOpenChange={setCommentsOpen} repositionInputs={false}>
        <DrawerContent className="h-[85vh] flex flex-col p-0">
          <DrawerHeader className="border-b border-neutral-100 py-3">
            <DrawerTitle className="text-center text-[17px] font-bold">Comments</DrawerTitle>
          </DrawerHeader>
          <CommentSection postId={item.id} groupId={item.groupId} />
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
      const clone = el.cloneNode(true) as HTMLDivElement;
      clone.style.position = "absolute";
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      clone.style.display = "-webkit-box";
      (clone.style as any).webkitLineClamp = "2";
      (clone.style as any).webkitBoxOrient = "vertical";
      clone.style.overflow = "hidden";
      clone.style.width = `${el.clientWidth}px`;
      el.parentElement?.appendChild(clone);
      setOverflows(clone.scrollHeight > clone.clientHeight + 1);
      clone.remove();
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

