import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ImagePlus, RefreshCw } from "lucide-react";
import { MOODS, type MoodId } from "./check-in.index";

export const Route = createFileRoute("/_authenticated/check-in/camera")({
  component: CameraPage,
});

function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [error, setError] = useState(false);

  const moodId = (typeof window !== "undefined" ? (sessionStorage.getItem("checkin-mood") as MoodId | null) : null);
  const mood = MOODS.find((m) => m.id === moodId) ?? MOODS[0];

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError(true);
      }
    }
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      navigate({ to: "/check-in/notes" });
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    sessionStorage.setItem("checkin-photo", dataUrl);
    navigate({ to: "/check-in/notes" });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem("checkin-photo", String(reader.result));
      navigate({ to: "/check-in/notes" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center px-8 text-neutral-300">
          Camera unavailable. Tap skip or attach a photo.
        </div>
      )}

      <div className="absolute top-0 inset-x-0 pt-4 px-4 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/check-in" })}
          className="h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="rounded-full bg-black/50 backdrop-blur px-4 py-2 flex items-center gap-2">
          <span className="text-[18px] leading-none">{mood.emoji}</span>
          <span className="text-[15px] font-semibold" style={{ color: mood.color }}>{mood.label}</span>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 pb-6 flex flex-col items-center">
        <div className="w-full flex items-center justify-around pt-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-12 rounded-xl border border-white/40 flex items-center justify-center"
            aria-label="Pick from library"
          >
            <ImagePlus size={22} />
          </button>
          <button
            onClick={capture}
            className="h-20 w-20 rounded-full bg-white/10 border-4 border-white flex items-center justify-center"
            aria-label="Capture"
          >
            <span className="h-16 w-16 rounded-full bg-white/90" />
          </button>
          <button
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            className="h-12 w-12 rounded-xl border border-white/40 flex items-center justify-center"
            aria-label="Flip camera"
          >
            <RefreshCw size={20} />
          </button>
        </div>
        <button
          onClick={() => navigate({ to: "/check-in/notes" })}
          className="mt-4 text-[15px] font-medium text-white/90 px-4"
        >
          Skip
        </button>
      </div>


      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
