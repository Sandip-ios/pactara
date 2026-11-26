import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Play, Share, Trash2 } from "lucide-react";
import { newToast as toast } from "./new-toast";
import { NewAvatarFallback } from "./NewAvatarFallback";
import { NewConfirm } from "./NewConfirm";
import { PactaraAuthorIcon } from "./PactaraAuthorIcon";
import { NewSheet, NewSheetRow } from "./NewSheet";
import { useMyWorkoutsFlow } from "@/components/workout/MyWorkoutsFlow";
import { WorkoutSharePanel } from "@/components/workout/WorkoutSharePanel";
import { showTopMessage } from "@/components/workout/savedToast";
import { getActiveWorkout } from "@/lib/active-workout";
import { MY_WORKOUTS_KEY, useExerciseMap } from "@/lib/exercise-library";
import { deleteSavedWorkout, type SavedWorkout } from "@/lib/lifts.functions";
import { getWorkoutPage, type WorkoutPage } from "@/lib/new-workout.functions";
import { doseText, socialLine, tipText, topMuscleChips, workoutButtons, workoutStats } from "@/lib/new-workout-view";
import { saveSharedWorkout, shareSavedWorkout } from "@/lib/workout-share.functions";
import { shareText, shareTitle, shareUrl } from "@/lib/workout-share";
import { shareLink } from "@/lib/share-link";
import { useOpenAtTop } from "@/lib/use-open-at-top";

const PURPLE = "#7C3AED";
const PURPLE_INK = "#6D28D9";
const LAVENDER = "#EDE9FE";
const INK = "#1C1917";
const MUTED = "#78716C";
const HAIR = "#F0EDE9";
const CIRCLE = "#F0EDE8";
const FONT = "Inter, system-ui, sans-serif";
/** Same as the plan menu: 56px rows, 22px icons, 16px/600 labels, one hairline above Delete. */
const MENU_ROW = "!h-14 border-b-0 py-0";

export const workoutPageKey = (id: string) => ["new-workout-page", id] as const;

/** New-version workout page: one of my workouts (uuid) or someone else's (share code). */
export function NewWorkoutPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const scrollRef = useOpenAtTop();
  const { map } = useExerciseMap();
  const flow = useMyWorkoutsFlow({ onSaved: () => void qc.invalidateQueries({ queryKey: workoutPageKey(id) }) });
  const pageFn = useServerFn(getWorkoutPage);
  const saveFn = useServerFn(saveSharedWorkout);
  const shareFn = useServerFn(shareSavedWorkout);
  const deleteFn = useServerFn(deleteSavedWorkout);
  const { data: page, isLoading } = useQuery({ queryKey: workoutPageKey(id), queryFn: () => pageFn({ data: { id } }), staleTime: 30_000 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const back = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/workout" });
  };

  if (!page) {
    return (
      <div className="fixed inset-0 flex items-center justify-center text-[16px] font-bold" style={{ background: "#F5F2EC", color: INK, fontFamily: FONT }}>
        {isLoading ? null : "This workout isn't available"}
      </div>
    );
  }

  const rows = page.exercises.map((e) => {
    const ex = map.get(e.exerciseId) ?? null;
    return { ...e, ex, name: ex?.name ?? e.name ?? "Exercise", primary: ex?.primary ?? e.primary, detail: ex?.detail?.length ? ex.detail : e.detail };
  });
  const stats = workoutStats(rows);
  const chips = topMuscleChips(rows);
  const buttons = workoutButtons({ isMine: page.isMine, saved: !!page.savedWorkoutId });
  const social = buttons.showSocial ? socialLine(null, null) : null;

  const asSaved = (): SavedWorkout => ({
    id: page.workoutId ?? page.savedWorkoutId ?? "",
    name: page.name,
    exercises: page.exercises.map((e) => {
      const o: SavedWorkout["exercises"][number] = { exerciseId: e.exerciseId, sets: e.sets };
      if (e.restSeconds != null) o.restSeconds = e.restSeconds;
      if (e.seconds != null) o.seconds = e.seconds;
      if (e.reps) o.reps = e.reps;
      if (e.tip) o.tip = e.tip;
      return o;
    }),
    lastDoneAt: null,
    createdAt: "",
  });

  const startNow = () => {
    if (getActiveWorkout()) {
      navigate({ to: "/workout/log" });
      return;
    }
    const wk = asSaved();
    flow.run(() => flow.start.startSaved({ ...wk, id: page.workoutId ?? page.savedWorkoutId }, page.author.kind === "member" ? page.author.name.split(" ")[0] ?? null : page.author.kind === "pactara" ? "Pactara" : null));
  };

  const edit = () => {
    setMenuOpen(false);
    if (page.workoutId) navigate({ to: "/workouts/$workoutId/edit", params: { workoutId: page.workoutId } });
  };

  const save = async () => {
    if (!page.shareCode || page.savedWorkoutId || busy) return;
    setBusy(true);
    try {
      const res = await saveFn({ data: { code: page.shareCode } });
      if (res.status === "saved") {
        qc.setQueryData<WorkoutPage | null>(workoutPageKey(id), (old) => (old ? { ...old, savedWorkoutId: res.workoutId } : old));
        void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
        toast(`${page.name} saved to your workouts`);
      } else if (res.status === "missing") toast("This workout isn't available anymore");
    } catch (e) {
      console.error("[workout-page] save failed", e);
      toast("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const shareOwnLink = async () => {
    if (!page.workoutId || linkBusy) return;
    setLinkBusy(true);
    try {
      const { url, name } = await shareFn({ data: { workoutId: page.workoutId } });
      const outcome = await shareLink({ title: shareTitle(name), text: shareText(name), url });
      if (outcome === "copied") showTopMessage("Link copied");
      else if (outcome === "failed") showTopMessage("Couldn't share. Try again.");
    } catch {
      showTopMessage("Couldn't share. Try again.");
    } finally {
      setLinkBusy(false);
    }
  };

  const share = async () => {
    setMenuOpen(false);
    if (page.isMine) {
      setShareOpen(true);
      return;
    }
    if (!page.shareCode) return;
    const outcome = await shareLink({ title: shareTitle(page.name), text: shareText(page.name), url: shareUrl(page.shareCode) });
    if (outcome === "copied") toast("Link copied");
    else if (outcome === "failed") toast("Couldn't share. Try again.");
  };

  const remove = async () => {
    if (!page.workoutId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteFn({ data: { workoutId: page.workoutId } });
      qc.setQueryData<SavedWorkout[]>(MY_WORKOUTS_KEY, (old) => (old ?? []).filter((x) => x.id !== page.workoutId));
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      setDeleteOpen(false);
      toast(`${page.name} deleted`);
      back();
    } catch (e) {
      console.error("[workout-page] delete failed", e);
      setErr("Couldn't delete. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={scrollRef} data-scroll-root className="fixed inset-0 overflow-y-auto overscroll-none" style={{ background: "#F5F2EC", color: INK, fontFamily: FONT }}>
      <div className="bg-white px-4 pb-5 pt-new-top">
        <header className="flex h-11 items-center justify-between">
          <Circle label="Back" onClick={back}><ChevronLeft size={24} /></Circle>
          <Circle label="Workout options" onClick={() => setMenuOpen(true)}><MoreHorizontal size={22} /></Circle>
        </header>
        <h1 className="mt-3 text-[28px] font-extrabold leading-[1.15] tracking-[-0.4px]">{page.name}</h1>
        <div className="mt-2 flex items-center gap-2 text-[15px]" style={{ color: "#44403C" }}>
          <AuthorAvatar author={page.author} />
          <span>by <b className="font-bold" style={{ color: INK }}>{page.author.name}</b></span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat value={`${stats.minutes} min`} label="time" />
          <Stat value={String(stats.exercises)} label="exercises" />
          <Stat value={String(stats.sets)} label="sets" />
        </div>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: LAVENDER, color: PURPLE_INK }}>{c}</span>
            ))}
          </div>
        )}
        {social && <p className="mt-3 text-[14px]" style={{ color: MUTED }}>{social}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={startNow} disabled={flow.busy} className="flex h-12 items-center justify-center gap-2 rounded-full text-[16px] font-bold" style={{ background: PURPLE, color: "#FFFFFF" }}>
            <Play size={16} fill="currentColor" aria-hidden /> Start now
          </button>
          {buttons.secondary === "edit" ? (
            <button type="button" onClick={edit} className="flex h-12 items-center justify-center gap-2 rounded-full text-[16px] font-bold" style={{ background: LAVENDER, color: PURPLE_INK }}>
              <Pencil size={16} aria-hidden /> Edit
            </button>
          ) : (
            <button type="button" onClick={() => void save()} disabled={busy} aria-pressed={buttons.secondary === "saved"} className="flex h-12 items-center justify-center gap-2 rounded-full text-[16px] font-bold" style={{ background: LAVENDER, color: PURPLE_INK }}>
              <Bookmark size={17} fill={buttons.secondary === "saved" ? "currentColor" : "none"} aria-hidden /> {buttons.secondary === "saved" ? "Saved" : "Save"}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4" style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}>
        <div className="overflow-hidden rounded-[18px] bg-white">
          {rows.map((r, i) => {
            const tip = tipText(r.tip);
            const body = (
              <>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px]" style={{ background: r.ex?.imageBg ?? "#E8F1FB" }} aria-hidden>
                  {(r.ex?.imageStart ?? r.imageStart) && <img src={(r.ex?.imageStart ?? r.imageStart)!} alt="" loading="lazy" className="h-full w-full object-contain" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[16px] font-bold leading-[1.25] [overflow-wrap:anywhere]">{r.name}</span>
                  {tip && <span className="line-clamp-2 text-[13px] leading-[1.35]" style={{ color: MUTED }}>{tip}</span>}
                </span>
                <span className="shrink-0 whitespace-nowrap text-[15px] font-extrabold" style={{ color: PURPLE }}>{doseText(r)}</span>
              </>
            );
            const cls = "flex min-h-[72px] items-center gap-3 py-3 pl-3.5 pr-2.5";
            const style = { color: INK, borderTop: i === 0 ? undefined : `1px solid ${HAIR}` };
            if (!r.ex) return <div key={`${r.exerciseId}-${i}`} className={cls} style={style}>{body}<span className="w-5" /></div>;
            return (
              <Link key={`${r.exerciseId}-${i}`} to="/exercises/$exerciseId" params={{ exerciseId: r.ex.id }} search={{ tab: "howto", workout: page.key }} className={cls} style={style} aria-label={`How to do ${r.name}`}>
                {body}
                <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} aria-hidden />
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[13px]" style={{ color: MUTED }}>Tap an exercise to see how to do it and your history</p>
      </div>

      <NewSheet open={menuOpen} onOpenChange={setMenuOpen} title={page.name} hideTitle>
        {buttons.menu.includes("edit") && <NewSheetRow simple className={MENU_ROW} leading={<Pencil />} title="Edit workout" onClick={edit} />}
        <NewSheetRow simple className={MENU_ROW} leading={<Share />} title="Share workout" onClick={() => void share()} />
        {buttons.menu.includes("delete") && (
          <>
            <div className="h-px" style={{ background: HAIR }} aria-hidden />
            <NewSheetRow simple destructive className={MENU_ROW} leading={<Trash2 className="text-[var(--new-destructive)]" />} title="Delete workout" onClick={() => { setMenuOpen(false); setDeleteOpen(true); }} />
          </>
        )}
      </NewSheet>

      <NewConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${page.name}?`}
        subtitle="It's gone from your workouts. Workouts you already did stay in your history."
        action="Delete"
        cancelLabel="Keep it"
        busy={busy}
        error={err}
        onConfirm={() => void remove()}
      />

      {page.isMine && (
        <WorkoutSharePanel variant="new" open={shareOpen} workoutId={page.workoutId} name={page.name} onClose={() => setShareOpen(false)} onShareLink={() => void shareOwnLink()} linkBusy={linkBusy} />
      )}
      {flow.overlays}
    </div>
  );
}

function Circle({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: CIRCLE, color: INK }}>
      {children}
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex h-[54px] flex-col items-center justify-center rounded-[12px]" style={{ background: CIRCLE }}>
      <span className="text-[20px] font-extrabold leading-none">{value}</span>
      <span className="mt-1 text-[13px]" style={{ color: MUTED }}>{label}</span>
    </div>
  );
}

function AuthorAvatar({ author }: { author: WorkoutPage["author"] }) {
  if (author.kind === "pactara") {
    return <PactaraAuthorIcon size={24} />;
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: author.avatarUrl ? author.avatarColor : "var(--new-profile-avatar-bg)" }} aria-hidden>
      {author.avatarUrl ? <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" /> : <NewAvatarFallback />}
    </span>
  );
}
