import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { listMyGroups } from "@/lib/groups.functions";
import { getUnreadChatCounts } from "@/lib/chat.functions";
import { PullToRefresh } from "@/components/PullToRefresh";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatPage,
});

function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
  });
  const { data: unread } = useQuery({
    queryKey: ["unread-chat-counts"],
    queryFn: () => getUnreadChatCounts(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const groups = data?.groups ?? [];
  const counts = unread?.counts ?? {};

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28 bg-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white px-6 pt-5 pb-4 border-b border-neutral-100">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span>
          <span>actara</span>
        </div>
      </header>
      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0];
              return k === "my-groups" || k === "unread-chat-counts";
            },
          })
        }
      >


      <section className="px-6 pt-6 pb-4 border-b border-neutral-100">
        <h1 className="text-[28px] font-black tracking-tight">Messages</h1>
        <div className="text-[14px] text-neutral-500 mt-1">
          {isLoading ? " " : `${groups.length} ${groups.length === 1 ? "group" : "groups"}`}
        </div>
      </section>

      {!isLoading && groups.length === 0 && (
        <div className="px-6 py-16 text-center text-neutral-400 text-[14px]">
          You're not in any groups yet.
        </div>
      )}

      <ul>
        {groups.map((g) => {
          const n = counts[g.id] ?? 0;
          const hasUnread = n > 0;
          return (
            <li key={g.id} className="border-b border-neutral-100">
              <button
                onClick={() => navigate({ to: "/chat/$groupId", params: { groupId: g.id } })}
                className="w-full flex items-center gap-4 px-6 py-4 text-left"
              >
                <span
                  className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 relative"
                  style={{ background: PURPLE_SOFT }}
                >
                  <Users size={22} style={{ color: PURPLE }} />
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 text-[17px] text-neutral-900">
                    <span className="text-[18px]">{g.emoji}</span>
                    <span className={`truncate ${hasUnread ? "font-black" : "font-bold"}`}>{g.name}</span>
                  </span>
                  <span
                    className={`block text-[14px] truncate mt-0.5 ${
                      hasUnread ? "text-neutral-900 font-semibold" : "text-neutral-500"
                    }`}
                  >
                    {hasUnread
                      ? `${n} new ${n === 1 ? "message" : "messages"}`
                      : `${g.memberCount} ${g.memberCount === 1 ? "member" : "members"}`}
                  </span>
                </span>
                {hasUnread && (
                  <span
                    className="ml-2 min-w-[22px] h-[22px] px-1.5 rounded-full text-white text-[12px] font-bold flex items-center justify-center"
                    style={{ background: "#EF4444" }}
                  >
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      </PullToRefresh>
    </div>
  );
}
