export type StackMember = { id: string; name: string; avatarColor: string; avatarUrl: string | null };

/**
 * Up to three teammates' photos, overlapping, in a fixed 84px slot so every
 * crew name after it starts at the same x. A crew with nobody else shows its
 * emoji instead.
 */
export function CrewAvatarStack({ members, emoji, size = 34 }: { members: StackMember[]; emoji?: string | null; size?: number }) {
  const shown = members.slice(0, 3);
  return (
    <span className="flex w-[84px] shrink-0 items-center justify-start" aria-hidden>
      {shown.length === 0 ? (
        <span
          className="flex items-center justify-center rounded-full text-[18px]"
          style={{ width: size, height: size, background: "#EDE7FB" }}
        >
          {emoji || "👥"}
        </span>
      ) : (
        <span className="flex">
          {shown.map((m, i) => (
            <span
              key={m.id}
              className="flex items-center justify-center overflow-hidden rounded-full text-[13px] font-bold text-white ring-2 ring-white"
              style={{ width: size, height: size, background: m.avatarColor, marginLeft: i ? -12 : 0 }}
            >
              {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : (m.name || "?").charAt(0).toUpperCase()}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
