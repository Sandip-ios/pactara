import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ListChecks, X, Circle, CheckCircle2 } from "lucide-react";

const PURPLE = "#7C3AED";
const ORANGE = "#F59E0B";

type TaskId = "checkin" | "comment" | "chat" | "streak";

type Task = {
  id: TaskId;
  title: string;
  desc: string;
  cta?: { label: string; to: string };
};

const TASKS: Task[] = [
  {
    id: "checkin",
    title: "Log your first check-in",
    desc: "Show up for Day 1. Your group is watching.",
  },
  {
    id: "comment",
    title: "Comment on a teammate's post",
    desc: "Leave a comment on someone's check-in — it keeps the group going.",
    cta: { label: "Go to feed", to: "/home" },
  },
  {
    id: "chat",
    title: "Say hi in the group chat",
    desc: 'Drop a message. Even just "Let\'s go" counts.',
    cta: { label: "Open chat", to: "/groups" },
  },
  {
    id: "streak",
    title: "Build a 3-day streak",
    desc: "Check in 3 days in a row. That's when it becomes a habit.",
  },
];

const STORAGE_KEY = "getting-started-done";
const DISMISS_KEY = "getting-started-dismissed";

function readDone(): Set<TaskId> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as TaskId[]);
  } catch {
    return new Set();
  }
}

function writeDone(done: Set<TaskId>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
}

export function GettingStarted({ iCheckedIn }: { iCheckedIn: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Set<TaskId>>(() => new Set());

  useEffect(() => {
    setDone(readDone());
  }, []);

  // Sync check-in status from server state
  useEffect(() => {
    if (iCheckedIn) {
      setDone((prev) => {
        if (prev.has("checkin")) return prev;
        const next = new Set(prev);
        next.add("checkin");
        writeDone(next);
        return next;
      });
    }
  }, [iCheckedIn]);

  const total = TASKS.length;
  const doneCount = done.size;

  if (doneCount === total) return null;

  const toggle = (id: TaskId) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeDone(next);
      return next;
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 z-30 flex items-center gap-2 rounded-full pl-4 pr-2 py-2.5 text-white font-semibold"
        style={{
          background: ORANGE,
          bottom: "102px",
        }}
        aria-label="Getting started"
      >
        <ListChecks size={18} />
        <span className="text-[14px]">Getting started</span>
        <span className="ml-1 rounded-full bg-black/15 px-2 py-0.5 text-[12px] font-bold">
          {doneCount}/{total}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div
            className="relative w-full rounded-t-3xl bg-[#FFF7E6] pt-3 pb-8 max-h-[85dvh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-300" />

            <div className="flex items-start justify-between px-6 pt-4">
              <div className="flex items-center gap-3">
                <ListChecks size={22} style={{ color: ORANGE }} />
                <div>
                  <div className="text-[18px] font-bold tracking-tight">Getting started</div>
                  <div className="text-[13px] text-neutral-500">
                    {doneCount}/{total} done · 13 days left
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1.5 rounded-full bg-orange-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(doneCount / total) * 100}%`, background: ORANGE }}
                  />
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-neutral-500"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="mt-4 divide-y divide-orange-100 bg-white/60">
              {TASKS.map((t) => {
                const isDone = done.has(t.id);
                return (
                  <div key={t.id} className="px-6 py-4 flex items-start gap-3">
                    <button
                      onClick={() => toggle(t.id)}
                      className="mt-0.5 shrink-0"
                      aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                    >
                      {isDone ? (
                        <CheckCircle2 size={24} style={{ color: PURPLE }} />
                      ) : (
                        <Circle size={24} className="text-purple-300" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div
                        className={`text-[16px] font-bold tracking-tight ${
                          isDone ? "text-neutral-400 line-through" : "text-neutral-900"
                        }`}
                      >
                        {t.title}
                      </div>
                      <div className="text-[13px] text-neutral-500 mt-0.5">{t.desc}</div>
                    </div>
                    {t.cta && !isDone && (
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate({ to: t.cta!.to });
                        }}
                        className="shrink-0 rounded-full px-4 py-2 text-white text-[13px] font-semibold"
                        style={{ background: PURPLE }}
                      >
                        {t.cta.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
