import { useQuery } from "@tanstack/react-query";
import { Flame, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commentsQueryOptions, type CommentScope } from "@/components/feed/CommentsSheet";
import { getSocialPostComments } from "@/lib/posts.functions";
import { firstVisibleComment, type CommentPreview } from "@/lib/first-comment";

export function useCheckInFirstComment(postId: string, count: number, scope: CommentScope = null) {
  const query = useQuery({ ...commentsQueryOptions(postId, scope), enabled: count > 0 });
  return count > 0 ? firstVisibleComment((query.data?.comments ?? []).map(c => ({ id: c.id, userId: c.userId, name: c.authorName, body: c.body, at: c.createdAt }))) : null;
}

export function useLibraryFirstComment(postId: string, count: number, allowed: boolean) {
  const query = useQuery({ queryKey: ["social-post-comments", postId], queryFn: () => getSocialPostComments({ data: { id: postId } }), enabled: allowed && count > 0 });
  // The authenticated comment read excludes blocked pairs before returning rows.
  return allowed && count > 0 ? firstVisibleComment((query.data ?? []).map(c => ({ ...c, userId: "" }))) : null;
}

/** New-only shared card actions. Comments and their count share one tap target. */
export function FeedCardActions({ cheer, cheered, cheers, comments, openComments, prefetchComments, cheerLine, preview, canComment = true }: {
  cheer?: (() => void) | undefined;
  cheered: boolean;
  cheers: number;
  comments: number;
  openComments: () => void;
  prefetchComments?: (() => void) | undefined;
  cheerLine?: string | null | undefined;
  preview: CommentPreview | null;
  canComment?: boolean;
}) {
  const visiblePreview = canComment ? preview : null;
  return <>
    <div className={`flex items-center gap-4 px-3.5 pt-2.5 text-[var(--new-ink-deep)] ${visiblePreview ? "pb-2.5" : "pb-3"}`}>
      {cheer && <Button variant="ghost" aria-label="Cheer" aria-pressed={cheered} onClick={cheer} className="relative h-[22px] min-h-0 min-w-0 justify-start gap-[5px] rounded-none p-0 after:absolute after:-inset-y-[11px] after:left-1/2 after:w-full after:min-w-11 after:-translate-x-1/2 after:content-[''] hover:bg-transparent">
        <Flame className={`!size-[22px] ${cheered ? "fill-[var(--new-orange-icon)] text-[var(--new-orange-icon)]" : "text-[var(--new-ink-deep)]"}`} strokeWidth={2} aria-hidden />
        {cheers > 0 && <span className="text-[14px] font-bold tabular-nums text-[var(--new-ink-deep)]">{cheers}</span>}
      </Button>}
      {canComment && <Button variant="ghost" aria-label="Comments" onClick={openComments} onPointerDown={prefetchComments} className="relative h-[22px] min-h-0 min-w-0 justify-start gap-[5px] rounded-none p-0 text-[var(--new-ink-deep)] after:absolute after:-inset-y-[11px] after:left-1/2 after:w-full after:min-w-11 after:-translate-x-1/2 after:content-[''] hover:bg-transparent">
        <MessageCircle className="!size-[22px]" strokeWidth={2} aria-hidden />
        {comments > 0 && <span className="text-[14px] font-bold tabular-nums">{comments}</span>}
      </Button>}
      {cheerLine && <span className="ml-auto min-w-0 truncate text-[13px] text-[var(--new-muted)]">{cheerLine}</span>}
    </div>
    {visiblePreview && <div className="px-3.5 pb-3 text-[14px] leading-[1.4] text-[var(--new-ink-deep)]">
      <Button variant="ghost" aria-label={`Comments: ${visiblePreview.name} ${visiblePreview.body}`} onClick={openComments} className="relative block h-auto min-h-0 w-full rounded-none p-0 text-left text-[14px] font-normal leading-[1.4] after:absolute after:inset-x-0 after:top-1/2 after:min-h-11 after:h-full after:-translate-y-1/2 after:content-[''] hover:bg-transparent">
        <span className="block truncate"><b className="font-bold">{visiblePreview.name.split(" ")[0]}</b> {visiblePreview.body}</span>
      </Button>
    </div>}
  </>;
}