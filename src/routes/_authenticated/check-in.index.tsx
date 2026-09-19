import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, List, ListOrdered, CheckSquare, ChevronDown } from "lucide-react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { postMorningRitual, getTodayRitualStatus } from "@/lib/daily-posts.functions";
import { listMyGroups } from "@/lib/groups.functions";
import { clearCheckInPhoto } from "@/lib/checkin-photo-store";
import { clearCheckInStream } from "@/lib/checkin-stream-store";

import GroupSwitcherSheet, { type SwitcherGroup } from "@/components/GroupSwitcherSheet";

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
      tabIndex={-1}
      onPointerDown={(e) => {
        e.preventDefault();
        onInsert();
      }}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
      onTouchEnd={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
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

function useSelectedGroup() {
  const { data: groupsData } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
  });
  const groups = groupsData?.groups ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("active-group-id");
  });
  useEffect(() => {
    if (groups.length === 0) return;
    const exists = selectedGroupId && groups.some((g) => g.id === selectedGroupId);
    if (!exists) setSelectedGroupId(groups[0].id as string);
  }, [groups, selectedGroupId]);
  useEffect(() => {
    if (selectedGroupId && typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", selectedGroupId);
    }
  }, [selectedGroupId]);
  return { groups, selectedGroupId, setSelectedGroupId };
}

function GroupSwitcher({
  groups,
  selectedGroupId,
  onSelect,
}: {
  groups: SwitcherGroup[];
  selectedGroupId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = groups.find((g) => g.id === selectedGroupId) ?? groups[0];
  if (!active) return null;
  if (groups.length < 2) {
    return (
      <div className="px-6 pt-safe-6">
        <div className="flex items-center gap-1.5 font-bold text-neutral-900">
          {active.emoji && <span>{active.emoji}</span>}
          <span className="truncate max-w-[220px]">{active.name}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="px-6 pt-safe-6 relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 font-bold text-neutral-900 active:opacity-70"
      >
        {active.emoji && <span>{active.emoji}</span>}
        <span className="truncate max-w-[200px]">{active.name}</span>
        <ChevronDown size={16} className="text-neutral-500" />
      </button>
      <GroupSwitcherSheet
        open={open}
        onClose={() => setOpen(false)}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelect={onSelect}
      />
    </div>
  );
}

function CheckInRouter() {
  const { groups, selectedGroupId, setSelectedGroupId } = useSelectedGroup();
  const getStatus = useServerFn(getTodayRitualStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["today-ritual-status", selectedGroupId],
    queryFn: () => getStatus({ data: { groupId: selectedGroupId } }),
    staleTime: 60_000,
  });
  const [localPosted, setLocalPosted] = useState<string | null>(null);

  if (isLoading || !data) {
    return <div className="min-h-[100dvh] w-full" style={{ background: BG }} />;
  }

  const postedForThisGroup = localPosted && localPosted === selectedGroupId;
  const showRitual = data.beforeNoon && !data.posted && !postedForThisGroup;
  const switcher = (
    <GroupSwitcher
      groups={groups}
      selectedGroupId={selectedGroupId}
      onSelect={setSelectedGroupId}
    />
  );
  return showRitual ? (
    <MorningRitual
      groupId={selectedGroupId}
      groups={groups}
      switcher={switcher}
      onPosted={() => setLocalPosted(selectedGroupId)}
    />
  ) : (
    <CheckInLaunch />
  );
}

export function AllGroupsToggle({
  count,
  value,
  onChange,
  label,
}: {
  count: number;
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  if (count < 2) return null;
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-neutral-200 px-4 py-3 text-left"
    >
      <span className="text-[14px] font-medium text-neutral-800">
        {label}
        <span className="block text-[12px] font-normal text-neutral-500">
          Shares with all {count} of your groups
        </span>
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: value ? PURPLE : "#D9D6D1" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: value ? "1.375rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}


function MorningRitual({
  groupId,
  groups,
  switcher,
  onPosted,
}: {
  groupId: string | null;
  groups: { id: string; name: string }[];
  switcher: React.ReactNode;
  onPosted: () => void;
}) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [count, setCount] = useState(0);
  const [allGroups, setAllGroups] = useState(false);
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
    mutation.mutate({
      data: {
        text,
        groupId,
        groupIds: allGroups && groups.length > 1 ? groups.map((g) => g.id) : null,
      },
    });
  };

  const canPost = count > 0 && count <= MAX && !mutation.isPending;

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-32"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {switcher}

      <div className="px-6 pt-safe-4">
        <div className="text-[13px] font-bold" style={{ color: PURPLE }}>
          It's time for today's commitment
        </div>
        <h1 className="mt-2 text-[34px] font-black leading-tight tracking-tight">
          What are you committing to today?
        </h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          Make it specific. Check in while you're doing it, not after.
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
        <div className="mt-3">
          <AllGroupsToggle
            count={groups.length}
            value={allGroups}
            onChange={setAllGroups}
            label="Post to all my groups"
          />
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
          {mutation.isPending
            ? "Posting…"
            : (<>{allGroups && groups.length > 1 ? "Post to all groups" : "Post to group"} <ArrowRight size={18} /></>)}
        </button>
      </div>
    </div>
  );
}

// No separate mood screen: tapping check-in goes straight to the camera.
// The recorder owns camera startup. Requesting a second stream here can race
// with the recorder on iOS and leave both requests waiting indefinitely.
function CheckInLaunch() {
  const navigate = useNavigate();

  useEffect(() => {
    clearCheckInPhoto();
    clearCheckInStream();
    navigate({ to: "/check-in/camera", replace: true });
  }, [navigate]);

  return <div className="fixed inset-0 w-full" style={{ background: BG }} />;
}


