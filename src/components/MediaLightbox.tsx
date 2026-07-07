import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function MediaLightbox({
  src,
  kind,
  onClose,
}: {
  src: string;
  kind: "image" | "video";
  onClose: () => void;
}) {
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
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white z-10"
      >
        <X size={22} />
      </button>
      <div
        className="w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "video" ? (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full w-auto h-auto object-contain bg-black"
          />
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
