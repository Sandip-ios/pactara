import { useEffect, useRef, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Exercise demo: start and finish pictures cross-fade every 1.2s; background from the start image's corner pixel. */
export function useDemoCycle(imageStart: string | null | undefined, imagePeak: string | null | undefined, defaultBg: string) {
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [bg, setBg] = useState<string>(defaultBg);
  const startRef = useRef<HTMLImageElement | null>(null);
  const hasTwo = !!imageStart && !!imagePeak;
  const playing = hasTwo && !paused && !reduced;

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setShowTop((v) => !v), 1200);
    return () => window.clearInterval(t);
  }, [playing]);
  useEffect(() => {
    if (reduced) setShowTop(false);
  }, [reduced]);

  const sample = () => {
    const img = startRef.current;
    if (!img || !img.naturalWidth) return;
    try {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      setBg(`rgb(${r}, ${g}, ${b})`);
    } catch {
      /* keep the default tint */
    }
  };
  const fade = reduced ? "none" : "opacity 200ms ease-in-out";
  return { reduced, paused, setPaused, showTop, bg, startRef, sample, hasTwo, playing, fade };
}
