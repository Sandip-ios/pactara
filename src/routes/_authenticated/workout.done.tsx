import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useToastAbove } from "@/lib/toast-offset";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, Trophy, Video } from "lucide-react";
import { FONT, Switch, W } from "@/components/workout/WorkoutBits";
import { FeedAvatar } from "@/components/feed/FeedMedia";
import { checkInMetaLine } from "@/lib/feed-view";
import { getPostPreviewDay, saveWorkoutTemplate } from "@/lib/lifts.functions";
import { getMyGroupStatus } from "@/lib/groups.functions";
import { MY_WORKOUTS_KEY, useExerciseMap, useMyWorkouts } from "@/lib/exercise-library";
import { useAppVersion } from "@/hooks/use-app-version";
import { doneSaveRow } from "@/lib/workout-update";
import { clearFinishedWorkout, getFinishedWorkout, setWorkoutCheckIn, type FinishedWorkout } from "@/lib/active-workout";
import { setPlanCheckIn } from "@/lib/plan-checkin";
import { doneKicker, fmtNum, prFeedLabel, repsLabel, suggestWorkoutName, summaryLine } from "@/lib/lift-rules";

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
  const scrollRef = useOpenAtTop();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveWorkoutTemplate);
  const previewFn = useServerFn(getPostPreviewDay);
  // Already in My workouts: offer to update it. Plan days and unsaved sessions: offer to save.
  const isNew = !fw.workoutId;
  const version = useAppVersion();
  const actionRef = useRef<HTMLButtonElement>(null);
  useToastAbove(actionRef, version === "new");
  const { data: myWorkouts } = useMyWorkouts();
  const { map: exMap } = useExerciseMap();
  const saved = fw.workoutId ? myWorkouts?.find((x) => x.id === fw.workoutId)?.exercises ?? null : null;
  const row = doneSaveRow(version, fw, saved, (id) => exMap.get(id)?.name ?? "an exercise");
  // Until the member flips it, the switch follows the row's default (version prefs may load late).
  const [picked, setSave] = useState<boolean | null>(null);
  const save = picked ?? row.defaultOn;
  const [name, setName] = useState(() => (fw.plan || !isNew ? fw.title : suggestWorkoutName(fw.template)));
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
  const topPr = prs[0] ?? null;
  const title = save && row.show && name.trim() ? name.trim() : fw.title;

  const persistTemplate = async () => {
    if (!save || !row.show) return;
    await saveFn({
      data: {
        workoutId: fw.workoutId,
        name: name.trim() || fw.title,
        sessionId: fw.sessionId,
        exercises: row.template.map(({ exerciseId, sets, restSeconds }) => ({ exerciseId, sets, restSeconds })),
      },
    });
    void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
    void qc.invalidateQueries({ queryKey: ["workouts-overview"] });
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
    // A plan workout finishes the plan day, and arms its check-in.
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
    <div ref={scrollRef} className="fixed inset-0 overflow-y-auto pb-[calc(150px+env(safe-area-inset-bottom))]" style={{ background: W.bg, color: W.ink, fontFamily: FONT }} data-scroll-root>
      <div className="px-5 pb-[22px] pt-[calc(env(safe-area-inset-top)+12px)] text-white" style={{ background: W.violetDeep }}>
        <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: "#DDD6FE" }}>
          {doneKicker(fw.title, fw.localDate)}
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
                    {p.weight ? `${fmtNum(p.weight)} ${p.unit} × ${p.reps}` : repsLabel(p.reps)}{" "}
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

        {row.show && (
          <section className="flex flex-col gap-3 rounded-[20px] bg-white px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-extrabold">{row.title}</div>
                <div className="line-clamp-2 text-[13px]" style={{ color: W.stone }}>
                  {row.subtitle}
                </div>
              </div>
              <Switch on={save} onChange={setSave} label={row.title} />
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
          <div className="overflow-hidden rounded-[20px] bg-white shadow-sm">
            <div className="flex items-center gap-3 px-4 pt-3.5">
              <FeedAvatar url={status?.avatarUrl ?? null} color={W.purple} name={status?.firstName ?? "You"} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-neutral-900">You</div>
                <div className="truncate text-[13px]" style={{ color: W.stone }}>
                  {checkInMetaLine("workout", preview?.dayNumber ?? 0, "now")}
                </div>
              </div>
            </div>
            <div
              className="mx-[14px] mt-[14px] flex h-[120px] flex-col items-center justify-center gap-1.5 rounded-[14px]"
              style={{ border: `2px dashed ${W.ring}`, background: W.bg }}
            >
              <Video size={22} aria-hidden style={{ color: W.muted }} />
              <span className="text-[13px] font-semibold" style={{ color: W.muted }}>
                Your video goes here
              </span>
            </div>
            <div className="flex min-h-7 max-w-full flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-[14px] pt-[14px]">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: W.stoneDark }}>
                <Dumbbell size={14} className="shrink-0" aria-hidden />
                {summaryLine(s)}
              </span>
              {topPr && (
                <span className="inline-flex h-7 min-w-0 max-w-full items-center gap-1 rounded-full px-2.5 text-[12px] font-extrabold" style={{ background: W.gold, color: W.goldText }}>
                  <Trophy size={12} className="shrink-0" aria-hidden />
                  <span className="truncate">New PR: {prFeedLabel(topPr)}</span>
                </span>
              )}
            </div>
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
          ref={actionRef}
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
