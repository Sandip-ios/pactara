import { mediaOnlyCommentLine } from "@/lib/comment-media";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorkoutSummaryRow } from "@/components/workout/FeedWorkout";
import { Flame, ListChecks, MessageCircle, MoreHorizontal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { FeedItem } from "@/lib/daily-posts.functions";
import { deleteCheckIn, setPostReaction, togglePostReaction } from "@/lib/daily-posts.functions";
import type { CheckInNode, UpdateNode } from "@/lib/feed-days";
import {
  cheerSentence,
  cheerSummary,
  checkInMetaLine,
  orderReactors,
  showQuickReplies,
  viewCommentsLabel,
  type Reactor,
} from "@/lib/feed-view";
import { hapticLight } from "@/lib/native";
import { planChipLabel } from "@/lib/workout-plans";
import { MediaLightbox } from "@/components/MediaLightbox";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { CheckInShareModal } from "@/components/CheckInShareModal";
import type { MoodId } from "@/routes/_authenticated/check-in.index";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
import { FeedAvatar, FeedImage, FeedVideo, isVideoUrl } from "@/components/feed/FeedMedia";
import { QuickReplyChips, useCommentsSheet, usePostQuickComment } from "@/components/feed/CommentsSheet";
import { useFeedContext } from "@/components/feed/feed-context";

const PURPLE = "#7C3AED";
const MUTED = "#57534E";
const REACTION_EMOJIS = ["🔥", "💪", "❤️", "👏"];
const noSelectTouchStyle = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
  touchAction: "manipulation",
} as CSSProperties & { WebkitTouchCallout?: string; WebkitUserSelect?: string };

function clock(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* ------------------------------ Cheers ------------------------------ */

function Faces({ reactors }: { reactors: Reactor[] }) {
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {reactors.slice(0, 3).map((r, i) => (
        <span key={r.userId} className="relative rounded-full" style={{ marginLeft: i === 0 ? 0 : -7, zIndex: 3 - i }}>
          <FeedAvatar url={r.avatarUrl} color={r.avatarColor} name={r.name} size={22} className="border-2 border-white" />
        </span>
      ))}
    </span>
  );
}

function CheersSheet({ open, onOpenChange, reactors }: { open: boolean; onOpenChange: (o: boolean) => void; reactors: Reactor[] }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-0">
        <DrawerHeader className="border-b py-3" style={{ borderColor: "#F0EDE9" }}>
          <DrawerTitle className="text-center text-[17px] font-bold">Cheers</DrawerTitle>
        </DrawerHeader>
        <ul className="max-h-[60vh] overflow-y-auto px-4 py-2 pb-8">
          {orderReactors(reactors).map((r) => (
            <li key={r.userId} className="flex min-h-[52px] items-center gap-3">
              <MemberProfileLink userId={r.userId} isYou={r.isMe} className="shrink-0">
                <FeedAvatar url={r.avatarUrl} color={r.avatarColor} name={r.name} size={36} />
              </MemberProfileLink>
              <span className="flex-1 truncate text-[15px] font-semibold text-neutral-900">{r.isMe ? "You" : r.name}</span>
              <span className="text-[22px] leading-none" aria-label={`cheered with ${r.emoji}`}>
                {r.emoji}
              </span>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}

function CheerButton({ myEmoji, onToggle, onPick }: { myEmoji: string | null; onToggle: () => void; onPick: (e: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const clearTimer = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const clearSelection = () => window.getSelection()?.removeAllRanges();

  const onDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    longPressedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    longPressTimer.current = window.setTimeout(() => {
      longPressedRef.current = true;
      clearSelection();
      setPickerOpen(true);
    }, 350);
  };
  const onUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    clearTimer();
    clearSelection();
    if (!longPressedRef.current) onToggle();
  };
  const onCancel = () => {
    clearTimer();
    clearSelection();
  };
  const onKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="relative">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverAnchor className="pointer-events-none absolute inset-0" />
        <PopoverContent
          side="top"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-auto rounded-full border-neutral-200 p-1.5 shadow-lg"
          style={noSelectTouchStyle}
        >
          <div className="flex items-center gap-1">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`Cheer with ${e}`}
                aria-pressed={myEmoji === e}
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  clearSelection();
                  setPickerOpen(false);
                  onPick(e);
                }}
                onClick={(ev) => ev.preventDefault()}
                onContextMenu={(ev) => ev.preventDefault()}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[24px] transition active:scale-90"
                style={{ ...noSelectTouchStyle, background: myEmoji === e ? "#EDE6FE" : undefined, boxShadow: myEmoji === e ? `inset 0 0 0 2px ${PURPLE}` : undefined }}
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={myEmoji ? `You cheered ${myEmoji}. Tap to undo, hold to change` : "Cheer. Hold to pick an emoji"}
        aria-pressed={!!myEmoji}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onLostPointerCapture={onCancel}
        onKeyDown={onKey}
        onContextMenu={(e) => e.preventDefault()}
        className="flex h-11 w-11 select-none items-center justify-center rounded-full text-neutral-900 transition active:scale-95"
        style={{ ...noSelectTouchStyle, background: myEmoji ? "#F5F0FF" : undefined }}
      >
        {myEmoji ? <span className="text-[19px] leading-none">{myEmoji}</span> : <Flame size={21} strokeWidth={2} />}
      </button>
    </div>
  );
}

function ActionRow({
  item,
  onOpenComments,
  onPrefetchComments,
  reactors,
  myEmoji,
  onToggle,
  onPick,
}: {
  item: FeedItem;
  onOpenComments: () => void;
  onPrefetchComments: () => void;
  reactors: Reactor[];
  myEmoji: string | null;
  onToggle: () => void;
  onPick: (e: string) => void;
}) {
  const [cheersOpen, setCheersOpen] = useState(false);
  const own = item.isMe;
  const summary = cheerSummary(reactors, own);
  const ordered = orderReactors(reactors);

  return (
    <div className="flex min-h-11 items-center gap-1 px-2 py-1.5 select-none" style={noSelectTouchStyle}>
      {!own && <CheerButton myEmoji={myEmoji} onToggle={onToggle} onPick={onPick} />}
      <button
        type="button"
        aria-label={item.commentCount > 0 ? `Comments, ${item.commentCount}` : "Comment"}
        onClick={onOpenComments}
        onPointerDown={onPrefetchComments}
        className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-[15px] font-semibold text-neutral-900 active:scale-95"
      >
        <MessageCircle size={21} strokeWidth={2} />
        {item.commentCount > 0 && <span>{item.commentCount}</span>}
      </button>
      <div className="ml-auto flex min-w-0 justify-end">
        {summary.kind === "empty" ? (
          <span className="truncate pr-2 text-[13px]" style={{ color: "#78716C" }}>
            {summary.text}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setCheersOpen(true)}
            aria-label={`${cheerSentence(reactors, own)}. See who cheered`}
            className="flex h-11 min-w-0 items-center gap-1.5 rounded-full px-2 text-[13px] text-neutral-800 active:opacity-70"
          >
            <Faces reactors={ordered} />
            <span className="min-w-0 truncate">
              {summary.kind === "own" ? (
                <>
                  <b className="font-bold">{summary.count}</b> cheered you on
                </>
              ) : (
                <>
                  {summary.names.map((n, i) => (
                    <span key={n + i}>
                      {i > 0 && ", "}
                      <b className="font-bold">{n}</b>
                    </span>
                  ))}
                  {summary.extra > 0 && ` +${summary.extra}`}
                </>
              )}
            </span>
          </button>
        )}
      </div>
      <CheersSheet open={cheersOpen} onOpenChange={setCheersOpen} reactors={reactors} />
    </div>
  );
}

/** One person, one cheer: optimistic emoji plus the server's list of who cheered. */
function useCheers(item: FeedItem) {
  const queryClient = useQueryClient();
  const { me } = useFeedContext();
  const [override, setOverride] = useState<{ emoji: string | null } | null>(null);
  const serverMine = item.reactors.find((r) => r.isMe) ?? null;
  const myEmoji = override ? override.emoji : serverMine?.emoji ?? null;
  const others = item.reactors.filter((r) => !r.isMe);
  const self: Reactor = serverMine ?? {
    userId: me?.userId ?? "me",
    name: me?.name ?? "You",
    firstName: me?.firstName ?? "You",
    avatarUrl: me?.avatarUrl ?? null,
    avatarColor: me?.avatarColor ?? PURPLE,
    emoji: "🔥",
    isMe: true,
  };
  const reactors = myEmoji ? [{ ...self, emoji: myEmoji }, ...others] : others;
  const settle = () => queryClient.invalidateQueries({ queryKey: ["group-feed"] }).then(() => setOverride(null));
  const toggleM = useMutation({
    mutationFn: (emoji: string) => togglePostReaction({ data: { postId: item.id, emoji } }),
    onSettled: settle,
  });
  const setM = useMutation({
    mutationFn: (emoji: string) => setPostReaction({ data: { postId: item.id, emoji } }),
    onSettled: settle,
  });
  return {
    reactors,
    myEmoji,
    toggle: () => {
      const emoji = myEmoji ?? "🔥";
      void hapticLight();
      setOverride({ emoji: myEmoji ? null : "🔥" });
      toggleM.mutate(emoji);
    },
    pick: (emoji: string) => {
      void hapticLight();
      setOverride({ emoji });
      setM.mutate(emoji);
    },
  };
}

/* ------------------------- Comments preview ------------------------- */

function CommentsPreview({ item, unread, onOpen }: { item: FeedItem; unread: number; onOpen: () => void }) {
  if (item.commentCount <= 0) return null;
  const c = item.latestComment;

  return (
    <button type="button" onClick={onOpen} className="block w-full px-4 pt-0.5 text-left active:opacity-70">
      <span className="flex items-center gap-2">
        <span className="text-[13px] font-semibold" style={{ color: MUTED }}>
          {viewCommentsLabel(item.commentCount)}
        </span>
        {unread > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white" style={{ background: PURPLE }}>
            {unread} new
          </span>
        )}
      </span>
      {c && (
        <span className="mt-1 flex items-center gap-3">
          <span className="line-clamp-2 min-w-0 flex-1 text-[14px] text-neutral-900">
            <b className="font-bold">{c.authorName}</b> {c.body || (c.mediaKind ? mediaOnlyCommentLine(c.mediaKind) : "")}
          </span>
          {c.thumbUrl && <img src={c.thumbUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
        </span>
      )}
    </button>
  );
}

/* ----------------------------- Own menu ----------------------------- */

function OwnPostMenu({ checkIn }: { checkIn: CheckInNode }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The sheet closes first; the chosen action opens once it's gone, so two
  // overlays never hold the page's scroll lock at the same time.
  const pending = useRef<"share" | "delete" | null>(null);
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    if (action === "share") setSharing(true);
    else if (action === "delete") setConfirmOpen(true);
  };
  const choose = (action: "share" | "delete") => {
    pending.current = action;
    setMenuOpen(false);
    window.setTimeout(runPending, 350);
  };
  const del = useMutation({
    mutationFn: () => deleteCheckIn({ data: { checkInId: checkIn.id.replace(/^c-/, "") } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["home-crew"] });
      setConfirmOpen(false);
      toast.success("Check-in deleted");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't delete check-in"),
  });
  const shareImage = checkIn.photoUrl && isVideoUrl(checkIn.photoUrl) ? checkIn.posterUrl ?? null : checkIn.photoUrl;
  return (
    <>
      <button
        type="button"
        aria-label="Check-in options"
        aria-haspopup="dialog"
        onClick={() => {
          pending.current = null;
          setMenuOpen(true);
        }}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-700 after:absolute after:-inset-1 after:content-[''] active:scale-95"
        style={{ background: "#F4F2EF" }}
      >
        <MoreHorizontal size={18} />
      </button>
      <Drawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onAnimationEnd={(o) => {
          if (!o) runPending();
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="p-0 pb-[max(env(safe-area-inset-bottom),12px)]">
          <DrawerHeader className="pb-2 pt-3">
            <DrawerTitle className="text-center text-[17px] font-bold">Your check-in</DrawerTitle>
            <DrawerDescription className="sr-only">Share or delete this check-in</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <div className="overflow-hidden rounded-2xl" style={{ background: "#F7F5F2" }}>
              <button
                type="button"
                onClick={() => choose("share")}
                className="flex h-[52px] w-full items-center px-4 text-left text-[16px] font-semibold text-neutral-900 active:bg-black/5"
              >
                Share to story
              </button>
              <div className="h-px" style={{ background: "#ECE8E3" }} />
              <button
                type="button"
                onClick={() => choose("delete")}
                className="flex h-[52px] w-full items-center px-4 text-left text-[16px] font-semibold text-red-600 active:bg-black/5"
              >
                Delete check-in
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="mt-2 flex h-[52px] w-full items-center justify-center rounded-2xl text-[16px] font-semibold text-neutral-700 active:bg-black/5"
              style={{ background: "#F7F5F2" }}
            >
              Cancel
            </button>
          </div>
        </DrawerContent>
      </Drawer>
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
      {sharing &&
        createPortal(
          <CheckInShareModal
            data={{
              mood: (checkIn.mood as MoodId | null) ?? null,
              activity: checkIn.activity,
              note: checkIn.note ?? "",
              photoUrl: shareImage,
              photoBlob: null,
            }}
            onClose={() => setSharing(false)}
          />,
          document.body,
        )}
    </>
  );
}

/* ------------------------------- Body ------------------------------- */

function NoteText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);
  return (
    <div className="px-4 pb-3 pt-2.5">
      <p
        ref={ref}
        className="whitespace-pre-wrap break-words text-[15px] leading-snug text-neutral-900"
        style={expanded ? undefined : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {text}
      </p>
      {overflows && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-0.5 text-[14px] font-semibold active:opacity-70"
          style={{ color: MUTED }}
        >
          more
        </button>
      )}
    </div>
  );
}

function StatStrip({ streak, week, target }: { streak: number; week: number; target: number }) {
  return (
    <div className="mx-4 mb-1 mt-1 grid grid-cols-2 rounded-2xl py-3.5 text-center" style={{ background: "#F7F5F2" }}>
      <div>
        <div className="text-[20px] font-extrabold text-neutral-900">{streak}</div>
        <div className="text-[13px]" style={{ color: MUTED }}>day streak</div>
      </div>
      <div className="border-l" style={{ borderColor: "#E7E3DE" }}>
        <div className="text-[20px] font-extrabold text-neutral-900">
          {week} of {target}
        </div>
        <div className="text-[13px]" style={{ color: MUTED }}>this week</div>
      </div>
    </div>
  );
}

function Media({ url, poster, onOpen }: { url: string; poster?: string | null; onOpen: (kind: "image" | "video") => void }) {
  return isVideoUrl(url) ? (
    <FeedVideo src={url} poster={poster} onOpen={() => onOpen("video")} />
  ) : (
    <FeedImage src={url} onOpen={() => onOpen("image")} />
  );
}

/* ------------------------------- Card ------------------------------- */

export type PostCardProps =
  | { kind: "checkins"; item: FeedItem; checkIns: CheckInNode[]; autoOpenComments?: boolean }
  | { kind: "update"; item: FeedItem; node: UpdateNode; autoOpenComments?: boolean };

/** A check-in (swipe between several on one day) or an update, with cheers and comments. */
export function TimelineCard(props: PostCardProps) {
  const { item } = props;
  const { weeklyTarget } = useFeedContext();
  const comments = useCommentsSheet(item);
  const cheers = useCheers(item);
  const quick = usePostQuickComment(item.id);
  const [quickSent, setQuickSent] = useState(false);
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{ src: string; kind: "image" | "video" } | null>(null);

  useEffect(() => {
    if (props.autoOpenComments) comments.openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoOpenComments]);

  const checkIns = props.kind === "checkins" ? props.checkIns : [];
  const current = checkIns[Math.min(index, checkIns.length - 1)];
  const metaPlan = props.kind === "checkins" ? current?.plan ?? null : null;
  const metaWorkout = props.kind === "checkins" ? current?.workout ?? null : null;
  const meta =
    props.kind === "checkins"
      ? checkInMetaLine(current?.activity, item.dayNumber, current ? clock(current.at) : "")
      : props.node.kind === "ritual"
        ? `Commitment · ${clock(props.node.at)}`
        : `Update · ${clock(props.node.at)}`;
  const note = props.kind === "checkins" ? current?.note ?? null : props.node.text;
  const cheerCount = cheers.reactors.length;
  const quickReplies =
    !quickSent && showQuickReplies({ ownPost: item.isMe, cheers: cheerCount, comments: item.commentCount });

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <article className="mx-4 mt-3 overflow-hidden rounded-[20px] bg-white pb-[14px] shadow-sm select-none" style={noSelectTouchStyle}>
      <header className="flex items-center gap-3 px-4 pt-3.5">
        <MemberProfileLink userId={item.userId} isYou={item.isMe} className="shrink-0" >
          <span className="sr-only">{item.isMe ? "Your profile" : `${item.name}'s profile`}</span>
          <FeedAvatar url={item.avatarUrl} color={item.avatarColor || "#22C55E"} name={item.name} size={40} />
        </MemberProfileLink>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-neutral-900">{item.isMe ? "You" : item.name}</div>
          <div className="truncate text-[13px]" style={{ color: MUTED }}>{meta}</div>
        </div>
        {item.isMe && current && <OwnPostMenu checkIn={current} />}
      </header>

      {note ? <NoteText key={current?.id ?? "u"} text={note} /> : <div className="h-3" />}

      {props.kind === "checkins" ? (
        <div className="relative">
          <div
            ref={scroller}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {checkIns.map((c) => (
              <div key={c.id} className="w-full shrink-0 snap-center">
                {c.photoUrl ? (
                  <Media url={c.photoUrl} poster={c.posterUrl} onOpen={(kind) => setLightbox({ src: c.photoUrl!, kind })} />
                ) : (
                  <StatStrip streak={item.dayNumber} week={item.weekCount} target={weeklyTarget} />
                )}
              </div>
            ))}
          </div>
          {checkIns.length > 1 && (
            <>
              <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold text-white">
                {index + 1} of {checkIns.length}
              </span>
              <span className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
                {checkIns.map((c, i) => (
                  <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ background: i === index ? "#FFFFFF" : "rgba(255,255,255,0.5)" }} />
                ))}
              </span>
            </>
          )}
        </div>
      ) : props.node.kind === "thought" && props.node.photoUrl ? (
        <Media
          url={props.node.photoUrl}
          poster={props.node.posterUrl}
          onOpen={(kind) => props.node.kind === "thought" && props.node.photoUrl && setLightbox({ src: props.node.photoUrl, kind })}
        />
      ) : null}

      {metaWorkout && current && <WorkoutSummaryRow workout={metaWorkout} checkInId={current.id.replace(/^c-/, "")} />}
      {metaPlan && <PlanChip plan={metaPlan} />}
      <div className="mt-1">
        <ActionRow
          item={item}
          reactors={cheers.reactors}
          myEmoji={cheers.myEmoji}
          onToggle={cheers.toggle}
          onPick={cheers.pick}
          onOpenComments={comments.openSheet}
          onPrefetchComments={comments.prefetch}
        />
      </div>
      <CommentsPreview item={item} unread={comments.unread} onOpen={comments.openSheet} />
      {quickReplies && (
        <div className="px-4 pt-1">
          <QuickReplyChips
            disabled={quick.isPending}
            onPick={(t) => {
              setQuickSent(true);
              quick.mutate(t, { onError: () => setQuickSent(false) });
            }}
          />
        </div>
      )}
      {comments.sheet}
      {lightbox && <MediaLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />}
    </article>
  );
}

export function TimelineCardSkeleton() {
  return (
    <div className="mx-4 mt-3 overflow-hidden rounded-[20px] bg-white pb-[14px] shadow-sm" aria-hidden>
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-44 animate-pulse rounded bg-neutral-200" />
        </div>
      </div>
      <div className="mt-3 aspect-square w-full animate-pulse bg-neutral-200" />
      <div className="flex items-center gap-2 px-4 pt-3">
        <div className="h-8 w-14 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-8 w-14 animate-pulse rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}

/** The workout plan day a check-in finished; opens that plan's page. */
function PlanChip({ plan }: { plan: { name: string; slug: string; week: number; day: number } }) {
  return (
    <div className="flex px-4 pt-3">
      <Link
        to="/plans/$slug"
        params={{ slug: plan.slug }}
        aria-label={`${planChipLabel(plan.name, plan.week, plan.day)}. Open plan`}
        className="relative flex h-7 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"
        style={{ background: "#F5F0FF", color: "#5B21B6" }}
      >
        <ListChecks size={14} className="shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{plan.name}</span>
        <span className="shrink-0">· Week {plan.week}, Day {plan.day}</span>
      </Link>
    </div>
  );
}
