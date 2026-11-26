import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Pause, Play, X } from "lucide-react";
import { useDemoCycle } from "@/lib/use-demo-cycle";
import { NewAvatarFallback } from "./NewAvatarFallback";
import { exerciseKicker } from "@/components/workout/WorkoutBits";
import { usePlans } from "@/components/plans/PlanBits";
import { useExerciseDetail, useExerciseLibrary, type LibraryExercise } from "@/lib/exercise-library";
import { SHOW_COMMON_MISTAKES, changeLabel, exercisePageChips, historyRows, nextTarget, progressStats, swapOptions, tipCard, type ExerciseTab } from "@/lib/exercise-page";
import { buildHowTo, planMoveFor } from "@/lib/how-to-view";
import { getExerciseProgress } from "@/lib/lifts.functions";
import { EQUIPMENT_LABEL, fmtDurationShort, fmtNum, type WeightUnit } from "@/lib/lift-rules";
import { getWorkoutPage } from "@/lib/new-workout.functions";
import { useOpenAtTop } from "@/lib/use-open-at-top";

const PURPLE = "#7C3AED";
const PURPLE_INK = "#6D28D9";
const LAVENDER = "#EDE9FE";
const TIP_BG = "#F3EEFF";
const INK = "#1C1917";
const MUTED = "#78716C";
const HAIR = "#F0EDE9";
const WARM = "#F5F2EC";
const GREEN = "#15803D";
const FONT = "Inter, system-ui, sans-serif";

/** New-version exercise page: start/finish drawings, How to and Your progress tabs. */
export function NewExercisePage({ exerciseId, tab, workout }: { exerciseId: string; tab: ExerciseTab; workout: string | undefined }) {
  const navigate = useNavigate();
  const router = useRouter();
  const scrollRef = useOpenAtTop();
  const { data: library, isLoading } = useExerciseLibrary();
  const ex = (library ?? []).find((e) => e.id === exerciseId) ?? null;

  const back = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/groups", search: { tab: "workouts" } });
  };
  const setTab = (t: ExerciseTab) => navigate({ to: "/exercises/$exerciseId", params: { exerciseId }, search: { tab: t, ...(workout ? { workout } : {}) }, replace: true });

  if (!ex) {
    return (
      <div className="fixed inset-0 flex items-center justify-center text-[16px] font-bold" style={{ background: WARM, color: INK, fontFamily: FONT }}>
        {isLoading ? null : "This exercise isn't available"}
        <BackButton onClick={back} />
      </div>
    );
  }
  const chips = exercisePageChips(ex);

  return (
    <div ref={scrollRef} data-scroll-root className="fixed inset-0 overflow-y-auto overscroll-none" style={{ background: WARM, color: INK, fontFamily: FONT }}>
      <Demo ex={ex} onBack={back} />

      <div className="bg-white px-4 pb-0 pt-4">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.6px]" style={{ color: PURPLE }}>{exerciseKicker(ex)}</div>
        <h1 className="mt-1 text-[26px] font-extrabold leading-[1.15] tracking-[-0.5px]">{ex.name}</h1>
        {chips.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="rounded-full px-2.5 py-[5px] text-[12px] font-bold" style={{ background: LAVENDER, color: PURPLE_INK }}>{c}</span>
            ))}
          </div>
        )}
      </div>
      <div role="tablist" className="grid w-full grid-cols-2 bg-white pt-4" style={{ borderBottom: `1px solid ${HAIR}` }}>
          {(["howto", "progress"] as const).map((t) => {
            const on = tab === t;
            return (
              <button key={t} type="button" role="tab" aria-selected={on} onClick={() => setTab(t)} className="relative h-12 text-[15px] font-bold" style={{ color: on ? PURPLE : MUTED }}>
                {t === "howto" ? "How to" : "Your progress"}
                {on && <span className="absolute inset-x-0 -bottom-px h-[2px]" style={{ background: PURPLE }} />}
              </button>
            );
          })}
      </div>

      <div className="px-4 pt-4" style={{ paddingBottom: "calc(40px + env(safe-area-inset-bottom) + var(--workout-bar-pad, 0px))" }}>
        {tab === "howto" ? <HowToTab ex={ex} library={library ?? []} workout={workout} /> : <ProgressTab ex={ex} />}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={onClick}
      className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white"
      style={{ top: "calc(max(env(safe-area-inset-top), 44px) + 4px)", color: INK, boxShadow: "0 1px 3px rgba(20,18,24,.12)" }}
    >
      <ChevronLeft size={24} />
    </button>
  );
}

function Demo({ ex, onBack }: { ex: LibraryExercise; onBack: () => void }) {
  const d = useDemoCycle(ex.imageStart, ex.imagePeak, ex.imageBg ?? "#D8F1FD");
  return (
    <div className="relative h-[300px] overflow-hidden" style={{ background: ex.imageStart ? d.bg : "#D8F1FD" }}>
      {ex.imageStart && <img ref={d.startRef} src={ex.imageStart} alt={`${ex.name}, start position`} onLoad={d.sample} className="absolute inset-0 h-full w-full object-cover object-center" />}
      {d.hasTwo && (
        <img src={ex.imagePeak!} alt={`${ex.name}, finish position`} className="absolute inset-0 h-full w-full object-cover object-center" style={{ opacity: d.showTop ? 1 : 0, transition: d.fade }} />
      )}
      <BackButton onClick={onBack} />
      {d.hasTwo && (
        <div className="absolute bottom-[14px] left-4 right-4 flex items-center justify-between">
          <div className="flex gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,.85)" }} aria-hidden>
            {(["Start", "Finish"] as const).map((l) => {
              const on = (l === "Finish") === d.showTop;
              return (
                <span key={l} className="flex h-8 items-center rounded-[16px] px-[14px] text-[13px] font-bold" style={{ background: on ? INK : "transparent", color: on ? "#FFFFFF" : "#57534E", transition: d.reduced ? "none" : "background 200ms, color 200ms" }}>
                  {l}
                </span>
              );
            })}
          </div>
          <button type="button" onClick={() => d.setPaused((p) => !p)} aria-label={d.playing ? "Pause demo" : "Play demo"} className="flex h-11 w-11 items-center justify-center rounded-full bg-white" style={{ color: INK, boxShadow: "0 1px 3px rgba(20,18,24,.12)" }}>
            {d.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <h2 className="mb-2 mt-5 text-[12px] font-extrabold uppercase tracking-[0.6px] first:mt-0" style={{ color: MUTED }}>{children}</h2>;
}

function HowToTab({ ex, library, workout }: { ex: LibraryExercise; library: LibraryExercise[]; workout: string | undefined }) {
  const { data: plans } = usePlans();
  const { data: detail } = useExerciseDetail(ex.id);
  const pageFn = useServerFn(getWorkoutPage);
  const { data: page } = useQuery({ queryKey: ["new-workout-page", workout ?? ""], queryFn: () => pageFn({ data: { id: workout! } }), enabled: !!workout, staleTime: 30_000 });
  const view = buildHowTo({ ex, planMove: planMoveFor(plans ?? [], ex.id), detail: detail ?? null, library, equipmentLabel: (e) => EQUIPMENT_LABEL[e] });
  const item = page?.exercises.find((e) => e.exerciseId === ex.id) ?? null;
  const card = page && item ? tipCard({ authorKind: page.author.kind, authorName: page.author.name, workoutName: page.name, tip: item.tip, sets: item.sets, reps: item.reps, seconds: item.seconds }) : null;
  const mistakes = view.mistakes?.map((m) => `${m.mistake} ${m.fix}`.trim()) ?? view.tips ?? [];
  const swaps = swapOptions(ex, library);

  return (
    <div>
      {card && page && (
        <div className="mb-5 flex gap-3 rounded-[16px] p-[14px]" style={{ background: TIP_BG }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: page.author.avatarUrl ? page.author.avatarColor : "var(--new-profile-avatar-bg)" }} aria-hidden>
            {page.author.avatarUrl ? <img src={page.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : <NewAvatarFallback />}
          </span>
          <p className="m-0 text-[14px] leading-[1.45]" style={{ color: INK }}>
            <strong className="font-extrabold">{card.lead}</strong> {card.body}
          </p>
        </div>
      )}

      {view.steps.length > 0 && (
        <>
          <Label>Steps</Label>
          <ol className="m-0 flex list-none flex-col gap-3 rounded-[16px] bg-white p-[14px]">
            {view.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-[1.45]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: LAVENDER, color: PURPLE_INK }}>{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {SHOW_COMMON_MISTAKES && mistakes.length > 0 && (
        <>
          <Label>Common mistakes</Label>
          <ul className="m-0 list-none rounded-[16px] bg-white px-[14px] py-1">
            {mistakes.map((m, i) => (
              <li key={i} className="flex gap-3 py-3 text-[15px] leading-[1.45]" style={{ borderTop: i ? `1px solid ${HAIR}` : undefined }}>
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: "#FEE2E2", color: "#DC2626" }} aria-hidden><X size={12} strokeWidth={3} /></span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {swaps.length > 0 && (
        <section className="mt-6">
          <h2 className="m-0 text-[18px] font-extrabold">Swap it for</h2>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {swaps.map((o) => (
              <Link key={o.id} to="/exercises/$exerciseId" params={{ exerciseId: o.id }} search={{ tab: "howto" }} className="w-[140px] shrink-0">
                <span className="flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-[16px]" style={{ background: o.imageBg ?? "#D8F1FD" }}>
                  {o.imageStart && <img src={o.imageStart} alt="" loading="lazy" className="h-full w-full object-contain" />}
                </span>
                <span className="mt-1.5 line-clamp-2 block text-[14px] font-bold leading-[1.3]" style={{ color: INK }}>{o.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProgressTab({ ex }: { ex: LibraryExercise }) {
  const fetchFn = useServerFn(getExerciseProgress);
  const { data, isLoading } = useQuery({ queryKey: ["exercise-progress", ex.id], queryFn: () => fetchFn({ data: { exerciseId: ex.id } }), staleTime: 30_000 });
  if (isLoading) return <div className="h-40 animate-pulse rounded-[16px] bg-white" />;
  const unit: WeightUnit = data?.unit ?? "lb";
  const sessions = data?.sessions ?? [];
  if (!sessions.length) {
    return <div className="rounded-[16px] bg-white px-5 py-8 text-center text-[15px] leading-[1.45]" style={{ color: MUTED }}>No sets logged yet. Your sets show here after you do this exercise.</div>;
  }
  const timed = ex.logType === "timed";
  const loadable = ex.equipment !== "bodyweight" && ex.equipment !== "band";
  const stats = progressStats(sessions, unit);
  const target = nextTarget(sessions[0] ?? null, unit, { logType: ex.logType, loadable });
  const rows = historyRows(sessions, unit, timed);
  const showChart = !timed && stats.points.some((p) => p.w > 0);
  const longest = Math.max(0, ...sessions.flatMap((s) => s.sets.map((x) => x.seconds ?? 0)));

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Tile value={timed ? fmtDurationShort(longest) : stats.best ? `${fmtNum(stats.best)} ${unit}` : "—"} label={timed ? "longest" : "best weight"} />
        <Tile value={stats.change == null ? "—" : changeLabel(stats.change, unit)} label={stats.change == null ? "first session" : `in ${stats.weeks} ${stats.weeks === 1 ? "week" : "weeks"}`} green={(stats.change ?? 0) > 0} />
        <Tile value={String(stats.sessions)} label={stats.sessions === 1 ? "session" : "sessions"} />
      </div>

      {(showChart || target) && (
        <section className="mt-[10px] rounded-[16px] bg-white p-[14px]">
          {showChart && (
            <>
              <h2 className="m-0 text-[16px] font-extrabold">Heaviest set each session</h2>
              <Chart points={stats.points} next={target?.weight ?? null} unit={unit} />
            </>
          )}
          {target && <div className={`${showChart ? "mt-2" : ""} rounded-[12px] px-3 py-2.5 text-[14px] font-semibold`} style={{ background: TIP_BG, color: PURPLE_INK }}>{target.text}</div>}
        </section>
      )}

      <Label>History</Label>
      <div className="overflow-hidden rounded-[16px] bg-white">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-3 px-[14px] py-3" style={{ borderTop: i ? `1px solid ${HAIR}` : undefined }}>
            <div className="min-w-[52px] shrink-0 whitespace-nowrap">
              <div className="text-[15px] font-extrabold">{r.date}</div>
              <div className="text-[12px]" style={{ color: MUTED }}>{r.weekday}</div>
            </div>
            <div className="min-w-0 flex-1 text-[14px]" style={{ color: "#44403C", fontVariantNumeric: "tabular-nums" }}>
              {r.sets.split(" · ").map((t, j) => (
                <span key={j} className="whitespace-nowrap">{j ? " · " : ""}{t}</span>
              ))}
            </div>
            {r.pr && <span className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-extrabold" style={{ background: "#FEF3C7", color: "#92400E" }}>🏆 PR</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ value, label, green }: { value: string; label: string; green?: boolean }) {
  return (
    <div className="flex flex-col rounded-[16px] bg-white px-3 py-3">
      <span className="text-[19px] font-extrabold leading-tight" style={{ color: green ? GREEN : INK, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span className="mt-0.5 text-[12px]" style={{ color: MUTED }}>{label}</span>
    </div>
  );
}

/** Purple line on 3 light gridlines, hollow points, last point filled, dashed segment to a hollow dashed next-target point. */
function Chart({ points, next, unit }: { points: { date: string; w: number }[]; next: number | null; unit: WeightUnit }) {
  const width = 330;
  const height = 170;
  const pad = { l: 22, r: 22, t: 28, b: 30 };
  const all = [...points.map((p) => p.w), ...(next != null ? [next] : [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  const n = points.length + (next != null ? 1 : 0);
  const x = (i: number) => pad.l + (n <= 1 ? (width - pad.l - pad.r) / 2 : (i * (width - pad.l - pad.r)) / (n - 1));
  const y = (w: number) => pad.t + (1 - (w - min) / span) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(" ");
  const lastI = points.length - 1;
  const lo = Math.min(...points.map((p) => p.w));
  const loI = points.findIndex((p) => p.w === lo);
  const grid = [0, 0.5, 1].map((f) => pad.t + f * (height - pad.t - pad.b));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" role="img" aria-label={`Heaviest set each session, from ${fmtNum(points[0]?.w ?? 0)} to ${fmtNum(points[lastI]?.w ?? 0)} ${unit}`}>
      {grid.map((gy) => <line key={gy} x1={0} x2={width} y1={gy} y2={gy} stroke={HAIR} strokeWidth={1} />)}
      {next != null && lastI >= 0 && <line x1={x(lastI)} y1={y(points[lastI]!.w)} x2={x(lastI + 1)} y2={y(next)} stroke={PURPLE} strokeWidth={2} strokeDasharray="4 4" />}
      <path d={path} fill="none" stroke={PURPLE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.w)} r={4.5} fill={i === lastI ? PURPLE : "#FFFFFF"} stroke={PURPLE} strokeWidth={2} />
      ))}
      {loI >= 0 && <text x={x(loI)} y={y(lo) + 20} fontSize={12} fill={MUTED} textAnchor="middle">{`${fmtNum(lo)} ${unit}`}</text>}
      {next != null && lastI >= 0 && (
        <>
          <circle cx={x(lastI + 1)} cy={y(next)} r={4.5} fill="#FFFFFF" stroke={PURPLE} strokeWidth={2} strokeDasharray="2 2" />
          <text x={x(lastI + 1)} y={y(next) - 12} fontSize={12} fill={MUTED} textAnchor="middle">{`${fmtNum(next)} ${unit}`}</text>
        </>
      )}
    </svg>
  );
}
