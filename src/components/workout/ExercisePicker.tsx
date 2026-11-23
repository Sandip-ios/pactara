import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Search, X } from "lucide-react";
import { createCustomExercise } from "@/lib/lifts.functions";
import { EXERCISE_LIBRARY_KEY, fetchExerciseLibrary, useExerciseLibrary, useLiftHistory, type LibraryExercise } from "@/lib/exercise-library";
import {
  EQUIPMENT_CHIPS,
  EQUIPMENT_LABEL,
  PICKER_TABS,
  lastSetLabel,
  mainTab,
  tabLabel,
  tabsFor,
  type Equipment,
  type PickerTab,
} from "@/lib/lift-rules";
import { ExerciseThumb, FONT, W } from "./WorkoutBits";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Section = { key: string; label: string; items: LibraryExercise[] };

/**
 * Full-screen "Add exercises" picker. `single` replaces one exercise; otherwise
 * picks are numbered in the order they're tapped.
 */
export function ExercisePicker({
  open,
  single = false,
  initialPicked,
  hint = "In the order you picked. You can reorder in the workout.",
  onClose,
  onDone,
}: {
  open: boolean;
  single?: boolean;
  /** Picks to show as already chosen when it opens (going back from New workout). */
  initialPicked?: string[];
  /** Footer line shown once something is picked. */
  hint?: string;
  onClose: () => void;
  onDone: (picked: LibraryExercise[]) => void;
}) {
  const { data: library = [], isLoading } = useExerciseLibrary();
  const { data: history } = useLiftHistory();
  const unit = history?.unit ?? "lb";
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PickerTab>("all");
  const [equip, setEquip] = useState<Equipment | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (open) setPicked(initialPicked ?? []);
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sections = useMemo<Section[]>(() => {
    const q = norm(query);
    const words = q ? q.split(" ") : [];
    const match = (e: LibraryExercise) => {
      if (equip && e.equipment !== equip) return false;
      if (tab !== "all" && !tabsFor(e.primary).includes(tab)) return false;
      if (!words.length) return true;
      const hay = norm(`${e.name} ${EQUIPMENT_LABEL[e.equipment]} ${e.primary.join(" ")}`);
      return words.every((w) => hay.includes(w));
    };
    const list = library.filter(match);
    if (tab !== "all") return list.length ? [{ key: tab, label: tabLabel(tab), items: list }] : [];
    const out: Section[] = [];
    const recentIds = (history?.recent ?? []).filter((id) => list.some((e) => e.id === id));
    if (recentIds.length) {
      out.push({ key: "recent", label: "Recent", items: recentIds.map((id) => list.find((e) => e.id === id)!) });
    }
    const mine = list.filter((e) => e.custom && !recentIds.includes(e.id));
    if (mine.length) out.push({ key: "mine", label: "Your exercises", items: mine });
    for (const t of PICKER_TABS) {
      if (t.id === "all") continue;
      const items = list.filter((e) => !e.custom && mainTab(e.primary) === t.id && !recentIds.includes(e.id));
      if (items.length) out.push({ key: t.id, label: t.label, items });
    }
    return out;
  }, [library, history?.recent, query, tab, equip]);

  if (!open) return null;

  const toggle = (id: string) => {
    if (single) {
      setPicked([id]);
      return;
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const finish = () => {
    const byId = new Map(library.map((e) => [e.id, e]));
    onDone(picked.map((id) => byId.get(id)).filter((e): e is LibraryExercise => !!e));
    setPicked([]);
    setQuery("");
  };
  const empty = !isLoading && sections.length === 0;
  const n = picked.length;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-white" style={{ fontFamily: FONT, color: W.ink }} role="dialog" aria-label="Add exercises">
      <header className="flex items-center justify-between px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full">
          <X size={22} />
        </button>
        <span className="text-[17px] font-extrabold">{single ? "Replace exercise" : "Add exercises"}</span>
        <button type="button" onClick={() => setCreating(true)} className="h-11 px-2.5 text-[15px] font-bold" style={{ color: W.violet }}>
          Create
        </button>
      </header>
      <div className="px-4 pb-2.5 pt-1.5">
        <label className="flex h-11 items-center gap-2 rounded-[22px] px-3.5" style={{ background: W.chip }}>
          <Search size={18} style={{ color: W.muted }} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${library.length || 700} exercises`}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#78716C]"
            enterKeyHint="search"
            aria-label="Search exercises"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="-mr-1 flex h-8 w-8 items-center justify-center">
              <X size={16} style={{ color: W.muted }} />
            </button>
          )}
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Muscle">
        {PICKER_TABS.map((t) => {
          const sel = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setTab(t.id)}
              className="h-[38px] shrink-0 whitespace-nowrap rounded-[19px] px-4 text-[14px] font-bold"
              style={{ background: sel ? W.ink : "#FFFFFF", color: sel ? "#FFFFFF" : W.ink, border: `1.5px solid ${sel ? W.ink : W.line}` }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Equipment">
        {EQUIPMENT_CHIPS.map((c) => {
          const sel = equip === c.id;
          return (
            <button
              key={c.label}
              type="button"
              aria-pressed={sel}
              onClick={() => setEquip(c.id)}
              className="h-8 shrink-0 whitespace-nowrap rounded-2xl px-3 text-[13px] font-semibold"
              style={{ background: sel ? "#EDE7FB" : W.chip, color: sel ? W.violetText : W.stoneDark }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ borderTop: `1px solid ${W.divider}` }}>
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[52px] animate-pulse rounded-[14px]" style={{ background: W.chip }} />
            ))}
          </div>
        )}
        {empty && (
          <div className="px-8 pt-14 text-center">
            <p className="text-[16px] font-bold">{query ? `No match for "${query}"` : "No exercises here"}</p>
            <p className="mt-1 text-[14px]" style={{ color: W.stone }}>
              Tap Create to add your own exercise.
            </p>
          </div>
        )}
        {sections.map((s) => (
          <section key={s.key}>
            <h3 className="px-4 pb-1 pt-3.5 text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>
              {s.label.toUpperCase()} · {s.items.length}
            </h3>
            <ul>
              {s.items.map((e) => {
                const order = picked.indexOf(e.id);
                const sel = order >= 0;
                const hist = history?.byExercise[e.id];
                return (
                  <li key={e.id} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 68px" }}>
                    <button
                      type="button"
                      onClick={() => toggle(e.id)}
                      aria-pressed={sel}
                      className="flex min-h-[68px] w-full items-center gap-3 px-4 py-2.5 text-left"
                      style={{ background: sel ? W.tintRow : undefined }}
                    >
                      <ExerciseThumb name={e.name} primary={e.primary} image={e.imageStart} size={48} radius={14} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[16px] font-bold leading-snug">{e.name}</span>
                        <span className="truncate text-[13px]" style={{ color: W.stone }}>
                          {EQUIPMENT_LABEL[e.equipment]} · {lastSetLabel(hist?.last ?? null, unit, e.logType)}
                        </span>
                      </span>
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                        style={sel ? { background: W.purple } : { boxShadow: `inset 0 0 0 2px ${W.ring}` }}
                        aria-hidden
                      >
                        {sel ? (single ? <Check size={16} strokeWidth={3} /> : order + 1) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="bg-white px-4 pb-[max(30px,env(safe-area-inset-bottom))] pt-3" style={{ borderTop: `1px solid ${W.line}` }}>
        {n > 0 && !single && (
          <p className="pb-2 text-center text-[13px]" style={{ color: W.stone }}>
            {hint}
          </p>
        )}
        <button
          type="button"
          disabled={n === 0}
          onClick={finish}
          className="h-[54px] w-full rounded-[27px] text-[16px] font-bold text-white"
          style={{ background: n ? W.purple : W.lilac }}
        >
          {single ? (n ? "Replace exercise" : "Pick an exercise") : n ? `Add ${n} exercise${n === 1 ? "" : "s"}` : "Pick exercises to add"}
        </button>
      </div>
      {creating && (
        <CreateExercise
          initialName={query}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setQuery("");
            setTab("all");
            setEquip(null);
            setPicked((p) => (single ? [id] : [...p, id]));
          }}
        />
      )}
    </div>
  );
}

const MUSCLES: { id: string; label: string }[] = [
  { id: "shoulders", label: "Shoulders" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "abs", label: "Core" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "glutes", label: "Glutes" },
  { id: "calves", label: "Calves" },
];
const EQUIPMENT: Equipment[] = ["dumbbell", "barbell", "cable", "machine", "bodyweight", "band", "kettlebell", "other"];

function ChipPick<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T | null; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const sel = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(o.id)}
            className="h-9 rounded-[18px] px-3.5 text-[14px] font-semibold"
            style={{ background: sel ? W.ink : "#FFFFFF", color: sel ? "#FFFFFF" : W.ink, border: `1.5px solid ${sel ? W.ink : W.line}` }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Create": a member's own exercise, visible only to them. */
function CreateExercise({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createCustomExercise);
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = name.trim().length > 0 && !!muscle && !!equipment;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const { id } = await createFn({ data: { name: name.trim(), muscle: muscle!, equipment: equipment! } });
      await qc.fetchQuery({ queryKey: EXERCISE_LIBRARY_KEY, queryFn: fetchExerciseLibrary, staleTime: 0 });
      onCreated(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save that exercise. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-white" role="dialog" aria-label="Create exercise">
      <header className="flex items-center justify-between px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" aria-label="Back to exercises" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full">
          <X size={22} />
        </button>
        <span className="text-[17px] font-extrabold">Create exercise</span>
        <span className="w-11" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-3">
        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>NAME</span>
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Landmine press"
            className="h-12 rounded-[14px] px-3.5 text-[16px] outline-none"
            style={{ background: W.chip }}
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>MAIN MUSCLE</span>
          <ChipPick label="Main muscle" options={MUSCLES} value={muscle} onChange={setMuscle} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>EQUIPMENT</span>
          <ChipPick label="Equipment" options={EQUIPMENT.map((e) => ({ id: e, label: EQUIPMENT_LABEL[e] }))} value={equipment} onChange={setEquipment} />
        </div>
        <p className="text-[13px]" style={{ color: W.stone }}>Only you can see exercises you create.</p>
        {err && <p className="text-[14px] font-semibold text-red-600">{err}</p>}
      </div>
      <div className="bg-white px-4 pb-[max(30px,env(safe-area-inset-bottom))] pt-3" style={{ borderTop: `1px solid ${W.line}` }}>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={save}
          className="h-[54px] w-full rounded-[27px] text-[16px] font-bold text-white"
          style={{ background: ready ? W.purple : W.lilac }}
        >
          {saving ? "Saving…" : "Save exercise"}
        </button>
      </div>
    </div>
  );
}
