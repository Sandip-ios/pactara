import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { matchCaptionWorkout } from "@/lib/posts.functions";
import { audienceIsValid } from "@/lib/post-audience";
import { composerIsDirty, formatClock, trimmedLength, videoLengthError } from "@/lib/post-composer";
import { pickedItems, resetDraft, setDraft, usePostDraft } from "@/lib/post-draft";
import { submitPost } from "@/lib/post-submit";
import type { PostWorkoutChoice } from "@/lib/social-post-types";
import { WorkoutAttachment } from "./WorkoutAttachment";
import { NewConfirm } from "../NewConfirm";
import { PostOptionRows, WhoSeesIt, useAudience, useComposeContext } from "./ComposeParts";
import { INK, PostTopBar, TextAction } from "./PostBits";

type Move = { exerciseId: string; name: string; imageStart: string | null; sets: number; reps: number };

/** Compose: thumbs, caption, attach a workout, who sees it, tags, comments. */
export function NewPostCompose() {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const draft = usePostDraft();
  const captionRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = captionRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [draft.caption]);
  const picked = pickedItems(draft);
  const ctx = useComposeContext();
  const { audience, setAudience } = useAudience(ctx.data);
  const matchFn = useServerFn(matchCaptionWorkout);
  const [workout, setWorkout] = useState<PostWorkoutChoice>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [commentsOn, setCommentsOn] = useState(true);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!picked.length) void navigate({ to: "/post/new", replace: true }); }, [picked.length, navigate]);

  // Suggestions are separate from the explicitly attached and edited snapshot.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!draft.caption.trim()) { setMoves([]); return; }
      void matchFn({ data: { caption: draft.caption } }).then((r) => setMoves(r.moves)).catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [draft.caption, matchFn]);

  const dirty = composerIsDirty({ items: picked.length, caption: draft.caption, workoutAttached: !!workout });
  const lengthErr = videoLengthError(picked.map((p) => p.edit), audience.kind !== "crews");
  const valid = !lengthErr && !!ctx.data && audienceIsValid(audience, ctx.data.under18);

  const back = () => (dirty ? setDiscard(true) : navigate({ to: "/post/edit" }));
  const share = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await submitPost({ picked, caption: draft.caption, audience, workout, commentsOn, tags });
      await Promise.all([qc.invalidateQueries({ queryKey: ["post-compose-context"] }), qc.invalidateQueries({ queryKey: ["my-social-posts"] }), qc.invalidateQueries({ queryKey: ["crew-social-posts"] }), qc.invalidateQueries({ queryKey: ["home-social-posts"] })]);
      await navigate({ to: "/home" });
      resetDraft();
    } catch (e) {
      console.error("[post] share failed", e);
      setErr("Couldn't post. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="redesign-step3 new-post-compose-page fixed inset-0 overflow-y-auto bg-[var(--new-bg)] pb-[calc(32px+env(safe-area-inset-bottom))]" style={{ color: INK }} data-scroll-root>
      <PostTopBar compose title="New post" left={<TextAction tone="muted" className="w-full min-w-0 justify-start px-0 font-semibold" onClick={back}>Back</TextAction>} right={<TextAction tone="purple" className="w-full min-w-0 justify-end px-0" disabled={!valid || busy} onClick={() => void share()}>Share</TextAction>} />
      <section className="bg-[var(--new-white)] px-4 pt-3.5">
        <div className="flex gap-2 overflow-hidden">
          {picked.map(({ media, edit }) => (
            <span key={media.id} className="relative aspect-[3/4] w-[92px] shrink-0 overflow-hidden rounded-[12px] bg-neutral-200">
              {media.kind === "video" ? <video src={`${media.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full bg-[var(--new-library-video)] object-contain" /> : <img src={media.url} alt="" className="h-full w-full object-cover object-center" />}
              {media.kind === "video" && media.duration != null && <span className="absolute bottom-1.5 left-1.5 flex h-5 items-center rounded-[10px] px-1.5 text-[11px] font-bold text-[var(--new-white)]" style={{ background: "rgba(0,0,0,0.55)" }}>{formatClock(trimmedLength(edit))}</span>}
            </span>
          ))}
        </div>
        <textarea
          ref={captionRef}
          value={draft.caption}
          onChange={(e) => setDraft({ caption: e.target.value })}
          maxLength={2200}
          rows={1}
          placeholder="Write a caption..."
          aria-label="Caption"
          className="block w-full resize-none overflow-hidden bg-transparent pb-3.5 pt-2.5 text-[15px] leading-[1.45] text-[var(--new-ink-deep)] outline-none placeholder:text-[var(--new-chevron)]"
        />
      </section>
      <WorkoutAttachment ctx={ctx.data} suggestions={moves} workout={workout} onChange={setWorkout} />
      {ctx.data && <WhoSeesIt ctx={ctx.data} audience={audience} onChange={setAudience} />}
      {audience.kind !== "only_me" && <PostOptionRows audience={audience} tags={tags} setTags={setTags} commentsOn={commentsOn} setCommentsOn={setCommentsOn} />}
      {lengthErr && <p role="alert" className="px-4 pt-3 text-[14px] font-semibold" style={{ color: "var(--new-destructive)" }}>{lengthErr}</p>}
      {err && <p role="alert" className="px-4 pt-3 text-[14px] font-semibold" style={{ color: "var(--new-destructive)" }}>{err}</p>}

      <NewConfirm
        open={discard}
        onOpenChange={setDiscard}
        title="Discard this post?"
        subtitle="Your photos, videos and caption won't be saved."
        action="Discard"
        cancelLabel="Keep editing"
        busy={false}
        error={null}
        onConfirm={() => { setDiscard(false); void navigate({ to: "/home" }).then(() => resetDraft()); }}
      />
    </div>
  );
}
