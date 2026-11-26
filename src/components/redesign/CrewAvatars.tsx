import { UserRound } from "lucide-react";

/** Shared no-photo fallback for the redesign: light purple disc, near-white silhouette. */
const FALLBACK_BG = "#E4DAFB";
const FALLBACK_FG = "#F8F5FF";

export type RedesignCrewAvatarMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
};

export function CrewAvatar({ member, size, ring = false }: { member: RedesignCrewAvatarMember; size: number; ring?: boolean }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: member.avatarUrl ? member.avatarColor : FALLBACK_BG,
        border: ring ? "2px solid #FFFFFF" : undefined,
        color: FALLBACK_FG,
      }}
      aria-hidden
    >
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <UserRound size={Math.round(size * 0.54)} strokeWidth={2.2} />
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
