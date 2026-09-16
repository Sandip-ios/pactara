import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { X, HelpCircle, SwitchCamera } from "lucide-react";
import { setCheckInPhoto } from "@/lib/checkin-photo-store";
import { takeCheckInStream } from "@/lib/checkin-stream-store";
import HowToRecordSheet from "@/components/HowToRecordSheet";

const JAKARTA = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";
const PURPLE = "#7C3AED";
const RED = "#EF4444";
const GREEN = "#10B981";
const MIN_SECS = 5;
const MAX_SECS = 60;

type Look = { id: string; label: string; css: string; swatch: string };

// Colour looks. `css` is used both for the live preview (CSS filter) and for
// baking the look into the recorded file (canvas ctx.filter).
const LOOKS: Look[] = [
  { id: "none", label: "Normal", css: "none", swatch: "linear-gradient(135deg,#8E8E93,#3A3A3C)" },
  { id: "golden", label: "Golden", css: "sepia(0.22) saturate(1.3) contrast(1.05) brightness(1.04)", swatch: "linear-gradient(135deg,#FFD98E,#E8994A)" },
  { id: "arctic", label: "Arctic", css: "saturate(1.1) contrast(1.1) hue-rotate(12deg) brightness(1.03)", swatch: "linear-gradient(135deg,#9FD8FF,#3A7BD5)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.18)", swatch: "linear-gradient(135deg,#FFFFFF,#1C1C1E)" },
  { id: "film", label: "Film", css: "sepia(0.4) saturate(0.85) contrast(1.12) brightness(0.98)", swatch: "linear-gradient(135deg,#D8C3A5,#8A6A4F)" },
  { id: "vivid", label: "Vivid", css: "saturate(1.65) contrast(1.15)", swatch: "linear-gradient(135deg,#FF5E7E,#7C3AED)" },
  { id: "fade", label: "Fade", css: "contrast(0.9) saturate(0.78) brightness(1.1)", swatch: "linear-gradient(135deg,#F2E9E4,#B8B0C9)" },
];

export const Route = createFileRoute("/_authenticated/check-in/camera")({
  component: CameraRoute,
});

function CameraRoute() {
  return <VideoRecordScreen />;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function VideoRecordScreen() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const recordingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("user");
  const [switching, setSwitching] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [lookIndex, setLookIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0); // live drag, in look units
  const [dragging, setDragging] = useState(false);
  const lastStepRef = useRef(0);
  const displayIndex = Math.min(
    LOOKS.length - 1,
    Math.max(0, Math.round(lookIndex + dragOffset)),
  );
  const look = LOOKS[displayIndex] ?? LOOKS[0];
  const lookRef = useRef(look.css);
  lookRef.current = look.css;
  const bakeCleanupRef = useRef<(() => void) | null>(null);
  
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; native: boolean }>({
    min: 1,
    max: 1,
    native: false,
  });

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const streamIsLive = (stream: MediaStream | null) =>
    Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live"));

  const detectZoom = (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0];
    const caps = (track && "getCapabilities" in track
      ? (track as MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities }).getCapabilities?.()
      : undefined) as (MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } }) | undefined;
    const nativeZoom = caps?.zoom;
    // Only treat native zoom as useful when it actually spans a range.
    const useNative = Boolean(nativeZoom && nativeZoom.max > nativeZoom.min);
    const min = useNative ? nativeZoom!.min : 1;
    const max = useNative ? nativeZoom!.max : 4; // CSS-scale fallback caps at 4x
    setZoomRange({ min, max, native: useNative });
    // Always start fully zoomed out, on both the front and rear camera.
    setZoom(min);
    if (useNative) {
      try {
        void track.applyConstraints({
          advanced: [{ zoom: min } as MediaTrackConstraintSet & { zoom: number }],
        });
      } catch {
        /* noop */
      }
    }
  };

  const applyZoom = async (value: number, range = zoomRange) => {
    const clamped = Math.min(range.max, Math.max(range.min, value));
    const stream = streamRef.current;
    setZoom(clamped);
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    if (range.native) {
      try {
        await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet & { zoom: number }] });
      } catch {
        /* noop */
      }
    }
  };

  // ---- Pinch to zoom -------------------------------------------------
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const [pinching, setPinching] = useState(false);

  const pinchDistance = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return 0;
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.hypot(dx, dy);
  };

  // ---- Swipe to change look (Snapchat-style) -------------------------
  const swipeRef = useRef<{ x: number; y: number; id: number; done: boolean } | null>(null);

  const stepLook = (dir: 1 | -1) => {
    setLookIndex((i) => Math.min(LOOKS.length - 1, Math.max(0, i + dir)));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate?.(8); } catch { /* noop */ }
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      pinchRef.current = { dist: pinchDistance(), zoom };
      setPinching(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const start = pinchRef.current;
    if (!start || pointersRef.current.size < 2) return;
    const dist = pinchDistance();
    if (!dist || !start.dist) return;
    void applyZoom(start.zoom * (dist / start.dist));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
      setPinching(false);
    }
  };

  // ---- Swipe on the filter carousel itself ---------------------------
  // The carousel tracks the finger continuously (fractional index) and snaps
  // to the nearest look on release — Snapchat-style, no stepped jumps.
  const SPACING = 72;

  const onCarouselPointerDown = (e: React.PointerEvent) => {
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, done: false };
    lastStepRef.current = 0;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onCarouselPointerMove = (e: React.PointerEvent) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x;
    // Positive drag (finger right) moves toward earlier looks.
    let units = -dx / SPACING;
    const min = -lookIndex;
    const max = LOOKS.length - 1 - lookIndex;
    // Rubber-band past the ends.
    if (units < min) units = min + (units - min) * 0.25;
    if (units > max) units = max + (units - max) * 0.25;
    setDragOffset(units);

    const step = Math.round(units);
    if (step !== lastStepRef.current && step >= min && step <= max) {
      lastStepRef.current = step;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.(6); } catch { /* noop */ }
      }
    }
  };

  const onCarouselPointerUp = (e: React.PointerEvent) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.id !== e.pointerId) return;
    swipeRef.current = null;
    setDragging(false);
    const target = Math.min(
      LOOKS.length - 1,
      Math.max(0, lookIndex + Math.round(dragOffset)),
    );
    setDragOffset(0);
    setLookIndex(target);
  };

  const attachStream = (stream: MediaStream) => {
    streamRef.current = stream;
    setFrameReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    const settings = stream.getVideoTracks()[0]?.getSettings?.() as
      | (MediaTrackSettings & { facingMode?: string })
      | undefined;
    if (settings?.facingMode === "environment" || settings?.facingMode === "user") {
      setFacingMode(settings.facingMode);
    }
    detectZoom(stream);
    setReady(true);
  };


  const requestStream = async (mode: "environment" | "user") => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not supported on this device.");
      return null;
    }
    try {
      // Phone camera sensors are natively 4:3 (landscape orientation of the
      // sensor). Asking for a tall 9:16 or 3:4 portrait stream makes iOS
      // digitally crop into the sensor, which is what made our preview look
      // much more zoomed-in than Snapchat's. Snapchat requests the full
      // sensor frame and letterboxes/crops it in the UI. So we request the
      // widest full-sensor frame available and let CSS object-cover fit it
      // to the portrait screen — same framing, far less zoom.
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: mode },
        frameRate: { ideal: 30 },
        width: { ideal: 1920 },
        height: { ideal: 1440 },
        aspectRatio: { ideal: 4 / 3 },
      };

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      try {
        return await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });
      } catch (audioErr) {
        const audioName = (audioErr as DOMException)?.name;
        // If the mic is unavailable/denied, still let them record video.
        if (audioName === "NotAllowedError" || audioName === "NotFoundError" || audioName === "NotReadableError") {
          return await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        }
        throw audioErr;
      }
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError") setError("Camera permission denied. Enable it in your browser settings.");
      else if (name === "NotFoundError") setError("No camera found on this device.");
      else if (name === "NotReadableError") setError("Camera is being used by another app.");
      else setError("Camera unavailable.");
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = takeCheckInStream();
      if (existing && streamIsLive(existing)) {
        if (cancelled) {
          existing.getTracks().forEach((t) => t.stop());
          return;
        }
        attachStream(existing);
        return;
      }
      if (existing) existing.getTracks().forEach((t) => t.stop());
      const stream = await requestStream(facingMode);
      if (!stream) return;
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      attachStream(stream);
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = async () => {
    if (recording || switching) return;
    setSwitching(true);
    const next = facingMode === "environment" ? "user" : "environment";
    stopStream();
    setReady(false);
    const stream = await requestStream(next);
    if (stream) {
      setFacingMode(next);
      attachStream(stream);
    }
    setSwitching(false);
  };

  // Draws the live camera frames through a filtered canvas so the selected
  // look is permanently part of the saved video, not just the preview.
  const buildBakedStream = (src: MediaStream, css: string): { stream: MediaStream; cleanup: () => void } => {
    const noop = { stream: src, cleanup: () => {} };
    if (!css || css === "none") return noop;
    const video = videoRef.current;
    if (!video) return noop;
    const settings = src.getVideoTracks()[0]?.getSettings?.() ?? {};
    const w = Math.round(settings.width ?? video.videoWidth ?? 1280);
    const h = Math.round(settings.height ?? video.videoHeight ?? 960);
    if (!w || !h) return noop;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.captureStream !== "function" || !("filter" in ctx)) return noop;

    let stopped = false;
    let raf = 0;
    const draw = () => {
      if (stopped) return;
      try {
        ctx.filter = lookRef.current === "none" ? "none" : lookRef.current;
        ctx.drawImage(video, 0, 0, w, h);
      } catch {
        /* frame not ready */
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    let out: MediaStream;
    try {
      out = canvas.captureStream(30);
    } catch {
      stopped = true;
      cancelAnimationFrame(raf);
      return noop;
    }
    src.getAudioTracks().forEach((t) => out.addTrack(t));

    return {
      stream: out,
      cleanup: () => {
        stopped = true;
        cancelAnimationFrame(raf);
        out.getVideoTracks().forEach((t) => t.stop());
      },
    };
  };

  const tick = () => {
    const secs = (Date.now() - startedAtRef.current) / 1000;
    setElapsed(secs);
    if (secs < MAX_SECS) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    setError(null);

    let stream = streamRef.current;
    if (!streamIsLive(stream)) {
      stopStream();
      stream = await requestStream(facingMode);
      if (!stream) return;
      attachStream(stream);
    }

    if (!stream) {
      setError("Camera unavailable.");
      return;
    }

    // Bake the selected look into the recording by drawing the camera frames
    // through a filtered canvas and recording that canvas instead.
    const baked = buildBakedStream(stream, lookRef.current);
    bakeCleanupRef.current = baked.cleanup;

    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(baked.stream, mimeType ? { mimeType } : undefined);
    } catch {
      baked.cleanup();
      bakeCleanupRef.current = null;
      setError("Recording isn't supported on this browser.");
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      bakeCleanupRef.current?.();
      bakeCleanupRef.current = null;
      if (blob.size > 0) setCheckInPhoto(blob);
      stopStream();
      navigate({ to: "/check-in/notes" });
    };
    recorderRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsed(0);
    recordingRef.current = true;
    setRecording(true);
    // Ask for regular fragments instead of leaving the whole recording in
    // Safari's encoder buffer. Some iOS versions otherwise finalize only the
    // first ~15-second MP4 fragment even though the recording UI reaches 60s.
    // MediaRecorder guarantees that all fragments from one recording form a
    // playable Blob when concatenated in order.
    rec.start(1000);
    rafRef.current = requestAnimationFrame(tick);
    autoStopRef.current = window.setTimeout(() => {
      stopRecording();
    }, MAX_SECS * 1000);
  };

  const stopRecording = () => {
    if (autoStopRef.current) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    recordingRef.current = false;
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.requestData();
        rec.stop();
      } catch { /* noop */ }
    }
  };

  const onTapButton = () => {
    if (!recordingRef.current) {
      startRecording();
      return;
    }
    if (elapsed >= MIN_SECS) stopRecording();
  };

  const cancel = () => {
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      } catch { /* noop */ }
    }
    bakeCleanupRef.current?.();
    bakeCleanupRef.current = null;
    stopStream();
    navigate({ to: "/check-in" });
  };

  const progress = Math.min(1, elapsed / MAX_SECS);
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = C * progress;

  const timerLabel = (() => {
    const s = Math.floor(elapsed);
    return `0:${String(s).padStart(2, "0")}`;
  })();

  const canStop = recording && elapsed >= MIN_SECS;

  return (
    <div
      className="fixed inset-0 text-white overflow-hidden"
      style={{
        fontFamily: JAKARTA,
        background: "linear-gradient(180deg, #0D0D0D 0%, #1A1A2E 100%)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={() => setFrameReady(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          // Keep the preview hidden until the stream's frame size is known
          // so the user never sees the initial resize/settling animation.
          opacity: ready && frameReady ? 1 : 0,
          // Mirror the front camera preview like Snapchat / Instagram so
          // the user sees themselves the way they see themselves in a
          // mirror. Rear camera is never mirrored. When the platform
          // doesn't support native zoom, we fall back to a CSS scale so
          // the pinch/preset zoom still feels responsive.
          transform: `${facingMode === "user" ? "scaleX(-1) " : ""}${
            !zoomRange.native && zoom !== 1 ? `scale(${zoom})` : ""
          }`.trim() || "none",
          transformOrigin: "center center",
          filter: look.css,
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.55) 100%)" }} />

      {/* Pinch-to-zoom surface (sits under the controls) */}
      <div
        className="absolute inset-0"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      />

      {(!ready || !frameReady) && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 opacity-70">
            <div className="h-14 w-14 rounded-2xl border border-white/30 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <p className="text-[14px]">Camera preview</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <p className="text-center text-[15px] text-white/80 max-w-[280px]">{error}</p>
        </div>
      )}

      {/* Top controls */}
      <div className="absolute top-0 inset-x-0 pt-safe-6 px-4 flex items-center justify-between">
        <button
          onClick={cancel}
          className="h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
          aria-label="Cancel"
        >
          <X size={20} />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={switchCamera}
            disabled={recording || switching}
            className="h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center disabled:opacity-40"
            aria-label="Switch camera"
          >
            <SwitchCamera size={20} />
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            className="h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
            aria-label="Help"
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Bottom recording UI */}
      <div className="absolute inset-x-0 bottom-0 pb-[calc(env(safe-area-inset-bottom)+32px)] flex flex-col items-center gap-3">
        {recording && canStop && (
          <div
            className="px-4 py-2 rounded-full text-white text-[13px] font-semibold"
            style={{ background: GREEN }}
          >
            ✓ Min reached — tap to stop
          </div>
        )}

        {recording && (
          <div className="px-3 py-1.5 rounded-full bg-black/60 text-white text-[14px] font-semibold tabular-nums">
            {timerLabel}
          </div>
        )}

        {/* Pinch-to-zoom readout */}
        {ready && (pinching || Math.abs(zoom - zoomRange.min) > 0.01) && (
          <div
            className="px-3 py-1 rounded-full bg-black/55 backdrop-blur text-[12px] font-bold tabular-nums transition-opacity"
            style={{ color: "#FBBF24" }}
          >
            {zoom.toFixed(1)}
            <span style={{ fontSize: 9, marginLeft: 1 }}>×</span>
          </div>
        )}

        {/* Lens carousel: record button in the centre, looks slide past it */}
        <div
          className="relative w-full h-28 flex items-center justify-center"
          style={{ touchAction: "pan-y" }}
          onPointerDown={onCarouselPointerDown}
          onPointerMove={onCarouselPointerMove}
          onPointerUp={onCarouselPointerUp}
          onPointerCancel={onCarouselPointerUp}
          onPointerLeave={onCarouselPointerUp}
        >
          {ready && !error && !recording && LOOKS.map((l, i) => {
            const offset = i - lookIndex;
            if (offset === 0) return null;
            const abs = Math.abs(offset);
            if (abs > 3) return null;
            const size = abs === 1 ? 54 : abs === 2 ? 46 : 38;
            const x = offset * 72 + (offset > 0 ? 14 : -14);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLookIndex(i)}
                aria-label={l.label}
                className="absolute rounded-full touch-manipulation"
                style={{
                  height: size,
                  width: size,
                  transform: `translateX(${x}px)`,
                  background: l.swatch,
                  border: "2px solid rgba(255,255,255,0.75)",
                  opacity: abs === 1 ? 0.95 : abs === 2 ? 0.7 : 0.45,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                  transition: "transform 180ms ease, opacity 180ms ease, height 180ms ease, width 180ms ease",
                }}
              />
            );
          })}


          <div className="relative h-24 w-24 flex items-center justify-center">
          {/* Progress ring */}
          <svg className="absolute inset-0 pointer-events-none" width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r={R} stroke="rgba(255,255,255,0.25)" strokeWidth="4" fill="none" />
            {recording && (
              <circle
                cx="48"
                cy="48"
                r={R}
                stroke={PURPLE}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C - dash}`}
                transform="rotate(-90 48 48)"
              />
            )}
          </svg>
          <button
            type="button"
            onClick={onTapButton}
            disabled={recording && !canStop}
            aria-label={recording ? (canStop ? "Stop recording" : "Recording") : "Start recording"}
            className="relative z-10 h-20 w-20 rounded-full flex items-center justify-center transition-colors touch-manipulation"
            style={{
              background: recording ? RED : "#FFFFFF",
              border: "2px solid rgba(255,255,255,0.9)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
              opacity: recording && !canStop ? 0.9 : 1,
              cursor: recording && !canStop ? "not-allowed" : "pointer",
            }}
          />
          </div>
        </div>

        {/* Active look name (below the carousel) */}
        {ready && !error && !recording && (
          <div
            className="px-3.5 py-1.5 rounded-full text-[13px] font-bold tracking-wide whitespace-nowrap"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
          >
            {look.label}
          </div>
        )}


      </div>

      <HowToRecordSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onRecord={() => setHelpOpen(false)}
      />
    </div>
  );
}
