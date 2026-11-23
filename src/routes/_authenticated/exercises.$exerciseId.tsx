import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Trophy } from "lucide-react";
import { FONT, W, exerciseKicker, tintFor } from "@/components/workout/WorkoutBits";
import { getExerciseProgress } from "@/lib/lifts.functions";
import { useExerciseMap } from "@/lib/exercise-library";
import { bestOf, convertWeight, historyDateLabel, fmtDurationShort, fmtNum, nextTimeTip, plural, repsLabel, type SetEntry, type WeightUnit } from "@/lib/lift-rules";

export const Route = createFileRoute("/_authenticated/exercises/$exerciseId")({
  head: () => ({
    meta: [
      { title: "Exercise progress · Pactara" },
      { name: "description", content: "Your best weight, every session and what to lift next time." },
      { property: "og:title", content: "Exercise progress · Pactara" },
      { property: "og:description", content: "Your best weight, every session and what to lift next time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExerciseProgressPage,
});


function ExerciseProgressPage() {
  const scrollRef = useOpenAtTop();
  const { exerciseId } = Route.useParams();
  const navigate = useNavigate();
  const fetchFn = useServerFn(getExerciseProgress);
  const { map, isLoading: libLoading } = useExerciseMap();
  const { data, isLoading } = useQuery({
    queryKey: ["exercise-progress", exerciseId],
    queryFn: () => fetchFn({ data: { exerciseId } }),
    staleTime: 30_000,
  });
  const ex = map.get(exerciseId) ?? null;
  const unit: WeightUnit = data?.unit ?? "lb";
  const sessions = data?.sessions ?? [];
  const timed = ex?.logType === "timed";
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/profile" });
  };

  // Heaviest set each session, oldest first, in the member's unit.
  const points = [...sessions].reverse().map((s) => {
    const b = bestOf(s.sets);
    return { date: s.date, w: b ? convertWeight(b.weight, b.unit, unit) : 0, reps: b?.reps ?? 0 };
  });
  const best = points.reduce((m, p) => Math.max(m, p.w), 0);
  const first = points[0];
  const change = first && points.length > 1 ? best - first.w : 0;
  const weeks = first ? Math.max(1, Math.round((Date.parse(points[points.length - 1]!.date) - Date.parse(first.date)) / (7 * 86400000))) : 0;
  const latest = sessions[0] ?? null;
  const tip = !timed && latest ? nextTimeTip({ date: latest.date, sets: latest.sets }, unit) : null;
  const t = ex ? tintFor(ex.primary) : tintFor([]);

  return (
    <div ref={scrollRef} className="fixed inset-0 overflow-y-auto pb-12" style={{ background: W.bg, color: W.ink, fontFamily: FONT }} data-scroll-root>
      <header className="flex items-center justify-between px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" aria-label="Back" onClick={back} className="flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft size={24} />
        </button>
        {ex && (
          <button type="button" onClick={() => navigate({ to: "/exercises/$exerciseId/how-to", params: { exerciseId } })} className="mr-2 h-9 rounded-full bg-white px-4 text-[14px] font-bold" style={{ color: W.violet, boxShadow: "0 1px 2px rgba(20,18,24,.06)" }}>
            How to
          </button>
        )}
      </header>
      <div className="flex flex-col gap-4 px-4 pt-1">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: t.ink }}>
            {ex ? exerciseKicker(ex) : libLoading ? "\u00a0" : "EXERCISE"}
          </span>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.5px]">{ex?.name ?? (libLoading ? "" : "Exercise")}</h1>
        </div>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-[20px] bg-white" />
        ) : sessions.length === 0 ? (
          <div className="rounded-[20px] bg-white px-4 py-6 text-center">
            <p className="text-[16px] font-bold">No sessions yet</p>
            <p className="mt-1 text-[14px]" style={{ color: W.stone }}>
              Log this exercise in a workout and your progress shows up here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat value={timed ? fmtDurationShort(Math.max(...sessions.flatMap((s) => s.sets.map((x) => x.seconds ?? 0)))) : best ? `${fmtNum(best)} ${unit}` : "—"} label={timed ? "longest" : "best weight"} />
              <Stat
                value={timed || points.length < 2 ? "—" : `${change >= 0 ? "+" : "−"}${fmtNum(Math.abs(change))} ${unit}`}
                label={points.length < 2 ? "first session" : `in ${plural(weeks, "week")}`}
                green={!timed && change > 0}
              />
              <Stat value={String(sessions.length)} label={sessions.length === 1 ? "session" : "sessions"} />
            </div>

            {!timed && points.some((p) => p.w > 0) && (
              <section className="rounded-[20px] bg-white px-4 py-3.5">
                <h2 className="text-[16px] font-extrabold">Heaviest set each session</h2>
                <Chart points={points} next={tip?.weight ?? null} unit={unit} />
                {tip && (
                  <div className="mt-2 rounded-[12px] px-3 py-2 text-[13px] font-semibold" style={{ background: W.tint, color: W.violetText }}>
                    {tip.text}
                  </div>
                )}
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h2 className="text-[17px] font-extrabold">History</h2>
              <div className="overflow-hidden rounded-[20px] bg-white">
                {sessions.map((s, i) => {
                  const d = historyDateLabel(s.date);
                  const pr = s.sets.some((x) => x.isPr);
                  return (
                    <div key={`${s.date}-${i}`} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${W.divider}` : undefined }}>
                      <div className="min-w-[52px] shrink-0 whitespace-nowrap">
                        <div className="text-[15px] font-bold">{d.date}</div>
                        <div className="text-[12px]" style={{ color: W.muted }}>
                          {d.weekday}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 text-[14px]" style={{ color: W.stoneDark, fontVariantNumeric: "tabular-nums" }}>
                        {s.sets.map((x) => setText(x, unit, timed)).join(" · ")}
                      </div>
                      {pr && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-extrabold" style={{ background: W.gold, color: W.goldText }}>
                          <Trophy size={12} aria-hidden /> PR
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function setText(s: SetEntry, unit: WeightUnit, timed: boolean) {
  if (timed) return fmtDurationShort(s.seconds ?? 0);
  if (!s.weight) return repsLabel(s.reps ?? 0);
  return `${fmtNum(convertWeight(s.weight, s.unit, unit))} × ${s.reps ?? 0}`;
}

function Stat({ value, label, green }: { value: string; label: string; green?: boolean }) {
  return (
    <div className="flex flex-col rounded-[16px] bg-white px-3 py-3">
      <span className="text-[19px] font-extrabold leading-tight" style={{ color: green ? W.greenText : W.ink, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      <span className="text-[12px]" style={{ color: W.stone }}>
        {label}
      </span>
    </div>
  );
}

/** Line chart: purple line, white dots, latest dot filled, dashed dot for next time's weight. */
function Chart({ points, next, unit }: { points: { date: string; w: number }[]; next: number | null; unit: WeightUnit }) {
  const width = 311;
  const height = 150;
  const pad = { l: 8, r: 16, t: 16, b: 22 };
  const all = [...points.map((p) => p.w), ...(next != null ? [next] : [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  const n = points.length + (next != null ? 1 : 0);
  const x = (i: number) => pad.l + (n <= 1 ? (width - pad.l - pad.r) / 2 : (i * (width - pad.l - pad.r)) / (n - 1));
  const y = (w: number) => pad.t + (1 - (w - min) / span) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(" ");
  const lastI = points.length - 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" role="img" aria-label={`Heaviest set each session, from ${fmtNum(points[0]?.w ?? 0)} to ${fmtNum(points[lastI]?.w ?? 0)} ${unit}`}>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={pad.l} x2={width - pad.r} y1={pad.t + f * (height - pad.t - pad.b)} y2={pad.t + f * (height - pad.t - pad.b)} stroke={W.divider} strokeWidth={1} />
      ))}
      {next != null && lastI >= 0 && (
        <line x1={x(lastI)} y1={y(points[lastI]!.w)} x2={x(lastI + 1)} y2={y(next)} stroke={W.lilac} strokeWidth={2} strokeDasharray="4 4" />
      )}
      <path d={path} fill="none" stroke={W.purple} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.w)} r={5} fill={i === lastI ? W.purple : "#FFFFFF"} stroke={W.purple} strokeWidth={2.5} />
      ))}
      {next != null && <circle cx={x(lastI + 1)} cy={y(next)} r={5} fill="#FFFFFF" stroke={W.lilac} strokeWidth={2.5} strokeDasharray="3 2" />}
      <text x={pad.l} y={height - 4} fontSize={11} fill={W.muted}>
        {fmtNum(min)} {unit}
      </text>
      <text x={width - pad.r} y={12} fontSize={11} fill={W.muted} textAnchor="end">
        {fmtNum(max)} {unit}
      </text>
    </svg>
  );
}
