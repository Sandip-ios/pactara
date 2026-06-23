import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Image as ImageIcon, Send, MessageSquareMore, Users } from "lucide-react";
import { getGroupChat, sendGroupMessage } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const BG = "#F5F2EE";

export const Route = createFileRoute("/_authenticated/chat/$groupId")({
  component: GroupChatPage,
});

function GroupChatPage() {
  const { groupId } = useParams({ from: "/_authenticated/chat/$groupId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");

  const { data } = useQuery({
    queryKey: ["group-chat", groupId],
    queryFn: () => getGroupChat({ data: { groupId } }),
  });

  const send = useMutation({
    mutationFn: (body: string) => sendGroupMessage({ data: { groupId, body } }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["group-chat", groupId] });
      inputRef.current?.focus();
    },
  });

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        () => queryClient.invalidateQueries({ queryKey: ["group-chat", groupId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.messages.length]);

  const group = data?.group;
  const messages = data?.messages ?? [];
  const currentUserId = data?.currentUserId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || send.isPending) return;
    send.mutate(t);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col bg-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white px-6 pt-5 pb-4 border-b border-neutral-100 shrink-0">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span>
          <span>actara</span>
        </div>
      </header>

      <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate({ to: "/chat" })}
          aria-label="Back"
          className="h-10 w-10 rounded-xl bg-neutral-100 flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-neutral-700" />
        </button>
        <span
          className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: PURPLE_SOFT }}
        >
          <Users size={20} style={{ color: PURPLE }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[17px] font-bold truncate">
            <span>{group?.emoji ?? "💬"}</span>
            <span className="truncate">{group?.name ?? " "}</span>
          </div>
          <div className="text-[13px] text-neutral-500 truncate">{group?.name ?? ""}</div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-none px-4 py-4"
        style={{ background: BG }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 -mt-16">
            <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
              <MessageSquareMore size={28} className="text-neutral-400" />
            </div>
            <div className="text-[20px] font-bold">No messages yet</div>
            <div className="text-[14px] text-neutral-500 mt-1 text-center">
              Be the first to say something to {group?.emoji} {group?.name}!
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = m.userId === currentUserId;
              const initial = (m.authorName || "U").slice(0, 1).toUpperCase();
              return (
                <li key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && (
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0 self-end"
                      style={{ background: m.authorColor }}
                    >
                      {initial}
                    </div>
                  )}
                  <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                    {!mine && (
                      <span className="text-[11px] text-neutral-500 ml-2 mb-0.5">{m.authorName}</span>
                    )}
                    <div
                      className={`px-3.5 py-2 rounded-2xl text-[15px] leading-snug whitespace-pre-wrap break-words ${
                        mine ? "rounded-br-md text-white" : "rounded-bl-md bg-white text-neutral-900"
                      }`}
                      style={mine ? { background: PURPLE } : undefined}
                    >
                      {m.body}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 bg-white border-t border-neutral-100 px-3 py-3 flex items-center gap-2"
        style={{ paddingBottom: "12px" }}
      >
        <button
          type="button"
          aria-label="Add photo"
          className="h-10 w-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0"
        >
          <ImageIcon size={20} className="text-neutral-500" />
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your group..."
          className="flex-1 h-11 rounded-full bg-neutral-100 px-4 text-[15px] outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          aria-label="Send"
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50"
          style={{ background: text.trim() ? PURPLE : "#E5E5E5" }}
        >
          <Send size={18} className={text.trim() ? "text-white" : "text-neutral-400"} />
        </button>
      </form>
    </div>
  );
}
