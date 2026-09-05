import { useEffect, useRef } from "react";

type Props = {
  /** Called when the animation is finished. */
  onDone?: () => void;
  durationMs?: number;
};

const COLORS = ["#7C3AED", "#A78BFA", "#22C55E", "#FACC15", "#F472B6", "#38BDF8"];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
};

/**
 * Lightweight canvas confetti. Purely decorative, pointer-events none.
 */
export function ConfettiBurst({ onDone, durationMs = 2600 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      doneRef.current?.();
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const pieces: Piece[] = [];
    const spawn = (originX: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const speed = 6 + Math.random() * 9;
        pieces.push({
          x: originX,
          y: h * 0.62,
          vx: Math.cos(angle) * speed * (0.6 + Math.random() * 0.8),
          vy: Math.sin(angle) * speed,
          size: 5 + Math.random() * 6,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.3,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    };
    spawn(w * 0.25, 55);
    spawn(w * 0.75, 55);
    spawn(w * 0.5, 40);

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, h);
      for (const p of pieces) {
        p.vy += 0.28;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        const fade = Math.max(0, 1 - Math.max(0, elapsed - durationMs * 0.55) / (durationMs * 0.45));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        doneRef.current?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[120]"
    />
  );
}

export default ConfettiBurst;
