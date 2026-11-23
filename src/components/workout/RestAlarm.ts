import { isNative } from "@/lib/native";

/** Rest timer end: a short beep and a haptic buzz. */
let ctx: AudioContext | null = null;

/** Call from a tap so iOS lets the beep play later. */
export function primeRestSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* no audio */
  }
}

export async function restEnded() {
  try {
    if (ctx) {
      const now = ctx.currentTime;
      for (const at of [0, 0.22]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, now + at);
        g.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.16);
        o.connect(g).connect(ctx.destination);
        o.start(now + at);
        o.stop(now + at + 0.18);
      }
    }
  } catch {
    /* ignore */
  }
  if (isNative()) {
    try {
      const { Haptics, NotificationType } = await import("@capacitor/haptics");
      await Haptics.notification({ type: NotificationType.Success });
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    /* ignore */
  }
}
