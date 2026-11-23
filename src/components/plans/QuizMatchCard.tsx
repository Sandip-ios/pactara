import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyGroups } from "@/lib/groups.functions";
import { weeklyTarget } from "@/lib/streak-rules";
import { coverThumb } from "@/lib/plan-filters";
import { matchPlans, type QuizAnswers } from "@/lib/plan-quiz";
import {
  matchCardTags,
  newestSavedQuiz,
  parseSavedQuiz,
  quizSearchFor,
  sameAnswers,
  savedQuizLocalKey,
  serializeSavedQuiz,
  type SavedQuiz,
} from "@/lib/plan-quiz-saved";
import type { Plan } from "@/lib/workout-plans";
import { GOAL_TILE, P, usePlans } from "./PlanBits";

const quizKey = (userId: string) => ["plan-quiz", userId] as const;

function useSignedInUserId(): string {
  return useRouteContext({ from: "/_authenticated" }).user.id;
}

function readLocal(userId: string): SavedQuiz | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(savedQuizLocalKey(userId));
    return raw ? parseSavedQuiz(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function loadSavedQuiz(userId: string): Promise<SavedQuiz | null> {
  let profile: SavedQuiz | null = null;
  try {
    const { data } = await supabase.from("profiles").select("plan_quiz").eq("id", userId).maybeSingle();
    profile = parseSavedQuiz(data?.plan_quiz ?? null);
  } catch {
    /* the local copy still answers */
  }
  return newestSavedQuiz(profile, readLocal(userId));
}

/** The member's saved quiz answers, shared by Discover, the Workouts tab and the quiz. */
export function useSavedQuiz() {
  const userId = useSignedInUserId();
  return useQuery({ queryKey: quizKey(userId), queryFn: () => loadSavedQuiz(userId), staleTime: 5 * 60_000 });
}

/** Results screen reached: save the answers on the profile, keeping a local copy in case that write fails. */
export function useSaveQuizResult() {
  const userId = useSignedInUserId();
  const queryClient = useQueryClient();
  return async (answers: QuizAnswers) => {
    const current = queryClient.getQueryData<SavedQuiz | null>(quizKey(userId)) ?? (await loadSavedQuiz(userId));
    if (current && sameAnswers(current.answers, answers)) return;
    const saved: SavedQuiz = { answers, completedAt: new Date().toISOString() };
    const row = serializeSavedQuiz(saved);
    queryClient.setQueryData(quizKey(userId), saved);
    try {
      localStorage.setItem(savedQuizLocalKey(userId), JSON.stringify(row));
    } catch {
      /* ignore */
    }
    try {
      await supabase.from("profiles").update({ plan_quiz: row }).eq("id", userId);
    } catch {
      /* the local copy covers this device */
    }
  };
}

function useCrewDays(): number | null {
  const { data } = useQuery({ queryKey: ["my-groups"], queryFn: () => listMyGroups(), staleTime: 60_000 });
  const targets = (data?.groups ?? []).map((g) => weeklyTarget({ frequency: g.frequency, days_per_week: g.daysPerWeek }));
  return targets.length ? Math.max(...targets) : null;
}

function Cover({ plan }: { plan: Plan }) {
  const [failed, setFailed] = useState(false);
  const src = coverThumb(plan.coverUrl, 192);
  return (
    <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-[12px]" style={{ background: GOAL_TILE[plan.goal]?.tint ?? P.tile }}>
      {src && !failed && <img src={src} alt="" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" data-plan-cover={plan.slug} />}
    </span>
  );
}

/** "YOUR BEST MATCH" card on Discover and the Workouts tab, recomputed from the saved answers each time. */
export function QuizMatchCard({ saved }: { saved: SavedQuiz }) {
  const navigate = useNavigate();
  const { data: plans } = usePlans();
  const crewDays = useCrewDays();
  const match = useMemo(() => (plans ? matchPlans(plans, saved.answers, crewDays) : null), [plans, saved, crewDays]);
  if (!match) return null;
  const bp = match.best.plan;
  const total = 1 + match.also.length;
  const tags = matchCardTags(match.best.why);
  const openPlan = () => navigate({ to: "/plans/$slug", params: { slug: bp.slug } });

  return (
    <section className="flex flex-col gap-2.5 rounded-[16px] p-3" style={{ background: "#EDE7FB" }} aria-label="Your best match">
      <div className="flex items-center justify-between gap-3">
        <span className="pl-1 text-[12px] font-extrabold uppercase tracking-[0.8px]" style={{ color: "#6D28D9" }}>
          Your best match
        </span>
        <button
          type="button"
          onClick={() => navigate({ to: "/find-plan", search: quizSearchFor(saved.answers, 1) })}
          className="-my-1 flex min-h-8 items-center px-1 text-[13px] font-bold"
          style={{ color: "#6D28D9" }}
        >
          Retake quiz
        </button>
      </div>
      <button type="button" onClick={openPlan} className="flex w-full items-center gap-3 text-left" aria-label={`Best match: ${bp.name}`}>
        <Cover plan={bp} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16px] font-bold leading-tight" style={{ color: P.ink }}>
            {bp.name}
          </span>
          <span className="text-[13px]" style={{ color: P.stone }}>
            {bp.weeks} weeks · {bp.daysPerWeek} days a week · {bp.minutes} min
          </span>
          {tags && (
            <span className="truncate text-[12px] font-semibold" style={{ color: "#5B21B6" }}>
              {tags}
            </span>
          )}
        </span>
        <ChevronRight size={20} className="shrink-0" style={{ color: "#5B21B6" }} aria-hidden />
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={openPlan}
          className="flex h-11 items-center justify-center rounded-full text-[14px] font-extrabold text-white"
          style={{ background: "#7C3AED" }}
        >
          See plan
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/find-plan", search: quizSearchFor(saved.answers, 5) })}
          className="flex h-11 items-center justify-center rounded-full bg-white text-[14px] font-extrabold"
          style={{ color: "#6D28D9" }}
        >
          See all {total} matches
        </button>
      </div>
    </section>
  );
}
