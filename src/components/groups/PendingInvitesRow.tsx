import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { getSavedInvites, removeSavedInvite } from "@/lib/pending-invite";
import { getInviteGroup } from "@/lib/invite.functions";
import { PURPLE, PURPLE_SOFT } from "@/components/groups/AccountabilityBits";

type SavedInvite = { id: string; name: string; emoji: string };

/**
 * Invites the user tapped "Not now" on. Shown above their groups so there is
 * a way back in without hunting for the original text message. Any group they
 * have since joined is filtered out by the caller.
 */
export function PendingInvitesRow({ joinedIds }: { joinedIds: string[] }) {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<SavedInvite[]>([]);

  useEffect(() => {
    let cancelled = false;
    const ids = getSavedInvites().filter((id) => !joinedIds.includes(id));
    // Drop any invite for a group we already joined — nothing to offer there.
    getSavedInvites()
      .filter((id) => joinedIds.includes(id))
      .forEach(removeSavedInvite);
    if (ids.length === 0) {
      setInvites([]);
      return;
    }
    Promise.all(
      ids.map(async (id) => {
        try {
          const res = await getInviteGroup({ data: { groupId: id } });
          if (!res.group) {
            removeSavedInvite(id);
            return null;
          }
          return { id, name: res.group.name, emoji: res.group.emoji } as SavedInvite;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (!cancelled) setInvites(rows.filter((r): r is SavedInvite => !!r));
    });
    return () => {
      cancelled = true;
    };
  }, [joinedIds.join(",")]);

  if (invites.length === 0) return null;

  return (
    <div className="px-4 mt-4 space-y-2">
      <div className="text-[12px] font-bold tracking-wide text-neutral-500 px-1">PENDING INVITES</div>
      {invites.map((inv) => (
        <div
          key={inv.id}
          className="rounded-2xl bg-white px-4 py-3 flex items-center gap-3 shadow-sm"
          style={{ border: `1px solid ${PURPLE_SOFT}` }}
        >
          <span
            className="h-10 w-10 rounded-xl flex items-center justify-center text-[20px] shrink-0"
            style={{ background: PURPLE_SOFT }}
          >
            {inv.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold truncate">{inv.name}</div>
            <div className="text-[13px] text-neutral-500">You were invited to join</div>
          </div>
          <button
            onClick={() => navigate({ to: "/join/$groupId", params: { groupId: inv.id } })}
            className="px-4 py-2 rounded-xl text-white text-[14px] font-semibold"
            style={{ background: PURPLE }}
          >
            Join
          </button>
          <button
            aria-label="Dismiss invite"
            onClick={() => {
              removeSavedInvite(inv.id);
              setInvites((cur) => cur.filter((c) => c.id !== inv.id));
            }}
            className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-400"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
