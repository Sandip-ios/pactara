import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Image as ImageIcon, Send, MessageSquareMore, Users, X, Loader2 } from "lucide-react";
import { getGroupChat, sendGroupMessage, markGroupRead } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const BG = "#F5F2EE";
const BUCKET = "chat-photos";

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
