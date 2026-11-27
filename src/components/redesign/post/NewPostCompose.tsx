import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { matchCaptionWorkout } from "@/lib/posts.functions";
import { audienceIsValid } from "@/lib/post-audience";
import { composerIsDirty, videoLengthError } from "@/lib/post-composer";
import { pickedItems, resetDraft, setDraft, usePostDraft } from "@/lib/post-draft";
import { submitPost } from "@/lib/post-submit";
import type { PostWorkoutChoice } from "@/lib/social-post-types";
import { WorkoutAttachment } from "./WorkoutAttachment";
import { NewConfirm } from "../NewConfirm";
import { PostOptionRows, WhoSeesIt, useAudience, useComposeContext } from "./ComposeParts";
import { INK, MUTED, PURPLE, PostTopBar, TextAction } from "./PostBits";

type Move = { exerciseId: string; name: string; imageStart: string | null; sets: number; reps: number };

/** Compose: thumbs, caption, attach a workout, who sees it, tags, comments. */
export function NewPostCompose() {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const draft = usePostDraft();
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
      await Promise.all([qc.invalidateQueries({ queryKey: ["post-compose-context"] }), qc.invalidateQueries({ queryKey: ["my-social-posts"] }), qc.invalidateQueries({ queryKey: ["crew-social-posts"] })]);
      await navigate({ to: "/home" });
      resetDraft();
    } catch (e) {
      console.error("[post] share failed", e);
      setErr("Couldn't post. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="redesign-step3 fixed inset-0 overflow-y-auto bg-white pb-[calc(32px+env(safe-area-inset-bottom))]" style={{ color: INK }} data-scroll-root>
      <PostTopBar title="New post" left={<TextAction onClick={back}>Back</TextAction>} right={<TextAction tone="purple" disabled={!valid || busy} onClick={() => void share()}>Share</TextAction>} />
      <div className="flex gap-2 overflow-x-auto px-4 pt-2 [scrollbar-width:none]">
        {picked.map(({ media }) => (
          <span key={media.id} className="h-[72px] w-[58px] shrink-0 overflow-hidden rounded-[10px] bg-neutral-200">
            {media.kind === "video" ? <video src={`${media.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={media.url} alt="" className="h-full w-full object-cover" />}
          </span>
        ))}
      </div>
      <textarea
        value={draft.caption}
        onChange={(e) => setDraft({ caption: e.target.value })}
        maxLength={2200}
        rows={3}
        placeholder="Write a caption..."
        aria-label="Caption"
        className="mx-4 mt-3 block w-[calc(100%-32px)] resize-none bg-transparent text-[16px] outline-none placeholder:text-[#A8A29E]"
      />

      <WorkoutAttachment ctx={ctx.data} suggestions={moves} workout={workout} onChange={setWorkout} />
      {ctx.data && <WhoSeesIt ctx={ctx.data} audience={audience} onChange={setAudience} />}
      {audience.kind !== "only_me" && <PostOptionRows tags={tags} setTags={setTags} commentsOn={commentsOn} setCommentsOn={setCommentsOn} />}
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
