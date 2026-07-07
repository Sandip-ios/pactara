import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowRight, Check, List, ListOrdered, CheckSquare } from "lucide-react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { postMorningRitual, getTodayRitualStatus } from "@/lib/daily-posts.functions";
import { clearCheckInPhoto } from "@/lib/checkin-photo-store";
import HowToRecordSheet from "@/components/HowToRecordSheet";

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

function ToolbarBtn({
  children,
  onInsert,
  label,
}: {
  children: React.ReactNode;
  onInsert: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onInsert();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        onInsert();
      }}
      className="h-9 w-9 rounded-lg flex items-center justify-center text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200"
    >
      {children}
    </button>
  );
}

function insertLinePrefix(el: HTMLTextAreaElement | null, prefix: string, onInput: () => void) {
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const value = el.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const atLineStart = start === lineStart;
  const needsNewline = !atLineStart && value[start - 1] !== "\n";
  const insertion = (needsNewline ? "\n" : "") + prefix;
  el.value = value.slice(0, start) + insertion + value.slice(end);
  const pos = start + insertion.length;
  el.focus();
  el.setSelectionRange(pos, pos);
  onInput();
}

function insertNumberedLine(el: HTMLTextAreaElement | null, onInput: () => void) {
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const value = el.value;
  // Find previous number on prior lines
  const before = value.slice(0, start);
  const lines = before.split("\n");
  let next = 1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^(\d+)\.\s/);
    if (m) {
      next = parseInt(m[1], 10) + 1;
      break;
    }
    if (lines[i].trim() === "") continue;
    break;
  }
  insertLinePrefix(el, `${next}. `, onInput);
}


function handleListBeforeInput(
  e: React.FormEvent<HTMLTextAreaElement>,
  onInput: () => void,
) {
  const native = e.nativeEvent as InputEvent;
  const inputType = native.inputType;
  if (inputType !== "insertLineBreak" && inputType !== "insertParagraph") return;
  const el = e.currentTarget;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? start;
  if (start !== end) return;
  const value = el.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", start);
  const currentLine = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);

  const bullet = currentLine.match(/^(•\s)(.*)$/);
  const check = currentLine.match(/^(☐\s)(.*)$/);
  const num = currentLine.match(/^(\d+)\.\s(.*)$/);
  const match = bullet || check || num;
  if (!match) return;

  const rest = match[2];
  e.preventDefault();

  if (rest.trim() === "") {
    el.value = value.slice(0, lineStart) + value.slice(lineEnd === -1 ? value.length : lineEnd);
    el.setSelectionRange(lineStart, lineStart);
    onInput();
    return;
  }

  let prefix = "";
  if (bullet) prefix = "• ";
  else if (check) prefix = "☐ ";
  else if (num) prefix = `${parseInt(num[1], 10) + 1}. `;

  const insertion = "\n" + prefix;
  el.value = value.slice(0, start) + insertion + value.slice(end);
  const pos = start + insertion.length;
  el.setSelectionRange(pos, pos);
  onInput();
}

function CheckInRouter() {
  const getStatus = useServerFn(getTodayRitualStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["today-ritual-status"],
    queryFn: () => getStatus(),
    staleTime: 60_000,
  });
  const [localPosted, setLocalPosted] = useState(false);

  if (isLoading || !data) {
    return <div className="min-h-[100dvh] w-full" style={{ background: BG }} />;
  }

  const showRitual = data.beforeNoon && !data.posted && !localPosted;
  return showRitual ? <MorningRitual onPosted={() => setLocalPosted(true)} /> : <CheckInMood />;
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
      queryClient.invalidateQueries({ queryKey: ["today-ritual-status"] });
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

      <div className="px-6 pt-8">
        <div className="text-[13px] font-bold" style={{ color: PURPLE }}>
          It's time for your morning ritual
        </div>
        <h1 className="mt-2 text-[34px] font-black leading-tight tracking-tight">
          What are you committing to today?
        </h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          Make it specific. Tonight, you'll prove you did it.
        </p>
      </div>


      <div className="px-4 mt-6">
        <div className="relative rounded-2xl bg-white ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-[#7C3AED]">
          <textarea
            ref={textareaRef}
            defaultValue=""
            onInput={onInput}
            onBeforeInput={(e) => handleListBeforeInput(e, onInput)}
            maxLength={MAX}
            placeholder="Run 5K before work, hit the gym at 6pm…"
            className="w-full min-h-[180px] rounded-t-2xl bg-transparent p-4 text-[16px] outline-none resize-none placeholder:text-neutral-400"
          />
          <div className="flex items-center gap-1 border-t border-neutral-100 px-2 py-2">
            <ToolbarBtn label="Bulleted list" onInsert={() => insertLinePrefix(textareaRef.current, "• ", onInput)}>
              <List size={18} />
            </ToolbarBtn>
            <ToolbarBtn label="Numbered list" onInsert={() => insertNumberedLine(textareaRef.current, onInput)}>
              <ListOrdered size={18} />
            </ToolbarBtn>
            <ToolbarBtn label="Checkbox" onInsert={() => insertLinePrefix(textareaRef.current, "☐ ", onInput)}>
              <CheckSquare size={18} />
            </ToolbarBtn>
          </div>
        </div>
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
    clearCheckInPhoto();
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

