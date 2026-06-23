import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { postMorningRitual } from "@/lib/daily-posts.functions";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";

export const MOODS = [
  { id: "crushed", emoji: "🚀", label: "Crushed it", sub: "Absolutely nailed it", color: "#16A34A", bg: "#E8F7EE", ring: "#16A34A" },
  { id: "showed", emoji: "💪", label: "Showed up", sub: "Showed up and did the work", color: PURPLE, bg: "#EFE9FB", ring: PURPLE },
  { id: "struggled", emoji: "😤", label: "Struggled", sub: "Tough day, but still here", color: "#F59E0B", bg: "#FDF1DD", ring: "#F59E0B" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

export const Route = createFileRoute("/_authenticated/check-in/")({
  component: CheckInRouter,
});

function CheckInRouter() {
  // Capture the current local hour on mount so the view doesn't flip during a session.
  const [isMorning] = useState(() => new Date().getHours() < 12);
  const [ritualDone, setRitualDone] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("morning-ritual-done") === "1",
  );
  return isMorning && !ritualDone ? <MorningRitual onPosted={() => setRitualDone(true)} /> : <CheckInMood />;
}

function MorningRitual({ onPosted }: { onPosted: () => void }) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [count, setCount] = useState(0);
  const MAX = 280;

  const postRitualFn = useServerFn(postMorningRitual);
  const mutation = useMutation({
    mutationFn: postRitualFn,
    onSuccess: () => {
      sessionStorage.setItem("morning-ritual-done", "1");
      queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      onPosted();
    },
  });

  const onInput = () => {
    const v = textareaRef.current?.value ?? "";
    setCount(v.length);
  };

  const onPost = () => {
    const text = textareaRef.current?.value.trim();
    if (!text) return;
    mutation.mutate({ data: { text } });
  };

  const canPost = count > 0 && count <= MAX && !mutation.isPending;

  return (
    <div
      className="min-h-[100dvh] w-full pb-32"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >

      <div className="px-6 pt-2">
        <div className="text-[13px] font-bold" style={{ color: PURPLE }}>
          It's time for your morning ritual
        </div>
        <h1 className="mt-2 text-[34px] font-black leading-tight tracking-tight">
          What are you doing today?
        </h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          Every morning, share your plan. Your group holds you to it.
        </p>
      </div>

      <div className="px-4 mt-6">
        <textarea
          ref={textareaRef}
          defaultValue=""
          onInput={onInput}
          maxLength={MAX}
          placeholder="Run 5K before work, hit the gym at 6pm…"
          className="w-full min-h-[180px] rounded-2xl bg-white p-4 text-[16px] outline-none resize-none placeholder:text-neutral-400 ring-1 ring-neutral-200 focus:ring-2 focus:ring-[#7C3AED]"
        />
        <div className="mt-2 pr-1 text-right text-[13px] text-neutral-400">
          {count}/{MAX}
        </div>
      </div>

      <div
        className="fixed inset-x-0 px-4 z-40"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
      >
        <button
          onClick={onPost}
          disabled={!canPost}
          className="w-full rounded-2xl py-4 text-white text-[16px] font-semibold flex items-center justify-center gap-2 disabled:text-neutral-500"
          style={{ background: canPost ? PURPLE : "#D9D6D1" }}
        >
          {mutation.isPending ? "Posting…" : (<>Post to group <ArrowRight size={18} /></>)}
        </button>
      </div>
    </div>
  );
}

function CheckInMood() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<MoodId | null>(null);

  const onContinue = () => {
    if (!selected) return;
    sessionStorage.setItem("checkin-mood", selected);
    sessionStorage.removeItem("checkin-photo");
    navigate({ to: "/check-in/camera" });
  };

  return (
    <div className="min-h-[100dvh] w-full pb-40" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="px-6 pt-10">
        <h1 className="text-[34px] font-black leading-tight tracking-tight">Let's check you in</h1>
        <p className="text-neutral-500 text-[15px] mt-1">How did today go?</p>
      </div>

      <div className="px-4 mt-8 space-y-3">
        {MOODS.map((m) => {
          const active = selected === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className="w-full rounded-2xl p-4 flex items-center gap-4 text-left transition"
              style={{
                background: active ? m.bg : "#FFFFFF",
                boxShadow: active ? `0 0 0 2px ${m.ring}` : "none",
              }}
            >
              <span className="text-[32px] leading-none">{m.emoji}</span>
              <span className="flex-1">
                <span className="block text-[18px] font-bold" style={{ color: active ? m.color : "#0A0A0A" }}>
                  {m.label}
                </span>
                <span className="block text-[14px] text-neutral-500">{m.sub}</span>
              </span>
              {active && (
                <span className="h-7 w-7 rounded-full flex items-center justify-center text-white" style={{ background: m.color }}>
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="fixed inset-x-0 px-4 z-50" style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}>
        <button
          onClick={onContinue}
          disabled={!selected}
          className="w-full rounded-2xl py-4 text-white text-[16px] font-semibold flex items-center justify-center gap-2 disabled:text-neutral-500"
          style={{
            background: selected ? PURPLE : "#D9D6D1",
            boxShadow: "none",
          }}
        >
          Continue <ArrowRight size={18} />
        </button>
      </div>

    </div>
  );
}

