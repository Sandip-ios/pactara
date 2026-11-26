import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Pause, Play, X } from "lucide-react";
import { FONT } from "@/components/workout/WorkoutBits";
import { usePlans } from "@/components/plans/PlanBits";
import { buildLiveExercise, updateActiveWorkout, useActiveWorkout } from "@/lib/active-workout";
import { useExerciseDetail, useExerciseLibrary, useLiftHistory, type LibraryExercise } from "@/lib/exercise-library";
import { buildHowTo, fitCardTarget, planMoveFor, type FitOption } from "@/lib/how-to-view";
import { EQUIPMENT_LABEL, initials } from "@/lib/lift-rules";
import { useOpenAtTop } from "@/lib/use-open-at-top";

type HowToSearch = { swap?: string };

export const Route = createFileRoute("/_authenticated/exercises/$exerciseId_/how-to")({
  validateSearch: (s: Record<string, unknown>): HowToSearch => (typeof s["swap"] === "string" && s["swap"] ? { swap: s["swap"] } : {}),
  head: () => ({
    meta: [
      { title: "How to do it · Pactara" },
      { name: "description", content: "See the move from start to finish, then follow the short steps." },
      { property: "og:title", content: "How to do it · Pactara" },
      { property: "og:description", content: "See the move from start to finish, then follow the short steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowToRoute,
});

function HowToRoute() {
  const { exerciseId } = Route.useParams();
  const { swap } = Route.useSearch();
  const version = useAppVersion();
  const { isLoading } = useAppPrefs();
  if (isLoading) return null;
  // New version: How to lives on the exercise page (classic's swap-from-logger link keeps this page).
  if (version === "new" && !swap) return <Navigate to="/exercises/$exerciseId" params={{ exerciseId }} search={{ tab: "howto" }} replace />;
  return <HowToPage />;
}

const C = {
  ink: "#141218",
  stone: "#57534E",
  stoneDark: "#44403C",
  line: "#E7E3DE",
  violet: "#6D28D9",
  violetText: "#5B21B6",
  violetTint: "#F5F0FF",
  chip: "#F4F2EF",
  imageBg: "#D8F1FD",
} as const;

/** Full-screen How to: start/top pictures cross-fading, muscles, plain line, steps, mistakes or tips, easier/harder. */
function HowToPage() {
  const { exerciseId } = Route.useParams();
  const { swap } = Route.useSearch();
  const navigate = useNavigate();
  const scrollRef = useOpenAtTop();
  const { data: library, isLoading } = useExerciseLibrary();
  const { data: plans } = usePlans();
  const { data: detail } = useExerciseDetail(exerciseId);
  const { data: history } = useLiftHistory();
  const workout = useActiveWorkout();
  const ex = (library ?? []).find((e) => e.id === exerciseId) ?? null;

  const close = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/groups", search: { tab: "plans" } });
  };

  // In a live workout: offer to swap this move in for the one you came from.
  const swapTarget = swap && workout ? workout.exercises.find((e) => e.key === swap) ?? null : null;
  const canSwap = !!ex && !!swapTarget && swapTarget.exerciseId !== ex.id;
  const swapIn = () => {
    if (!ex || !swapTarget) return;
    updateActiveWorkout((w) => ({
      ...w,
      exercises: w.exercises.map((e) =>
        e.key === swapTarget.key
          ? buildLiveExercise(ex, history?.byExercise[ex.id], { unit: w.unit, count: Math.max(1, e.sets.length), restSeconds: e.restSeconds })
          : e,
      ),
    }));
    navigate({ to: "/workout/log", replace: true });
  };

  if (!ex) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white px-8 text-center" style={{ fontFamily: FONT, color: C.ink }}>
        {isLoading ? null : (
          <div>
            <div className="text-[17px] font-bold">This exercise isn't available</div>
            <button type="button" onClick={close} className="mt-3 h-11 rounded-full px-5 text-[15px] font-semibold" style={{ background: C.violetTint, color: C.violet }}>
              Go back
            </button>
          </div>
        )}
      </div>
    );
  }

  const planMove = planMoveFor(plans ?? [], ex.id);
  const view = buildHowTo({ ex, planMove, detail: detail ?? null, library: library ?? [], equipmentLabel: (e) => EQUIPMENT_LABEL[e] });

  return (
    <div ref={scrollRef} className="fixed inset-0 w-full overflow-y-auto overscroll-none bg-white" data-scroll-root style={{ fontFamily: FONT, color: C.ink }}>
      <DemoHeader ex={ex} onClose={close} />

      <div className="flex flex-col gap-5 px-5 pt-5" style={{ paddingBottom: canSwap ? 130 : 40 }}>
        <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-[-0.5px]">{view.title}</h1>

        {(view.primary.length > 0 || view.secondary.length > 0) && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {view.primary.map((m) => (
              <span key={`p-${m}`} className="rounded-full px-2.5 py-[5px] text-[12px] font-bold" style={{ background: C.violetTint, color: C.violetText }}>
                {m}
              </span>
            ))}
            {view.secondary.map((m) => (
              <span key={`s-${m}`} className="rounded-full px-2.5 py-[5px] text-[12px] font-semibold" style={{ background: C.chip, color: C.stoneDark }}>
                {m}
              </span>
            ))}
          </div>
        )}

        {view.plain && (
          <p className="m-0 text-[15px] leading-[1.5]" style={{ color: C.stoneDark }}>
            {view.plain}
          </p>
        )}

        {view.steps.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-[17px] font-extrabold">How to do it</h2>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {view.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-[1.45]">
                  <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white" style={{ background: C.violet }}>
                    {i + 1}
                  </span>
                  <span className="pt-px">{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {view.mistakes && (
          <section className="flex flex-col gap-2.5 rounded-[16px] p-[14px]" style={{ background: "#FDF2F2" }}>
            <h2 className="m-0 text-[17px] font-extrabold" style={{ color: "#991B1B" }}>
              Common mistakes
            </h2>
            {view.mistakes.map((m, i) => (
              <div key={i} className="flex gap-2.5 text-[14px] leading-[1.45]">
                <X size={18} className="mt-px shrink-0" style={{ color: "#B91C1C" }} aria-hidden />
                <span>
                  <strong>{m.mistake}</strong> {m.fix}
                </span>
              </div>
            ))}
          </section>
        )}

        {view.tips && (
          <section className="flex flex-col gap-2.5 rounded-[16px] p-[14px]" style={{ background: C.chip }}>
            <h2 className="m-0 text-[17px] font-extrabold" style={{ color: C.ink }}>
              Tips
            </h2>
            {view.tips.map((t, i) => (
              <div key={i} className="flex gap-2.5 text-[14px] leading-[1.45]">
                <Check size={18} className="mt-px shrink-0" style={{ color: "#15803D" }} aria-hidden />
                <span>{t}</span>
              </div>
            ))}
          </section>
        )}

        {(view.easier || view.harder) && (
          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-[17px] font-extrabold">Make it fit you</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {view.easier && <FitCard kind="easier" option={view.easier} swap={swap} library={library ?? []} currentId={exerciseId} />}
              {view.harder && <FitCard kind="harder" option={view.harder} swap={swap} library={library ?? []} currentId={exerciseId} />}
            </div>
          </section>
        )}
      </div>

      {canSwap && swapTarget && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 bg-white px-4 pt-3"
          style={{ borderTop: `1px solid ${C.line}`, paddingBottom: "max(30px, env(safe-area-inset-bottom))" }}
        >
          <button type="button" onClick={swapIn} className="h-[54px] w-full rounded-[27px] text-[16px] font-bold text-white" style={{ background: "#7C3AED" }}>
            Swap in
          </button>
          <div className="text-center text-[12px]" style={{ color: C.stone }}>
            Replaces {swapTarget.name} in your workout.
          </div>
        </div>
      )}
    </div>
  );
}

function FitCard({ kind, option, swap, library, currentId }: { kind: "easier" | "harder"; option: FitOption; swap: string | undefined; library: LibraryExercise[]; currentId: string }) {
  const body = (
    <>
      <span className="text-[12px] font-bold" style={{ color: kind === "easier" ? "#15803D" : "#B45309" }}>
        {kind === "easier" ? "TOO HARD?" : "TOO EASY?"}
      </span>
      <span className="text-[14px] font-bold leading-snug" style={{ color: C.ink }}>
        {option.name}
      </span>
      {option.note && (
        <span className="text-[12px] leading-snug" style={{ color: C.stone }}>
          {option.note}
        </span>
      )}
    </>
  );
  // Only a card naming a real library exercise opens anything; a plain tip is static.
  const target = fitCardTarget(option, library, currentId);
  const cls = "relative flex flex-col gap-1 rounded-[14px] p-3 text-left";
  if (!target) {
    return (
      <div className={cls} style={{ background: "#F4F2EF" }}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to="/exercises/$exerciseId/how-to"
      params={{ exerciseId: target }}
      search={swap ? { swap } : {}}
      className={`${cls} pr-7`}
      style={{ background: "#fff", border: `1.5px solid ${C.line}` }}
      aria-label={`${kind === "easier" ? "Too hard?" : "Too easy?"} ${option.name}: see how to do it`}
    >
      <ChevronRight size={16} className="absolute right-2.5 top-3" style={{ color: "#A8A29E" }} aria-hidden />
      {body}
    </Link>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Start and top pictures: hold ~1s, fade 0.2s, hold ~1s, fade back (2.4s loop); the label follows. */
function DemoHeader({ ex, onClose }: { ex: LibraryExercise; onClose: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [bg, setBg] = useState<string>(C.imageBg);
  const startRef = useRef<HTMLImageElement | null>(null);
  const hasTwo = !!ex.imageStart && !!ex.imagePeak;
  const playing = hasTwo && !paused && !reduced;

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setShowTop((v) => !v), 1200);
    return () => window.clearInterval(t);
  }, [playing]);
  useEffect(() => {
    if (reduced) setShowTop(false);
  }, [reduced]);

  // Picture background: the start image's corner pixel, so the photo blends into the header.
  const sample = () => {
    const img = startRef.current;
    if (!img || !img.naturalWidth) return;
    try {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      setBg(`rgb(${r}, ${g}, ${b})`);
    } catch {
      /* keep the default tint */
    }
  };

  return (
    <div className="relative h-[330px] overflow-hidden" style={{ background: ex.imageStart ? bg : C.violetTint }}>
      {ex.imageStart ? (
        <>
          <img
            ref={startRef}
            src={ex.imageStart}
            alt={`${ex.name}, start position`}
            onLoad={sample}
            className="absolute left-0 top-[-20px] aspect-square w-full object-cover"
          />
          {ex.imagePeak && (
            <img
              src={ex.imagePeak}
              alt={`${ex.name}, top position`}
              className="absolute left-0 top-[-20px] aspect-square w-full object-cover"
              style={{ opacity: showTop ? 1 : 0, transition: reduced ? "none" : "opacity 200ms ease-in-out" }}
            />
          )}
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[64px] font-extrabold" style={{ color: C.violetText }} aria-hidden>
          {initials(ex.name)}
        </span>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white"
        style={{ top: "calc(env(safe-area-inset-top) + 8px)", boxShadow: "0 1px 2px rgba(20,18,24,.08)", color: C.ink }}
      >
        <X size={22} />
      </button>

      {hasTwo && (
        <div className="absolute bottom-[14px] left-4 right-4 flex items-center justify-between">
          <div className="flex gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,.85)" }} aria-hidden>
            {(["Start", "Top"] as const).map((l) => {
              const on = (l === "Top") === showTop;
              return (
                <span
                  key={l}
                  className="flex h-8 items-center rounded-[16px] px-[14px] text-[13px] font-bold"
                  style={{ background: on ? C.ink : "transparent", color: on ? "#FFFFFF" : C.stoneDark, transition: reduced ? "none" : "background 200ms, color 200ms" }}
                >
                  {l}
                </span>
              );
            })}
          </div>
          {!reduced && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={playing ? "Pause demo" : "Play demo"}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white"
              style={{ color: C.ink }}
            >
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
