import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, GripVertical, Minus, Pencil, Play, Plus, Trash2 } from "lucide-react";
import type { LibraryExercise } from "@/lib/exercise-library";
import { EQUIPMENT_LABEL } from "@/lib/lift-rules";
import { MAX_SETS, MIN_SETS, canSave, clampSets, draftMeta, draftSignature, moveItem, type DraftItem } from "@/lib/workout-builder";
import { hapticLight } from "@/lib/native";
import { ExerciseThumb, FONT, W } from "./WorkoutBits";

const SHADOW = "0 1px 2px rgba(20,18,24,.06)";

/**
 * Full-screen New workout / Edit workout review: name, order and sets,
 * then save it for later or start it now. Nothing here starts a timer
 * except Start.
 */
export function WorkoutBuilder({
  mode,
  name,
  onName,
  items,
  onItems,
  lib,
  initial,
  busy,
  error,
  onBack,
  onAddExercises,
  onSave,
  onStart,
  onDelete,
}: {
  mode: "new" | "edit";
  name: string;
  onName: (v: string) => void;
  items: DraftItem[];
  onItems: (fn: (items: DraftItem[]) => DraftItem[]) => void;
  lib: Map<string, LibraryExercise>;
  /** Edit workout: what it looked like when opened (to spot unsaved changes). */
  initial: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onAddExercises: () => void;
  onSave: () => void;
  onStart: () => void;
  onDelete?: () => void;
}) {
  const ready = canSave(name, items) && !busy;
  const isEdit = mode === "edit";
  // Nothing changed yet: "Save changes" has nothing to save.
  const changed = !isEdit || draftSignature(name, items) !== initial;
  const saveReady = ready && changed;

  // ---- Drag the grip to reorder ----
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<{ key: string; grab: number; y: number; pointerId: number } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const place = () => {
    const d = drag.current;
    const el = d ? rowRefs.current.get(d.key) : null;
    const list = listRef.current;
    if (!d || !el || !list) return;
    const natural = list.getBoundingClientRect().top + el.offsetTop;
    el.style.transform = `translateY(${d.y - d.grab - natural}px)`;
  };
  useLayoutEffect(place, [items]);

  const onGripDown = (key: string) => (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = rowRefs.current.get(key);
    if (!el || items.length < 2) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { key, grab: e.clientY - el.getBoundingClientRect().top, y: e.clientY, pointerId: e.pointerId };
    setDragKey(key);
    void hapticLight();
  };
  const onGripMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    d.y = e.clientY;
    const el = rowRefs.current.get(d.key);
    if (!el) return;
    const center = d.y - d.grab + el.offsetHeight / 2;
    let to = 0;
    for (const it of items) {
      if (it.key === d.key) continue;
      const r = rowRefs.current.get(it.key)?.getBoundingClientRect();
      if (r && center > r.top + r.height / 2) to++;
    }
    const from = items.findIndex((x) => x.key === d.key);
    if (from !== to) {
      onItems((cur) => moveItem(cur, cur.findIndex((x) => x.key === d.key), to));
      void hapticLight();
    } else place();
  };
  const onGripEnd = () => {
    const d = drag.current;
    if (!d) return;
    const el = rowRefs.current.get(d.key);
    if (el) el.style.transform = "";
    drag.current = null;
    setDragKey(null);
  };
  const onGripKey = (key: string) => (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    onItems((cur) => {
      const i = cur.findIndex((x) => x.key === key);
      return moveItem(cur, i, e.key === "ArrowUp" ? i - 1 : i + 1);
    });
  };

  const setSets = (key: string, delta: number) =>
    onItems((cur) => cur.map((x) => (x.key === key ? { ...x, sets: clampSets(x.sets + delta) } : x)));

  return (
    <div className="fixed inset-0 z-[65] overflow-y-auto" style={{ background: W.bg, color: W.ink, fontFamily: FONT }} role="dialog" aria-label={isEdit ? "Edit workout" : "New workout"} data-scroll-root>
      <header className="sticky top-0 z-10 grid grid-cols-[44px_1fr_44px] items-center px-2 pt-[env(safe-area-inset-top)]" style={{ background: W.bg }}>
        <button type="button" aria-label={isEdit ? "Back to Start a workout" : "Back to exercises"} onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft size={24} />
        </button>
        <span className="text-center text-[17px] font-extrabold">{isEdit ? "Edit workout" : "New workout"}</span>
        <span />
      </header>

      <div className="flex flex-col gap-4 px-4 pb-[200px] pt-2.5">
        <label className="flex flex-col gap-1 rounded-[20px] bg-white px-4 py-3" style={{ boxShadow: SHADOW }}>
          <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>
            NAME
          </span>
          <span className="flex items-center gap-2">
            <input
              aria-label="Workout name"
              value={name}
              maxLength={60}
              onChange={(e) => onName(e.target.value)}
              placeholder="Name this workout"
              enterKeyHint="done"
              className="min-w-0 flex-1 border-none bg-transparent text-[22px] font-extrabold tracking-[-0.4px] outline-none placeholder:text-[#A8A29E]"
            />
            <Pencil size={18} style={{ color: W.muted }} aria-hidden />
          </span>
        </label>

        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[17px] font-extrabold">Exercises</h2>
          <span className="text-[13px]" style={{ color: W.stone }}>
            {draftMeta(items)}
          </span>
        </div>

        {items.length > 0 && (
          <div ref={listRef} className="relative overflow-hidden rounded-[20px] bg-white" style={{ boxShadow: SHADOW }}>
            {items.map((it, i) => {
              const ex = lib.get(it.exerciseId);
              const exName = ex?.name ?? "Exercise";
              const dragging = dragKey === it.key;
              return (
                <div
                  key={it.key}
                  ref={(el) => {
                    if (el) rowRefs.current.set(it.key, el);
                    else rowRefs.current.delete(it.key);
                  }}
                  className="relative flex min-h-[72px] items-center gap-2.5 bg-white py-2.5 pl-1.5 pr-3"
                  style={{
                    borderTop: i ? `1px solid ${W.divider}` : undefined,
                    zIndex: dragging ? 2 : undefined,
                    boxShadow: dragging ? "0 8px 24px rgba(20,18,24,.16)" : undefined,
                  }}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Hold and drag to reorder"
                    onPointerDown={onGripDown(it.key)}
                    onPointerMove={onGripMove}
                    onPointerUp={onGripEnd}
                    onPointerCancel={onGripEnd}
                    onKeyDown={onGripKey(it.key)}
                    onContextMenu={(e) => e.preventDefault()}
                    className="flex h-11 w-7 shrink-0 cursor-grab touch-none select-none items-center justify-center"
                    style={{ color: W.disabled }}
                  >
                    <GripVertical size={20} />
                  </span>
                  <ExerciseThumb name={exName} primary={ex?.primary ?? []} image={ex?.imageStart ?? null} size={52} radius={14} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[16px] font-bold leading-[1.25]">{exName}</span>
                    {/* If the label and stepper don't fit side by side, the stepper drops to its own line, right-aligned. */}
                    <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                      <span className="whitespace-nowrap text-[13px]" style={{ color: W.stone }}>
                        {ex ? EQUIPMENT_LABEL[ex.equipment] : ""}
                      </span>
                      <span className="ml-auto flex h-[34px] shrink-0 items-center rounded-[17px]" style={{ background: W.chip }}>
                        <button
                          type="button"
                          aria-label={`One less set of ${exName}`}
                          disabled={it.sets <= MIN_SETS}
                          onClick={() => setSets(it.key, -1)}
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-full disabled:opacity-40"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="min-w-11 text-center text-[13px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {it.sets} {it.sets === 1 ? "set" : "sets"}
                        </span>
                        <button
                          type="button"
                          aria-label={`One more set of ${exName}`}
                          disabled={it.sets >= MAX_SETS}
                          onClick={() => setSets(it.key, 1)}
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-full disabled:opacity-40"
                        >
                          <Plus size={16} />
                        </button>
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${exName}`}
                    onClick={() => onItems((cur) => cur.filter((x) => x.key !== it.key))}
                    className="flex h-11 w-9 shrink-0 items-center justify-center"
                    style={{ color: W.disabled }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onAddExercises}
          className="flex h-[52px] items-center justify-center gap-2 rounded-[26px] text-[15px] font-bold"
          style={{ border: `2px dashed ${W.lilac}`, color: W.violet }}
        >
          <Plus size={18} /> Add exercises
        </button>
        {items.length > 1 && (
          <span className="-mt-1.5 text-center text-[13px]" style={{ color: W.muted }}>
            Hold ⠿ and drag to change the order.
          </span>
        )}
        {isEdit && onDelete && (
          <button type="button" onClick={onDelete} className="mx-auto h-12 px-4 text-[15px] font-bold" style={{ color: "#DC2626" }}>
            Delete workout
          </button>
        )}
        {error && (
          <p className="text-center text-[14px] font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 bg-white px-4 pb-[calc(30px+env(safe-area-inset-bottom))] pt-3" style={{ borderTop: `1px solid ${W.line}` }}>
        <button
          type="button"
          disabled={!saveReady}
          onClick={onSave}
          className="h-[54px] rounded-[27px] text-[17px] font-bold text-white"
          style={{ background: saveReady ? W.purple : W.lilac }}
        >
          {busy ? "Saving…" : isEdit ? "Save changes" : "Save workout"}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={onStart}
          className="flex h-12 items-center justify-center gap-2 rounded-[24px] bg-white text-[16px] font-bold disabled:opacity-50"
          style={{ border: `1.5px solid ${W.line}`, color: W.ink }}
        >
          <Play size={16} fill="currentColor" /> {isEdit ? "Start this workout" : "Start now"}
        </button>
        <span className="text-center text-[12px]" style={{ color: W.muted }}>
          {isEdit ? "Changes apply next time you start it." : "Saved to My workouts. Start it whenever you’re ready."}
        </span>
      </div>
    </div>
  );
}
