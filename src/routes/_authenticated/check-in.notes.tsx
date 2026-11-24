import { makeVideoPoster } from "@/lib/video-poster";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCheckInCelebrationData, recordCheckIn, type CelebrationData } from "@/lib/daily-posts.functions";
import { supabase } from "@/integrations/supabase/client";

import { clearCheckInPhoto, getCheckInPhoto, setCheckInPhotoBlob } from "@/lib/checkin-photo-store";
import { saveCheckInDraft, loadCheckInDraft, clearCheckInDraft } from "@/lib/checkin-draft-store";
import CheckInCelebrationModal from "@/components/CheckInCelebrationModal";
import ShareWinScreen from "@/components/share/ShareWinScreen";
import type { ShareCardInput } from "@/lib/share-card";
import { requestAppStoreReview } from "@/lib/app-review";
import { listMyGroups } from "@/lib/groups.functions";
import { AllGroupsToggle } from "./check-in.index";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";
import { clearPlanCheckIn, getPlanCheckIn, setPlanCheckIn, type PlanCheckIn } from "@/lib/plan-checkin";
import type { PlanDayResult } from "@/lib/workout-plans";
import { clearWorkoutCheckIn, getWorkoutCheckIn, setWorkoutCheckIn, type WorkoutCheckIn } from "@/lib/active-workout";
import { pendingHealthWorkout, attachHealthWorkout, clearHealthWorkout, isAppleHealthPlatform } from '@/lib/apple-health';
import { healthWorkoutSchema, healthWorkoutName, type HealthWorkout } from '@/lib/health-workouts';
import { HealthPostedStats } from '@/components/health/HealthUI';
import { HealthPrompt } from '@/components/health/HealthPrompt';

const SHARE_HIDE_KEY = "checkin-share-hide";
const PURPLE = "#7C3AED";
const MEDIA_UPLOAD_TIMEOUT_MS = 45_000;
const POST_TIMEOUT_MS = 20_000;
const CELEBRATION_TIMEOUT_MS = 8_000;


const ACTIVITIES = [
  { id: "meal", emoji: "🥗", label: "Meal" },
  { id: "workout", emoji: "💪", label: "Workout" },
  { id: "run", emoji: "🏃", label: "Run" },
  { id: "progress", emoji: "📸", label: "Progress" },
  { id: "sleep", emoji: "😴", label: "Sleep" },
  { id: "water", emoji: "💧", label: "Water" },
  { id: "meditation", emoji: "🧘", label: "Meditation" },
];

export const Route = createFileRoute("/_authenticated/check-in/notes")({
  component: NotesPage,
});

function getActiveGroupId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("active-group-id");
}

async function resolveGroupId(userId: string): Promise<string | null> {
  const preferred = getActiveGroupId();
  if (preferred) {
    const { data: member } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId)
      .eq("group_id", preferred)
      .maybeSingle();
    if (member?.group_id) return member.group_id;
  }
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return membership?.group_id ?? null;
}

async function uploadCheckInPhotoOnce(blob: Blob): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("You're signed out. Sign in and try again.");
  const groupId = await resolveGroupId(userId);
  if (!groupId) throw new Error("Couldn't find your crew. Try again.");
  const mime = blob.type || "image/jpeg";
  const ext = mime.startsWith("video/")
    ? (mime.split("/")[1]?.split(";")[0] || "mp4").replace("quicktime", "mov")
    : (mime.split("/")[1]?.split(";")[0] || "jpg").replace("jpeg", "jpg");
  const path = `${groupId}/${userId}-checkin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("chat-photos")
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw error;
  if (mime.startsWith("video/")) {
    // Best effort: a small preview frame lets the feed paint instantly.
    try {
      const poster = await makeVideoPoster(blob);
      if (poster) {
        await supabase.storage
          .from("chat-photos")
          .upload(`${path}.poster.jpg`, poster, { contentType: "image/jpeg", upsert: false });
      }
    } catch {
      /* the video still posts without a poster */
    }
  }
  return path;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Never post a media-less check-in when a weak connection stalls the upload. */
async function uploadCheckInPhoto(blob: Blob): Promise<string> {
  return withTimeout(
    uploadCheckInPhotoOnce(blob),
    MEDIA_UPLOAD_TIMEOUT_MS,
    "Media upload timed out",
  );
}

function NotesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allGroups, setAllGroups] = useState(false);
  // The plan day this check-in finishes (a plan workout's Workout done).
  const [planDay, setPlanDay] = useState<PlanCheckIn | null>(null);
  const [planResult, setPlanResult] = useState<PlanDayResult | null>(null);
  // The logged workout this check-in posts with (from "Workout done").
  const [workout, setWorkout] = useState<WorkoutCheckIn | null>(null);
  const [healthWorkout, setHealthWorkout] = useState<HealthWorkout | null>(null);
  const [healthUserId, setHealthUserId] = useState<string | null>(null);
  const [firstCheckIn, setFirstCheckIn] = useState(false);
  const { data: groupsData } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
    staleTime: 60_000,
  });
  const myGroups = groupsData?.groups ?? [];
  const { data: partnerState } = usePartnerState();
  const activeGroupName = (() => {
    const id = getActiveGroupId();
    const g = myGroups.find((x) => (x.id as string) === id) ?? myGroups[0];
    if (!g) return null;
    const relation = relationForGroup(g.id as string, partnerState);
    const emoji = relation?.emoji ?? g.emoji;
    return `${emoji ? `${emoji} ` : ""}${relation?.name ?? g.name}`;
  })();
  const celebrationGroupName = (() => {
    const id = getActiveGroupId();
    const group = myGroups.find((g) => (g.id as string) === id) ?? myGroups[0];
    if (!group) return null;
    const relation = relationForGroup(group.id as string, partnerState);
    return relation?.name ?? group.name;
  })();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [draftRestored, setDraftRestored] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    const plan = getPlanCheckIn();
    if (plan) {
      setPlanDay(plan);
      setActivity((a) => a ?? plan.activity);
    }
    const logged = getWorkoutCheckIn();
    if (logged) {
      setWorkout(logged);
      setActivity((a) => a ?? "workout");
    }
    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || !isAppleHealthPlatform()) return;
      setHealthUserId(userId);
      if (plan || logged) { clearHealthWorkout(); return; }
      const health = pendingHealthWorkout(userId);
      if (health) { setHealthWorkout(health); setActivity(/run|walk/i.test(health.type) ? 'run' : 'workout'); }
    });
    const existing = getCheckInPhoto();
    if (existing) {
      setPhotoPreview(existing.previewUrl);
      return;
    }
    // No fresh capture — restore a saved draft (media survives app restarts
    // via IndexedDB, unlike the in-memory photo store).
    let cancelled = false;
    void loadCheckInDraft().then((draft) => {
      if (cancelled || !draft) return;
      if (draft.blob) {
        setCheckInPhotoBlob(draft.blob);
        setPhotoPreview(getCheckInPhoto()?.previewUrl ?? null);
      }
      setNote(draft.note ?? "");
      setActivity(draft.activity ?? null);
      if (draft.planDay) {
        setPlanDay(draft.planDay);
        setPlanCheckIn(draft.planDay, false);
      }
      if (draft.workout) {
        setWorkout(draft.workout);
        setWorkoutCheckIn(draft.workout);
      }
      if (draft.health && isAppleHealthPlatform()) {
        const savedHealth = draft.health;
        void supabase.auth.getUser().then(({ data }) => {
          const userId = data.user?.id;
          if (!userId || userId !== savedHealth.userId) return;
          const parsed = healthWorkoutSchema.safeParse(savedHealth.workout);
          if (parsed.success) { setHealthWorkout(parsed.data); setHealthUserId(userId); attachHealthWorkout(userId, parsed.data); }
        });
      }
      setAllGroups(draft.allGroups ?? false);
      setDraftRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  type ShareState = {
    photoUrl: string | null;
    media: Blob | null;
    celebration: CelebrationData;
    /** Badges this check-in unlocked in the celebrated group. */
    newBadges: number[];
    /** The one streak number the badge, the card and the share card all show. */
    streak: number;
    activity: string | null;
  };
  const [shareData, setShareData] = useState<ShareState | null>(null);
  const [shareScreenOpen, setShareScreenOpen] = useState(false);

  const getCelebrationFn = useServerFn(getCheckInCelebrationData);
  // Warm the celebration data in the background so the modal opens with real numbers.
  useQuery({
    queryKey: ["checkin-celebration-prefetch"],
    queryFn: () => getCelebrationFn({ data: { groupId: getActiveGroupId() } }),
    staleTime: 30_000,
  });

  const finalizeAndExit = (plan: PlanDayResult | null = planResult) => {
    sessionStorage.setItem("checkin-celebrate", "1");
    clearCheckInPhoto();
    queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
    queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    queryClient.invalidateQueries({ queryKey: ["home-crew"] });
    // Finishing the last day of a plan lands on the "Plan complete" celebration.
    if (plan?.completed) {
      navigate({ to: "/groups", search: { tab: "plans", complete: plan.slug } });
      return;
    }
    navigate({ to: "/home" });
  };

  const recordCheckInFn = useServerFn(recordCheckIn);
  const mutation = useMutation({
    mutationFn: async (vars: {
      note?: string;
      activity?: string;
      photoUrl?: string;
      groupId?: string | null;
      groupIds?: string[] | null;
      planDay?: { userPlanId: string; week: number; day: number } | null;
      workoutSessionId?: string | null;
      healthWorkout?: HealthWorkout | null;
    }) =>
      recordCheckInFn({ data: vars }),
  });

  const submit = async () => {
    if (submitting || mutation.isPending) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const activeGroupId = getActiveGroupId();
      let photoUrl: string | undefined;
      const photo = getCheckInPhoto();
      if (healthWorkout && !photo?.blob.type.startsWith('video/')) {
        setSubmitError('Add a video to check in with this Health workout.');
        return;
      }
      if (photo) {
        try {
          photoUrl = await uploadCheckInPhoto(photo.blob);
        } catch (error) {
          console.error("check-in media upload failed", error);
          // Never post without the media the user captured — keep it and let
          // them retry once they have a better connection.
          setSubmitError(
            photo.blob.type.startsWith("video/")
              ? "Your video couldn't upload — your connection looks weak. Try again, or save it as a draft and share it later."
              : "Your photo couldn't upload — your connection looks weak. Try again, or save it as a draft and share it later.",
          );
          return;
        }
      }
      const result = await withTimeout(
        mutation.mutateAsync({
          note: note || undefined,
          activity: activity || undefined,
          photoUrl,
          groupId: activeGroupId,
          groupIds: allGroups && myGroups.length > 1 ? myGroups.map((g) => g.id as string) : null,
          planDay: planDay ? { userPlanId: planDay.userPlanId, week: planDay.week, day: planDay.day } : null,
          workoutSessionId: workout?.sessionId ?? null,
          healthWorkout,
        }),
        POST_TIMEOUT_MS,
        "Posting timed out. Please try again.",
      );
      const newBadges = (result as { newBadges?: number[] } | undefined)?.newBadges ?? [];
      setFirstCheckIn(result.firstCheckIn);
      clearHealthWorkout();
      queryClient.invalidateQueries({ queryKey: ['apple-health'] });
      const plan = (result as { plan?: PlanDayResult | null } | undefined)?.plan ?? null;
      if (workout) {
        clearWorkoutCheckIn();
        queryClient.invalidateQueries({ queryKey: ["lift-history"] });
      }
      if (planDay) {
        clearPlanCheckIn();
        setPlanResult(plan);
        queryClient.invalidateQueries({ queryKey: ["my-plans"] });
      }

      queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      queryClient.invalidateQueries({ queryKey: ["rest-day-info"] });
      queryClient.invalidateQueries({ queryKey: ["home-crew"] });
      queryClient.invalidateQueries({ queryKey: ["my-badges"] });

      // Stash any new badges so /home can also announce them — safety net in case
      // the user dismisses fast or the local modal never mounts.
      if (newBadges.length > 0 && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("pending-badge-announce", JSON.stringify(newBadges));
      }

      // Posted — any saved draft for this check-in is no longer needed.
      void clearCheckInDraft();

      const hide = typeof localStorage !== "undefined" && localStorage.getItem(SHARE_HIDE_KEY) === "1";
      if (hide && newBadges.length === 0 && !(result.firstCheckIn && isAppleHealthPlatform())) {
        finalizeAndExit(plan);
        return;
      }
      const photoForShare = photo ? URL.createObjectURL(photo.blob) : null;
      const celebration: CelebrationData = await withTimeout(
        getCelebrationFn({ data: { groupId: activeGroupId, workoutSessionId: workout?.sessionId ?? null } }),
        CELEBRATION_TIMEOUT_MS,
        "Celebration loading timed out",
      ).catch(() => ({ groupId: activeGroupId, streakCount: 1, groupName: "Your crew", teammates: [] }));
      // One streak value everywhere: the number the badges were awarded on
      // for the celebrated group (same rule as the celebration data).
      const posted = result as { streakByGroup?: Record<string, number>; badgesByGroup?: Record<string, number[]> } | undefined;
      const celebratedGroup = celebration.groupId ?? activeGroupId;
      const streak = (celebratedGroup && posted?.streakByGroup?.[celebratedGroup]) || celebration.streakCount;
      const groupBadges = celebratedGroup ? posted?.badgesByGroup?.[celebratedGroup] : undefined;
      setShareData({
        photoUrl: photoForShare,
        media: photo?.blob ?? null,
        celebration: { ...celebration, streakCount: streak },
        newBadges: groupBadges ?? newBadges,
        streak,
        activity: activity ?? null,
      });
    } catch (err) {
      console.error("check-in submit failed", err);
      setSubmitError(
        "Couldn't post your check-in — your connection looks weak. Try again, or save it as a draft and share it later.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const photo = getCheckInPhoto();
      const ok = await saveCheckInDraft({
        note,
        activity,
        groupId: getActiveGroupId(),
        allGroups,
        blob: photo?.blob ?? null,
        isVideo: photo ? photo.blob.type.startsWith("video/") : false,
        planDay,
        workout,
        health: healthWorkout && healthUserId ? { userId: healthUserId, workout: healthWorkout } : null,
      });
      if (ok) {
        // The draft now owns the blob; drop the in-memory copy and go home,
        // where a draft card lets them resume when they're back online.
        clearCheckInPhoto();
        clearHealthWorkout();
        navigate({ to: "/home" });
      } else {
        setSubmitError("Couldn't save the draft on this device. Please try sharing again.");
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const handleShareClose = () => {
    if (shareData?.photoUrl) URL.revokeObjectURL(shareData.photoUrl);
    // Keep `pending-badge-announce` in sessionStorage so /home shows the
    // dedicated BadgeUnlockedModal after this share sheet closes.
    setShareData(null);
    finalizeAndExit();
    // Ask for an App Store review shortly after a successful check-in.
    setTimeout(() => {
      void requestAppStoreReview();
    }, 1500);
  };

  // Video or photo, the same Share your win screen as the feed and Home.
  const handleShareWin = () => {
    if (shareData?.media) setShareScreenOpen(true);
  };

  const shareInput: ShareCardInput | null = (() => {
    if (!shareData) return null;
    const c = shareData.celebration;
    const relation = relationForGroup(c.groupId ?? getActiveGroupId(), partnerState);
    return {
      streak: shareData.streak,
      crewName: celebrationGroupName ?? c.groupName,
      relation: relation?.kind === "partner" ? "partner" : relation?.kind === "solo" ? "solo" : "crew",
      activityLabel: ACTIVITIES.find((a) => a.id === shareData.activity)?.label ?? null,
      week: c.week ?? null,
      workout: c.workout ?? null,
    };
  })();

  const isBusy = submitting || mutation.isPending;

  return (
    <div
      className="min-h-[100dvh] w-full bg-white flex flex-col"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="relative h-14 flex items-center justify-center border-b border-neutral-200 px-4 shrink-0">
        <button
          onClick={() => navigate({ to: "/check-in/camera" })}
          className="absolute left-3 h-10 w-10 flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight">New check-in</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-40">
        {/* Photo or video */}
        {photoPreview && (
          <div className="px-6 pt-5 flex justify-center">
            {getCheckInPhoto()?.blob.type.startsWith("video/") ? (
              <video
                src={photoPreview}
                controls
                muted
                autoPlay
                loop
                playsInline
                preload="auto"
                className="w-full max-w-[224px] aspect-[9/16] object-cover rounded-2xl bg-black"
              />
            ) : (
              <img
                src={photoPreview}
                alt="Check-in"
                className="w-full max-w-[224px] aspect-[9/16] object-cover rounded-2xl"
              />
            )}
          </div>
        )}

        {/* Note */}
        <div className="px-6 pt-5">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            className="w-full bg-transparent outline-none text-[18px] placeholder:text-neutral-400"
          />
        </div>

        {/* Tag your activity */}
        {!healthWorkout && <div className="pt-8">
          <h2 className="px-6 text-[17px] font-bold tracking-tight">Tag your activity</h2>
          <div
            className="ml-6 mt-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity" }}
          >
            <div className="flex w-max gap-2 pr-6">
            {ACTIVITIES.map((a) => {
              const selected = activity === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setActivity(selected ? null : a.id)}
                  style={{
                    scrollSnapAlign: "start",
                    borderColor: selected ? PURPLE : undefined,
                    color: selected ? PURPLE : undefined,
                    backgroundColor: selected ? `${PURPLE}10` : undefined,
                  }}
                  className={`shrink-0 rounded-full border px-4 py-2.5 flex items-center gap-2 text-[15px] font-medium transition-colors ${
                    selected ? "" : "border-neutral-300 bg-white text-neutral-900"
                  }`}
                >
                  <span className="text-[16px] leading-none">{a.emoji}</span>
                  <span className="whitespace-nowrap">{a.label}</span>
                </button>
              );
            })}
            </div>
          </div>
        </div>}
        <div className="px-6 pt-6">
          {healthWorkout && <div className="ph-no-capture ph-mask mb-3 rounded-[20px] bg-health-surface px-4 py-3">
            <p className="text-[15px] font-bold text-health-ink">{healthWorkoutName(healthWorkout.type)}</p>
            <HealthPostedStats workout={healthWorkout} />
          </div>}
          {workout && (
            <div className="mb-3 rounded-2xl px-4 py-3 text-[14px]" style={{ background: "#EFE9FB", color: PURPLE }}>
              <span className="font-semibold">{workout.title}</span> · {workout.line}
            </div>
          )}
          {planDay && (
            <div className="mb-3 rounded-2xl px-4 py-3 text-[14px]" style={{ background: "#EFE9FB", color: PURPLE }}>
              <span className="font-semibold">{planDay.planName}</span> · Week {planDay.week} · Day {planDay.day}
            </div>
          )}
          {!allGroups && activeGroupName && (
            <div className="mb-3 text-[14px] text-neutral-500">
              Posting to <span className="font-semibold text-neutral-900">{activeGroupName}</span>
            </div>
          )}
          <AllGroupsToggle
            count={myGroups.length}
            value={allGroups}
            onChange={setAllGroups}
            label="Share to all my crews"
          />
        </div>
      </div>

      {/* Share button */}
      <div
        className="fixed inset-x-0 px-4 z-50"
        style={{ bottom: "24px" }}
      >
        {draftRestored && !submitError && (
          <div className="mb-2 rounded-lg bg-purple-50 px-3 py-2 text-[13px] text-center" style={{ color: PURPLE }}>
            Draft restored — tap Share when you're back online.
          </div>
        )}
        {submitError && (
          <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 text-center">
            {submitError}
          </div>
        )}
        <button
          onClick={submit}
          disabled={isBusy || savingDraft}
          className="w-full rounded-2xl py-4 text-white text-[16px] font-semibold disabled:opacity-60"
          style={{ background: PURPLE }}
        >
          {isBusy ? "Sharing…" : allGroups && myGroups.length > 1 ? "Share to all crews" : "Share"}
        </button>
        {submitError && (
          <button
            onClick={saveDraft}
            disabled={isBusy || savingDraft}
            className="mt-2 w-full rounded-2xl py-4 text-[16px] font-semibold disabled:opacity-60"
            style={{ background: "#EDE6FE", color: PURPLE }}
          >
            {savingDraft ? "Saving…" : "Save as draft"}
          </button>
        )}
      </div>

      {shareData && (
        <CheckInCelebrationModal
          open
          userPhoto={shareData.photoUrl}
          userPhotoIsVideo={!!shareData.media?.type.startsWith("video/")}
          streakCount={shareData.streak}
          groupName={celebrationGroupName ?? shareData.celebration.groupName}
          teammates={shareData.celebration.teammates}
          newBadges={shareData.newBadges}
          {...(shareData.media ? { onShare: handleShareWin } : {})}
          onDismiss={handleShareClose}
        />
      )}
      {shareData && shareScreenOpen && shareData.media && shareInput && (
        <ShareWinScreen
          media={{ blob: shareData.media, kind: shareData.media.type.startsWith("video/") ? "video" : "photo" }}
          input={shareInput}
          onClose={() => setShareScreenOpen(false)}
        />
      )}
      {shareData && firstCheckIn && <HealthPrompt firstCheckIn />}
    </div>
  );
}
