import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCheckInCelebrationData, recordCheckIn, type CelebrationData } from "@/lib/daily-posts.functions";
import { supabase } from "@/integrations/supabase/client";
import type { MoodId } from "./check-in.index";
import { clearCheckInPhoto, getCheckInPhoto } from "@/lib/checkin-photo-store";
import CheckInCelebrationModal from "@/components/CheckInCelebrationModal";
import { listMyGroups } from "@/lib/groups.functions";
import { AllGroupsToggle } from "./check-in.index";

const SHARE_HIDE_KEY = "checkin-share-hide";
const PURPLE = "#7C3AED";


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

async function uploadCheckInPhoto(blob: Blob): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;
    const groupId = await resolveGroupId(userId);
    if (!groupId) return null;
    const mime = blob.type || "image/jpeg";
    const ext = mime.startsWith("video/")
      ? (mime.split("/")[1]?.split(";")[0] || "mp4").replace("quicktime", "mov")
      : (mime.split("/")[1]?.split(";")[0] || "jpg").replace("jpeg", "jpg");
    const path = `${groupId}/${userId}-checkin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("chat-photos")
      .upload(path, blob, { contentType: mime, upsert: false });
    if (error) {
      console.error("photo upload failed", error);
      return null;
    }
    return path;
  } catch (e) {
    console.error("photo upload error", e);
    return null;
  }
}

function NotesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodId | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allGroups, setAllGroups] = useState(false);
  const { data: groupsData } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
    staleTime: 60_000,
  });
  const myGroups = groupsData?.groups ?? [];
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setMood(sessionStorage.getItem("checkin-mood") as MoodId | null);
    setPhotoPreview(getCheckInPhoto()?.previewUrl ?? null);
  }, []);

  type ShareState = { photoUrl: string | null; celebration: CelebrationData; newBadges: number[] };
  const [shareData, setShareData] = useState<ShareState | null>(null);

  const getCelebrationFn = useServerFn(getCheckInCelebrationData);
  // Warm the celebration data in the background so the modal opens with real numbers.
  useQuery({
    queryKey: ["checkin-celebration-prefetch"],
    queryFn: () => getCelebrationFn({ data: { groupId: getActiveGroupId() } }),
    staleTime: 30_000,
  });

  const finalizeAndExit = () => {
    sessionStorage.removeItem("checkin-mood");
    clearCheckInPhoto();
    queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
    queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    navigate({ to: "/home" });
  };

  const recordCheckInFn = useServerFn(recordCheckIn);
  const mutation = useMutation({
    mutationFn: async (vars: { note?: string; mood?: string; activity?: string; photoUrl?: string; groupId?: string | null; groupIds?: string[] | null }) =>
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
      if (photo) {
        const path = await uploadCheckInPhoto(photo.blob);
        if (path) photoUrl = path;
      }
      const result = await mutation.mutateAsync({
        note: note || undefined,
        mood: mood || undefined,
        activity: activity || undefined,
        photoUrl,
        groupId: activeGroupId,
        groupIds: allGroups && myGroups.length > 1 ? myGroups.map((g) => g.id as string) : null,
      });
      const newBadges = (result as { newBadges?: number[] } | undefined)?.newBadges ?? [];

      queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-badges"] });

      // Stash any new badges so /home can also announce them — safety net in case
      // the user dismisses fast or the local modal never mounts.
      if (newBadges.length > 0 && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("pending-badge-announce", JSON.stringify(newBadges));
      }

      const hide = typeof localStorage !== "undefined" && localStorage.getItem(SHARE_HIDE_KEY) === "1";
      if (hide && newBadges.length === 0) {
        finalizeAndExit();
        return;
      }
      const photoForShare = photo ? URL.createObjectURL(photo.blob) : null;
      const celebration = await getCelebrationFn({ data: { groupId: activeGroupId } }).catch(() => ({
        streakCount: 1,
        groupName: "Your group",
        teammates: [],
      }));
      setShareData({ photoUrl: photoForShare, celebration, newBadges });
    } catch (err) {
      console.error("check-in submit failed", err);
      setSubmitError(err instanceof Error ? err.message : "Couldn't post your check-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareClose = () => {
    if (shareData?.photoUrl) URL.revokeObjectURL(shareData.photoUrl);
    // Keep `pending-badge-announce` in sessionStorage so /home shows the
    // dedicated BadgeUnlockedModal after this share sheet closes.
    setShareData(null);
    finalizeAndExit();
  };

  const handleShareWin = async () => {
    try {
      const text = `Day ${shareData?.celebration.streakCount} on Pactara — show up, every day.`;
      const nav = navigator as Navigator & {
        share?: (d: ShareData) => Promise<void>;
        canShare?: (d: ShareData) => boolean;
      };
      if (shareData?.photoUrl) {
        const res = await fetch(shareData.photoUrl);
        const blob = await res.blob();
        const file = new File([blob], "pactara-checkin.png", { type: blob.type || "image/png" });
        const payload: ShareData = { files: [file], text };
        if (nav.share && (!nav.canShare || nav.canShare(payload))) {
          await nav.share(payload);
          return;
        }
      }
      if (nav.share) await nav.share({ text });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") console.error("share failed", e);
    }
  };



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
        <div className="pt-8">
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
        </div>
        <div className="px-6 pt-6">
          <AllGroupsToggle
            count={myGroups.length}
            value={allGroups}
            onChange={setAllGroups}
            label="Share to all my groups"
          />
        </div>
      </div>

      {/* Share button */}
      <div
        className="fixed inset-x-0 px-4 z-50"
        style={{ bottom: "24px" }}
      >
        {submitError && (
          <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 text-center">
            {submitError}
          </div>
        )}
        <button
          onClick={submit}
          disabled={isBusy}
          className="w-full rounded-2xl py-4 text-white text-[16px] font-semibold disabled:opacity-60"
          style={{ background: PURPLE }}
        >
          {isBusy ? "Sharing…" : allGroups && myGroups.length > 1 ? "Share to all groups" : "Share"}
        </button>
      </div>

      {shareData && (
        <CheckInCelebrationModal
          open
          userPhoto={shareData.photoUrl}
          streakCount={shareData.celebration.streakCount}
          groupName={shareData.celebration.groupName}
          teammates={shareData.celebration.teammates}
          newBadges={shareData.newBadges}
          onShare={handleShareWin}
          onDismiss={handleShareClose}
        />
      )}
    </div>
  );
}
