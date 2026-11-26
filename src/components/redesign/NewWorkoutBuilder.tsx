import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { newToast as toast } from "./new-toast";
import { NewConfirm } from "./NewConfirm";
import { NewSheet, NewSheetButton, NewSheetChip } from "./NewSheet";
import { workoutPageKey } from "./NewWorkoutPage";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { uid } from "@/lib/active-workout";
import { MY_WORKOUTS_KEY, useExerciseMap, type LibraryExercise } from "@/lib/exercise-library";
import { saveBuiltWorkout } from "@/lib/lifts.functions";
import { getWorkoutPage } from "@/lib/new-workout.functions";
import { TIP_MAX } from "@/lib/new-workout-view";
import { clampSets, MAX_SETS, MIN_SETS } from "@/lib/workout-builder";
import {
  builderDirty, builderMinutes, builderSignature, canSaveBuilder, cleanReps, cleanTip, EQUIPMENT_OPTIONS, equipmentFromExercises,
  isEachSide, newItemDose, pillText, reorderItems, savePayload, stepReps, toggleEach, type BuilderItem, type BuilderState, type WorkoutEquipment,
} from "@/lib/new-workout-builder";
import { useOpenAtTop } from "@/lib/use-open-at-top";

const PURPLE = "#7C3AED";
const PURPLE_INK = "#6D28D9";
const LAVENDER = "#EDE9FE";
const INK = "#1C1917";
const MUTED = "#78716C";
const HAIR = "#F0EDE9";
const WARM = "#F0EDE8";
const BORDER = "#E7E2DA";
const FONT = "Inter, system-ui, sans-serif";

/** New-version workout builder: /workouts/new and /workouts/$id/edit. */
export function NewWorkoutBuilder({ workoutId }: { workoutId?: string }) {
  const pageFn = useServerFn(getWorkoutPage);
  const { data: page, isLoading } = useQuery({
    queryKey: workoutId ? workoutPageKey(workoutId) : ["new-workout-builder-empty"],
    queryFn: () => (workoutId ? pageFn({ data: { id: workoutId } }) : Promise.resolve(null)),
    enabled: !!workoutId,
    staleTime: 30_000,
  });
  const { map, isLoading: libLoading } = useExerciseMap();
  useHideBottomTabs(true, false);
  if (workoutId && (isLoading || libLoading)) return <div className="fixed inset-0" style={{ background: "#F5F2EC" }} />;
  if (workoutId && (!page || !page.isMine || !page.workoutId)) {
    return <div className="fixed inset-0 flex items-center justify-center text-[16px] font-bold" style={{ background: "#F5F2EC", color: INK, fontFamily: FONT }}>This workout isn't available</div>;
  }
  const initial: BuilderState = page?.workoutId
    ? {
        workoutId: page.workoutId,
        name: page.name,
        equipment: page.equipment,
        items: page.exercises
          .filter((e) => map.has(e.exerciseId))
          .map((e) => {
            const it: BuilderItem = { key: uid(), exerciseId: e.exerciseId, sets: clampSets(e.sets), reps: e.reps ?? "", tip: e.tip ?? "" };
            if (e.restSeconds != null) it.restSeconds = e.restSeconds;
            if (e.seconds != null) it.seconds = e.seconds;
            return it;
          }),
      }
    : { workoutId: null, name: "", equipment: null, items: [] };
  return <Builder key={page?.workoutId ?? "new"} initial={initial} map={map} />;
}

function Builder({ initial, map }: { initial: BuilderState; map: Map<string, LibraryExercise> }) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const scrollRef = useOpenAtTop();
  const saveFn = useServerFn(saveBuiltWorkout);
  const isEdit = !!initial.workoutId;
  const [state, setState] = useState<BuilderState>(initial);
  const initialSig = useMemo(() => builderSignature(initial), [initial]);
  // Equipment follows the exercises until the member picks one (or it was saved).
  const [equipTouched, setEquipTouched] = useState(initial.equipment != null);
  const [picking, setPicking] = useState(false);
  const [doseKey, setDoseKey] = useState<string | null>(null);
  const [tipKey, setTipKey] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const equipment: WorkoutEquipment | null = equipTouched
    ? state.equipment
    : equipmentFromExercises(state.items.map((i) => map.get(i.exerciseId)?.equipment ?? "").filter(Boolean));
  const current: BuilderState = { ...state, equipment };
  const dirty = builderDirty(initialSig, current);
  const ok = canSaveBuilder(current);
  const minutes = builderMinutes(state.items);

  const setItems = (fn: (items: BuilderItem[]) => BuilderItem[]) => setState((s) => ({ ...s, items: fn(s.items) }));
  const patch = (key: string, p: Partial<BuilderItem>) => setItems((items) => items.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const leave = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/workouts" });
  };
  const cancel = () => (dirty ? setDiscardOpen(true) : leave());

  const remove = (it: BuilderItem) => {
    const at = state.items.findIndex((i) => i.key === it.key);
    setItems((items) => items.filter((i) => i.key !== it.key));
    const name = map.get(it.exerciseId)?.name ?? "exercise";
    toast(`Removed ${name}`, {
      undo: () => setItems((items) => (items.some((i) => i.key === it.key) ? items : [...items.slice(0, at), it, ...items.slice(at)])),
    });
  };

  const addPicked = (picked: LibraryExercise[]) => {
    setPicking(false);
    setItems((items) => [...items, ...picked.map((e) => ({ key: uid(), exerciseId: e.id, tip: "", ...newItemDose(e.logType) }))]);
  };

  const save = async () => {
    if (!ok || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const { workout } = await saveFn({ data: savePayload(current) });
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      qc.removeQueries({ queryKey: workoutPageKey(workout.id) });
      qc.removeQueries({ queryKey: ["workout-share-panel", workout.id] });
      toast(`${workout.name} saved`, { success: true });
      navigate({ to: "/workouts/$workoutId", params: { workoutId: workout.id }, replace: true });
    } catch (e) {
      console.error("[builder] save failed", e);
      setErr("Couldn't save the workout. Check your connection and try again.");
      toast("Couldn't save the workout. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Drag to reorder: the handle moves its row past neighbours' midpoints.
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [dragKey, setDragKey] = useState<string | null>(null);
  const onHandleDown = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragKey(key);
  };
  const onHandleMove = (key: string) => (e: React.PointerEvent) => {
    if (dragKey !== key) return;
    const y = e.clientY;
    setItems((items) => {
      const from = items.findIndex((i) => i.key === key);
      if (from < 0) return items;
      let to = from;
      items.forEach((it, idx) => {
        const el = rowRefs.current.get(it.key);
        if (!el || idx === from) return;
        const r = el.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        if (idx < from && y < mid) to = Math.min(to, idx);
        if (idx > from && y > mid) to = Math.max(to, idx);
      });
      return to === from ? items : reorderItems(items, from, to);
    });
  };
  const onHandleUp = () => setDragKey(null);

  const doseItem = state.items.find((i) => i.key === doseKey) ?? null;

  return (
    <div ref={scrollRef} data-scroll-root className="fixed inset-0 overflow-y-auto overscroll-none" style={{ background: "#F5F2EC", color: INK, fontFamily: FONT }}>
      <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-new-top">
        <header className="grid h-11 grid-cols-[1fr_auto_1fr] items-center">
          <button type="button" onClick={cancel} className="justify-self-start text-[17px] font-medium" style={{ color: MUTED }}>Cancel</button>
          <h1 className="text-[17px] font-extrabold">{isEdit ? "Edit workout" : "New workout"}</h1>
          <button type="button" onClick={() => void save()} disabled={!ok || saving} className="justify-self-end text-[17px] font-bold disabled:cursor-default" style={{ color: ok ? PURPLE : "#A8A29E" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </header>
      </div>

      <div className="px-4 pt-4" style={{ paddingBottom: "calc(max(40px, calc(env(safe-area-inset-bottom) + 24px)) + var(--workout-bar-pad, 0px))" }}>
        <div className="rounded-[18px] bg-white p-4">
          <label htmlFor="wk-name" className="text-[14px] font-bold">Name</label>
          <input
            id="wk-name"
            value={state.name}
            maxLength={60}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="Back day"
            className="mt-2 h-12 w-full rounded-[12px] border bg-white px-3.5 text-[16px] outline-none focus:border-[#7C3AED]"
            style={{ borderColor: BORDER, color: INK }}
          />
          <p className="mt-4 text-[14px] font-bold">Equipment</p>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Equipment">
            {EQUIPMENT_OPTIONS.map((o) => {
              const on = equipment === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => { setEquipTouched(true); setState((s) => ({ ...s, equipment: o.key })); }}
                  className="h-10 rounded-full border px-4 text-[15px] font-semibold"
                  style={on ? { background: PURPLE, borderColor: PURPLE, color: "#FFFFFF" } : { background: "#FFFFFF", borderColor: BORDER, color: INK }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mb-2 mt-5 px-1 text-[12px] font-extrabold uppercase tracking-[0.6px]" style={{ color: MUTED }}>
          Exercises · {minutes} min
        </p>
        {state.items.length > 0 && (
          <div className="overflow-hidden rounded-[18px] bg-white">
            {state.items.map((it, i) => {
              const ex = map.get(it.exerciseId);
              const name = ex?.name ?? "Exercise";
              const editingTip = tipKey === it.key;
              return (
                <div
                  key={it.key}
                  ref={(el) => { if (el) rowRefs.current.set(it.key, el); else rowRefs.current.delete(it.key); }}
                  data-builder-row
                  className="px-3 py-3"
                  style={{ borderTop: i === 0 ? undefined : `1px solid ${HAIR}`, background: dragKey === it.key ? "#FAF8F5" : "#FFFFFF" }}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      aria-label={`Move ${name}`}
                      onPointerDown={onHandleDown(it.key)}
                      onPointerMove={onHandleMove(it.key)}
                      onPointerUp={onHandleUp}
                      onPointerCancel={onHandleUp}
                      className="-ml-1 flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center"
                      style={{ color: "#A8A29E" }}
                    >
                      <DragDots />
                    </button>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px]" style={{ background: ex?.imageBg ?? "#E8F1FB" }} aria-hidden>
                      {ex?.imageStart && <img src={ex.imageStart} alt="" loading="lazy" className="h-full w-full object-contain" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-3 text-[16px] font-bold leading-[1.25] [hyphens:none] [overflow-wrap:normal]">{name}</span>
                      {isEachSide(it.reps) && <span className="block text-[12px] leading-[1.3]" style={{ color: MUTED }}>each side</span>}
                    </span>
                    <button type="button" onClick={() => setDoseKey(it.key)} className="h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-[15px] font-bold" style={{ background: WARM, color: INK }} aria-label={`Sets and reps for ${name}: ${pillText(it)}${isEachSide(it.reps) ? " each side" : ""}`}>
                      {pillText(it)}
                    </button>
                    <button type="button" onClick={() => remove(it)} aria-label={`Remove ${name}`} className="-mr-1 flex h-11 w-9 shrink-0 items-center justify-center" style={{ color: "#A8A29E" }}>
                      <Trash2 size={19} />
                    </button>
                  </div>
                  <div className="mt-2 pl-[88px]">
                    {editingTip ? (
                      <TipEditor value={it.tip} onChange={(v) => patch(it.key, { tip: v })} onDone={() => setTipKey(null)} />
                    ) : it.tip.trim() ? (
                      <button type="button" onClick={() => setTipKey(it.key)} className="w-full rounded-[12px] px-3 py-2 text-left text-[13px] leading-[1.35]" style={{ background: WARM, color: "#44403C" }}>
                        {it.tip}
                      </button>
                    ) : (
                      <button type="button" onClick={() => setTipKey(it.key)} className="h-8 text-[13px] font-bold" style={{ color: PURPLE }}>+ Add a tip</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button type="button" onClick={() => setPicking(true)} className={`${state.items.length ? "mt-3" : ""} flex h-[52px] w-full items-center justify-center gap-1.5 rounded-full text-[17px] font-bold`} style={{ background: LAVENDER, color: PURPLE_INK }}>
          <Plus size={19} strokeWidth={2.5} aria-hidden /> Add exercise
        </button>
        {err && <p className="mt-3 text-center text-[13px]" style={{ color: "#B91C1C" }}>{err}</p>}
      </div>

      <NewSheet open={!!doseItem} onOpenChange={(o) => { if (!o) setDoseKey(null); }} title={doseItem ? (map.get(doseItem.exerciseId)?.name ?? "Sets and reps") : "Sets and reps"}>
        {doseItem && <DoseEditor item={doseItem} onChange={(p) => patch(doseItem.key, p)} onDone={() => setDoseKey(null)} />}
      </NewSheet>

      <NewConfirm
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this workout?"
        subtitle="Your changes won't be saved."
        action="Discard"
        cancelLabel="Keep editing"
        busy={false}
        error={null}
        onConfirm={() => { setDiscardOpen(false); leave(); }}
      />

      <ExercisePicker open={picking} hint="Added to the end. Drag to reorder." onClose={() => setPicking(false)} onDone={addPicked} />
    </div>
  );
}

function TipEditor({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="rounded-[12px] border px-3 pb-1.5 pt-2" style={{ background: WARM, borderColor: PURPLE }}>
      <textarea
        ref={ref}
        value={value}
        rows={2}
        maxLength={TIP_MAX}
        onChange={(e) => onChange(cleanTip(e.target.value))}
        onBlur={() => { onChange(value.trim()); onDone(); }}
        placeholder="A short tip for this exercise"
        aria-label="Tip"
        className="block w-full resize-none bg-transparent text-[13px] leading-[1.35] outline-none"
        style={{ color: INK }}
      />
      <p className="text-right text-[11px] font-semibold" style={{ color: value.length >= TIP_MAX ? "#C2410C" : "#A8A29E" }}>{value.length}/{TIP_MAX}</p>
    </div>
  );
}

function DoseEditor({ item, onChange, onDone }: { item: BuilderItem; onChange: (p: Partial<BuilderItem>) => void; onDone: () => void }) {
  const each = / each$/i.test(cleanReps(item.reps));
  return (
    <div>
      <Stepper label="Sets" value={String(item.sets)} onMinus={() => onChange({ sets: clampSets(item.sets - 1) })} onPlus={() => onChange({ sets: clampSets(item.sets + 1) })} minusDisabled={item.sets <= MIN_SETS} plusDisabled={item.sets >= MAX_SETS} />
      <div className="h-px" style={{ background: HAIR }} />
      <div className="flex items-center gap-3 py-3">
        <span className="flex-1 text-[16px] font-bold">Reps</span>
        <StepButton label="Fewer reps" onClick={() => onChange({ reps: stepReps(item.reps, -1) })}><Minus size={18} /></StepButton>
        <input
          value={item.reps}
          onChange={(e) => onChange({ reps: e.target.value.slice(0, 20) })}
          onBlur={() => onChange({ reps: cleanReps(item.reps) })}
          placeholder="8"
          aria-label="Reps"
          className="h-11 w-[92px] rounded-[12px] border text-center text-[17px] font-bold outline-none"
          style={{ borderColor: BORDER, color: INK }}
        />
        <StepButton label="More reps" onClick={() => onChange({ reps: stepReps(item.reps, 1) })}><Plus size={18} /></StepButton>
      </div>
      <div className="flex flex-wrap gap-2">
        <NewSheetChip selected={each} onClick={() => onChange({ reps: toggleEach(item.reps) })}>Each side</NewSheetChip>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: MUTED }}>Type a range like 8-12, or 10 each.</p>
      <NewSheetButton onClick={onDone}>Done</NewSheetButton>
    </div>
  );
}

function Stepper({ label, value, onMinus, onPlus, minusDisabled, plusDisabled }: { label: string; value: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex-1 text-[16px] font-bold">{label}</span>
      <StepButton label={`Fewer ${label.toLowerCase()}`} onClick={onMinus} disabled={minusDisabled}><Minus size={18} /></StepButton>
      <span className="w-[92px] text-center text-[22px] font-extrabold" aria-live="polite">{value}</span>
      <StepButton label={`More ${label.toLowerCase()}`} onClick={onPlus} disabled={plusDisabled}><Plus size={18} /></StepButton>
    </div>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40" style={{ background: WARM, color: INK }}>
      {children}
    </button>
  );
}

function DragDots() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden>
      {[3, 9, 15].map((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  );
}
