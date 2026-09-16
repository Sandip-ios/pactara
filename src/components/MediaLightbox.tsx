import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { attachVideoDurationFix, effectiveDuration } from "@/lib/video-playback";

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
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClose();
        }}
        aria-label="Close"
        className="absolute h-14 w-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white z-[100]"
        style={{
          top: "calc(max(env(safe-area-inset-top), 20px) + 44px)",
          right: "calc(env(safe-area-inset-right) + 12px)",
        }}
      >
        <X size={28} />
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
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    return attachVideoDurationFix(video);
  }, [src]);

  const syncDuration = () => {
    const video = videoRef.current;
    if (!video) return 0;
    const d = effectiveDuration(video);
    setDuration((prev) => (Math.abs(prev - d) > 0.1 ? d : prev));
    return d;
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = syncDuration();
    if (!d) return;
    setProgress(Math.min(100, (video.currentTime / d) * 100));
  };

  const handleLoadedMetadata = () => {
    syncDuration();
  };

  const handleEnded = () => {
    const video = videoRef.current;
    if (!video) return;
    // Loop manually: the native `loop` attribute would restart at the bogus
    // duration without giving us a chance to keep playing the rest.
    window.setTimeout(() => {
      if (!videoRef.current || !videoRef.current.ended) return;
      try {
        videoRef.current.currentTime = 0;
        void videoRef.current.play().catch(() => {});
      } catch {
        /* noop */
      }
    }, 60);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const value = Number(e.target.value);
    video.currentTime = (value / 100) * duration;
    setProgress(value);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={syncDuration}
        onProgress={syncDuration}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full object-contain bg-black"
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause video" : "Play video"}
        className="absolute inset-0 z-0 bg-transparent"
      />
      <div
        className="absolute left-0 right-0 px-4 z-10"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        onClick={(e) => e.stopPropagation()}
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
