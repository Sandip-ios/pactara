import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { ImagePlus, X } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { getShareWorkoutPreview } from "@/lib/posts.functions";
import { audienceIsValid } from "@/lib/post-audience";
import { creditLine, MAX_POST_ITEMS, shareWorkoutStats } from "@/lib/post-composer";
import { addFiles, pickedItems, resetDraft, setDraft, usePostDraft } from "@/lib/post-draft";
import { pickFromNativeLibrary } from "@/lib/media-picker";
import { submitPost } from "@/lib/post-submit";
import { PostOptionRows, WhoSeesIt, useAudience, useComposeContext } from "./ComposeParts";
import { INK, MUTED, PURPLE, PostTopBar, TextAction } from "./PostBits";

/** Share workout: optional media, caption, the attached workout card and who sees it. */
export function NewShareWorkout({ workoutId, sessionId }: { workoutId: string | null; sessionId: string | null }) {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const router = useRouter();
  const draft = usePostDraft();
  const picked = pickedItems(draft);
  const ctx = useComposeContext();
  const preview = useQuery({ queryKey: ["share-workout-preview", workoutId, sessionId], queryFn: () => getShareWorkoutPreview({ data: { workoutId, sessionId } }) });
  const { audience, toggleEveryone, toggleCrew } = useAudience(ctx.data);
  const [tags, setTags] = useState<string[]>([]);
  const [commentsOn, setCommentsOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const valid = !!ctx.data && !!preview.data && audienceIsValid(audience, ctx.data.under18);

  const add = async (files: { blob: Blob; name: string }[]) => {
    const ids = await addFiles(files);
    setDraft((d) => ({ selected: [...d.selected, ...ids].slice(0, MAX_POST_ITEMS) }));
  };
  const openLibrary = async () => {
    const native = await pickFromNativeLibrary(MAX_POST_ITEMS - picked.length).catch(() => null);
    if (native) { if (native.length) await add(native); return; }
    input.current?.click();
  };
  const cancel = () => { resetDraft(); if (router.history.canGoBack()) router.history.back(); else void navigate({ to: "/workouts" }); };
  const share = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await submitPost({ picked, caption: draft.caption, audience, workout: sessionId ? { source: "session", id: sessionId } : { source: "saved", id: workoutId! }, commentsOn, tags });
      await navigate({ to: "/home" });
      resetDraft();
    } catch (e) {
      console.error("[post] share workout failed", e);
      setErr("Couldn't post. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="redesign-step3 fixed inset-0 overflow-y-auto bg-white pb-[calc(32px+env(safe-area-inset-bottom))]" style={{ color: INK }} data-scroll-root>
      <PostTopBar title="Share workout" left={<TextAction onClick={cancel}>Cancel</TextAction>} right={<TextAction tone="purple" disabled={!valid || busy} onClick={() => void share()}>Share</TextAction>} />
      <div className="flex gap-2 overflow-x-auto px-4 pt-2 [scrollbar-width:none]">
        {picked.map(({ media }) => (
          <span key={media.id} className="relative h-[96px] w-[78px] shrink-0 overflow-hidden rounded-[12px] bg-neutral-200">
            {media.kind === "video" ? <video src={`${media.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={media.url} alt="" className="h-full w-full object-cover" />}
            <button type="button" aria-label="Remove" onClick={() => setDraft((d) => ({ selected: d.selected.filter((x) => x !== media.id) }))} className="absolute right-0.5 top-0.5 flex h-7 w-7 items-center justify-center">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"><X size={12} /></span>
            </button>
          </span>
        ))}
        {picked.length < MAX_POST_ITEMS && (
          <button type="button" onClick={() => void openLibrary()} className="flex h-[96px] shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] px-3" style={{ width: picked.length ? 78 : "100%", border: "2px dashed #D6D3D1", background: "var(--new-bg)", color: MUTED }}>
            <ImagePlus size={22} aria-hidden />
            <span className="text-[13px] font-semibold">Add photo or video</span>
          </button>
        )}
      </div>
      <textarea value={draft.caption} onChange={(e) => setDraft({ caption: e.target.value })} maxLength={2200} rows={3} placeholder="Say something about it (optional)" aria-label="Caption"
        className="mx-4 mt-3 block w-[calc(100%-32px)] resize-none bg-transparent text-[16px] outline-none placeholder:text-[#A8A29E]" />

      <section className="mx-4 mt-3 rounded-[16px] p-3.5" style={{ background: "#F7F5F2" }}>
        <div className="text-[11px] font-extrabold" style={{ letterSpacing: "0.6px", color: PURPLE }}>WORKOUT ATTACHED</div>
        {preview.data ? (
          <>
            <div className="mt-0.5 truncate text-[17px] font-extrabold">{preview.data.title}</div>
            <div className="text-[13px]" style={{ color: MUTED }}>{shareWorkoutStats(preview.data)}</div>
            {preview.data.credit && <div className="pt-1.5 text-[13px] font-semibold" style={{ color: "var(--new-purple-text)" }}>{creditLine(preview.data.credit)}</div>}
          </>
        ) : <div className="mt-1 h-10 animate-pulse rounded bg-white" />}
      </section>

      {ctx.data && <WhoSeesIt ctx={ctx.data} audience={audience} onEveryone={toggleEveryone} onCrew={toggleCrew} />}
      <PostOptionRows tags={tags} setTags={setTags} commentsOn={commentsOn} setCommentsOn={setCommentsOn} />
      {err && <p role="alert" className="px-4 pt-3 text-[14px] font-semibold" style={{ color: "var(--new-destructive)" }}>{err}</p>}
      <p className="px-4 pt-5 text-center text-[12px]" style={{ color: "#78716C" }}>No photo needed. Posts without one show the workout card on its own.</p>
      <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void add(fs.map((f) => ({ blob: f, name: f.name }))); }} />
    </div>
  );
}
