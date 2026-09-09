import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Image as ImageIcon, Send, MessageSquareMore, X, Loader2, Plus } from "lucide-react";
import { getGroupChat, sendGroupMessage, markGroupRead, toggleMessageReaction } from "@/lib/chat.functions";
import { clearBadge } from "@/lib/badge-client";
import { supabase } from "@/integrations/supabase/client";
import EmojiPickerSheet from "@/components/EmojiPickerSheet";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const BG = "#F5F2EE";
const BUCKET = "chat-photos";
const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

export const Route = createFileRoute("/_authenticated/chat/$groupId")({
  component: GroupChatPage,
});

function GroupChatPage() {
  const { groupId } = useParams({ from: "/_authenticated/chat/$groupId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const longPress = useRef<number | null>(null);

  function cancelLongPress() {
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
  }

  const { data } = useQuery({
    queryKey: ["group-chat", groupId],
    queryFn: () => getGroupChat({ data: { groupId } }),
  });

  const send = useMutation({
    mutationFn: ({ body, imageUrl }: { body: string; imageUrl?: string }) =>
      sendGroupMessage({ data: { groupId, body, imageUrl } }),
    onSuccess: () => {
      setText("");
      clearPending();
      queryClient.invalidateQueries({ queryKey: ["group-chat", groupId] });
      inputRef.current?.focus();
    },
    onError: (e: Error) => setError(e.message),
  });

  const react = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      toggleMessageReaction({ data: { messageId, emoji } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group-chat", groupId] }),
  });

  function onReact(messageId: string, emoji: string) {
    setPickerFor(null);
    queryClient.setQueryData(["group-chat", groupId], (prev: typeof data) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) => {
          if (m.id !== messageId) return m;
          const list = m.reactions.map((r) => ({ ...r }));
          const found = list.find((r) => r.emoji === emoji);
          if (found) {
            found.count += found.mine ? -1 : 1;
            found.mine = !found.mine;
          } else {
            list.push({ emoji, count: 1, mine: true });
          }
          return { ...m, reactions: list.filter((r) => r.count > 0) };
        }),
      };
    });
    react.mutate({ messageId, emoji });
  }

  function clearPending() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
  }

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        () => queryClient.invalidateQueries({ queryKey: ["group-chat", groupId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => queryClient.invalidateQueries({ queryKey: ["group-chat", groupId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  // Mark group as read whenever new messages arrive while viewing it
  useEffect(() => {
    if (!data) return;
    // Optimistically clear the badge for this group right away
    queryClient.setQueryData(
      ["unread-chat-counts"],
      (prev: { counts: Record<string, number>; total: number } | undefined) => {
        if (!prev) return prev;
        const n = prev.counts[groupId] ?? 0;
        if (n === 0) return prev;
        // Opening the thread is the interaction: drop those from the app badge.
        void clearBadge(n).catch(() => {});
        return {
          counts: { ...prev.counts, [groupId]: 0 },
          total: Math.max(0, prev.total - n),
        };
      },
    );
    markGroupRead({ data: { groupId } })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread-chat-counts"] });
      })
      .catch(() => {});
  }, [groupId, data?.messages.length, queryClient, data]);

  // Mark read again on leaving the conversation
  useEffect(() => {
    return () => {
      markGroupRead({ data: { groupId } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["unread-chat-counts"] });
          queryClient.invalidateQueries({ queryKey: ["my-groups"] });
        })
        .catch(() => {});
    };
  }, [groupId, queryClient]);


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.messages.length]);

  const group = data?.group;
  const messages = data?.messages ?? [];
  const currentUserId = data?.currentUserId;
  const members = data?.members ?? [];


  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB");
      return;
    }
    setError(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (send.isPending || uploading) return;
    if (!body && !pendingFile) return;

    let imageUrl: string | undefined;
    if (pendingFile && currentUserId) {
      setUploading(true);
      setError(null);
      try {
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${groupId}/${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, pendingFile, { contentType: pendingFile.type, upsert: false });
        if (upErr) throw upErr;
        imageUrl = path;
      } catch (err) {
        setError((err as Error).message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    send.mutate({ body, imageUrl });
  };

  return (
    <div
      className="fixed inset-0 flex flex-col bg-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white px-6 pt-safe-5 pb-4 border-b border-neutral-100 shrink-0">
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[17px] font-bold">
            <span>{group?.emoji ?? "💬"}</span>
            <span className="truncate">{group?.name ?? " "}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {members.length > 0 && (
              <div className="flex -space-x-2">
                {members.slice(0, 5).map((m) => (
                  <span
                    key={m.id}
                    title={m.name}
                    className="h-6 w-6 rounded-full ring-2 ring-white overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: m.avatarColor }}
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      (m.name?.[0] ?? "?").toUpperCase()
                    )}
                  </span>
                ))}
                {members.length > 5 && (
                  <span className="h-6 w-6 rounded-full ring-2 ring-white bg-neutral-200 text-neutral-600 text-[10px] font-bold flex items-center justify-center">
                    +{members.length - 5}
                  </span>
                )}
              </div>
            )}
            <span className="text-[12px] text-neutral-500 truncate">
              {members.length > 0 ? `${members.length} members` : ""}
            </span>
          </div>
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
          <ul className="space-y-3 select-none">
            {messages.map((m) => {
              const mine = m.userId === currentUserId;
              const initial = (m.authorName || "U").slice(0, 1).toUpperCase();
              return (
                <li key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && (
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0 self-end overflow-hidden"
                      style={{ background: m.authorColor }}
                    >
                      {m.authorAvatarUrl ? (
                        <img
                          src={m.authorAvatarUrl}
                          alt={m.authorName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initial
                      )}
                    </div>
                  )}

                  <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                    {!mine && (
                      <span className="text-[11px] text-neutral-500 ml-2 mb-0.5">{m.authorName}</span>
                    )}

                    {pickerFor === m.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative z-[90] mb-1 flex items-center gap-1 rounded-full bg-white shadow-xl px-2.5 py-2"
                      >
                        {QUICK_EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            aria-label={`React ${e}`}
                            onClick={() => onReact(m.id, e)}
                            className="text-[26px] leading-none px-0.5 active:scale-90 transition-transform"
                          >
                            {e}
                          </button>
                        ))}
                        <button
                          type="button"
                          aria-label="More emojis"
                          onClick={() => setSheetFor(m.id)}
                          className="ml-1 h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <Plus size={18} className="text-neutral-600" />
                        </button>
                      </div>
                    )}

                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setPickerFor((cur) => (cur === m.id ? null : m.id));
                      }}
                      onPointerDown={() => {
                        longPress.current = window.setTimeout(
                          () => setPickerFor((cur) => (cur === m.id ? null : m.id)),
                          400,
                        );
                      }}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      className="select-none"
                    >
                      {m.imageUrl && (
                        <SignedImage path={m.imageUrl} className="mb-1 max-w-full rounded-2xl" />
                      )}
                      {m.body && (
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-[15px] leading-snug whitespace-pre-wrap break-words ${
                            mine ? "rounded-br-md text-white" : "rounded-bl-md bg-white text-neutral-900"
                          }`}
                          style={mine ? { background: PURPLE } : undefined}
                        >
                          {m.body}
                        </div>
                      )}
                    </div>

                    {m.reactions.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : ""}`}>
                        {m.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => onReact(m.id, r.emoji)}
                            className="flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[12px]"
                            style={{
                              borderColor: r.mine ? PURPLE : "#E5E5E5",
                              color: r.mine ? PURPLE : "#525252",
                            }}
                          >
                            <span className="text-[13px]">{r.emoji}</span>
                            <span className="font-semibold">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <span className={`text-[11px] text-neutral-400 mt-1 ${mine ? "mr-2" : "ml-2"}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pickerFor && !sheetFor && (
        <button
          aria-label="Dismiss reactions"
          onClick={() => setPickerFor(null)}
          className="fixed inset-0 z-[85] cursor-default"
        />
      )}

      <EmojiPickerSheet
        open={!!sheetFor}
        onClose={() => {
          setSheetFor(null);
          setPickerFor(null);
        }}
        onSelect={(emoji) => {
          if (sheetFor) onReact(sheetFor, emoji);
          setSheetFor(null);
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="shrink-0 bg-white border-t border-neutral-100 px-3 py-3"
        style={{ paddingBottom: "12px" }}
      >
        {pendingPreview && (
          <div className="mb-2 relative inline-block">
            <img src={pendingPreview} alt="Selected" className="h-24 rounded-lg object-cover" />
            <button
              type="button"
              onClick={clearPending}
              aria-label="Remove image"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-neutral-900 text-white flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {error && (
          <div className="mb-2 text-[12px] text-red-500">{error}</div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Add photo"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0"
          >
            <ImageIcon size={20} className="text-neutral-500" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message your group..."
            className="flex-1 h-11 rounded-full bg-neutral-100 px-4 text-[15px] outline-none placeholder:text-neutral-400"
          />
          <button
            type="submit"
            disabled={(!text.trim() && !pendingFile) || send.isPending || uploading}
            aria-label="Send"
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50"
            style={{ background: (text.trim() || pendingFile) ? PURPLE : "#E5E5E5" }}
          >
            {uploading || send.isPending ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <Send size={18} className={(text.trim() || pendingFile) ? "text-white" : "text-neutral-400"} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function SignedImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) {
    return <div className={`bg-neutral-200 animate-pulse h-40 w-40 rounded-2xl ${className ?? ""}`} />;
  }
  return <img src={url} alt="" className={className} />;
}
