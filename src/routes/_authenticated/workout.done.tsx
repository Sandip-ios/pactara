import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Video } from "lucide-react";
import { FONT, Switch, W } from "@/components/workout/WorkoutBits";
import { getPostPreviewDay, saveWorkoutTemplate } from "@/lib/lifts.functions";
import { getMyGroupStatus } from "@/lib/groups.functions";
import { MY_WORKOUTS_KEY } from "@/lib/exercise-library";
import { clearFinishedWorkout, getFinishedWorkout, setWorkoutCheckIn, type FinishedWorkout } from "@/lib/active-workout";
import { setPlanCheckIn } from "@/lib/plan-checkin";
import { fmtNum, plural, suggestWorkoutName, summaryLine } from "@/lib/lift-rules";

export const Route = createFileRoute("/_authenticated/workout/done")({
  head: () => ({
    meta: [
      { title: "Workout done · Pactara" },
      { name: "description", content: "Your workout stats, personal bests and a quick check-in for your crew." },
      { property: "og:title", content: "Workout done · Pactara" },
      { property: "og:description", content: "Your workout stats, personal bests and a quick check-in for your crew." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkoutDone,
});

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function WorkoutDone() {
  const navigate = useNavigate();
  const [fw] = useState<FinishedWorkout | null>(() => getFinishedWorkout());
  useEffect(() => {
    if (!fw) navigate({ to: "/home", replace: true });
  }, [fw, navigate]);
  if (!fw) return <div className="fixed inset-0" style={{ background: W.bg }} />;
  return <Done fw={fw} />;
}

function Done({ fw }: { fw: FinishedWorkout }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveWorkoutTemplate);
  const previewFn = useServerFn(getPostPreviewDay);
  const isNew = !fw.workoutId && !fw.plan;
  const [save, setSave] = useState(!fw.plan);
  const [name, setName] = useState(() => (isNew ? suggestWorkoutName(fw.template) : fw.title));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data: status } = useQuery({ queryKey: ["my-group-status"], queryFn: () => getMyGroupStatus(), staleTime: 60_000 });
  const { data: preview } = useQuery({
    queryKey: ["post-preview-day", fw.groupId],
    queryFn: () => previewFn({ data: { groupId: fw.groupId } }),
    staleTime: 60_000,
  });
  const s = fw.summary;
  const prs = s.prs;
  const title = save && name.trim() ? name.trim() : fw.title;

  const persistTemplate = async () => {
    if (!save || fw.plan) return;
    await saveFn({
      data: {
        workoutId: fw.workoutId,
        name: name.trim() || fw.title,
        sessionId: fw.sessionId,
        exercises: fw.template.map(({ exerciseId, sets, restSeconds }) => ({ exerciseId, sets, restSeconds })),
      },
    });
    void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
  };

  const leave = async (checkIn: boolean) => {
    if (busy) return;
    if (save && isNew && !name.trim()) {
      setErr("Give your workout a name, or turn off saving.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await persistTemplate();
    } catch (e) {
      console.error("[workout] save template failed", e);
      setErr("Couldn't save the workout. Check your connection and try again.");
      setBusy(false);
      return;
    }
    clearFinishedWorkout();
    if (!checkIn) {
      navigate({ to: "/home", replace: true });
      return;
    }
    if (fw.sessionId) setWorkoutCheckIn({ sessionId: fw.sessionId, title, line: summaryLine(s) });
    // A plan workout finishes the plan day, exactly like "Done, check in".
    if (fw.plan) setPlanCheckIn(fw.plan, true);
    if (fw.groupId) {
      try {
        localStorage.setItem("active-group-id", fw.groupId);
      } catch {
        /* noop */
      }
    }
    navigate({ to: "/check-in", replace: true });
  };

  const tiles = [
    { value: String(s.minutes), label: "minutes" },
    { value: String(s.exercises), label: s.exercises === 1 ? "exercise" : "exercises" },
    { value: String(s.sets), label: s.sets === 1 ? "set" : "sets" },
    { value: s.volume >= 10000 ? `${fmtNum(Math.round(s.volume / 100) / 10)}k` : s.volume.toLocaleString("en-US"), label: `${s.unit} lifted` },
  ];

  return (
    <div className="fixed inset-0 overflow-y-auto pb-[calc(150px+env(safe-area-inset-bottom))]" style={{ background: W.bg, color: W.ink, fontFamily: FONT }} data-scroll-root>
      <div className="px-5 pb-[22px] pt-[calc(env(safe-area-inset-top)+12px)] text-white" style={{ background: W.violetDeep }}>
        <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: "#DDD6FE" }}>
          {fw.title.toUpperCase()} · {WEEKDAYS[new Date(fw.finishedAt).getDay()]}
        </span>
        <h1 className="mt-1 text-[30px] font-extrabold tracking-[-0.7px]">Workout done</h1>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col items-center rounded-[14px] px-2 py-2.5 text-center" style={{ background: "rgba(255,255,255,.12)" }}>
              <span className="text-[19px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {t.value}
              </span>
              <span className="text-[11px]" style={{ color: "#EDE9FE" }}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 px-4 pt-4">
        {prs.length > 0 && (
          <section className="rounded-[20px] bg-white px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: W.gold, color: W.goldIcon }}>
                <Trophy size={15} />
              </span>
              <h2 className="text-[16px] font-extrabold">
                {prs.length === 1 ? "1 new personal best" : `${prs.length} new personal bests`}
              </h2>
            </div>
            <ul className="mt-2">
              {prs.map((p) => (
                <li key={p.exerciseId} className="flex items-baseline justify-between gap-3 py-1.5 text-[15px]">
                  <span className="min-w-0 truncate font-semibold">{p.name}</span>
                  <span className="shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.weight ? `${fmtNum(p.weight)} ${p.unit} × ${p.reps}` : `${p.reps} reps`}{" "}
                    <span className="font-bold" style={{ color: W.greenText }}>
                      {p.delta > 0 ? `+${fmtNum(p.delta)} ${p.unit}` : "+reps"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-[20px] bg-white px-4">
          {s.items.map((it, i) => (
            <div key={it.exerciseId + i} className="flex items-baseline justify-between gap-3 py-3 text-[15px]" style={{ borderTop: i ? `1px solid ${W.divider}` : undefined }}>
              <span className="min-w-0 truncate font-semibold">{it.name}</span>
              <span className="shrink-0" style={{ color: W.stone, fontVariantNumeric: "tabular-nums" }}>
                {it.line}
              </span>
            </div>
          ))}
        </section>

        {!fw.plan && (
          <section className="flex flex-col gap-3 rounded-[20px] bg-white px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-extrabold">{isNew ? "Save as a workout" : `Update "${fw.title}"`}</div>
                <div className="text-[13px]" style={{ color: W.stone }}>
                  Next time starts with today's weights.
                </div>
              </div>
              <Switch on={save} onChange={setSave} label={isNew ? "Save as a workout" : `Update ${fw.title}`} />
            </div>
            {isNew && save && (
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                aria-label="Workout name"
                placeholder="Name this workout"
                className="h-12 rounded-[14px] px-3.5 text-[16px] font-semibold outline-none"
                style={{ background: W.chip }}
              />
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>
            YOUR CREW WILL SEE
          </span>
          <div className="flex items-center gap-3 rounded-[20px] bg-white px-4 py-3">
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full" style={{ background: W.purple }}>
              {status?.avatarUrl ? (
                <img src={status.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[15px] font-bold text-white">{(status?.firstName ?? "Y").slice(0, 1)}</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold">You</div>
              <div className="truncate text-[13px]" style={{ color: W.muted }}>
                💪 Workout · {title} · Day {preview?.dayNumber ?? 1}
              </div>
            </div>
            {prs.length > 0 && (
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: W.gold, color: W.goldText }}>
                {plural(prs.length, "PR")}
              </span>
            )}
          </div>
        </section>
        {err && (
          <p className="text-[14px] font-semibold text-red-600" role="alert">
            {err}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3" style={{ background: `linear-gradient(180deg, rgba(245,242,238,0) 0%, ${W.bg} 24%)` }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void leave(true)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[28px] text-[16px] font-bold text-white disabled:opacity-70"
          style={{ background: W.purple }}
        >
          <Video size={20} /> Check in with a quick video
        </button>
        <p className="pt-2 text-center text-[12px]" style={{ color: W.muted }}>
          Your stats and PRs are added to the post for you.
        </p>
        <button type="button" disabled={busy} onClick={() => void leave(false)} className="mx-auto block h-10 px-4 text-[14px] font-semibold" style={{ color: W.stone }}>
          Not now
        </button>
      </div>
    </div>
  );
}
