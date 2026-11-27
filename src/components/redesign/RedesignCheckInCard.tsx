import { useEffect, useState } from "react";
import { Check, ChevronRight, Flame, MessageCircle } from "lucide-react";
import type { FeedItem } from "@/lib/daily-posts.functions";
import type { CheckInNode } from "@/lib/feed-days";
import { activityMeta } from "@/lib/feed-view";
import { healthDistanceUnit, healthWorkoutName } from "@/lib/health-workouts";
import { attachedCard, cheeredByLine, checkInCardMeta, checkInTag, showCheckedInPill, showPrChip } from "@/lib/redesign-feed-view";
import { clock, OwnPostMenu, useCheers } from "@/components/TimelineCard";
import { useCommentsSheet } from "@/components/feed/CommentsSheet";
import { FeedImage, FeedVideo, isVideoUrl } from "@/components/feed/FeedMedia";
import { MediaLightbox } from "@/components/MediaLightbox";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { SafetyActions } from "@/components/safety/SafetyActions";
import { CrewAvatar } from "./CrewAvatars";
import { RedesignHealthSheet, RedesignWorkoutSheet, type SheetAuthor } from "./RedesignCheckInSheets";

const INK = "#141218";
const MUTED = "#57534E";

function sheetWhen(localDate: string, viewerToday: string, at: string): string {
  const meta = checkInCardMeta({ time: clock(at), localDate, viewerToday, tag: null });
  return localDate >= viewerToday ? `Today, ${meta}` : `${meta}, ${clock(at)}`;
}

/** New version: one card per check-in, with its own cheers, replies and attached workout. */
export function RedesignCheckInCard({
  item,
  checkIn,
  viewerToday,
  autoOpenComments,
  targetCommentId,
}: {
  item: FeedItem;
  checkIn: CheckInNode;
  viewerToday: string;
  autoOpenComments?: boolean;
  targetCommentId?: string | null;
}) {
  const rawId = checkIn.id.replace(/^c-/, "");
  const firstId = item.nodes.find((n) => n.kind === "check_in")?.id ?? checkIn.id;
  const isFirst = firstId === checkIn.id;
  const social = checkIn.social ?? { reactors: item.reactors, commentCount: item.commentCount };
  const scoped = { id: item.id, reactors: social.reactors };
  const cheers = useCheers(scoped, isFirst ? null : rawId);
  const comments = useCommentsSheet(
    { id: item.id, groupId: item.groupId, commentCount: social.commentCount, name: item.name, isMe: item.isMe },
    targetCommentId,
    { checkInId: rawId, includeUnscoped: isFirst },
  );
  const [lightbox, setLightbox] = useState<{ src: string; kind: "image" | "video" } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [unit, setUnit] = useState<"mi" | "km">("mi");
  useEffect(() => setUnit(healthDistanceUnit(navigator.language || "en-US")), []);

  useEffect(() => {
    if (autoOpenComments) comments.openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenComments]);

  const tag = checkInTag(checkIn, healthWorkoutName, activityMeta);
  const meta = checkInCardMeta({ time: clock(checkIn.at), localDate: item.localDate, viewerToday, tag });
  const card = attachedCard(checkIn, unit, healthWorkoutName);
  const cheered = !!cheers.myEmoji;
  const cheerLine = cheeredByLine(cheers.reactors);
  const firstName = (item.name || "").split(" ")[0] || "Member";
  const author: SheetAuthor = {
    id: item.userId, name: item.name, avatarUrl: item.avatarUrl, avatarColor: item.avatarColor,
    firstName, when: sheetWhen(item.localDate, viewerToday, checkIn.at),
  };
  const cardBg = card?.kind === "health" ? "#FFF1F2" : "#F7F5F2";
  const labelColor = card?.kind === "health" ? "#E11D48" : "#7C3AED";

  return (
    <article id={`checkin-${rawId}`} className="overflow-hidden rounded-[20px] bg-white" style={{ margin: "12px 12px 0", color: INK }}>
      <header className="flex items-center gap-2" style={{ padding: "12px 14px" }}>
        <MemberProfileLink userId={item.userId} isYou={item.isMe} className="shrink-0">
          <span className="sr-only">{item.isMe ? "Your profile" : `${item.name}'s profile`}</span>
          <CrewAvatar member={{ id: item.userId, name: item.name, avatarUrl: item.avatarUrl, avatarColor: item.avatarColor }} size={40} />
        </MemberProfileLink>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight">{item.isMe ? "You" : item.name}</div>
          <div className="truncate text-[12px]" style={{ color: MUTED }}>{meta}</div>
        </div>
        {showCheckedInPill("check_in") && (
          <span className="flex h-[26px] shrink-0 items-center gap-1 rounded-[13px] px-2.5 text-[12px] font-extrabold" style={{ background: "#DCFCE7", color: "#15803D" }}>
            <Check size={12} strokeWidth={3} aria-hidden /> Checked in
          </span>
        )}
        <span className="-mr-2 shrink-0 [&>button]:h-9 [&>button]:w-9 [&>button]:min-w-9 [&>button]:bg-transparent! [&>button]:p-0 [&>button]:text-[var(--new-muted)]! [&>button>svg]:size-5">
          {item.isMe ? <OwnPostMenu checkIn={checkIn} /> : (
            <SafetyActions target={{
              userId: item.userId, name: item.name, avatarUrl: item.avatarUrl, avatarColor: item.avatarColor,
              groupId: item.groupId, type: "post", targetId: rawId, update: false,
            }} />
          )}
        </span>
      </header>

      {checkIn.photoUrl && (
        isVideoUrl(checkIn.photoUrl) ? (
          <FeedVideo src={checkIn.photoUrl} poster={checkIn.posterUrl} variant="redesign" onOpen={() => setLightbox({ src: checkIn.photoUrl!, kind: "video" })} />
        ) : (
          <div className="h-[300px] overflow-hidden [&>div]:h-full [&>div]:aspect-auto">
            <FeedImage src={checkIn.photoUrl} onOpen={() => setLightbox({ src: checkIn.photoUrl!, kind: "image" })} />
          </div>
        )
      )}

      {checkIn.note && <p className="whitespace-pre-wrap break-words text-[14px]" style={{ padding: "10px 14px 0", lineHeight: 1.4 }}>{checkIn.note}</p>}

      {card && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-[calc(100%-24px)] items-center gap-3 rounded-[16px] text-left active:opacity-80"
          style={{ margin: "10px 12px 0", padding: "12px 14px", background: cardBg }}
          aria-label={`${card.label}: ${card.title}. ${card.line}. Show details`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold" style={{ letterSpacing: "0.6px", color: labelColor }}>{card.label}</span>
            <span className="block truncate text-[16px] font-extrabold leading-snug">{card.title}</span>
            {card.line && <span className="block truncate text-[12px]" style={{ color: MUTED }}>{card.line}</span>}
            {card.pr && showPrChip("check_in", item.isMe) && (
              <span className="mt-1.5 inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-extrabold" style={{ background: "#FEF3C7", color: "#A16207" }}>🏆 New PR</span>
            )}
          </span>
          <ChevronRight size={18} className="shrink-0" style={{ color: "#8A847E" }} aria-hidden />
        </button>
      )}

      <div className="flex items-center gap-4" style={{ padding: "10px 14px 12px" }}>
        {!item.isMe && (
          <button type="button" onClick={cheers.toggle} aria-pressed={cheered} className="flex h-9 items-center gap-1.5 text-[13px] font-bold active:scale-95" style={{ color: cheered ? "#C2410C" : INK }}>
            <Flame size={18} fill={cheered ? "#EA580C" : "none"} style={{ color: cheered ? "#EA580C" : INK }} aria-hidden /> Cheer
          </button>
        )}
        <button
          type="button"
          onClick={comments.openSheet}
          onPointerDown={comments.prefetch}
          aria-label={social.commentCount > 0 ? `Reply, ${social.commentCount} comments` : "Reply"}
          className="flex h-9 items-center gap-1.5 text-[13px] font-bold active:scale-95"
          style={{ color: INK }}
        >
          <MessageCircle size={18} aria-hidden /> Reply{social.commentCount > 0 ? ` · ${social.commentCount}` : ""}
        </button>
        {cheerLine && <span className="ml-auto min-w-0 truncate text-[13px]" style={{ color: MUTED }}>{cheerLine}</span>}
      </div>
      {comments.sheet}
      {card && card.kind !== "health" && (
        <RedesignWorkoutSheet open={sheetOpen} onOpenChange={setSheetOpen} checkInId={rawId} card={card} author={author} isMine={item.isMe} planSlug={checkIn.plan?.slug ?? null} />
      )}
      {card?.kind === "health" && checkIn.health && (
        <RedesignHealthSheet open={sheetOpen} onOpenChange={setSheetOpen} health={checkIn.health} unit={unit} author={author} isMine={item.isMe} />
      )}
      {lightbox && <MediaLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />}
    </article>
  );
}
