import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, MessageCircle } from "lucide-react";
import type { SocialPostView } from "@/lib/social-post-types";
import { toggleSocialPostCheer } from "@/lib/posts.functions";
import { clock } from "@/components/TimelineCard";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { SafetyActions } from "@/components/safety/SafetyActions";
import { CrewAvatar } from "../CrewAvatars";
import { PostCarousel, PostWorkoutCard, INK, MUTED } from "./PostBits";
import { PostCommentsSheet } from "./PostComments";

/** A camera-roll post in the crew Posts feed: the 1d card with no tag at all. */
export function SocialPostCard({ post, groupId }: { post: SocialPostView; groupId: string }) {
  const qc = useQueryClient();
  const cheerFn = useServerFn(toggleSocialPostCheer);
  const [cheered, setCheered] = useState(post.cheeredByMe);
  const [comments, setComments] = useState(false);
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
          <div className="truncate text-[12px]" style={{ color: MUTED }}>{clock(post.createdAt)}</div>
        </div>
        {!post.isMine && (
          <span className="-mr-2 shrink-0 [&>button]:h-9 [&>button]:w-9 [&>button]:min-w-9 [&>button]:bg-transparent! [&>button]:p-0 [&>button]:text-[var(--new-muted)]! [&>button>svg]:size-5">
            <SafetyActions target={{ userId: post.author.id, name: post.author.name, avatarUrl: post.author.avatarUrl, avatarColor: post.author.avatarColor, groupId, type: "post", targetId: post.id, update: true }} />
          </span>
        )}
      </header>
      {post.isMine ? <Link to="/post/$postId" params={{ postId: post.id }} className="block"><PostCarousel items={post.items} height={300} /></Link> : <PostCarousel items={post.items} height={300} />}
      {post.caption && <p className="whitespace-pre-wrap break-words text-[14px]" style={{ padding: "10px 14px 0", lineHeight: 1.4 }}>{post.caption}</p>}
      {post.workout && <PostWorkoutCard workout={post.workout} isMine={post.isMine} postId={post.id} author={post.isMine ? null : { ...post.author, firstName, when: clock(post.createdAt) }} />}
      <div className="flex items-center gap-4" style={{ padding: "10px 14px 12px" }}>
        {!post.isMine && (
          <button type="button" onClick={() => void cheer()} aria-pressed={cheered} className="flex h-9 items-center gap-1.5 text-[13px] font-bold active:scale-95" style={{ color: cheered ? "#C2410C" : INK }}>
            <Flame size={18} fill={cheered ? "#EA580C" : "none"} style={{ color: cheered ? "#EA580C" : INK }} aria-hidden /> Cheer
          </button>
        )}
        {post.commentsOn && (
          <button type="button" onClick={() => setComments(true)} className="flex h-9 items-center gap-1.5 text-[13px] font-bold active:scale-95" style={{ color: INK }}>
            <MessageCircle size={18} aria-hidden /> Reply{post.comments > 0 ? ` · ${post.comments}` : ""}
          </button>
        )}
      </div>
      <PostCommentsSheet postId={post.id} open={comments} onOpenChange={setComments} canComment={post.commentsOn} />
    </article>
  );
}
