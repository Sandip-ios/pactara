import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { MOODS, type MoodId } from "./check-in.index";

const BG = "#F5F2EE";
const PURPLE = "#7C3AED";

export const Route = createFileRoute("/_authenticated/check-in/notes")({
  component: NotesPage,
});

function NotesPage() {
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [moodId, setMoodId] = useState<MoodId | null>(null);

  useEffect(() => {
    setMoodId(sessionStorage.getItem("checkin-mood") as MoodId | null);
    setPhoto(sessionStorage.getItem("checkin-photo"));
  }, []);

  const mood = MOODS.find((m) => m.id === moodId) ?? MOODS[0];

  const submit = () => {
    sessionStorage.removeItem("checkin-mood");
    sessionStorage.removeItem("checkin-photo");
    navigate({ to: "/home" });
  };

  return (
    <div className="min-h-[100dvh] w-full pb-32" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="px-4 pt-5 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/check-in/camera" })}
          className="h-10 w-10 rounded-full bg-neutral-200/70 flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="rounded-full bg-neutral-200/70 px-4 py-2 flex items-center gap-2">
          <span className="text-[18px] leading-none">{mood.emoji}</span>
          <span className="text-[15px] font-semibold" style={{ color: mood.color }}>{mood.label}</span>
        </div>
      </div>

      <div className="px-6 pt-6">
        <h1 className="text-[32px] font-black leading-tight tracking-tight">Anything to add?</h1>
        <p className="text-neutral-500 text-[15px] mt-1">Optional — share what's on your mind</p>
      </div>

      {photo && (
        <div className="px-4 mt-4">
          <div className="relative inline-block">
            <img src={photo} alt="Check-in" className="max-h-56 rounded-2xl" />
            <button
              onClick={() => { setPhoto(null); sessionStorage.removeItem("checkin-photo"); }}
              className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center"
              aria-label="Remove photo"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="px-4 mt-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened today? How are you feeling?"
          className="w-full min-h-[55dvh] rounded-2xl bg-white p-5 outline-none text-[16px] placeholder:text-neutral-400 resize-none"
        />
      </div>

      <div className="fixed bottom-6 inset-x-0 px-4 z-50">
        <button
          onClick={submit}
          className="w-full rounded-2xl py-4 text-white text-[16px] font-semibold"
          style={{ background: PURPLE, boxShadow: `0 12px 30px -10px ${PURPLE}80` }}
        >
          Check In 🔥
        </button>
      </div>
    </div>
  );
}
