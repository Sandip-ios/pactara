import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { listMyGroups } from "@/lib/groups.functions";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatPage,
});

function ChatPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
  });

  const groups = data?.groups ?? [];

  return (
    <div
      className="min-h-[100dvh] w-full pb-28 bg-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white px-6 pt-5 pb-4 border-b border-neutral-100">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span>
          <span>actara</span>
        </div>
      </header>

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
        {groups.map((g) => (
          <li key={g.id} className="border-b border-neutral-100">
            <button
              onClick={() => navigate({ to: "/chat/$groupId", params: { groupId: g.id } })}
              className="w-full flex items-center gap-4 px-6 py-4 text-left"
            >
              <span
                className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: PURPLE_SOFT }}
              >
                <Users size={22} style={{ color: PURPLE }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 text-[17px] font-bold text-neutral-900">
                  <span className="text-[18px]">{g.emoji}</span>
                  <span className="truncate">{g.name}</span>
                </span>
                <span className="block text-[14px] text-neutral-500 truncate mt-0.5">
                  {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
