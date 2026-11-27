import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { getSocialPost, toggleSocialPostCheer } from "@/lib/posts.functions";
import { FeedCardActions, useLibraryFirstComment } from "../FeedCardActions";
import { useFeedSave } from "../use-feed-save";
import { clock } from "@/components/TimelineCard";
import { newToast } from "../new-toast";
import { CrewAvatar } from "../CrewAvatars";
import { PostCarousel, PostWorkoutCard, INK, MUTED, PostTopBar } from "./PostBits";
import { OwnPostMenu } from "./OwnPostMenu";
import { postSubline } from "@/lib/social-post-subline";
import { PostCommentsSheet } from "./PostComments";

/** One post: carousel, caption, workout and the owner's exact canvas menu. */
export function NewOwnPost({ postId }: { postId: string }) {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: post, isLoading } = useQuery({ queryKey: ["social-post", postId], queryFn: () => getSocialPost({ data: { id: postId } }) });
  const cheerFn = useServerFn(toggleSocialPostCheer);
  const [cheerOverride, setCheerOverride] = useState<boolean | null>(null);
  const [menu, setMenu] = useState(false);
  const [comments, setComments] = useState(false);
  const canComment = !!post && post.commentsOn && post.audience !== "only_me";
  const preview = useLibraryFirstComment(postId, post?.comments ?? 0, canComment);
  const save = useFeedSave("post", postId, post?.savedByMe);
  const back = () => (router.history.canGoBack() ? router.history.back() : void navigate({ to: "/profile" }));

  if (isLoading) return <div className="fixed inset-0 bg-white" aria-busy="true" />;
  if (!post) return (
    <div className="fixed inset-0 bg-white">
      <PostTopBar title="Posts" left={<button type="button" aria-label="Back" onClick={back} className="flex h-11 w-11 items-center justify-center"><ChevronLeft size={26} /></button>} />
      <p className="px-6 pt-10 text-center text-[15px]" style={{ color: MUTED }}>This post isn't available.</p>
    </div>
  );

  const cheered = cheerOverride ?? post.cheeredByMe;
  const cheerCount = Math.max(0, post.cheers + Number(cheered) - Number(post.cheeredByMe));
  const toggleCheer = async () => {
    const next = !cheered;
    setCheerOverride(next);
    try {
      await cheerFn({ data: { id: post.id, on: next } });
      await qc.invalidateQueries({ queryKey: ["social-post", post.id] });
      setCheerOverride(null);
      void qc.invalidateQueries({ queryKey: ["home-social-posts"] });
      void qc.invalidateQueries({ queryKey: ["crew-social-posts"] });
    } catch { setCheerOverride(!next); newToast("Couldn't cheer. Try again."); }
  };

  return (
    <div className="redesign-step3 fixed inset-0 overflow-y-auto bg-white pb-[calc(32px+env(safe-area-inset-bottom))]" style={{ color: INK }} data-scroll-root>
      <PostTopBar
        title="Posts"
        left={<button type="button" aria-label="Back" onClick={back} className="flex h-11 w-11 items-center justify-center"><ChevronLeft size={26} /></button>}
        right={post.isMine ? <button type="button" aria-label="Post options" onClick={() => setMenu(true)} className="flex h-11 w-11 items-center justify-center"><MoreHorizontal size={22} /></button> : undefined}
      />
      <div className="flex items-center gap-2.5 px-4 pb-3">
        <CrewAvatar member={post.author} size={36} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold">{post.isMine ? "You" : post.author.name}</div>
          <div className="text-[12px]" style={{ color: MUTED }}>{postSubline(post.audience, post.viewerCrews, clock(post.createdAt))}</div>
        </div>
      </div>
      <PostCarousel items={post.items} />
      {post.caption && <p className="whitespace-pre-wrap break-words px-4 pt-3 text-[15px]" style={{ lineHeight: 1.4 }}>{post.caption}</p>}
      {post.workout && <PostWorkoutCard workout={post.workout} isMine={post.isMine} postId={post.id} author={null} />}
      <div className="pt-1.5">
        <FeedCardActions cheer={() => void toggleCheer()} cheered={cheered} cheers={cheerCount} comments={post.comments} openComments={() => setComments(true)} preview={preview} canComment={canComment}
          save={post.isMine ? { ...save, toggle: () => void save.toggle(), count: post.saves + Number(save.saved) - Number(post.savedByMe) } : { ...save, toggle: () => void save.toggle() }} />
      </div>

      <OwnPostMenu post={post} open={menu} onOpenChange={setMenu} onDeleted={back} />
      <PostCommentsSheet postId={post.id} open={comments} onOpenChange={setComments} canComment={post.commentsOn} />
    </div>
  );
}
