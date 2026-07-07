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
const MAX_SECS = 15;

export const Route = createFileRoute("/_authenticated/check-in/camera")({
  component: VideoRecordScreen,
});

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
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
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [switching, setSwitching] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomOptions, setZoomOptions] = useState<number[]>([1]);
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
    // Front cameras often report zoom capability with min=max=1, which would
    // hide the zoom pill entirely — fall back to CSS scale in that case so
    // the front camera gets the same presets as the rear.
    const useNative = Boolean(nativeZoom && nativeZoom.max > nativeZoom.min);
    const min = useNative ? nativeZoom!.min : 1;
    const max = useNative ? nativeZoom!.max : 4; // CSS-scale fallback caps at 4x
    const presets = [0.5, 1, 2, 4, 8].filter((v) => v >= min && v <= max);
    if (!presets.includes(1) && min <= 1 && 1 <= max) presets.unshift(1);
    setZoomRange({ min, max, native: useNative });
    setZoomOptions(presets.length > 1 ? presets : [1, 2, 4]);
    setZoom(1);
  };

  const applyZoom = async (value: number) => {
    const stream = streamRef.current;
    setZoom(value);
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    if (zoomRange.native) {
      try {
        await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet & { zoom: number }] });
      } catch {
        /* noop */
      }
    }
  };

  const attachStream = (stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
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
      // Request a portrait HD stream at the device's natural aspect. Asking
      // for explicit dimensions + 9:16 aspect prevents the browser from
      // handing back a low-res/landscape stream that then gets stretched by
      // object-cover — which is what makes faces look wide/distorted.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      return stream;
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

    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
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
      if (blob.size > 0) setCheckInPhoto(blob);
      stopStream();
      navigate({ to: "/check-in/notes" });
    };
    recorderRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsed(0);
    recordingRef.current = true;
    setRecording(true);
    rec.start();
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
      try { rec.stop(); } catch { /* noop */ }
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
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          // Mirror the front camera preview like Snapchat / Instagram so
          // the user sees themselves the way they see themselves in a
          // mirror. Rear camera is never mirrored. When the platform
          // doesn't support native zoom, we fall back to a CSS scale so
          // the pinch/preset zoom still feels responsive.
          transform: `${facingMode === "user" ? "scaleX(-1) " : ""}${
            !zoomRange.native && zoom !== 1 ? `scale(${zoom})` : ""
          }`.trim() || "none",
          transformOrigin: "center center",
          transition: "transform 180ms ease-out",
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.55) 100%)" }} />

      {!ready && !error && (
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
      <div className="absolute top-0 inset-x-0 pt-6 px-4 flex items-center justify-between">
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

        {/* Zoom presets, iPhone-style */}
        {ready && zoomOptions.length > 1 && (
          <div className="flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur px-2 py-1.5">
            {zoomOptions.map((v) => {
              const active = Math.abs(zoom - v) < 0.01;
              const label = v < 1 ? `.${Math.round(v * 10)}` : `${v}`;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => applyZoom(v)}
                  className="flex items-center justify-center rounded-full transition-all touch-manipulation tabular-nums"
                  style={{
                    height: active ? 34 : 30,
                    minWidth: active ? 34 : 30,
                    padding: "0 6px",
                    background: active ? "rgba(255,255,255,0.14)" : "transparent",
                    color: active ? "#FBBF24" : "#FFFFFF",
                    fontSize: active ? 12 : 11,
                    fontWeight: 700,
                  }}
                  aria-label={`Zoom ${v}x`}
                  aria-pressed={active}
                >
                  {label}
                  <span style={{ fontSize: 9, marginLeft: 1 }}>×</span>
                </button>
              );
            })}
          </div>
        )}



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

        {!recording && (
          <p className="text-[13px] text-white/70">Tap to start recording</p>
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
