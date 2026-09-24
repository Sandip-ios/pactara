// TEMPORARY debug-only route: renders the partner waiting screen markup so the
// layout (including the new "Keep using Pactara" button) can be screenshotted
// without a live partner search. Delete this file after verifying.
import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/debug-partner")({
  component: DebugPartner,
});

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const MUTED = "#6B6660";

const ORBITERS = [
  { radius: 104, duration: 9, delay: 0, size: 12, color: "#7C3AED" },
  { radius: 104, duration: 9, delay: -3, size: 10, color: "#A78BFA" },
  { radius: 104, duration: 9, delay: -6, size: 9, color: "#DDD6FE" },
  { radius: 76, duration: 6.5, delay: 0, size: 8, color: "#C4B5FD" },
  { radius: 76, duration: 6.5, delay: -3.25, size: 7, color: "#8B5CF6" },
];

function DebugPartner() {
  return (
    <div
      className="h-[100dvh] w-full flex flex-col px-6 pb-8 overflow-hidden bg-background text-foreground"
      style={{ paddingTop: 32 }}
    >
      <div className="flex items-center" />
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="relative h-64 w-64 flex items-center justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden
              className="absolute h-28 w-28 rounded-full border-2 border-pactara-purple/35"
              style={{ animation: `partner-radar 3s ease-out ${i}s infinite` }}
            />
          ))}
          <span aria-hidden className="absolute h-40 w-40 rounded-full bg-pactara-purple/10 blur-2xl" />
          {ORBITERS.map((o, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute"
              style={
                {
                  "--orbit-r": `${o.radius}px`,
                  animation: `partner-orbit ${o.duration}s linear ${o.delay}s infinite`,
                } as React.CSSProperties
              }
            >
              <span
                className="block rounded-full shadow-md"
                style={{ width: o.size, height: o.size, background: o.color }}
              />
            </span>
          ))}
          <span
            className="relative h-24 w-24 rounded-full flex items-center justify-center shadow-partner-icon"
            style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
          >
            <Handshake size={38} color="white" strokeWidth={2} />
          </span>
        </div>
        <h1 className="mt-8 max-w-[320px] text-[28px] font-bold tracking-tight leading-tight">
          Finding your accountability partner
        </h1>
        <p className="mt-3 max-w-[280px] text-[16px]" style={{ color: MUTED }}>
          We're looking for someone who's ready to show up with you.
        </p>
      </div>

      <div className="pt-5 flex flex-col items-center gap-3">
        <Button
          type="button"
          className="h-14 w-full rounded-2xl bg-pactara-purple text-[16px] font-semibold text-pactara-purple-foreground shadow-partner-cta transition-[transform,background-color,opacity] hover:bg-pactara-purple-deep active:scale-[0.98] disabled:opacity-60"
        >
          Keep using Pactara
        </Button>
        <button className="text-[15px] font-medium py-1" style={{ color: MUTED }}>
          Invite someone instead
        </button>
      </div>
    </div>
  );
}
