import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, ImagePlus, Loader2, Send } from "lucide-react";
import { stabilizeSignedUrls } from "@/lib/stable-urls";
import { supabase } from "@/integrations/supabase/client";
import { addPostComment, getPostComments, toggleCommentLike, type FeedItem } from "@/lib/daily-posts.functions";
import { getMyGroupStatus } from "@/lib/groups.functions";
import { getUnreadCommentCounts, markPostCommentsRead } from "@/lib/comment-reads.functions";
import { markReadAndSyncBadge } from "@/lib/badge-client";
import { hapticLight } from "@/lib/native";
import { QUICK_REPLIES } from "@/lib/feed-view";
import { MediaLightbox } from "@/components/MediaLightbox";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import GifPickerSheet from "@/components/GifPickerSheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { FeedAvatar } from "@/components/feed/FeedMedia";

const PURPLE = "#7C3AED";

export const commentsQueryOptions = (postId: string) => ({
  queryKey: ["post-comments", postId] as const,
  queryFn: () => getPostComments({ data: { postId } }).then(stabilizeSignedUrls),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
});

export const unreadCommentsQueryOptions = () => ({
  queryKey: ["comment-unreads"] as const,
  queryFn: () => getUnreadCommentCounts(),
  staleTime: 30_000,
});

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Posts a ready-made comment ("Let's go", "🔥"…) and refreshes the feed. */
export function usePostQuickComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addPostComment({ data: { postId, body } }),
    onSuccess: () => {
      void hapticLight();
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't send that"),
  });
}

export function QuickReplyChips({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_REPLIES.map((t) => (
        <button
          key={t}
          type="button"
          disabled={disabled}
          onClick={() => onPick(t)}
          className="relative h-8 rounded-2xl border bg-white px-3 text-[13px] font-semibold text-neutral-800 after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] active:bg-neutral-50 disabled:opacity-50"
          style={{ borderColor: "#E7E3DE" }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/**
 * Open/close state for one post's comments sheet, plus its unread count.
 * Unread comments are remembered at open time so the sheet can mark them "New".
 */
export function useCommentsSheet(item: Pick<FeedItem, "id" | "groupId" | "commentCount" | "name" | "isMe">) {
  const qc = useQueryClient();
  const { data: unreadMap } = useQuery(unreadCommentsQueryOptions());
  const [open, setOpen] = useState(false);
  const [seenNow, setSeenNow] = useState(false);
  const [unreadAtOpen, setUnreadAtOpen] = useState(0);
  useEffect(() => setSeenNow(false), [item.id]);
  const unread = seenNow ? 0 : Math.min(item.commentCount, unreadMap?.[item.id] ?? 0);

  const prefetch = () => {
    void qc.prefetchQuery(commentsQueryOptions(item.id));
  };
  const openSheet = () => {
    prefetch();
    setUnreadAtOpen(unread);
    void markReadAndSyncBadge({
      groupId: item.groupId,
      kinds: ["comment", "reply", "comment_like", "reaction", "checkin"],
      postId: item.id,
    });
    setSeenNow(true);
    void markPostCommentsRead({ data: { postId: item.id } })
      .then(() => qc.invalidateQueries({ queryKey: ["comment-unreads"] }))
      .catch(() => {});
    setOpen(true);
  };

  const sheet = (
    <CommentsSheet
      open={open}
      onOpenChange={setOpen}
      postId={item.id}
      groupId={item.groupId}
      authorFirstName={(item.name || "").split(" ")[0] || "them"}
      ownPost={item.isMe}
      unreadAtOpen={unreadAtOpen}
      fallbackCount={item.commentCount}
    />
  );
  return { unread, openSheet, prefetch, sheet };
}

function CommentLikeButton({ comment, postId }: { comment: { id: string; likeCount: number; likedByMe: boolean }; postId: string }) {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<{ liked: boolean; count: number } | null>(null);
  const liked = optimistic ? optimistic.liked : comment.likedByMe;
  const count = optimistic ? optimistic.count : comment.likeCount;
  const like = useMutation({
    mutationFn: () => toggleCommentLike({ data: { commentId: comment.id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["post-comments", postId] }),
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
        void hapticLight();
        setOptimistic({ liked: !liked, count: count + (liked ? -1 : 1) });
        like.mutate();
      }}
      className="-ml-2 flex h-9 min-w-9 items-center gap-1 px-2 text-[13px] font-semibold active:opacity-60"
      style={{ color: liked ? "#E11D48" : "#78716C" }}
    >
      <Heart size={15} fill={liked ? "currentColor" : "none"} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

function CommentsSheet({
  open,
  onOpenChange,
  postId,
  groupId,
  authorFirstName,
  ownPost,
  unreadAtOpen,
  fallbackCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  postId: string;
  groupId: string;
  authorFirstName: string;
  ownPost: boolean;
  unreadAtOpen: number;
  fallbackCount: number;
}) {
  const { data } = useQuery({ ...commentsQueryOptions(postId), enabled: open });
  const count = data?.comments.length ?? fallbackCount;
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="flex h-[85vh] flex-col p-0">
        <DrawerHeader className="border-b py-3" style={{ borderColor: "#F0EDE9" }}>
          <DrawerTitle className="text-center text-[17px] font-bold">
            {count > 0 ? `Comments · ${count}` : "Comments"}
          </DrawerTitle>
        </DrawerHeader>
        {open && (
          <CommentThread
            postId={postId}
            groupId={groupId}
            authorFirstName={authorFirstName}
            ownPost={ownPost}
            unreadAtOpen={unreadAtOpen}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function CommentThread({
  postId,
  groupId,
  authorFirstName,
  ownPost,
  unreadAtOpen,
}: {
  postId: string;
  groupId: string;
  authorFirstName: string;
  ownPost: boolean;
  unreadAtOpen: number;
}) {
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
  const [gifOpen, setGifOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery(commentsQueryOptions(postId));
  const { data: me } = useQuery({ queryKey: ["my-group-status"], queryFn: () => getMyGroupStatus() });

  const clearPending = () => {
    setPendingFile(null);
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const add = useMutation({
    mutationFn: (vars: { body: string; mediaUrl?: string | null; mediaType?: string | null; parentCommentId?: string | null }) =>
      addPostComment({ data: { postId, ...vars } }),
    onSuccess: (_res, vars) => {
      setText("");
      if (vars.parentCommentId) setExpanded((prev) => ({ ...prev, [vars.parentCommentId!]: true }));
      setReplyTo(null);
      clearPending();
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    },
  });

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
    add.mutate({ body, mediaUrl, mediaType, parentCommentId: replyTo?.id ?? null });
  };

  const busy = add.isPending || uploading;
  const canSend = (!!text.trim() || !!pendingFile) && !busy;

  const allComments = data?.comments ?? [];
  const topLevel = allComments.filter((c) => !c.parentCommentId);
  const repliesByParent = new Map<string, typeof allComments>();
  allComments.forEach((c) => {
    if (!c.parentCommentId) return;
    const list = repliesByParent.get(c.parentCommentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentCommentId, list);
  });

  // The newest `unreadAtOpen` comments from other people are the new ones.
  const newIds = useMemo(() => {
    if (!unreadAtOpen || !data) return new Set<string>();
    return new Set(
      [...data.comments]
        .filter((c) => !c.isMine)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, unreadAtOpen)
        .map((c) => c.id),
    );
    // Fix the set on first load so a refetch doesn't reshuffle it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadAtOpen, Boolean(data)]);

  // Open the thread of a new reply so it's visible.
  useEffect(() => {
    if (!newIds.size) return;
    const open: Record<string, boolean> = {};
    for (const c of allComments) if (c.parentCommentId && newIds.has(c.id)) open[c.parentCommentId] = true;
    if (Object.keys(open).length) setExpanded((prev) => ({ ...open, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newIds]);

  const startReply = (id: string, name: string, isMine: boolean) => {
    void hapticLight();
    setReplyTo({ id, name });
    if (!isMine) {
      const handle = `@${name.split(" ")[0]} `;
      setText((prev) => (prev.startsWith("@") ? prev : handle + prev));
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const renderComment = (c: (typeof allComments)[number], isReply: boolean) => {
    const isNew = newIds.has(c.id);
    return (
      <div className="relative flex items-start gap-3">
        {isNew && (
          <span
            className="absolute -left-3 top-3.5 h-2 w-2 rounded-full"
            style={{ background: PURPLE }}
            aria-hidden
          />
        )}
        <MemberProfileLink userId={c.userId} isYou={c.isMine} className="shrink-0">
          <FeedAvatar url={c.authorAvatarUrl} color={c.authorColor} name={c.authorName} size={isReply ? 28 : 36} />
        </MemberProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-[14px] font-bold text-neutral-900">{c.isMine ? "You" : c.authorName}</span>
            <span className="text-[12px] text-neutral-500">{timeAgo(c.createdAt)}</span>
            {isNew && (
              <span className="rounded-full px-1.5 py-px text-[10px] font-extrabold text-white" style={{ background: PURPLE }}>
                New
              </span>
            )}
          </div>
          {c.body && (
            <div className="mt-0.5 whitespace-pre-wrap break-words text-[15px] text-neutral-900">{c.body}</div>
          )}
          {c.mediaUrl && (
            <button
              type="button"
              aria-label={c.mediaKind === "video" ? "Open video" : "Open photo"}
              onClick={() => setLightbox({ src: c.mediaUrl!, kind: c.mediaKind === "video" ? "video" : "image" })}
              className="mt-2 block overflow-hidden rounded-xl bg-neutral-100"
            >
              {c.mediaKind === "video" ? (
                <video src={c.mediaUrl} className="max-h-[120px] w-auto object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={c.mediaUrl} alt="" className="max-h-[120px] w-auto object-cover" />
              )}
            </button>
          )}
          <div className="mt-0.5 flex items-center gap-3">
            <CommentLikeButton comment={c} postId={postId} />
            <button
              type="button"
              onClick={() => startReply(c.parentCommentId ?? c.id, c.authorName, c.isMine)}
              className="flex h-9 items-center text-[13px] font-semibold text-neutral-500 active:opacity-60"
            >
              Reply
            </button>
          </div>
        </div>
      </div>
    );
  };

  const empty = !isLoading && allComments.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 select-none overflow-y-auto px-5 py-3">
        {isLoading ? (
          <div className="space-y-4" aria-hidden>
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 w-24 animate-pulse rounded bg-neutral-200" />
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-neutral-200" />
                </div>
              </div>
            ))}
          </div>
        ) : empty ? (
          <p className="py-10 text-center text-[15px] text-neutral-500">
            {ownPost ? "No comments yet." : `No comments yet. Say something to ${authorFirstName}.`}
          </p>
        ) : (
          <ul className="space-y-4">
            {topLevel.map((c) => {
              const replies = repliesByParent.get(c.id) ?? [];
              const isOpen = !!expanded[c.id];
              return (
                <li key={c.id}>
                  {renderComment(c, false)}
                  {replies.length > 0 && (
                    <div className="mt-1 pl-12">
                      {!isOpen ? (
                        <button
                          type="button"
                          onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: true }))}
                          className="flex h-9 items-center gap-2 text-[13px] font-semibold text-neutral-500 active:opacity-60"
                        >
                          <span className="h-px w-6 bg-neutral-300" />
                          View {replies.length} {replies.length === 1 ? "reply" : "replies"}
                        </button>
                      ) : (
                        <div className="space-y-3">
                          {replies.map((r) => (
                            <div key={r.id}>{renderComment(r, true)}</div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: false }))}
                            className="flex h-9 items-center gap-2 text-[13px] font-semibold text-neutral-500 active:opacity-60"
                          >
                            <span className="h-px w-6 bg-neutral-300" />
                            Hide replies
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {empty && !ownPost && (
        <div className="px-4 pb-2">
          <QuickReplyChips
            disabled={busy}
            onPick={(t) => add.mutate({ body: t, parentCommentId: null })}
          />
        </div>
      )}
      {replyTo && (
        <div className="flex items-center justify-between bg-neutral-50 px-4 py-2 text-[13px] text-neutral-500">
          <span>Replying to {replyTo.name}</span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="flex h-8 w-8 items-center justify-center font-semibold text-neutral-500"
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}
      {pendingPreview && (
        <div className="flex items-center gap-3 px-4 pt-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-neutral-100">
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
      <form onSubmit={submit} className="mb-4 flex items-center gap-2 border-t bg-white px-4 py-3" style={{ borderColor: "#F0EDE9" }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <FeedAvatar url={me?.avatarUrl ?? null} color={PURPLE} name={me?.firstName ?? "You"} size={32} />
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-0.5 rounded-full bg-[#F4F2EF] py-1 pl-4 pr-1 focus-within:ring-2 focus-within:ring-pactara-purple/20">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Add a comment…"}
            maxLength={1000}
            aria-label="Add a comment"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-neutral-500"
          />
          {text.trim() || pendingFile || busy ? (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Post comment"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60"
              style={{ background: PURPLE }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Add photo or video"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-700"
              >
                <ImagePlus size={19} />
              </button>
              <button
                type="button"
                onClick={() => setGifOpen(true)}
                aria-label="Add GIF"
                className="flex h-9 w-10 shrink-0 items-center justify-center rounded-full text-neutral-700"
              >
                <span className="rounded border border-current px-1 py-0.5 text-[10px] font-black leading-none">GIF</span>
              </button>
            </>
          )}
        </div>
      </form>
      {(add.isError || uploadError) && (
        <div className="px-4 pb-2 text-[12px] text-red-600">{uploadError ?? (add.error as Error)?.message}</div>
      )}
      {lightbox && <MediaLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />}
      <GifPickerSheet
        open={gifOpen}
        onClose={() => setGifOpen(false)}
        onSelect={(url) => {
          setGifOpen(false);
          if (add.isPending || uploading) return;
          add.mutate({ body: text.trim(), mediaUrl: url, mediaType: "image/gif", parentCommentId: replyTo?.id ?? null });
        }}
      />
    </div>
  );
}
