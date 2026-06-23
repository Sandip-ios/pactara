import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { recordCheckIn } from "@/lib/daily-posts.functions";
import { supabase } from "@/integrations/supabase/client";
import type { MoodId } from "./check-in.index";

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

async function uploadCheckInPhoto(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;
    const path = `${userId}/checkin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
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
  const [photo, setPhoto] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodId | null>(null);
  const [activity, setActivity] = useState<string | null>(null);

  useEffect(() => {
    setMood(sessionStorage.getItem("checkin-mood") as MoodId | null);
    setPhoto(sessionStorage.getItem("checkin-photo"));
  }, []);

  const recordCheckInFn = useServerFn(recordCheckIn);
  const mutation = useMutation({
    mutationFn: async (vars: { note?: string; mood?: string; activity?: string; photoUrl?: string }) =>
      recordCheckInFn({ data: vars }),
    onSuccess: () => {
      sessionStorage.removeItem("checkin-mood");
      sessionStorage.removeItem("checkin-photo");
      queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      navigate({ to: "/home" });
    },
  });

  const submit = async () => {
    let photoUrl: string | undefined;
    if (photo && photo.startsWith("data:")) {
      const path = await uploadCheckInPhoto(photo);
      if (path) photoUrl = path;
    } else if (photo) {
      photoUrl = photo;
    }
    mutation.mutate({
      note: note || undefined,
      mood: mood || undefined,
      activity: activity || undefined,
      photoUrl,
    });
  };

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
        {photo && (
          <div className="px-6 pt-5 flex justify-center">
            <img
              src={photo}
              alt="Check-in"
              className="w-full max-w-[280px] aspect-[9/16] object-cover rounded-2xl"
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
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <button
          onClick={submit}
          disabled={mutation.isPending}
          className="w-full rounded-2xl py-4 text-white text-[16px] font-semibold disabled:opacity-60"
          style={{ background: PURPLE, boxShadow: `0 18px 40px -12px ${PURPLE}80` }}
        >
          {mutation.isPending ? "Sharing…" : "Share"}
        </button>
      </div>
    </div>
  );
}
