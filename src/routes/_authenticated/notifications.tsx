import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, Heart, MessageCircle, Sparkles, UserPlus, Zap } from "lucide-react";
import { listMyGroups } from "@/lib/groups.functions";
import {
  getNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/notifications.functions";
import { GroupSwitcherSheet } from "@/components/GroupSwitcherSheet";
import { PullToRefresh } from "@/components/PullToRefresh";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Pactara" },
      { name: "description", content: "Comments, reactions, check-ins and messages from your accountability groups." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function KindGlyph({ kind }: { kind: NotificationItem["kind"] }) {
  const map: Record<NotificationItem["kind"], { bg: string; icon: React.ReactNode }> = {
    comment: { bg: "#3B82F6", icon: <MessageCircle size={11} /> },
    reply: { bg: "#3B82F6", icon: <MessageCircle size={11} /> },
    comment_like: { bg: "#EF4444", icon: <Heart size={11} fill="currentColor" /> },
    reaction: { bg: "#F59E0B", icon: <Sparkles size={11} /> },
    message: { bg: PURPLE, icon: <MessageCircle size={11} /> },
    checkin: { bg: "#22C55E", icon: <Zap size={11} fill="currentColor" /> },
    join: { bg: "#0EA5E9", icon: <UserPlus size={11} /> },
  };
  const cfg = map[kind];
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full ring-2 ring-white flex items-center justify-center text-white"
      style={{ background: cfg.bg }}
    >
      {cfg.icon}
    </span>
  );
}

function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const { data: groupsData } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
    staleTime: 60_000,
  });
  const groups = groupsData?.groups ?? [];

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("active-group-id");
  });

  useEffect(() => {
    if (groups.length === 0) return;
    const exists = selectedGroupId && groups.some((g) => g.id === selectedGroupId);
    if (!exists) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  const selected = groups.find((g) => g.id === selectedGroupId) ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", selectedGroupId],
    queryFn: () => getNotifications({ data: { groupId: selectedGroupId as string } }),
    enabled: !!selectedGroupId,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const markRead = useMutation({
    mutationFn: (keys: string[]) => markNotificationsRead({ data: { keys } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notification-count"] });
    },
  });

  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recent = items.filter((i) => new Date(i.createdAt).getTime() >= sevenDaysAgo);
  const older = items.filter((i) => new Date(i.createdAt).getTime() < sevenDaysAgo);
  const unreadKeys = items.filter((i) => !i.read).map((i) => i.key);

  const open = (item: NotificationItem) => {
    if (!item.read) markRead.mutate([item.key]);
    if (item.kind === "message") {
      navigate({ to: "/chat/$groupId", params: { groupId: item.groupId } });
      return;
    }
    if (item.postId) {
      window.location.assign(`/home?post=${item.postId}&comments=1`);
      return;
    }
    navigate({ to: "/groups/$groupId", params: { groupId: item.groupId } });
  };

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28 bg-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white px-4 pt-safe-5 pb-3 border-b border-neutral-100 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/home" })}
          aria-label="Back"
          className="h-9 w-9 -ml-1 flex items-center justify-center rounded-full"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[20px] font-black tracking-tight leading-tight">Notifications</div>
          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-1 text-[13px] font-semibold text-neutral-500"
          >
            <span className="truncate max-w-[200px]">
              {selected ? `${selected.emoji} ${selected.name}` : "Select a group"}
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
        {unreadKeys.length > 0 && (
          <button
            onClick={() => markRead.mutate(unreadKeys)}
            className="rounded-full px-3 py-1.5 text-[12px] font-bold"
            style={{ background: PURPLE_SOFT, color: PURPLE }}
          >
            Mark all read
          </button>
        )}
      </header>

      <PullToRefresh
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["notifications"] })}
      >
        {isLoading && (
          <div className="px-6 py-16 text-center text-neutral-400 text-[14px]">Loading…</div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="px-6 py-20 text-center">
            <div className="text-[40px] mb-2">🔔</div>
            <div className="text-[16px] font-bold">Nothing yet</div>
            <div className="text-[14px] text-neutral-500 mt-1">
              Reactions, comments and check-ins from this group will show up here.
            </div>
          </div>
        )}

        <Section title="Last 7 days" items={recent} onOpen={open} />
        <Section title="Last 30 days" items={older} onOpen={open} />
      </PullToRefresh>

      <GroupSwitcherSheet
        open={switcherOpen}
        groups={groups}
        selectedId={selectedGroupId}
        onSelect={(id) => {
          setSelectedGroupId(id);
          if (typeof localStorage !== "undefined") localStorage.setItem("active-group-id", id);
          setSwitcherOpen(false);
        }}
        onClose={() => setSwitcherOpen(false)}
      />
    </div>
  );
}

function Section({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: NotificationItem[];
  onOpen: (item: NotificationItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="px-6 pt-6 pb-2 text-[16px] font-black tracking-tight">{title}</h2>
      <ul>
        {items.map((n) => (
          <li key={n.key}>
            <button
              onClick={() => onOpen(n)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-left ${
                n.read ? "" : "bg-[#FAF7FF]"
              }`}
            >
              <span className="relative shrink-0">
                <span
                  className="h-11 w-11 rounded-full overflow-hidden flex items-center justify-center text-white text-[15px] font-bold"
                  style={{ background: n.actorColor }}
                >
                  {n.actorAvatarUrl ? (
                    <img src={n.actorAvatarUrl} alt={n.actorName} className="h-full w-full object-cover" />
                  ) : (
                    (n.actorName || "?").charAt(0).toUpperCase()
                  )}
                </span>
                <KindGlyph kind={n.kind} />
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className={`block text-[14px] leading-snug ${
                    n.read ? "text-neutral-600" : "text-neutral-900 font-semibold"
                  }`}
                >
                  <span className="font-bold">{n.actorName}</span> {n.text}
                </span>
                <span className="block text-[12px] text-neutral-400 mt-0.5">
                  {timeAgo(n.createdAt)}
                </span>
              </span>
              {n.mediaUrl && (
                <span className="h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-neutral-100">
                  {n.mediaKind === "video" ? (
                    <video src={n.mediaUrl} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <img src={n.mediaUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
              )}
              {!n.read && (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PURPLE }} />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
