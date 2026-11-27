import { FeedCardActions, useLibraryFirstComment } from "../FeedCardActions";
import { useFeedSave } from "../use-feed-save";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import type { SocialPostView } from "@/lib/social-post-types";
import { toggleSocialPostCheer } from "@/lib/posts.functions";
import { clock } from "@/components/TimelineCard";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { SafetyActions } from "@/components/safety/SafetyActions";
import { CrewAvatar } from "../CrewAvatars";
import { PostCarousel, PostWorkoutCard, INK, MUTED } from "./PostBits";
import { PostCommentsSheet } from "./PostComments";
import { OwnPostMenu } from "./OwnPostMenu";
import { postSubline } from "@/lib/social-post-subline";
import { MoreHorizontal } from "lucide-react";

/** A camera-roll post in the crew Posts feed: the 1d card with no tag at all. */
export function SocialPostCard({ post, groupId }: { post: SocialPostView; groupId: string }) {
  const qc = useQueryClient();
  const cheerFn = useServerFn(toggleSocialPostCheer);
  const [cheered, setCheered] = useState(post.cheeredByMe);
  const [comments, setComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const canComment = post.commentsOn && post.audience !== "only_me";
  const preview = useLibraryFirstComment(post.id, post.comments, canComment);
  const save = useFeedSave("post", post.id, post.savedByMe);
  const firstName = post.author.name.split(" ")[0] || "Member";
  const cheer = async () => {
    const next = !cheered;
    setCheered(next);
    try { await cheerFn({ data: { id: post.id, on: next } }); void qc.invalidateQueries({ queryKey: ["crew-social-posts", groupId] }); } catch { setCheered(!next); }
  };
  return (
    <article id={`social-${post.id}`} className="overflow-hidden rounded-[20px] bg-white" style={{ margin: "12px 12px 0", color: INK }}>
      <header className="flex items-center gap-2" style={{ padding: "12px 14px" }}>
        <MemberProfileLink userId={post.author.id} isYou={post.isMine} className="shrink-0">
          <span className="sr-only">{post.isMine ? "Your profile" : `${post.author.name}'s profile`}</span>
          <CrewAvatar member={post.author} size={40} />
        </MemberProfileLink>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight">{post.isMine ? "You" : post.author.name}</div>
          <div className="truncate text-[12px]" style={{ color: MUTED }}>{postSubline(post.audience, post.viewerCrews, clock(post.createdAt))}</div>
        </div>
        {post.isMine && (
          <button type="button" aria-label="Post options" onClick={() => setMenu(true)} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-[var(--new-muted)]"><MoreHorizontal className="size-5" /></button>
        )}
        {!post.isMine && (
          <span className="-mr-2 shrink-0 [&>button]:h-9 [&>button]:w-9 [&>button]:min-w-9 [&>button]:bg-transparent! [&>button]:p-0 [&>button]:text-[var(--new-muted)]! [&>button>svg]:size-5">
            <SafetyActions target={{ userId: post.author.id, name: post.author.name, avatarUrl: post.author.avatarUrl, avatarColor: post.author.avatarColor, groupId, type: "post", targetId: post.id, update: true }} />
          </span>
        )}
      </header>
      {post.isMine ? <Link to="/post/$postId" params={{ postId: post.id }} className="block w-full"><PostCarousel items={post.items} aspectRatio="4 / 5" /></Link> : <PostCarousel items={post.items} aspectRatio="4 / 5" />}
      {post.caption && <p className="whitespace-pre-wrap break-words text-[14px]" style={{ padding: "10px 14px 0", lineHeight: 1.4 }}>{post.caption}</p>}
      {post.workout && <PostWorkoutCard workout={post.workout} isMine={post.isMine} postId={post.id} author={post.isMine ? null : { ...post.author, firstName, when: clock(post.createdAt) }} />}
      <FeedCardActions cheer={() => void cheer()} cheered={cheered} cheers={Math.max(0, post.cheers + Number(cheered) - Number(post.cheeredByMe))} comments={post.comments} openComments={() => setComments(true)} preview={preview} canComment={canComment} save={save} />
      {post.isMine && <OwnPostMenu post={post} open={menu} onOpenChange={setMenu} />}
      <PostCommentsSheet postId={post.id} open={comments} onOpenChange={setComments} canComment={post.commentsOn} />
    </article>
  );
}
