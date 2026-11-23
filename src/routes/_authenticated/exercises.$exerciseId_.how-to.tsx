import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { FONT, PoseLoop, W, exerciseKicker, tintFor } from "@/components/workout/WorkoutBits";
import { useExerciseMap, useInstructions } from "@/lib/exercise-library";
import { useOpenAtTop } from "@/lib/use-open-at-top";

export const Route = createFileRoute("/_authenticated/exercises/$exerciseId_/how-to")({
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
  component: HowToPage,
});

/** Full-screen how-to: start and end pictures cross-fading, then plain steps. */
function HowToPage() {
  const { exerciseId } = Route.useParams();
  const navigate = useNavigate();
  const { map, isLoading } = useExerciseMap();
  const ex = map.get(exerciseId) ?? null;
  const scrollRef = useOpenAtTop();
  const { data: steps, isLoading: stepsLoading } = useInstructions(ex ? ex.id : null);
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/groups", search: { tab: "plans" } });
  };

  return (
    <div ref={scrollRef} className="fixed inset-0 w-full overflow-y-auto overscroll-none" data-scroll-root style={{ background: W.chip, fontFamily: FONT, color: W.ink }}>
      <div className="flex flex-col gap-4 px-4 pb-10" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <header className="flex items-center">
          <button type="button" onClick={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
            <ChevronLeft size={24} />
          </button>
        </header>
        {!ex ? (
          isLoading ? (
            <div className="h-[260px] animate-pulse rounded-[18px] bg-white" />
          ) : (
            <p className="px-1 text-[15px]" style={{ color: W.stone }}>
              This exercise isn't available.
            </p>
          )
        ) : (
          <>
            <div className="flex flex-col gap-1.5 px-1">
              <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: tintFor(ex.primary).ink }}>
                {exerciseKicker(ex)}
              </span>
              <h1 className="m-0 text-[28px] font-extrabold leading-tight tracking-[-0.5px]">{ex.name}</h1>
            </div>
            <div className="overflow-hidden rounded-[18px] bg-white p-2">
              <PoseLoop start={ex.imageStart} peak={ex.imagePeak} name={ex.name} height={280} />
            </div>
            <section className="flex flex-col gap-2">
              <div className="px-1 text-[13px] font-bold tracking-[0.6px]" style={{ color: W.stone }}>
                HOW TO DO IT
              </div>
              <div className="rounded-[18px] bg-white p-4">
                {stepsLoading ? (
                  <div className="h-24 animate-pulse rounded-[12px]" style={{ background: W.chip }} />
                ) : steps && steps.length ? (
                  <ol className="flex flex-col gap-3">
                    {steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-[15px] leading-snug">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: W.tint, color: W.violetText }}>
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[14px]" style={{ color: W.stone }}>
                    No steps for this exercise yet.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
