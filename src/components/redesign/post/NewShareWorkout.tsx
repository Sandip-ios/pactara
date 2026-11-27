import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Camera, X } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { getShareWorkoutPreview } from "@/lib/posts.functions";
import { audienceIsValid } from "@/lib/post-audience";
import { formatClock, MAX_POST_ITEMS, shareWorkoutStats, trimmedLength, videoLengthError } from "@/lib/post-composer";
import { addFiles, pickedItems, resetDraft, setDraft, usePostDraft } from "@/lib/post-draft";
import { pickFromNativeLibrary } from "@/lib/media-picker";
import { submitPost } from "@/lib/post-submit";
import { newToast } from "../new-toast";
import { CrewAvatar } from "../CrewAvatars";
import { WhoSeesIt, useAudience, useComposeContext } from "./ComposeParts";
import { INK, MUTED, PostTopBar, TextAction } from "./PostBits";

/** Share workout: optional media, caption, the attached workout card and who sees it. */
export function NewShareWorkout({ workoutId, sessionId }: { workoutId: string | null; sessionId: string | null }) {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const router = useRouter();
  const draft = usePostDraft();
  const picked = pickedItems(draft);
  const ctx = useComposeContext();
  const preview = useQuery({ queryKey: ["share-workout-preview", workoutId, sessionId], queryFn: () => getShareWorkoutPreview({ data: { workoutId, sessionId } }) });
  const { audience, setAudience } = useAudience(ctx.data);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lengthErr = videoLengthError(picked.map((p) => p.edit), audience.kind !== "crews");
  const valid = !lengthErr && !!ctx.data && !!preview.data && audienceIsValid(audience, ctx.data.under18);

  const add = async (files: { blob: Blob; name: string }[]) => {
    const ids = await addFiles(files, (m) => newToast(m));
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
      await submitPost({ picked, caption: draft.caption, audience, workout: sessionId ? { source: "session", id: sessionId } : workoutId ? { source: "saved", id: workoutId } : null, commentsOn: true, tags: [] });
      await Promise.all([qc.invalidateQueries({ queryKey: ["post-compose-context"] }), qc.invalidateQueries({ queryKey: ["my-social-posts"] }), qc.invalidateQueries({ queryKey: ["crew-social-posts"] })]);
      await navigate({ to: "/home" });
      resetDraft();
    } catch (e) {
      console.error("[post] share workout failed", e);
      setErr("Couldn't post. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="redesign-step3 new-post-compose-page fixed inset-0 overflow-y-auto bg-[var(--new-bg)] pb-[calc(32px+env(safe-area-inset-bottom))]" style={{ color: INK }} data-scroll-root>
      <PostTopBar compose title="Share workout" left={<TextAction tone="muted" className="w-full min-w-0 justify-start px-0 font-semibold" onClick={cancel}>Cancel</TextAction>} right={<TextAction tone="purple" className="w-full min-w-0 justify-end px-0" disabled={!valid || busy} onClick={() => void share()}>Share</TextAction>} />
      <section className="bg-[var(--new-white)] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="flex max-w-[196px] shrink-0 gap-2 overflow-x-auto [scrollbar-width:none]">
            {picked.map(({ media, edit }) => (
              <span key={media.id} className="relative h-[116px] w-[92px] shrink-0 overflow-hidden rounded-[12px] bg-neutral-200">
                {media.kind === "video" ? <video src={`${media.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full bg-[var(--new-library-video)] object-contain" /> : <img src={media.url} alt="" className="h-full w-full object-cover" />}
                {media.kind === "video" && media.duration != null && <span className="absolute bottom-1.5 left-1.5 flex h-5 items-center rounded-[10px] px-1.5 text-[11px] font-bold text-[var(--new-white)]" style={{ background: "rgba(0,0,0,0.55)" }}>{formatClock(trimmedLength(edit))}</span>}
                <button type="button" aria-label="Remove" onClick={() => setDraft((d) => ({ selected: d.selected.filter((x) => x !== media.id) }))} className="absolute right-0.5 top-0.5 flex h-7 w-7 items-center justify-center">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"><X size={12} /></span>
                </button>
              </span>
            ))}
            {picked.length < MAX_POST_ITEMS && (
              <button type="button" onClick={() => void openLibrary()} className="flex h-[116px] w-[92px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[12px] px-2" style={{ border: "1.5px dashed #D6D0C9", background: "#F4F2EF", color: INK }}>
                <Camera size={20} aria-hidden />
                <span className="text-[13px] font-semibold leading-tight">Add photo or video</span>
              </button>
            )}
          </div>
          <textarea value={draft.caption} onChange={(e) => setDraft({ caption: e.target.value })} maxLength={2200} rows={4} placeholder="Say something about it (optional)" aria-label="Caption"
            className="min-w-0 flex-1 resize-none bg-transparent p-0 text-[15px] leading-[1.45] text-[var(--new-ink-deep)] outline-none placeholder:text-[var(--new-chevron)]" />
        </div>
      </section>
      <section className="mx-4 mt-3 rounded-[20px] bg-[var(--new-white)] px-4">
        <div className="py-3.5">
          <div className="text-[11px] font-extrabold tracking-[0.6px] text-[var(--new-purple)]">WORKOUT ATTACHED</div>
          {preview.data ? (
            <>
              <div className="truncate text-[16px] font-extrabold">{preview.data.title}</div>
              <div className="text-[12px]" style={{ color: MUTED }}>{shareWorkoutStats(preview.data)}</div>
              {preview.data.credit && <div className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-[12px] bg-[var(--new-post-credit)] px-2.5 py-2 text-[13px] text-[var(--new-ink-deep)]">
                <CrewAvatar member={{ id: "workout-credit", name: preview.data.credit, avatarUrl: preview.data.creditAvatar, avatarColor: "#7C3AED" }} size={24} />
                <span className="min-w-0">Credits <b>{preview.data.credit}</b>.{audience.kind !== "only_me" && " She gets a notification."}</span>
              </div>}
            </>
          ) : <div className="mt-1 h-10 animate-pulse rounded bg-white" />}
        </div>
      </section>

      {ctx.data && <WhoSeesIt ctx={ctx.data} audience={audience} onChange={setAudience} />}
      {lengthErr && <p role="alert" className="px-4 pt-3 text-[14px] font-semibold" style={{ color: "var(--new-destructive)" }}>{lengthErr}</p>}
      {err && <p role="alert" className="px-4 pt-3 text-[14px] font-semibold" style={{ color: "var(--new-destructive)" }}>{err}</p>}
      <p className="px-4 pt-5 text-center text-[12px]" style={{ color: "#78716C" }}>No photo needed. Posts without one show the workout card on its own.</p>
      <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void add(fs.map((f) => ({ blob: f, name: f.name }))); }} />
    </div>
  );
}
