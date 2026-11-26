import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkTipTarget, shouldShowCheckTip } from "@/lib/logger-check-tip";
import { Check, ChevronDown, MoreHorizontal, Plus, Repeat, Timer, Trash2 } from "lucide-react";
import { NewConfirm } from "./NewConfirm";
import { NewSheet, NewSheetRow } from "./NewSheet";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { useNow } from "@/components/workout/WorkoutBar";
import { update, updateEx, useLoggerActions } from "@/components/workout/useLoggerActions";
import { emptySet, withPrs, type ActiveWorkout, type LiveExercise, type LiveSet } from "@/lib/active-workout";
import { useExerciseMap } from "@/lib/exercise-library";
import { canCheckOffSet, fmtClock, fmtNum, lastCell } from "@/lib/lift-rules";
import { adjustRest, loggerSubtitle, restSecondsLeft, setRowState, skipRest, uncheckedLine, uncheckedSets } from "@/lib/new-workout-logger";
import { useOpenAtTop } from "@/lib/use-open-at-top";

const INK = "#1C1917";
const MUTED = "#78716C";
const PURPLE = "#7C3AED";
const PURPLE_INK = "#6D28D9";
const GREEN = "#16A34A";
const WARM = "#F0EDE8";
const BG = "#F5F2EE";
const FONT = "Inter, system-ui, sans-serif";
const GRID = "26px minmax(0,1fr) 58px 58px 42px";

/** New-version logger at /workout/log; saving goes through the same path as classic. */
export function NewWorkoutLogger({ w }: { w: ActiveWorkout }) {
  const scrollRef = useOpenAtTop();
  const navigate = useNavigate();
  const now = useNow(1000);
  const { map: lib } = useExerciseMap();
  const actions = useLoggerActions(w);
  const [picker, setPicker] = useState<null | { replace: string | null }>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "finish" | "empty" | "discard">(null);

  const minimize = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/home" });
  };
  const finish = async (force = false) => {
    setConfirm(null);
    const r = await actions.finish(force);
    if (r === "empty") setConfirm("empty");
    else if (r === "confirm") setConfirm("finish");
  };

  const menuEx = w.exercises.find((e) => e.key === menuKey) ?? null;
  const removeEx = w.exercises.find((e) => e.key === removeKey) ?? null;
  const swapEx = picker?.replace ? w.exercises.find((e) => e.key === picker.replace) ?? null : null;
  const restLeft = restSecondsLeft(w.rest, now);
  const unchecked = uncheckedSets(w);
  const tip = useCheckTip(w, restLeft > 0);

  return (
    <div ref={scrollRef} className="fixed inset-0 overflow-y-auto" style={{ background: BG, color: INK, fontFamily: FONT }} data-scroll-root>
      <div className="sticky top-0 z-10">
        <div className="bg-white px-4 pb-3 pt-new-top">
        <header className="flex items-center gap-3">
          <button type="button" aria-label="Minimize workout" onClick={minimize} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: WARM }}>
            <ChevronDown size={22} strokeWidth={2.5} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[18px] font-extrabold leading-tight">{w.title}</div>
            <div className="truncate text-[13px]" style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
              {loggerSubtitle(w.from, (now - w.startedAt) / 1000)}
            </div>
          </div>
          <button type="button" disabled={actions.saving} onClick={() => void finish()} className="h-11 shrink-0 rounded-full px-5 text-[16px] font-extrabold text-white disabled:opacity-60" style={{ background: GREEN }}>
            {actions.saving ? "Saving…" : "Finish"}
          </button>
        </header>
        </div>
        {/* Rest bar sits on the warm gray under the white band and stays pinned there while scrolling. */}
        {w.rest && restLeft > 0 && (
          <div className="px-4 pt-3" style={{ background: BG }}>
          <div className="flex h-12 items-center gap-2.5 rounded-[14px] px-4 text-white" style={{ background: INK }} role="timer" aria-live="off">
            <Timer size={20} style={{ color: "#F59E0B" }} aria-hidden />
            <span className="flex-1 text-[16px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>Rest {fmtClock(restLeft)}</span>
            <button type="button" aria-label="15 seconds less rest" onClick={() => update((x) => ({ ...x, rest: adjustRest(x.rest, -15, Date.now()) }))} className="h-10 px-1.5 text-[14px] font-semibold" style={{ color: "rgba(255,255,255,.7)" }}>−15s</button>
            <button type="button" aria-label="15 seconds more rest" onClick={() => update((x) => ({ ...x, rest: adjustRest(x.rest, 15, Date.now()) }))} className="h-10 px-1.5 text-[14px] font-semibold" style={{ color: "rgba(255,255,255,.7)" }}>+15s</button>
            <button type="button" onClick={() => update((x) => ({ ...x, rest: skipRest() }))} className="h-10 pl-1.5 text-[14px] font-extrabold text-white">Skip</button>
          </div>
          </div>
        )}
      </div>

      {actions.err && (
        <div className="mx-4 mt-3 rounded-[14px] bg-red-50 px-3 py-2 text-[14px] font-semibold text-red-700" role="alert">{actions.err}</div>
      )}

      <div className="flex flex-col gap-[10px] px-4 pb-[calc(32px+env(safe-area-inset-bottom))] pt-3">
        {w.exercises.map((ex) => (
          <ExerciseCard key={ex.key} ex={ex} w={w} imageBg={lib.get(ex.exerciseId)?.imageBg ?? null} onMenu={() => setMenuKey(ex.key)} tipSetId={tip.target?.exKey === ex.key ? tip.target.setId : null} onTipDismiss={tip.dismiss} onToggle={(s) => { tip.dismiss(); actions.toggleSet(ex, s); }} />
        ))}

        {w.untracked.length > 0 && (
          <section className="rounded-[18px] bg-white p-[14px]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.6px]" style={{ color: MUTED }}>Also today · not logged here</div>
            <ul className="mt-1.5 flex flex-col gap-1">
              {w.untracked.map((m) => (
                <li key={m.name} className="flex justify-between gap-3 text-[15px]">
                  <span className="font-bold">{m.name}</span>
                  <span className="shrink-0 font-semibold" style={{ color: PURPLE_INK }}>{m.dose}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button type="button" onClick={() => setPicker({ replace: null })} className="flex h-[52px] items-center justify-center gap-1.5 rounded-full text-[16px] font-extrabold" style={{ background: "#EDE9FE", color: PURPLE_INK }}>
          <Plus size={19} strokeWidth={2.5} aria-hidden /> Add exercise
        </button>
        <p className="text-center text-[13px]" style={{ color: MUTED }}>Swap or remove an exercise from its ••• menu.</p>
        <button type="button" onClick={() => setConfirm("discard")} className="mx-auto h-11 px-4 text-[14px] font-semibold" style={{ color: MUTED }}>Discard workout</button>
      </div>

      <ExercisePicker
        open={!!picker}
        single={!!picker?.replace}
        similarTo={swapEx ? { variationGroup: lib.get(swapEx.exerciseId)?.variationGroup ?? null, excludeId: swapEx.exerciseId } : null}
        onClose={() => setPicker(null)}
        onDone={(picked) => { actions.addExercises(picked, picker?.replace ?? null); setPicker(null); }}
      />

      <NewSheet open={!!menuEx} onOpenChange={(o) => { if (!o) setMenuKey(null); }} title={menuEx?.name ?? "Exercise"}>
        {menuEx && (
          <div>
            <NewSheetRow simple className="h-14 [&_span]:!text-[16px] [&_span]:!font-semibold" leading={<Repeat size={22} />} title="Swap exercise" onClick={() => { setMenuKey(null); setPicker({ replace: menuEx.key }); }} />
            <NewSheetRow simple destructive className="h-14 [&_span]:!text-[16px] [&_span]:!font-semibold" leading={<Trash2 size={22} color="#DC2626" />} title="Remove exercise" onClick={() => { setMenuKey(null); setRemoveKey(menuEx.key); }} />
          </div>
        )}
      </NewSheet>

      <NewConfirm
        open={!!removeEx}
        onOpenChange={(o) => { if (!o) setRemoveKey(null); }}
        title={`Remove ${removeEx?.name ?? "exercise"}?`}
        subtitle="Sets you logged for it are removed from this workout."
        action="Remove"
        cancelLabel="Keep"
        busy={false}
        error={null}
        onConfirm={() => { const key = removeKey; setRemoveKey(null); update((x) => ({ ...x, exercises: x.exercises.filter((e) => e.key !== key), rest: x.rest?.exKey === key ? null : x.rest })); }}
      />
      <NewConfirm
        open={confirm === "finish"}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title="Finish workout?"
        subtitle={uncheckedLine(unchecked)}
        action="Finish"
        cancelLabel="Keep going"
        tone="success"
        busy={false}
        error={null}
        onConfirm={() => void finish(true)}
      />
      <NewConfirm
        open={confirm === "empty"}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title="Nothing logged yet"
        subtitle="Check off at least one set to finish, or discard this workout."
        action="Discard workout"
        cancelLabel="Keep going"
        busy={false}
        error={null}
        onConfirm={() => { setConfirm(null); actions.discard(); }}
      />
      <NewConfirm
        open={confirm === "discard"}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title="Discard this workout?"
        subtitle="Your sets from this workout won't be saved."
        action="Discard"
        cancelLabel="Keep going"
        busy={false}
        error={null}
        onConfirm={() => { setConfirm(null); actions.discard(); }}
      />
    </div>
  );
}

function ExerciseCard({ ex, w, imageBg, onMenu, onToggle, tipSetId, onTipDismiss }: { ex: LiveExercise; w: ActiveWorkout; imageBg: string | null; onMenu: () => void; onToggle: (s: LiveSet) => void; tipSetId: string | null; onTipDismiss: () => void }) {
  const unit = w.unit;
  const timed = ex.logType === "timed";
  const tip = ex.authorTip ?? ex.tip;
  const setField = (setId: string, patch: Partial<LiveSet>) =>
    updateEx(ex.key, (e) => withPrs({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }, unit));
  return (
    <section className="rounded-[18px] bg-white p-[14px]" aria-label={ex.name}>
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px]" style={{ background: imageBg ?? "#E8F1FB" }} aria-hidden>
          {ex.imageStart && <img src={ex.imageStart} alt="" loading="lazy" className="h-full w-full object-contain" />}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <Link to="/exercises/$exerciseId" params={{ exerciseId: ex.exerciseId }} search={{ tab: "howto", ...(w.workoutId ? { workout: w.workoutId } : {}) }} className="block text-[16px] font-extrabold leading-[1.25]" style={{ color: PURPLE }}>{ex.name}</Link>
          {tip && <p className="mt-0.5 text-[13px] leading-[1.35]" style={{ color: MUTED }}>{tip}</p>}
        </div>
        <button type="button" aria-label={`More options for ${ex.name}`} onClick={onMenu} className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center" style={{ color: MUTED }}>
          <MoreHorizontal size={22} />
        </button>
      </div>

      <div className="mb-2 mt-3 grid items-center gap-[7px] text-[11px] font-extrabold uppercase tracking-[0.5px]" style={{ gridTemplateColumns: GRID, color: MUTED }}>
        <span>Set</span>
        <span>Last time</span>
        <span className="text-center">{unit.toUpperCase()}</span>
        <span className="text-center">{timed ? (ex.minutes ? "Min" : "Sec") : "Reps"}</span>
        <span className="flex justify-center" aria-label="Done"><Check size={12} strokeWidth={3} /></span>
      </div>
      {ex.sets.map((s, i) => {
        const st = setRowState(s);
        const last = lastCell(ex.last?.sets[i] ?? null, unit, ex.logType).replace("×", " × ");
        return (
          <div key={s.id} className="grid h-11 items-center gap-[7px]" style={{ gridTemplateColumns: GRID }} data-set-row data-done={s.done || undefined}>
            <span className="text-[15px] font-extrabold">{i + 1}</span>
            <span className="truncate text-[14px]" style={{ color: MUTED }}>{last}</span>
            <NumBox value={emptyWhenZero(s.weight, s.done)} bg={st.boxBg} decimal placeholder={ex.loadable ? "" : "—"} ariaLabel={`Set ${i + 1} weight in ${unit}`} onChange={(v) => setField(s.id, { weight: v })} />
            <NumBox
              value={timed ? (s.seconds == null ? null : ex.minutes ? Math.round((s.seconds / 60) * 10) / 10 : s.seconds) : emptyWhenZero(s.reps, s.done)}
              bg={st.boxBg}
              decimal={timed && ex.minutes}
              placeholder=""
              ariaLabel={`Set ${i + 1} ${timed ? (ex.minutes ? "minutes" : "seconds") : "reps"}`}
              onChange={(v) => setField(s.id, timed ? { seconds: v == null ? null : Math.round(ex.minutes ? v * 60 : v) } : { reps: v == null ? null : Math.round(v) })}
            />
            <span className="relative flex h-[34px] w-[34px]">
              <button
                type="button"
                aria-label={s.done ? `Mark set ${i + 1} not done` : `Mark set ${i + 1} done`}
                aria-pressed={s.done}
                aria-disabled={!s.done && !canCheckOffSet(s, ex) ? true : undefined}
                onClick={() => { if (s.done || canCheckOffSet(s, ex)) onToggle(s); }}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px]"
                style={s.done ? { background: GREEN, color: "#FFFFFF" } : tipSetId === s.id ? { background: "#FFFFFF", border: "2px solid #7C3AED", boxShadow: "0 0 0 5px rgba(124,58,237,0.18)" } : { background: "#FFFFFF", border: "2px solid #D6D3D1", color: "#A8A29E" }}
              >
                {s.done && <Check size={18} strokeWidth={3} />}
              </button>
              {tipSetId === s.id && <CheckTip onDismiss={onTipDismiss} />}
              {st.showPr && (
                <span className="absolute -right-2 -top-1.5 rounded-full px-1.5 py-px text-[10px] font-extrabold leading-[14px]" style={{ background: "#F59E0B", color: "#FFFFFF" }}>PR</span>
              )}
            </span>
          </div>
        );
      })}
      <button type="button" onClick={() => updateEx(ex.key, (e) => ({ ...e, sets: [...e.sets, emptySet(e)] }))} className="mx-auto mb-1 mt-2 flex h-6 items-center justify-center gap-1 px-3 text-[14px] font-extrabold" style={{ color: PURPLE }}>
        <Plus size={16} strokeWidth={2.75} /> Add set
      </button>
    </section>
  );
}

/** No last time and no target: the box stays empty instead of showing 0. */
function emptyWhenZero(v: number | null, done: boolean): number | null {
  return v === 0 && !done ? null : v;
}

function NumBox({ value, bg, decimal, placeholder, ariaLabel, onChange }: { value: number | null; bg: string; decimal?: boolean; placeholder: string; ariaLabel: string; onChange: (v: number | null) => void }) {
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
      onFocus={(e) => { setDraft(shown); e.currentTarget.select(); }}
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
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="h-[34px] w-full min-w-0 rounded-[8px] text-center text-[16px] font-extrabold outline-none placeholder:font-semibold placeholder:text-[#A8A29E] focus:ring-2 focus:ring-[#C4B5FD]"
      style={{ background: bg, color: INK, fontVariantNumeric: "tabular-nums" }}
    />
  );
}

/** Once-per-account first-run tip; the seen time lives on the profile. */
function useCheckTip(w: ActiveWorkout, restRunning: boolean) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const q = useQuery({
    queryKey: ["logger-check-tip-seen"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return { uid: null, seenAt: "signed-out" };
      const { data, error } = await supabase.rpc("get_my_logger_check_tip_seen");
      if (error) throw error;
      return { uid, seenAt: (data as string | null) ?? null };
    },
  });
  const show = shouldShowCheckTip({ loaded: q.isSuccess, seenAt: q.data?.seenAt ?? null, dismissed, restRunning: false, exercises: w.exercises });
  const dismiss = () => {
    if (!show) return;
    setDismissed(true);
    const at = new Date().toISOString();
    qc.setQueryData(["logger-check-tip-seen"], { ...q.data, seenAt: at });
    if (q.data?.uid) void supabase.from("profiles").update({ seen_logger_check_tip_at: at }).eq("id", q.data.uid).then(() => undefined);
  };
  // The rest timer starting also counts as dismissing it.
  useEffect(() => { if (restRunning) dismiss(); }, [restRunning]); // eslint-disable-line react-hooks/exhaustive-deps
  return { target: show && !restRunning ? checkTipTarget(w.exercises) : null, dismiss };
}

function CheckTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="status" className="absolute right-0 top-[calc(100%+12px)] z-20 w-[232px] rounded-[14px] px-[14px] py-3 text-left" style={{ background: "#1C1917", boxShadow: "0 8px 24px rgba(20,18,24,0.22)" }}>
      <span aria-hidden className="absolute -top-[6px] right-[11px] h-3 w-3 rotate-45" style={{ background: "#1C1917" }} />
      <div className="text-[15px] font-extrabold text-white">Finished a set? Tap here.</div>
      <p className="mt-1 text-[13px] leading-[1.4]" style={{ color: "rgba(255,255,255,0.78)" }}>It turns green and your rest timer starts.</p>
      <div className="mt-1 flex justify-end">
        <button type="button" onClick={onDismiss} className="-mr-2 h-9 px-2 text-[14px] font-extrabold" style={{ color: "#C4B5FD" }}>Got it</button>
      </div>
    </div>
  );
}
