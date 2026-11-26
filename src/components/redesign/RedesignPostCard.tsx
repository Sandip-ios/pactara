import { useEffect, useState } from "react";
import { Check, Flame, MessageCircle } from "lucide-react";
import type { FeedItem } from "@/lib/daily-posts.functions";
import type { CheckInNode, UpdateNode } from "@/lib/feed-days";
import { activityMeta } from "@/lib/feed-view";
import { healthWorkoutName } from "@/lib/health-workouts";
import { cheeredByLine, postMetaLine } from "@/lib/redesign-feed-view";
import { clock, OwnPostMenu, useCheers } from "@/components/TimelineCard";
import { useCommentsSheet } from "@/components/feed/CommentsSheet";
import { FeedImage, FeedVideo, isVideoUrl } from "@/components/feed/FeedMedia";
import { MediaLightbox } from "@/components/MediaLightbox";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { SafetyActions } from "@/components/safety/SafetyActions";
import { CrewAvatar } from "@/components/redesign/CrewAvatars";

const INK = "#1C1917";
const MUTED = "#57534E";

type Props =
  | { kind: "checkins"; item: FeedItem; checkIns: CheckInNode[]; autoOpenComments?: boolean }
  | { kind: "update"; item: FeedItem; node: UpdateNode; autoOpenComments?: boolean };

/** The redesign's crew post card: same cheers, comments and menus as the classic card, new layout. */
export function RedesignPostCard(props: Props) {
  const { item } = props;
  const comments = useCommentsSheet(item);
  const cheers = useCheers(item);
  const [lightbox, setLightbox] = useState<{ src: string; kind: "image" | "video" } | null>(null);

  useEffect(() => {
    if (props.autoOpenComments) comments.openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoOpenComments]);

  const checkIns = props.kind === "checkins" ? props.checkIns : [];
  const first = checkIns[0];
  const at = props.kind === "checkins" ? first?.at : props.node.at;
  const activity = first
    ? first.workout?.title ?? (first.health ? healthWorkoutName(first.health.type) : activityMeta(first.activity))
    : null;
  const meta = postMetaLine(at ? clock(at) : "", activity);
  const media =
    props.kind === "checkins"
      ? checkIns.filter((c) => c.photoUrl).map((c) => ({ id: c.id, url: c.photoUrl!, poster: c.posterUrl }))
      : props.node.kind === "thought" && props.node.photoUrl
        ? [{ id: props.node.id, url: props.node.photoUrl, poster: props.node.posterUrl }]
        : [];
  const caption = props.kind === "checkins" ? checkIns.map((c) => c.note).find(Boolean) ?? null : props.node.text;
  const cheered = !!cheers.myEmoji;
  const cheerLine = cheeredByLine(cheers.reactors);

  return (
    <article className="overflow-hidden rounded-[20px] bg-white" style={{ margin: "0 12px 12px", color: INK }}>
      <header className="flex items-center gap-3" style={{ padding: "12px 14px" }}>
        <MemberProfileLink userId={item.userId} isYou={item.isMe} className="shrink-0">
          <span className="sr-only">{item.isMe ? "Your profile" : `${item.name}'s profile`}</span>
          <CrewAvatar member={{ id: item.userId, name: item.name, avatarUrl: item.avatarUrl, avatarColor: item.avatarColor }} size={40} />
        </MemberProfileLink>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold leading-tight">{item.isMe ? "You" : item.name}</div>
          <div className="truncate text-[13px]" style={{ color: MUTED }}>{meta}</div>
        </div>
        {item.isMe && first && <OwnPostMenu checkIn={first} compact />}
        {!item.isMe && (
          <SafetyActions
            target={{
              userId: item.userId,
              name: item.name,
              avatarUrl: item.avatarUrl,
              avatarColor: item.avatarColor,
              groupId: item.groupId,
              type: "post",
              targetId: (props.kind === "checkins" ? first?.id : props.node.id)?.replace(/^[ctr]-/, "") ?? item.id,
              update: props.kind === "update",
            }}
          />
        )}
        {props.kind === "checkins" && (
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold" style={{ background: "#DCFCE7", color: "#15803D" }}>
            <Check size={14} strokeWidth={3} aria-hidden /> Checked in
          </span>
        )}
      </header>

      {media.length > 0 && (
        <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {media.map((m) => (
            <div key={m.id} className="w-full shrink-0 snap-center">
              {isVideoUrl(m.url) ? (
                <FeedVideo src={m.url} poster={m.poster} variant="redesign" onOpen={() => setLightbox({ src: m.url, kind: "video" })} />
              ) : (
                <div className="aspect-[4/3] overflow-hidden [&>div]:h-full [&>div]:aspect-auto">
                  <FeedImage src={m.url} onOpen={() => setLightbox({ src: m.url, kind: "image" })} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {caption && <p className="whitespace-pre-wrap break-words text-[15px]" style={{ padding: "10px 14px 0" }}>{caption}</p>}

      <div className="flex items-center gap-4" style={{ padding: "10px 14px 12px" }}>
        {!item.isMe && (
          <button
            type="button"
            onClick={cheers.toggle}
            aria-pressed={cheered}
            className="flex h-9 items-center gap-1.5 text-[15px] font-bold active:scale-95"
            style={{ color: cheered ? "#C2410C" : INK }}
          >
            <Flame size={19} fill={cheered ? "#EA580C" : "none"} style={{ color: cheered ? "#EA580C" : INK }} aria-hidden /> Cheer
          </button>
        )}
        <button
          type="button"
          onClick={comments.openSheet}
          onPointerDown={comments.prefetch}
          aria-label={item.commentCount > 0 ? `Reply, ${item.commentCount} comments` : "Reply"}
          className="flex h-9 items-center gap-1.5 text-[15px] font-bold active:scale-95"
        >
          <MessageCircle size={19} aria-hidden /> Reply{item.commentCount > 0 ? ` · ${item.commentCount}` : ""}
        </button>
        {cheerLine && <span className="ml-auto min-w-0 truncate text-[13px]" style={{ color: MUTED }}>{cheerLine}</span>}
      </div>
      {comments.sheet}
      {lightbox && <MediaLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />}
    </article>
  );
}
