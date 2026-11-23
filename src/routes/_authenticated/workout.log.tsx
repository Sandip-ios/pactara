import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Minus, MoreHorizontal, Plus, Timer, Trophy } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { ConfirmSheet } from "@/components/workout/ConfirmSheet";
import { ExerciseThumb, FONT, HowToSheet, W } from "@/components/workout/WorkoutBits";
import { useNow } from "@/components/workout/WorkoutBar";
import { primeRestSound } from "@/components/workout/RestAlarm";
import { endWorkoutWithoutCompleting } from "@/lib/workouts.functions";
import { finishLoggedSession } from "@/lib/lifts.functions";
import { LIFT_HISTORY_KEY, MY_WORKOUTS_KEY, useExerciseMap, useLiftHistory, type LibraryExercise } from "@/lib/exercise-library";
import {
  buildLiveExercise,
  currentKey,
  emptySet,
  finishPayload,
  recordQuickPick,
  setActiveWorkout,
  setCounts,
  setFinishedWorkout,
  updateActiveWorkout,
  useActiveWorkout,
  withPrs,
  type ActiveWorkout,
  type LiveExercise,
  type LiveSet,
} from "@/lib/active-workout";
import { fmtClock, fmtNum, lastCell, lastSetLabel, setsShort, shortDay, weightStep } from "@/lib/lift-rules";
import { hapticLight } from "@/lib/native";

export const Route = createFileRoute("/_authenticated/workout/log")({
  head: () => ({
    meta: [
      { title: "Workout in progress · Pactara" },
      { name: "description", content: "Log your sets, rest between them and finish your workout." },
      { property: "og:title", content: "Workout in progress · Pactara" },
      { property: "og:description", content: "Log your sets, rest between them and finish your workout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkoutLogger,
});

const update = (fn: (w: ActiveWorkout) => ActiveWorkout) => updateActiveWorkout(fn);
const updateEx = (key: string, fn: (e: LiveExercise) => LiveExercise) =>
  update((w) => ({ ...w, exercises: w.exercises.map((e) => (e.key === key ? fn(e) : e)) }));

// Where the logger goes once the workout is cleared (finish → done, discard → home).
let exitTo: "/home" | "/workout/done" | null = null;

function WorkoutLogger() {
  const w = useActiveWorkout();
  const navigate = useNavigate();
  useEffect(() => {
    if (w) return;
    const to = exitTo ?? "/workout";
    exitTo = null;
    navigate({ to, replace: true });
  }, [w, navigate]);
  if (!w) return <div className="fixed inset-0" style={{ background: W.bg }} />;
  return <Logger w={w} />;
}

function Logger({ w }: { w: ActiveWorkout }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = useNow(1000);
  const { data: history } = useLiftHistory();
  const { map: lib } = useExerciseMap();
  const finishFn = useServerFn(finishLoggedSession);
  const endFn = useServerFn(endWorkoutWithoutCompleting);
  const [picker, setPicker] = useState<null | { replace: string | null }>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [howTo, setHowTo] = useState<LibraryExercise | null>(null);
  const [notesOpen, setNotesOpen] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | "finish" | "empty" | "discard">(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { done, total } = setCounts(w);
  const cur = currentKey(w);
  const curIdx = w.exercises.findIndex((e) => e.key === cur);
  const today = history?.today ?? new Date().toISOString().slice(0, 10);

  const minimize = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/home" });
  };

  const toggleSet = (ex: LiveExercise, set: LiveSet) => {
    primeRestSound();
    void hapticLight();
    const nowIso = new Date().toISOString();
    update((x) => {
      const exercises = x.exercises.map((e) => {
        if (e.key !== ex.key) return e;
        const sets = e.sets.map((s) => (s.id === set.id ? { ...s, done: !s.done, doneAt: !s.done ? nowIso : null } : s));
        return withPrs({ ...e, sets }, x.unit);
      });
      let rest = x.rest;
      if (!set.done) {
        const e = exercises.find((y) => y.key === ex.key)!;
        const nextIdx = e.sets.findIndex((s) => !s.done);
        const nextEx = exercises.find((y) => y.key !== ex.key && y.sets.some((s) => !s.done));
        const label = nextIdx >= 0 ? `Rest · next: set ${nextIdx + 1}` : nextEx ? `Rest · next: ${nextEx.name}` : "Rest · all sets done";
        rest = { endsAt: Date.now() + e.restSeconds * 1000, total: e.restSeconds, label, exKey: ex.key };
      }
      return { ...x, exercises, rest, focusKey: x.focusKey === ex.key && exercises.find((y) => y.key === ex.key)!.sets.every((s) => s.done) ? null : x.focusKey };
    });
  };

  const addExercises = (picked: LibraryExercise[]) => {
    const unit = w.unit;
    const built = picked.map((e) => buildLiveExercise(e, history?.byExercise[e.id], { unit }));
    if (picker?.replace) {
      const key = picker.replace;
      update((x) => ({ ...x, exercises: x.exercises.map((e) => (e.key === key ? built[0] ?? e : e)) }));
    } else {
      update((x) => ({ ...x, exercises: [...x.exercises, ...built] }));
    }
    setPicker(null);
  };

  const finish = async (force = false) => {
    const payload = finishPayload(w);
    if (!payload.length) return setConfirm("empty");
    if (!force && done < total) return setConfirm("finish");
    setConfirm(null);
    setSaving(true);
    setErr(null);
    try {
      const res = await finishFn({
        data: {
          sessionId: w.sessionId,
          groupId: w.groupId,
          title: w.title,
          workoutId: w.workoutId,
          startedAt: new Date(w.startedAt).toISOString(),
          exercises: payload,
        },
      });
      setFinishedWorkout({
        sessionId: res.sessionId,
        title: w.title,
        workoutId: w.workoutId,
        groupId: w.groupId,
        finishedAt: Date.now(),
        summary: res.summary,
        template: w.exercises
          .filter((e) => e.sets.some((s) => s.done))
          .map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((s) => s.done).length, restSeconds: e.restSeconds, primary: e.primary })),
        plan: w.plan,
      });
      recordQuickPick("logged");
      exitTo = "/workout/done";
      setActiveWorkout(null);
      void qc.invalidateQueries({ queryKey: LIFT_HISTORY_KEY });
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      void qc.invalidateQueries({ queryKey: ["home-crew"] });
    } catch (e) {
      console.error("[workout] finish failed", e);
      setErr("Couldn't save your workout. Check your connection and tap Finish again.");
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    setConfirm(null);
    const sessionId = w.sessionId;
    exitTo = "/home";
    setActiveWorkout(null);
    if (sessionId) endFn({ data: { sessionId } }).catch(() => {});
  };

  // ---- Long-press to reorder ----
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [dragKey, setDragKey] = useState<string | null>(null);
  const press = useRef<{ key: string; x: number; y: number; timer: number } | null>(null);
  useEffect(() => {
    if (!dragKey) return;
    const block = (e: TouchEvent) => e.preventDefault();
    const move = (e: PointerEvent) => {
      const others = w.exercises.filter((x) => x.key !== dragKey);
      let idx = 0;
      for (const o of others) {
        const el = cardRefs.current.get(o.key);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientY > r.top + r.height / 2) idx++;
      }
      update((x) => {
        const dragged = x.exercises.find((y) => y.key === dragKey);
        if (!dragged) return x;
        const rest = x.exercises.filter((y) => y.key !== dragKey);
        rest.splice(idx, 0, dragged);
        return rest.every((y, i) => y.key === x.exercises[i]?.key) ? x : { ...x, exercises: rest };
      });
    };
    const end = () => setDragKey(null);
    window.addEventListener("touchmove", block, { passive: false });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("touchmove", block);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragKey, w.exercises]);
  const pressHandlers = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button,a,input,textarea")) return;
      const timer = window.setTimeout(() => {
        void hapticLight();
        setDragKey(key);
        press.current = null;
      }, 450);
      press.current = { key, x: e.clientX, y: e.clientY, timer };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
        window.clearTimeout(p.timer);
        press.current = null;
      }
    },
    onPointerUp: () => {
      if (press.current) window.clearTimeout(press.current.timer);
      press.current = null;
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const menuEx = w.exercises.find((e) => e.key === menuKey) ?? null;
  const restLeft = w.rest ? Math.max(0, Math.ceil((w.rest.endsAt - now) / 1000)) : 0;
  const elapsed = (now - w.startedAt) / 1000;

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: W.bg, color: W.ink, fontFamily: FONT }} data-scroll-root>
      <div className="sticky top-0 z-10 bg-white" style={{ borderBottom: `1px solid ${W.line}` }}>
        <header className="flex items-center gap-2 pb-2.5 pl-2 pr-3 pt-[env(safe-area-inset-top)]">
          <button type="button" aria-label="Minimize workout" onClick={minimize} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <ChevronDown size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-extrabold">{w.title}</div>
            <div className="text-[13px]" style={{ color: W.stone, fontVariantNumeric: "tabular-nums" }}>
              {fmtClock(elapsed)} · {done} of {total} sets
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void finish()}
            className="h-10 shrink-0 rounded-[20px] px-[18px] text-[15px] font-bold text-white disabled:opacity-60"
            style={{ background: W.purple }}
          >
            {saving ? "Saving…" : "Finish"}
          </button>
        </header>
        <div className="h-1" style={{ background: "#EDE6FE" }}>
          <div className="h-1 transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: W.purple }} />
        </div>
      </div>

      {err && (
        <div className="mx-4 mt-3 rounded-[14px] bg-red-50 px-3 py-2 text-[14px] font-semibold text-red-700" role="alert">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 pb-[120px] pt-3.5">
        {w.exercises.map((ex, i) => {
          const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.done);
          const expanded = ex.key === cur || allDone || i < curIdx || cur === null;
          return (
            <section
              key={ex.key}
              ref={(el) => {
                if (el) cardRefs.current.set(ex.key, el);
                else cardRefs.current.delete(ex.key);
              }}
              {...pressHandlers(ex.key)}
              className="select-none rounded-[20px] bg-white transition-transform"
              style={{
                boxShadow: dragKey === ex.key ? "0 12px 28px rgba(20,18,24,.18)" : "0 1px 2px rgba(20,18,24,.06)",
                transform: dragKey === ex.key ? "scale(1.02)" : undefined,
                WebkitTouchCallout: "none",
              }}
            >
              {expanded ? (
                <ExpandedCard
                  ex={ex}
                  w={w}
                  today={today}
                  isCurrent={ex.key === cur}
                  notesOpen={notesOpen.has(ex.key) || !!ex.notes}
                  onMenu={() => setMenuKey(ex.key)}
                  onToggle={(s) => toggleSet(ex, s)}
                />
              ) : (
                <button type="button" onClick={() => update((x) => ({ ...x, focusKey: ex.key }))} className="flex w-full items-center gap-3 py-3.5 pl-4 pr-3.5 text-left">
                  <ExerciseThumb name={ex.name} primary={ex.primary} image={ex.imageStart} size={40} radius={12} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-extrabold">{ex.name}</span>
                    <span className="block truncate text-[13px]" style={{ color: W.stone }}>
                      Up next · {ex.sets.length} set{ex.sets.length === 1 ? "" : "s"}
                      {ex.last ? ` · ${lastSetLabel(ex.last, w.unit, ex.logType).replace("Last:", "last")}` : ""}
                    </span>
                  </span>
                  <span
                    role="button"
                    aria-label="More options"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuKey(ex.key);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: W.chip }}
                  >
                    <MoreHorizontal size={18} />
                  </span>
                </button>
              )}
            </section>
          );
        })}

        {w.untracked.length > 0 && (
          <section className="rounded-[20px] bg-white px-4 py-3.5" style={{ boxShadow: "0 1px 2px rgba(20,18,24,.06)" }}>
            <div className="text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>
              ALSO TODAY · NOT LOGGED HERE
            </div>
            <ul className="mt-1.5 flex flex-col gap-1">
              {w.untracked.map((m) => (
                <li key={m.name} className="flex justify-between gap-3 text-[15px]">
                  <span className="font-bold">{m.name}</span>
                  <span className="shrink-0 font-semibold" style={{ color: W.violet }}>
                    {m.dose}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          type="button"
          onClick={() => setPicker({ replace: null })}
          className="flex h-[52px] items-center justify-center gap-1.5 rounded-[26px] text-[15px] font-bold"
          style={{ border: `2px dashed ${W.lilac}`, color: W.violet }}
        >
          <Plus size={18} /> Add exercise
        </button>
        <button type="button" onClick={() => setConfirm("discard")} className="mx-auto h-11 px-4 text-[14px] font-semibold" style={{ color: W.muted }}>
          Discard workout
        </button>
      </div>

      {w.rest && restLeft > 0 && (
        <div
          className="fixed z-20 flex h-[60px] items-center gap-3 rounded-[30px] pl-5 pr-2.5 text-white"
          style={{ left: 16, right: 16, bottom: "calc(28px + env(safe-area-inset-bottom))", background: W.ink }}
          role="timer"
          aria-live="off"
        >
          <Timer size={22} style={{ color: W.lilac }} aria-hidden />
          <span className="text-[20px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtClock(restLeft)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: "#D6D3D1" }}>
            {w.rest.label}
          </span>
          <button
            type="button"
            onClick={() => update((x) => ({ ...x, rest: null }))}
            className="h-10 shrink-0 rounded-[20px] px-4 text-[14px] font-bold"
            style={{ background: "rgba(255,255,255,.14)" }}
          >
            Skip
          </button>
        </div>
      )}

      <ExercisePicker open={!!picker} single={!!picker?.replace} onClose={() => setPicker(null)} onDone={addExercises} />

      <Drawer open={!!menuEx} onOpenChange={(o) => !o && setMenuKey(null)} shouldScaleBackground={false}>
        <DrawerContent className="rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]" style={{ fontFamily: FONT, color: W.ink }}>
          {menuEx && (
            <div className="flex flex-col px-4 pt-3">
              <DrawerTitle className="pb-1 text-[17px] font-extrabold">{menuEx.name}</DrawerTitle>
              <DrawerDescription className="sr-only">Options for this exercise</DrawerDescription>
              {[
                { label: "Replace", onClick: () => setPicker({ replace: menuEx.key }) },
                { label: "Remove", danger: true, onClick: () => update((x) => ({ ...x, exercises: x.exercises.filter((e) => e.key !== menuEx.key) })) },
                { label: menuEx.notes ? "Edit notes" : "Notes", onClick: () => setNotesOpen((s) => new Set(s).add(menuEx.key)) },
                { label: "How to", onClick: () => setHowTo(lib.get(menuEx.exerciseId) ?? null) },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => {
                    setMenuKey(null);
                    o.onClick();
                  }}
                  className="h-[52px] text-left text-[16px] font-semibold"
                  style={{ color: o.danger ? "#DC2626" : W.ink, borderTop: `1px solid ${W.divider}` }}
                >
                  {o.label}
                </button>
              ))}
              <div className="flex h-[52px] items-center justify-between" style={{ borderTop: `1px solid ${W.divider}` }}>
                <span className="text-[16px] font-semibold">Rest timer</span>
                <Stepper
                  label={fmtClock(menuEx.restSeconds)}
                  ariaLabel="rest time"
                  onMinus={() => updateEx(menuEx.key, (e) => ({ ...e, restSeconds: Math.max(15, e.restSeconds - 15) }))}
                  onPlus={() => updateEx(menuEx.key, (e) => ({ ...e, restSeconds: Math.min(600, e.restSeconds + 15) }))}
                />
              </div>
              <button type="button" onClick={() => setMenuKey(null)} className="mt-1 h-[52px] rounded-[26px] text-[16px] font-bold" style={{ border: `1.5px solid ${W.line}` }}>
                Cancel
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <HowToSheet exercise={howTo} onClose={() => setHowTo(null)} />

      <ConfirmSheet
        open={confirm === "finish"}
        title="Finish workout?"
        body={`${total - done} set${total - done === 1 ? " isn't" : "s aren't"} checked off. Only checked sets are saved.`}
        confirmLabel="Finish workout"
        cancelLabel="Keep going"
        onConfirm={() => void finish(true)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === "empty"}
        title="Nothing logged yet"
        body="Check off at least one set to finish, or discard this workout."
        confirmLabel="Keep going"
        onConfirm={() => setConfirm(null)}
        onCancel={() => setConfirm(null)}
        extra={{ label: "Discard workout", danger: true, onClick: () => void discard() }}
      />
      <ConfirmSheet
        open={confirm === "discard"}
        title="Discard this workout?"
        body="Your sets from this workout won't be saved."
        confirmLabel="Discard workout"
        cancelLabel="Keep going"
        danger
        onConfirm={() => void discard()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

const GRID = "36px 1fr 1fr 1fr 48px";

function ExpandedCard({
  ex,
  w,
  today,
  isCurrent,
  notesOpen,
  onMenu,
  onToggle,
}: {
  ex: LiveExercise;
  w: ActiveWorkout;
  today: string;
  isCurrent: boolean;
  notesOpen: boolean;
  onMenu: () => void;
  onToggle: (s: LiveSet) => void;
}) {
  const unit = w.unit;
  const timed = ex.logType === "timed";
  const activeId = isCurrent ? ex.sets.find((s) => !s.done)?.id ?? null : null;
  const lastLine = ex.last
    ? `Last ${shortDay(ex.last.date, today)}: ${setsShort(ex.last.sets, unit, ex.logType)}`
    : ex.target?.repsLo
      ? `Target: ${ex.target.sets} × ${ex.target.repsLo}${ex.target.repsHi && ex.target.repsHi !== ex.target.repsLo ? `–${ex.target.repsHi}` : ""}`
      : "First time";
  const weightHeader = ex.loadable ? unit.toUpperCase() : `+${unit.toUpperCase()}`;
  const amountHeader = timed ? (ex.minutes ? "MIN" : "SEC") : "REPS";

  const setField = (setId: string, patch: Partial<LiveSet>) =>
    updateEx(ex.key, (e) => withPrs({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }, unit));

  return (
    <>
      <div className="flex items-center gap-3 pb-2 pl-4 pr-3.5 pt-3.5">
        <ExerciseThumb name={ex.name} primary={ex.primary} image={ex.imageStart} size={40} radius={12} />
        <div className="min-w-0 flex-1">
          <Link to="/exercises/$exerciseId" params={{ exerciseId: ex.exerciseId }} className="block text-[16px] font-extrabold leading-snug">
            {ex.name}
          </Link>
          <span className="block truncate text-[13px]" style={{ color: W.stone }}>
            {lastLine}
          </span>
        </div>
        <button type="button" aria-label="More options" onClick={onMenu} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: W.chip }}>
          <MoreHorizontal size={18} />
        </button>
      </div>
      {ex.tip && (
        <div className="mx-4 mb-2 rounded-[12px] px-3 py-2 text-[13px] font-semibold" style={{ background: W.tint, color: W.violetText }}>
          {ex.tip}
        </div>
      )}
      {notesOpen && (
        <div className="mx-4 mb-2">
          <textarea
            value={ex.notes}
            onChange={(e) => updateEx(ex.key, (x) => ({ ...x, notes: e.target.value.slice(0, 300) }))}
            placeholder="Notes for this exercise (seat height, grip…)"
            rows={2}
            className="w-full resize-none rounded-[12px] px-3 py-2 text-[14px] outline-none"
            style={{ background: W.chip }}
            aria-label={`Notes for ${ex.name}`}
          />
        </div>
      )}
      <div className="grid gap-2 pb-1 pl-4 pr-3.5 pt-0.5 text-[11px] font-bold tracking-[0.5px]" style={{ gridTemplateColumns: GRID, color: W.muted }}>
        <span>SET</span>
        <span>LAST</span>
        <span className="text-center">{weightHeader}</span>
        <span className="text-center">{amountHeader}</span>
        <span />
      </div>
      {ex.sets.map((s, i) => {
        const active = s.id === activeId;
        const lastSet = ex.last?.sets[i] ?? null;
        const bg = s.done ? W.greenSoft : active ? W.tintRow : "transparent";
        return (
          <div key={s.id}>
            <div className="mx-2 rounded-[14px] py-1.5 pl-2 pr-1.5" style={{ background: bg, outline: active ? `2px solid ${W.lilac}` : undefined, outlineOffset: -2 }}>
              <div className="grid items-center gap-2" style={{ gridTemplateColumns: GRID }}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-extrabold"
                  style={s.done ? { background: W.green, color: "#fff" } : active ? { background: W.purple, color: "#fff" } : { background: W.chip, color: W.stone }}
                >
                  {i + 1}
                </span>
                <span className="truncate text-[14px]" style={{ color: W.muted }}>
                  {lastCell(lastSet, unit, ex.logType)}
                </span>
                <NumCell
                  value={s.weight}
                  done={s.done}
                  decimal
                  placeholder={ex.loadable ? "0" : "—"}
                  ariaLabel={`Set ${i + 1} weight in ${unit}`}
                  onChange={(v) => setField(s.id, { weight: v })}
                />
                <NumCell
                  value={timed ? (s.seconds == null ? null : ex.minutes ? Math.round((s.seconds / 60) * 10) / 10 : s.seconds) : s.reps}
                  done={s.done}
                  decimal={timed && ex.minutes}
                  placeholder="0"
                  ariaLabel={`Set ${i + 1} ${timed ? (ex.minutes ? "minutes" : "seconds") : "reps"}`}
                  onChange={(v) =>
                    setField(s.id, timed ? { seconds: v == null ? null : Math.round(ex.minutes ? v * 60 : v) } : { reps: v == null ? null : Math.round(v) })
                  }
                />
                <button
                  type="button"
                  aria-label={s.done ? `Undo set ${i + 1}` : `Done with set ${i + 1}`}
                  aria-pressed={s.done}
                  onClick={() => onToggle(s)}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={s.done ? { background: W.green, color: "#fff" } : { background: W.chip, color: W.disabled }}
                >
                  <Check size={20} strokeWidth={3} />
                </button>
              </div>
              {active && (
                <div className="mt-2 flex gap-2 pr-0.5">
                  {ex.loadable && (
                    <Stepper
                      grow
                      label={`${fmtNum(weightStep(unit))} ${unit}`}
                      ariaLabel={`weight by ${weightStep(unit)} ${unit}`}
                      onMinus={() => setField(s.id, { weight: Math.max(0, (s.weight ?? 0) - weightStep(unit)) })}
                      onPlus={() => setField(s.id, { weight: (s.weight ?? 0) + weightStep(unit) })}
                    />
                  )}
                  {timed ? (
                    <Stepper
                      grow
                      label={ex.minutes ? "1 min" : "5 sec"}
                      ariaLabel={ex.minutes ? "time by 1 minute" : "time by 5 seconds"}
                      onMinus={() => setField(s.id, { seconds: Math.max(0, (s.seconds ?? 0) - (ex.minutes ? 60 : 5)) })}
                      onPlus={() => setField(s.id, { seconds: (s.seconds ?? 0) + (ex.minutes ? 60 : 5) })}
                    />
                  ) : (
                    <Stepper
                      grow
                      label="1 rep"
                      ariaLabel="reps by 1"
                      onMinus={() => setField(s.id, { reps: Math.max(0, (s.reps ?? 0) - 1) })}
                      onPlus={() => setField(s.id, { reps: (s.reps ?? 0) + 1 })}
                    />
                  )}
                </div>
              )}
            </div>
            {s.pr && (
              <div className="mb-0.5 ml-11 mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: W.gold, color: W.goldText }}>
                <Trophy size={13} aria-hidden /> New personal best
              </div>
            )}
          </div>
        );
      })}
      <div className="px-4 pb-3.5 pt-2">
        <button
          type="button"
          onClick={() => updateEx(ex.key, (e) => ({ ...e, sets: [...e.sets, emptySet(e)] }))}
          className="flex h-10 w-full items-center justify-center gap-1 rounded-[20px] text-[14px] font-bold"
          style={{ background: W.chip, color: W.stoneDark }}
        >
          <Plus size={16} /> Add set
        </button>
      </div>
    </>
  );
}

/** Weight / reps cell: tap opens the number keypad for exact entry. */
function NumCell({
  value,
  done,
  decimal,
  placeholder,
  ariaLabel,
  onChange,
}: {
  value: number | null;
  done: boolean;
  decimal?: boolean;
  placeholder: string;
  ariaLabel: string;
  onChange: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? "" : fmtNum(value));
  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      pattern={decimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      value={shown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={(e) => {
        setDraft(shown);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".").replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
        setDraft(raw);
        if (raw === "") onChange(null);
        else if (!raw.endsWith(".")) {
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(Math.min(9999, n));
        }
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="h-10 w-full min-w-0 rounded-[12px] text-center text-[17px] font-extrabold outline-none placeholder:font-semibold placeholder:text-[#A8A29E] focus:ring-2 focus:ring-[#C4B5FD]"
      style={{ background: done ? "transparent" : W.chip, color: W.ink, fontVariantNumeric: "tabular-nums" }}
    />
  );
}

function Stepper({ label, ariaLabel, onMinus, onPlus, grow }: { label: string; ariaLabel: string; onMinus: () => void; onPlus: () => void; grow?: boolean }) {
  return (
    <span className={`flex h-11 items-center justify-between rounded-[22px] bg-white ${grow ? "flex-1" : "w-[150px]"}`} style={{ border: `1.5px solid ${W.line}` }}>
      <button type="button" onClick={onMinus} aria-label={`Lower ${ariaLabel}`} className="flex h-11 w-11 items-center justify-center">
        <Minus size={18} />
      </button>
      <span className="text-[14px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
        {label}
      </span>
      <button type="button" onClick={onPlus} aria-label={`Raise ${ariaLabel}`} className="flex h-11 w-11 items-center justify-center">
        <Plus size={18} />
      </button>
    </span>
  );
}
