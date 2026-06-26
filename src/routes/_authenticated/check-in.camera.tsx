import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ImagePlus, RefreshCw } from "lucide-react";
import { MOODS, type MoodId } from "./check-in.index";
import { setCheckInPhoto } from "@/lib/checkin-photo-store";

export const Route = createFileRoute("/_authenticated/check-in/camera")({
  component: CameraPage,
});

function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moodId = (typeof window !== "undefined" ? (sessionStorage.getItem("checkin-mood") as MoodId | null) : null);
  const mood = MOODS.find((m) => m.id === moodId) ?? MOODS[0];

  const isSecure = typeof window !== "undefined" && (window.isSecureContext || window.location.hostname === "localhost");

  // Must be called from a user gesture (iOS Safari requirement).
  const startCamera = async (nextFacing: "user" | "environment" = facing) => {
    setError(null);
    if (!isSecure) {
      setError("Camera needs HTTPS. Use the library button to attach a photo.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not supported on this browser. Use the library button.");
      return;
    }
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
      setFacing(nextFacing);
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.play().catch(() => {});
      }
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError") {
        setError("Camera permission denied. Enable it in your browser settings, or use the library.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No camera found. Use the library button to attach a photo.");
      } else if (name === "NotReadableError") {
        setError("Camera is in use by another app. Close it and try again.");
      } else {
        setError("Camera unavailable. Use the library button to attach a photo.");
      }
      setActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!active || !video || !video.videoWidth) {
      // Fall back to the native camera input on devices where getUserMedia is blocked.
      nativeCameraInputRef.current?.click();
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) setCheckInPhoto(blob);
      navigate({ to: "/check-in/notes" });
    }, "image/jpeg", 0.85);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCheckInPhoto(file);
    navigate({ to: "/check-in/notes" });
  };

  return (
    <div className="fixed inset-0 bg-black text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />

      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-4">
          {error ? (
            <p className="text-neutral-300 text-[15px] leading-snug max-w-[280px]">{error}</p>
          ) : (
            <p className="text-neutral-300 text-[15px] leading-snug max-w-[280px]">
              Tap below to turn on the camera, or attach a photo from your library.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => startCamera(facing)}
              className="rounded-full bg-white text-black px-5 py-2.5 text-[15px] font-semibold flex items-center gap-2"
            >
              <Camera size={18} />
              Enable camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-white/60 text-white px-5 py-2.5 text-[15px] font-semibold"
            >
              Library
            </button>
          </div>
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
            onClick={() => (active ? startCamera(facing === "user" ? "environment" : "user") : startCamera(facing))}
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
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
