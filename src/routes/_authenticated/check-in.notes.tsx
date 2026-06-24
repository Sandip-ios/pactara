import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { recordCheckIn } from "@/lib/daily-posts.functions";
import { supabase } from "@/integrations/supabase/client";
import type { MoodId } from "./check-in.index";
import { clearCheckInPhoto, getCheckInPhoto } from "@/lib/checkin-photo-store";

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

async function uploadCheckInPhoto(blob: Blob): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;
    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const groupId = membership?.group_id;
    if (!groupId) return null;
    const path = `${groupId}/${userId}-checkin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage
      .from("chat-photos")
      .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
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
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setMood(sessionStorage.getItem("checkin-mood") as MoodId | null);
    setPhotoPreview(getCheckInPhoto()?.previewUrl ?? null);
  }, []);

  const recordCheckInFn = useServerFn(recordCheckIn);
  const mutation = useMutation({
    mutationFn: async (vars: { note?: string; mood?: string; activity?: string; photoUrl?: string }) =>
      recordCheckInFn({ data: vars }),
    onSuccess: () => {
      sessionStorage.removeItem("checkin-mood");
      clearCheckInPhoto();
      queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      navigate({ to: "/home" });
    },
  });

  const submit = async () => {
    if (submitting || mutation.isPending) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      const photo = getCheckInPhoto();
      if (photo) {
        const path = await uploadCheckInPhoto(photo.blob);
        if (path) photoUrl = path;
      }
      await mutation.mutateAsync({
        note: note || undefined,
        mood: mood || undefined,
        activity: activity || undefined,
        photoUrl,
      });
    } catch (err) {
      console.error("check-in submit failed", err);
      setSubmitError(err instanceof Error ? err.message : "Couldn't post your check-in. Please try again.");
    } finally {
      setSubmitting(false);
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
        {/* Photo */}
        {photoPreview && (
          <div className="px-6 pt-5 flex justify-center">
            <img
              src={photoPreview}
              alt="Check-in"
              className="w-full max-w-[224px] aspect-[9/16] object-cover rounded-2xl"
            />
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
            className="mt-3 flex gap-2 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity" }}
          >
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
          {isBusy ? "Sharing…" : "Share"}
        </button>
      </div>
    </div>
  );
}
