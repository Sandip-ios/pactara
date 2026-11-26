import { NewAvatarFallback } from "./NewAvatarFallback";

export type RedesignCrewAvatarMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
};

export function CrewAvatar({ member, size, ring = false }: { member: RedesignCrewAvatarMember; size: number; ring?: boolean }) {
  return (
    <span
      className={`new-crew-avatar flex shrink-0 items-center justify-center overflow-hidden rounded-full${ring ? " new-crew-avatar-ring" : ""}`}
      style={{
        width: size,
        height: size,
        background: member.avatarUrl ? member.avatarColor : "var(--new-profile-avatar-bg)",
      }}
      aria-hidden
    >
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <NewAvatarFallback />
      )}
    </span>
  );
}

export function CrewAvatarOverlap({ members, size, limit = 4 }: { members: RedesignCrewAvatarMember[]; size: number; limit?: number }) {
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {members.slice(0, limit).map((member, index) => (
        <span key={member.id} style={{ marginLeft: index ? -10 : 0, zIndex: limit - index }}>
          <CrewAvatar member={member} size={size} ring />
        </span>
      ))}
    </span>
  );
}
