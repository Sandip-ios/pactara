import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

export function MediaLightbox({
  src,
  kind,
  onClose,
}: {
  src: string;
  kind: "image" | "video";
  onClose: () => void;
}) {
  useHideBottomTabs();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const content = (
    <div
      className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white z-10"
        style={{
          top: "calc(env(safe-area-inset-top) + 12px)",
          right: "calc(env(safe-area-inset-right) + 12px)",
        }}
      >
        <X size={22} />
      </button>
      <div
        className="w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "video" ? (
          <VideoPlayer src={src} onClose={onClose} />
        ) : (
          <img
            src={src}
            alt=""
            className="max-w-full max-h-full w-auto h-auto object-contain"
          />
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function VideoPlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const value = Number(e.target.value);
    video.currentTime = (value / 100) * duration;
    setProgress(value);
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full h-full object-cover bg-black"
      />
      <div
        className="absolute left-0 right-0 px-4 z-10"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={handleSeek}
          aria-label="Video progress"
          className="w-full h-1 appearance-none rounded-full bg-white/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
        />
      </div>
    </div>
  );
}
