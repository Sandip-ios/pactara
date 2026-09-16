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
  let repairTimer: number | null = null;

  const rangeEnd = (ranges: TimeRanges) => {
    try {
      return ranges.length ? ranges.end(ranges.length - 1) : 0;
    } catch {
      return 0;
    }
  };

  const playableEnd = () => Math.max(
    Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0,
    rangeEnd(video.buffered),
    rangeEnd(video.seekable),
  );

  const needsRepair = () =>
    !Number.isFinite(video.duration)
    || video.duration <= 0
    // Older Pactara recordings can contain the full clip while their MP4
    // header incorrectly advertises one 15-second fragment.
    || (video.duration >= 14.5 && video.duration <= 15.5);

  const repairDuration = () => {
    if (repairing || !needsRepair()) return;
    repairing = true;
    const resumeAt = video.currentTime;
    const shouldResume = !video.paused;
    const finish = () => {
      if (!repairing) return;
      repairing = false;
      video.removeEventListener("durationchange", onDurationChange);
      if (repairTimer !== null) window.clearTimeout(repairTimer);
      repairTimer = null;
      try {
        video.currentTime = resumeAt;
        if (shouldResume) void video.play().catch(() => {});
      } catch {
        /* noop */
      }
    };
    const onDurationChange = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      finish();
    };
    video.addEventListener("durationchange", onDurationChange);
    try {
      // Seeking far past the end makes the browser scan the file and report
      // the real duration.
      video.currentTime = 1e7;
      repairTimer = window.setTimeout(finish, 250);
    } catch {
      finish();
    }
  };

  const onLoadedMetadata = () => repairDuration();

  const onEnded = () => {
    // If there is still buffered media beyond where we stopped, the reported
    // duration was wrong — keep going instead of ending/looping.
    const end = playableEnd();
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
    if (repairTimer !== null) window.clearTimeout(repairTimer);
    video.removeEventListener("loadedmetadata", onLoadedMetadata);
    video.removeEventListener("ended", onEnded);
  };
}

/** Best-known duration, including fragmented MP4 seekable/buffered ranges. */
export function effectiveDuration(video: HTMLVideoElement): number {
  let buffered = 0;
  let seekable = 0;
  try {
    buffered = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
    seekable = video.seekable.length ? video.seekable.end(video.seekable.length - 1) : 0;
  } catch {
    /* noop */
  }
  const reported = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  return Math.max(reported, buffered, seekable);
}
