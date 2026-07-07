import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { X, HelpCircle } from "lucide-react";
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

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const streamIsLive = (stream: MediaStream | null) =>
    Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live"));

  const attachStream = (stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    setReady(true);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera not supported on this device.");
          return;
        }
        const stream = takeCheckInStream();
        if (!stream) return;
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!streamIsLive(stream)) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        attachStream(stream);
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError") setError("Camera permission denied. Enable it in your browser settings.");
        else setError("Camera unavailable.");
      }
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
  }, []);

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
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera not supported on this device.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        attachStream(stream);
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError") setError("Camera permission denied. Enable it in your browser settings.");
        else setError("Camera unavailable.");
        return;
      }
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
    setRecording(true);
    rec.start();
    rafRef.current = requestAnimationFrame(tick);
    autoStopRef.current = window.setTimeout(() => {
      stopRecording();
    }, MAX_SECS * 1000);
  };

  const stopRecording = () => {
    if (!recording) return;
    if (autoStopRef.current) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* noop */ }
    }
  };

  const onTapButton = () => {
    if (!recording) {
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
        className="absolute inset-0 w-full h-full object-cover opacity-70"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(13,13,13,0.35) 0%, rgba(26,26,46,0.55) 100%)" }} />

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
        <button
          onClick={() => setHelpOpen(true)}
          className="h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
          aria-label="Help"
        >
          <HelpCircle size={20} />
        </button>
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

        <div className="relative h-24 w-24 flex items-center justify-center">
          {/* Progress ring */}
          <svg className="absolute inset-0" width="96" height="96" viewBox="0 0 96 96">
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
            onClick={onTapButton}
            disabled={recording && !canStop}
            aria-label={recording ? (canStop ? "Stop recording" : "Recording") : "Start recording"}
            className="h-20 w-20 rounded-full flex items-center justify-center transition-colors"
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
