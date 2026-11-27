import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { matchCaptionWorkout } from "@/lib/posts.functions";
import { foundLabel, setsRepsLine } from "@/lib/caption-workout";
import { audienceIsValid } from "@/lib/post-audience";
import { composerIsDirty } from "@/lib/post-composer";
import { pickedItems, resetDraft, setDraft, usePostDraft } from "@/lib/post-draft";
import { submitPost } from "@/lib/post-submit";
import type { PostWorkoutChoice } from "@/lib/social-post-types";
import { ExerciseThumb } from "@/components/workout/WorkoutBits";
import { newToast } from "../new-toast";
import { NewConfirm } from "../NewConfirm";
import { PostOptionRows, WhoSeesIt, useAudience, useComposeContext } from "./ComposeParts";
import { INK, MUTED, PURPLE, PostTopBar, TextAction } from "./PostBits";

type Move = { exerciseId: string; name: string; imageStart: string | null; sets: number; reps: number };

/** Compose: thumbs, caption, attach a workout, who sees it, tags, comments. */
export function NewPostCompose() {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const draft = usePostDraft();
  const picked = pickedItems(draft);
  const ctx = useComposeContext();
  const { audience, toggleEveryone, toggleCrew } = useAudience(ctx.data);
  const matchFn = useServerFn(matchCaptionWorkout);
  const [attach, setAttach] = useState<"workout" | "nothing">("workout");
  const [mode, setMode] = useState<"caption" | "pick">("caption");
  const [moves, setMoves] = useState<Move[]>([]);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);
  const [pickedWorkout, setPickedWorkout] = useState<{ source: "session" | "saved"; id: string } | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [commentsOn, setCommentsOn] = useState(true);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!picked.length) void navigate({ to: "/post/new", replace: true }); }, [picked.length, navigate]);

  // Re-read the caption a moment after typing stops, unless the list was fixed by hand.
  useEffect(() => {
    if (edited) return;
    const t = window.setTimeout(() => {
      if (!draft.caption.trim()) { setMoves([]); return; }
      void matchFn({ data: { caption: draft.caption } }).then((r) => setMoves(r.moves)).catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [draft.caption, edited, matchFn]);

  const workout: PostWorkoutChoice =
    attach === "nothing" ? null : mode === "caption" ? (moves.length ? { source: "caption", moves } : null) : pickedWorkout;
  const dirty = composerIsDirty({ items: picked.length, caption: draft.caption, workoutAttached: !!workout });
  const valid = !!ctx.data && audienceIsValid(audience, ctx.data.under18);

  const back = () => (dirty ? setDiscard(true) : navigate({ to: "/post/edit" }));
  const share = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await submitPost({ picked, caption: draft.caption, audience, workout, commentsOn, tags });
      await navigate({ to: "/home" });
      resetDraft();
    } catch (e) {
      console.error("[post] share failed", e);
      setErr("Couldn't post. Try again.");
      setBusy(false);
    }
  };
  const updateMove = (i: number, patch: Partial<Move>) => { setEdited(true); setMoves((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x))); };

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

      <section className="mx-4 mt-3 rounded-[16px] p-3.5" style={{ background: "#F7F5F2" }}>
        <h2 className="text-[15px] font-extrabold">Attach to your post</h2>
        <Segmented options={[["workout", "Workout"], ["nothing", "Nothing"]]} value={attach} onChange={(v) => setAttach(v as typeof attach)} />
        {attach === "workout" && (
          <>
            <Segmented small options={[["caption", "From your caption"], ["pick", "Pick a workout"]]} value={mode} onChange={(v) => setMode(v as typeof mode)} />
            {mode === "caption" ? (
              moves.length === 0 ? (
                <p className="pt-3 text-[13px]" style={{ color: MUTED }}>Name exercises in your caption, like "Squat 4x8", and they show up here.</p>
              ) : (
                <div className="pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold">{foundLabel(moves.length)}</span>
                    <button type="button" onClick={() => setEditing((e) => !e)} className="h-8 px-1 text-[14px] font-bold" style={{ color: PURPLE }}>{editing ? "Done" : "Edit"}</button>
                  </div>
                  <ul className="mt-2 rounded-[14px] bg-white">
                    {moves.map((m, i) => (
                      <li key={m.exerciseId} className="flex items-center gap-3 p-2.5" style={{ borderTop: i ? "1px solid #EFEAE4" : undefined }}>
                        <ExerciseThumb name={m.name} primary={[]} image={m.imageStart} size={40} radius={10} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-bold">{m.name}</div>
                          {!editing && <div className="text-[13px]" style={{ color: MUTED }}>{setsRepsLine(m.sets, m.reps)}</div>}
                          {editing && (
                            <div className="mt-1 flex items-center gap-3 text-[13px]">
                              <Stepper label="sets" value={m.sets} min={1} max={20} onChange={(v) => updateMove(i, { sets: v })} />
                              <Stepper label="reps" value={m.reps} min={1} max={200} onChange={(v) => updateMove(i, { reps: v })} />
                            </div>
                          )}
                        </div>
                        {editing && <button type="button" aria-label={`Remove ${m.name}`} onClick={() => { setEdited(true); setMoves((x) => x.filter((_, j) => j !== i)); }} className="flex h-9 w-9 items-center justify-center" style={{ color: MUTED }}><Trash2 size={18} /></button>}
                      </li>
                    ))}
                  </ul>
                  <p className="pt-2 text-[12px]" style={{ color: "#78716C" }}>Only sets and reps are shared</p>
                </div>
              )
            ) : (
              <WorkoutPickList ctx={ctx.data} value={pickedWorkout} onChange={setPickedWorkout} />
            )}
          </>
        )}
      </section>

      {ctx.data && <WhoSeesIt ctx={ctx.data} audience={audience} onEveryone={toggleEveryone} onCrew={toggleCrew} />}
      <PostOptionRows tags={tags} setTags={setTags} commentsOn={commentsOn} setCommentsOn={setCommentsOn} />
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

export function Segmented({ options, value, onChange, small = false }: { options: [string, string][]; value: string; onChange: (v: string) => void; small?: boolean }) {
  return (
    <div role="tablist" className={`mt-2.5 grid rounded-full p-1 ${small ? "h-9" : "h-10"}`} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, background: small ? "#EFEAE4" : "#E7E3DE" }}>
      {options.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={`rounded-full font-bold ${small ? "text-[13px]" : "text-[14px]"}`} style={value === k ? { background: "#FFFFFF", color: INK, boxShadow: "0 1px 2px rgba(0,0,0,.08)" } : { color: MUTED }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))} className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--new-control)]"><Minus size={14} /></button>
      <span className="min-w-[48px] text-center font-semibold">{value} {label}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--new-control)]"><Plus size={14} /></button>
    </span>
  );
}

function WorkoutPickList({ ctx, value, onChange }: { ctx: ReturnType<typeof useComposeContext>["data"]; value: { source: "session" | "saved"; id: string } | null; onChange: (v: { source: "session" | "saved"; id: string }) => void }) {
  if (!ctx) return <div className="mt-3 h-20 animate-pulse rounded-[14px] bg-white" />;
  const rows = [
    ...ctx.sessions.map((s) => ({ source: "session" as const, id: s.id, title: s.title, line: `${s.exercises} exercises · ${s.sets} sets · ${s.minutes} min`, group: "Your log" })),
    ...ctx.saved.map((w) => ({ source: "saved" as const, id: w.id, title: w.title, line: `${w.exercises} exercises · ${w.sets} sets`, group: "Saved workouts" })),
  ];
  if (!rows.length) return <p className="pt-3 text-[13px]" style={{ color: MUTED }}>No workouts yet. Log or build one first.</p>;
  return (
    <ul className="mt-3 rounded-[14px] bg-white">
      {rows.map((r, i) => {
        const on = value?.id === r.id && value.source === r.source;
        return (
          <li key={`${r.source}-${r.id}`} style={{ borderTop: i ? "1px solid #EFEAE4" : undefined }}>
            {(i === 0 || rows[i - 1]!.group !== r.group) && <div className="px-3 pt-2.5 text-[11px] font-extrabold" style={{ color: MUTED, letterSpacing: "0.6px" }}>{r.group.toUpperCase()}</div>}
            <button type="button" onClick={() => onChange({ source: r.source, id: r.id })} className="flex w-full items-center gap-3 p-3 text-left" aria-pressed={on}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{r.title}</span>
                <span className="block truncate text-[13px]" style={{ color: MUTED }}>{r.line}</span>
              </span>
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ border: `2px solid ${on ? PURPLE : "#D6D3D1"}` }}>
                {on && <span className="h-2.5 w-2.5 rounded-full" style={{ background: PURPLE }} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
