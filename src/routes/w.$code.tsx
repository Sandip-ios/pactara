import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FeedAvatar } from "@/components/feed/FeedMedia";
import { ExerciseThumb, FONT, W } from "@/components/workout/WorkoutBits";
import { showSavedToast, showTopError } from "@/components/workout/savedToast";
import { getSharedWorkout, getSharedWorkoutStatus, saveSharedWorkout } from "@/lib/workout-share.functions";
import { SHARE_ORIGIN, shareDescription, shareTitle, sharedMeta, targetLine } from "@/lib/workout-share";
import { setPendingSharedWorkout } from "@/lib/pending-shared-workout";
import { MY_WORKOUTS_KEY } from "@/lib/exercise-library";

export const Route = createFileRoute("/w/$code")({
  loader: ({ params }) => getSharedWorkout({ data: { code: params.code } }),
  head: ({ params, loaderData }) => {
    const url = `${SHARE_ORIGIN}/w/${params.code}`;
    const title = loaderData ? shareTitle(loaderData.name) : "Shared workout · Pactara";
    const description = loaderData
      ? shareDescription(loaderData.ownerFirstName, loaderData.exercises)
      : "A workout shared on Pactara.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: SharedWorkoutPage,
});

const SHADOW = "0 1px 2px rgba(20,18,24,.06)";
type Auth = "unknown" | "in" | "out";

function SharedWorkoutPage() {
  const { code } = Route.useParams();
  const workout = Route.useLoaderData();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const statusFn = useServerFn(getSharedWorkoutStatus);
  const saveFn = useServerFn(saveSharedWorkout);
  const [auth, setAuth] = useState<Auth>("unknown");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => alive && setAuth(data.session ? "in" : "out"));
    return () => {
      alive = false;
    };
  }, []);

  const { data: status } = useQuery({
    queryKey: ["shared-workout-status", code],
    queryFn: () => statusFn({ data: { code } }),
    enabled: auth === "in" && !!workout,
    staleTime: 0,
  });

  const openEdit = (workoutId: string | null) => void navigate({ href: workoutId ? `/workouts?edit=${workoutId}` : "/workouts" });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await saveFn({ data: { code } });
      if (res.status === "missing") {
        showTopError("This workout link doesn't work anymore.");
        return;
      }
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      void qc.invalidateQueries({ queryKey: ["shared-workout-status", code] });
      if (res.status === "saved") showSavedToast(res.name);
      openEdit(res.workoutId);
    } catch (e) {
      console.error("[shared] save failed", e);
      showTopError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const toSignup = () => {
    setPendingSharedWorkout(code);
    void navigate({ to: "/signup" });
  };
  const toLogin = () => {
    setPendingSharedWorkout(code);
    void navigate({ to: "/login" });
  };
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else void navigate({ to: "/home" });
  };

  const isOwner = !!status?.isOwner;

  return (
    <div className="min-h-[100dvh] w-full" style={{ background: W.bg, color: W.ink, fontFamily: FONT }}>
      {auth === "out" ? (
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)]" style={{ background: W.bg }}>
          <span className="text-[22px] font-black tracking-[-0.5px]" aria-label="Pactara">
            <span style={{ color: W.purple }}>P</span>
            <span style={{ color: W.ink }}>actara</span>
          </span>
          <button type="button" onClick={toLogin} className="flex h-11 items-center px-2 text-[15px] font-bold" style={{ color: W.violet }}>
            Sign in
          </button>
        </header>
      ) : (
        <header className="sticky top-0 z-10 grid grid-cols-[44px_1fr_44px] items-center px-2 pt-[env(safe-area-inset-top)]" style={{ background: W.bg }}>
          {auth === "in" ? (
            <button type="button" aria-label="Back" onClick={back} className="flex h-11 w-11 items-center justify-center rounded-full">
              <ChevronLeft size={24} />
            </button>
          ) : (
            <span className="h-11" />
          )}
          <span className="text-center text-[17px] font-extrabold">Shared workout</span>
          <span />
        </header>
      )}

      {!workout ? (
        <div className="flex flex-col items-center gap-5 px-6 pt-24 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: W.lilacSoft, color: W.violet }} aria-hidden>
            <Dumbbell size={28} />
          </span>
          <h1 className="text-[22px] font-extrabold leading-tight">This workout link doesn't work anymore.</h1>
          <p className="text-[15px]" style={{ color: W.stone }}>
            Ask whoever sent it for a new link.
          </p>
          {auth === "out" ? (
            <button type="button" onClick={() => void navigate({ to: "/signup" })} className="h-[52px] w-full max-w-[340px] rounded-[26px] text-[16px] font-bold text-white" style={{ background: W.purple }}>
              Join free
            </button>
          ) : auth === "in" ? (
            <Link to="/home" className="flex h-[52px] w-full max-w-[340px] items-center justify-center rounded-[26px] text-[16px] font-bold text-white" style={{ background: W.purple }}>
              Go to Home
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 px-4 pb-[190px] pt-3">
            <div className="flex items-center gap-2.5">
              <FeedAvatar url={workout.ownerAvatarUrl} color={workout.ownerAvatarColor} name={workout.ownerFirstName} size={36} />
              <span className="text-[14px]" style={{ color: W.stone }}>
                {isOwner ? (
                  <span className="font-bold" style={{ color: W.ink }}>
                    This is your workout
                  </span>
                ) : (
                  <>
                    <span className="font-bold" style={{ color: W.ink }}>
                      {workout.ownerFirstName}
                    </span>{" "}
                    shared a workout with you
                  </>
                )}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.6px]">{workout.name}</h1>
              <span className="flex items-center gap-1.5 text-[14px]" style={{ color: W.stone }}>
                <Dumbbell size={16} aria-hidden />
                {sharedMeta(workout.exercises)}
              </span>
            </div>
            <ul className="overflow-hidden rounded-[20px] bg-white" style={{ boxShadow: SHADOW }}>
              {workout.exercises.map((e, i) => (
                <li key={`${e.exerciseId}-${i}`} className="flex min-h-[72px] items-center gap-3 px-3.5 py-2.5" style={{ borderTop: i ? `1px solid ${W.divider}` : undefined }}>
                  <ExerciseThumb name={e.name} primary={e.primary} image={e.imageStart} size={52} radius={14} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-bold leading-[1.25]">{e.name}</span>
                    <span className="text-[13px]" style={{ color: W.stone }}>
                      {targetLine(e)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {auth !== "unknown" && (
            <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 bg-white px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3" style={{ borderTop: `1px solid ${W.line}` }}>
              {auth === "out" ? (
                <>
                  <PrimaryButton onClick={toSignup}>Join free to save this workout</PrimaryButton>
                  <Helper>After you sign up, it’s already in My workouts.</Helper>
                </>
              ) : !status ? (
                <PrimaryButton disabled>Save to my workouts</PrimaryButton>
              ) : isOwner ? (
                <PrimaryButton onClick={() => openEdit(status.ownWorkoutId)}>Open</PrimaryButton>
              ) : status.savedWorkoutId ? (
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(status.savedWorkoutId)}
                    className="flex h-[52px] items-center justify-center gap-2 rounded-[26px] text-[16px] font-bold"
                    style={{ background: W.lilacSoft, color: W.violetText }}
                  >
                    <Check size={18} aria-hidden /> Saved · Open
                  </button>
                  <Helper>It’s in My workouts. Start it whenever you’re ready.</Helper>
                </>
              ) : (
                <>
                  <PrimaryButton disabled={saving} onClick={() => void save()}>
                    {saving ? "Saving…" : "Save to my workouts"}
                  </PrimaryButton>
                  <Helper>It goes to My workouts. Start it whenever you’re ready.</Helper>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-[52px] rounded-[26px] text-[16px] font-bold text-white disabled:opacity-70"
      style={{ background: W.purple }}
    >
      {children}
    </button>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-center text-[12px]" style={{ color: W.muted }}>
      {children}
    </span>
  );
}
