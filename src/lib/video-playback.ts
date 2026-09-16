/**
 * Videos recorded in-app with MediaRecorder often ship a bogus/short duration
 * in their header (Safari's fragmented MP4 and Chrome's WebM both do this).
 * The <video> element then believes the clip is only a few seconds long and
 * fires `ended` early — with loop enabled it just restarts, so a 60s check-in
 * looks like it only plays the first ~15 seconds.
 *
 * This helper repairs playback at runtime:
 *  - forces the browser to recompute duration when it is missing/infinite
 *  - keeps playing past a premature `ended` while more media is buffered
 */
export function attachVideoDurationFix(video: HTMLVideoElement): () => void {
  let repairing = false;

  const bufferedEnd = () => {
    try {
      return video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
    } catch {
      return 0;
    }
  };

  const needsRepair = () => !Number.isFinite(video.duration) || video.duration <= 0;

  const repairDuration = () => {
    if (repairing || !needsRepair()) return;
    repairing = true;
    const onDurationChange = () => {
      if (!Number.isFinite(video.duration)) return;
      video.removeEventListener("durationchange", onDurationChange);
      repairing = false;
      try {
        video.currentTime = 0;
      } catch {
        /* noop */
      }
    };
    video.addEventListener("durationchange", onDurationChange);
    try {
      // Seeking far past the end makes the browser scan the file and report
      // the real duration.
      video.currentTime = 1e7;
    } catch {
      repairing = false;
      video.removeEventListener("durationchange", onDurationChange);
    }
  };

  const onLoadedMetadata = () => repairDuration();

  const onEnded = () => {
    // If there is still buffered media beyond where we stopped, the reported
    // duration was wrong — keep going instead of ending/looping.
    const end = bufferedEnd();
    if (end > video.currentTime + 0.25) {
      try {
        video.currentTime = Math.min(end - 0.05, video.currentTime + 0.05);
        void video.play().catch(() => {});
      } catch {
        /* noop */
      }
    }
  };

  video.addEventListener("loadedmetadata", onLoadedMetadata);
  video.addEventListener("ended", onEnded);
  if (video.readyState >= 1) repairDuration();

  return () => {
    video.removeEventListener("loadedmetadata", onLoadedMetadata);
    video.removeEventListener("ended", onEnded);
  };
}

/** Best-known duration for a video, falling back to what is buffered. */
export function effectiveDuration(video: HTMLVideoElement): number {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  try {
    return video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
  } catch {
    return 0;
  }
}
