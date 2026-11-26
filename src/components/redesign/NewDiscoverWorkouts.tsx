import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, ChevronDown } from "lucide-react";
import { NewSheet, NewSheetRadio, NewSheetRow } from "./NewSheet";
import { NewConfirm } from "./NewConfirm";
import { newToast as toast } from "./new-toast";
import { coverThumb } from "@/lib/plan-filters";
import {
  EQUIPMENT_OPTIONS,
  MUSCLE_CHIPS,
  SORT_OPTIONS,
  TIME_OPTIONS,
  cardByline,
  cardMeta,
  savesLabel,
  type DiscoverCard,
  type DiscoverQuery,
  type EquipmentKey,
  type MuscleKey,
  type SortKey,
  type TimeKey,
} from "@/lib/discover-workouts";
import { getDiscoverWorkouts, type DiscoverWorkoutsPage } from "@/lib/discover-workouts.functions";
import { saveSharedWorkout } from "@/lib/workout-share.functions";
import { deleteSavedWorkout } from "@/lib/lifts.functions";
import { MY_WORKOUTS_KEY } from "@/lib/exercise-library";

const INK = "#1C1917";
const MUTED = "#78716C";
const PURPLE = "#7C3AED";
const LAVENDER = "#EDE9FE";

export const discoverWorkoutsKey = (q: DiscoverQuery, withTop: boolean) => ["discover-workouts", q, withTop] as const;

export function useDiscoverWorkouts(q: DiscoverQuery, withTop: boolean) {
  const fetchFn = useServerFn(getDiscoverWorkouts);
  return useInfiniteQuery({
    queryKey: discoverWorkoutsKey(q, withTop),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchFn({ data: { muscle: q.muscle, ...(q.equipment ? { equipment: q.equipment } : {}), ...(q.time ? { time: q.time } : {}), sort: q.sort, q: q.q, offset: pageParam, withTop: withTop && pageParam === 0 } }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    staleTime: 30_000,
  });
}

/** Muscle chips: single select, same look as the plan goal chips. */
export function MuscleChips({ value, onChange }: { value: MuscleKey; onChange: (m: MuscleKey) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Muscles">
      {MUSCLE_CHIPS.map((c) => {
        const on = value === c.key;
        return (
          <button key={c.key} type="button" aria-pressed={on} onClick={() => onChange(c.key)} className="h-9 shrink-0 rounded-full px-4 text-[14px] font-bold" style={on ? { background: PURPLE, color: "#FFFFFF" } : { background: "#FFFFFF", color: INK, border: "1px solid #E7E3DE" }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

type Filters = { equipment: EquipmentKey | null; time: TimeKey | null; sort: SortKey };

/** Equipment ▾ / Time ▾ / Most saved ▾, each opening a sheet of radio options. */
export function FilterPills({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState<"equipment" | "time" | "sort" | null>(null);
  const eq = EQUIPMENT_OPTIONS.find((o) => o.key === value.equipment);
  const tm = TIME_OPTIONS.find((o) => o.key === value.time);
  const so = SORT_OPTIONS.find((o) => o.key === value.sort)!;
  const pills = [
    { key: "equipment" as const, label: eq?.label ?? "Equipment", on: !!eq },
    { key: "time" as const, label: tm?.label ?? "Time", on: !!tm },
    { key: "sort" as const, label: so.label, on: value.sort !== "saved" },
  ];
  const sheet =
    open === "equipment"
      ? { title: "Equipment", options: [{ key: null, label: "Any equipment" }, ...EQUIPMENT_OPTIONS], current: value.equipment, set: (k: string | null) => onChange({ ...value, equipment: k as EquipmentKey | null }) }
      : open === "time"
        ? { title: "Time", options: [{ key: null, label: "Any time" }, ...TIME_OPTIONS], current: value.time, set: (k: string | null) => onChange({ ...value, time: k as TimeKey | null }) }
        : open === "sort"
          ? { title: "Sort by", options: [...SORT_OPTIONS], current: value.sort, set: (k: string | null) => onChange({ ...value, sort: (k ?? "saved") as SortKey }) }
          : null;
  return (
    <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filters">
        {pills.map((p) => (
          <button key={p.key} type="button" onClick={() => setOpen(p.key)} aria-haspopup="dialog" className="flex h-9 shrink-0 items-center gap-1 rounded-full pl-3.5 pr-2.5 text-[14px] font-bold" style={p.on ? { background: PURPLE, color: "#FFFFFF", border: `1px solid ${PURPLE}` } : { background: "#FFFFFF", color: INK, border: "1px solid #E7E3DE" }}>
            {p.label}
            <ChevronDown size={16} strokeWidth={2.5} aria-hidden />
          </button>
        ))}
      </div>
      <NewSheet open={!!sheet} onOpenChange={(o) => { if (!o) setOpen(null); }} title={sheet?.title ?? ""}>
        <div role="radiogroup" aria-label={sheet?.title}>
          {sheet?.options.map((o) => {
            const on = sheet.current === o.key;
            return (
              <NewSheetRow key={o.label} simple role="radio" aria-checked={on} title={o.label} trailing={<NewSheetRadio checked={on} />} onClick={() => { sheet.set(o.key); setOpen(null); }} />
            );
          })}
        </div>
      </NewSheet>
    </>
  );
}

function Drawing({ card, className }: { card: DiscoverCard; className: string }) {
  const [failed, setFailed] = useState(false);
  const cover = coverThumb(card.coverUrl, 480);
  if (cover && !failed) return <img src={cover} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={`${className} object-cover`} />;
  if (card.drawing) return <span className={`${className} block`} style={{ background: card.drawing.bg }}><img src={card.drawing.src} alt="" loading="lazy" className="h-full w-full object-cover object-center" /></span>;
  return <span className={`${className} block`} style={{ background: card.exercises > 1 ? "#ECE8E1" : "#D8F1FD" }} />;
}

/** 2×2 photo cards: "Most saved this week". */
export function TopGrid({ cards, onOpen }: { cards: DiscoverCard[]; onOpen: (c: DiscoverCard) => void }) {
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {cards.map((c) => (
        <button key={c.code} type="button" onClick={() => onOpen(c)} className="relative h-[216px] overflow-hidden rounded-[18px] text-left active:scale-[0.99]" style={{ background: "#ECE8E1" }}>
          <Drawing card={c} className="absolute inset-0 h-full w-full" />
          <span className="absolute inset-x-0 bottom-0 h-[60%]" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.72) 100%)" }} aria-hidden />
          <span className="absolute inset-x-3 bottom-3 flex flex-col gap-1">
            <span className="line-clamp-2 text-[15px] font-extrabold leading-[1.2]" style={{ color: "#FFFFFF" }}>{c.name}</span>
            {c.saves > 0 && (
              <span className="flex items-center gap-1 text-[12px]" style={{ color: "#FFFFFF" }}>
                <Bookmark size={12} fill="currentColor" aria-hidden /> {savesLabel(c.saves)}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Saves and unsaves a copy in My workouts, keeping every cached Discover list in step. */
function useBookmark() {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveSharedWorkout);
  const deleteFn = useServerFn(deleteSavedWorkout);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<DiscoverCard | null>(null);
  const patch = (code: string, change: Partial<DiscoverCard>) =>
    qc.setQueriesData<InfiniteData<DiscoverWorkoutsPage>>({ queryKey: ["discover-workouts"] }, (old) =>
      old ? { ...old, pages: old.pages.map((p) => ({ ...p, top: p.top.map((c) => (c.code === code ? { ...c, ...change } : c)), items: p.items.map((c) => (c.code === code ? { ...c, ...change } : c)) })) } : old,
    );
  const save = async (c: DiscoverCard) => {
    setBusy(c.code);
    try {
      const res = await saveFn({ data: { code: c.code } });
      if (res.status === "saved") {
        patch(c.code, { myCopyId: res.workoutId, myCopyEdited: false, saves: c.saves + (res.already ? 0 : 1), savesWeek: c.savesWeek + (res.already ? 0 : 1) });
        void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
        toast(`${c.name} saved to your workouts`);
      } else toast("That workout isn't available anymore.");
    } catch (e) {
      console.error("[discover] save failed", e);
      toast("Couldn't save. Try again.");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (c: DiscoverCard) => {
    if (!c.myCopyId) return;
    setBusy(c.code);
    try {
      await deleteFn({ data: { workoutId: c.myCopyId } });
      patch(c.code, { myCopyId: null, myCopyEdited: false, saves: Math.max(0, c.saves - 1), savesWeek: Math.max(0, c.savesWeek - 1) });
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      toast(`${c.name} removed from your workouts`);
      setConfirm(null);
    } catch (e) {
      console.error("[discover] unsave failed", e);
      toast("Couldn't remove. Try again.");
    } finally {
      setBusy(null);
    }
  };
  const toggle = (c: DiscoverCard) => {
    if (busy) return;
    if (!c.myCopyId) void save(c);
    else if (c.myCopyEdited) setConfirm(c);
    else void remove(c);
  };
  const dialog = (
    <NewConfirm
      open={!!confirm}
      onOpenChange={(o) => { if (!o) setConfirm(null); }}
      title={`Remove ${confirm?.name ?? "this workout"} from your workouts?`}
      subtitle="Your changes to it are removed too."
      action="Remove"
      cancelLabel="Keep it"
      busy={!!busy}
      error={null}
      onConfirm={() => { if (confirm) void remove(confirm); }}
    />
  );
  return { toggle, busy, dialog };
}

export function WorkoutCards({ cards, onOpen }: { cards: DiscoverCard[]; onOpen: (c: DiscoverCard) => void }) {
  const { toggle, busy, dialog } = useBookmark();
  return (
    <div className="flex flex-col gap-2">
      {cards.map((c) => {
        const by = cardByline(c);
        const saved = !!c.myCopyId;
        return (
          <div key={c.code} className="flex items-center gap-3 rounded-[16px] bg-white p-[10px]" data-workout-card>
            <button type="button" onClick={() => onOpen(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-[12px]" style={{ background: "#ECE8E1" }}>
                <Drawing card={c} className="h-full w-full" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="line-clamp-2 text-[16px] font-extrabold leading-[1.2]" style={{ color: INK }}>{c.name}</span>
                <span className="text-[13px]" style={{ color: MUTED }}>{cardMeta(c)}</span>
                <span className="flex min-w-0 items-center gap-1 text-[13px]" style={{ color: MUTED }}>
                  {c.pactara && <img src="/pactara-icon.png" alt="" className="h-4 w-4 shrink-0 rounded-full" aria-hidden />}
                  <span className="truncate">by <strong className="font-bold" style={{ color: INK }}>{by.author}</strong>{by.saves}</span>
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggle(c)}
              disabled={busy === c.code}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${c.name} from your workouts` : `Save ${c.name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: saved ? LAVENDER : "#F0EDE8", color: saved ? PURPLE : INK }}
            >
              <Bookmark size={18} fill={saved ? "currentColor" : "none"} strokeWidth={2.25} />
            </button>
          </div>
        );
      })}
      {dialog}
    </div>
  );
}

/** Loads the next 20 when the end of the list scrolls into view. */
export function LoadMore({ hasMore, loading, onMore }: { hasMore: boolean; loading: boolean; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && !loading) onMore(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onMore]);
  return <div ref={ref} className="h-1" aria-hidden />;
}

export function CardSkeletons({ n = 3 }: { n?: number }) {
  return <>{Array.from({ length: n }, (_, i) => <div key={i} className="h-[84px] animate-pulse rounded-[16px] bg-white/70" />)}</>;
}

/** Discover › Workouts tab body (under the white Discover band). */
export function NewWorkoutsTab() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({ equipment: null, time: null, sort: "saved" });
  const q: DiscoverQuery = { muscle: "all", ...filters, q: "" };
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useDiscoverWorkouts(q, true);
  const top = data?.pages[0]?.top ?? [];
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const open = (c: DiscoverCard) => navigate({ to: "/workouts/$workoutId", params: { workoutId: c.code } });
  return (
    <>
      <p className="text-[13px] leading-[1.35]" style={{ color: "#57534E" }}>One workout you can do today. Save it, or tap Start.</p>
      <MuscleChips value="all" onChange={(m) => { if (m !== "all") navigate({ to: "/discover/workouts", search: { muscle: m, ...(filters.equipment ? { equipment: filters.equipment } : {}), ...(filters.time ? { time: filters.time } : {}), ...(filters.sort !== "saved" ? { sort: filters.sort } : {}) } }); }} />
      <FilterPills value={filters} onChange={setFilters} />
      <h2 className="m-0 mt-1 text-[18px] font-extrabold">Most saved this week</h2>
      {isLoading ? <div className="grid grid-cols-2 gap-[10px]">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[216px] animate-pulse rounded-[18px] bg-white/70" />)}</div> : <TopGrid cards={top} onOpen={open} />}
      <h2 className="m-0 mt-1 text-[18px] font-extrabold" id="all-workouts">All workouts</h2>
      {isLoading && <CardSkeletons />}
      {!isLoading && items.length === 0 && <p className="rounded-[16px] bg-white px-4 py-6 text-center text-[15px] font-semibold" style={{ color: "#57534E" }}>No workouts match. Try another filter.</p>}
      <WorkoutCards cards={items} onOpen={open} />
      {isFetchingNextPage && <CardSkeletons n={2} />}
      <LoadMore hasMore={!!hasNextPage} loading={isFetchingNextPage} onMore={() => void fetchNextPage()} />
    </>
  );
}
