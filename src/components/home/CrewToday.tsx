import { Check, Plus } from "lucide-react";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { MemberPhoto } from "@/components/MemberPhoto";
import { LiveDot, NudgeButton } from "@/components/groups/AccountabilityBits";
import type { HomeCrewMember } from "@/lib/home-crew.functions";
import type { CrewDayState, CrewTodayStatus } from "@/lib/crew-today";

const PURPLE = "#7C3AED";
const GREEN = "#16A34A";
const REST = "#A78BFA";

const DOT: Record<CrewDayState, string> = {
  checked: GREEN,
  rest: REST,
  missed: "#DC2626",
  none: "#D6D3D1",
};

function ringStyle(status: CrewTodayStatus): React.CSSProperties {
  switch (status) {
    case "done":
      return { border: `3px solid ${GREEN}` };
    case "working_out":
      return { border: `3px solid ${PURPLE}` };
    case "rest":
      return { border: `3px solid ${REST}` };
    default:
      return { border: "3px dashed #A8A29E" };
  }
}

const ringLabel: Record<CrewTodayStatus, string> = {
  done: "checked in today",
  working_out: "working out now",
  rest: "rest day today",
  not_yet: "not checked in yet",
};

function MemberColumn({
  member,
  groupId,
  compact,
}: {
  member: HomeCrewMember;
  groupId: string;
  /** 5-member crews: smaller avatar and nudge pill so the column fits. */
  compact: boolean;
}) {
  const name = member.isYou ? "You" : member.firstName;
  const onGoal = member.workouts >= member.target;
  return (
    <li className="flex min-w-0 flex-col items-center gap-1.5">
      <MemberProfileLink
        userId={member.userId}
        isYou={member.isYou}
        className="relative block rounded-full p-[3px] active:opacity-80"
      >
        <span className="sr-only">{`${member.isYou ? "Your" : `${member.firstName}'s`} profile, ${ringLabel[member.status]}`}</span>
        <span className="absolute inset-0 rounded-full" style={ringStyle(member.status)} aria-hidden />
        <span
          className={`relative m-[2px] flex items-center justify-center overflow-hidden rounded-full font-bold text-white ${
            compact ? "h-12 w-12 text-[17px]" : "h-16 w-16 text-[22px]"
          }`}
          style={{ background: member.avatarColor }}
          aria-hidden
        >
          <MemberPhoto src={member.avatarUrl} name={member.name || "U"} />
        </span>
        {member.status === "working_out" && (
          <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white" aria-hidden>
            <LiveDot size={8} />
          </span>
        )}
      </MemberProfileLink>
      <span className="max-w-full truncate text-[13px] font-semibold text-neutral-900">{name}</span>
      <span className="text-[12px] font-bold" style={{ color: onGoal ? "#15803D" : "#57534E" }}>
        {member.workouts} of {member.target}
      </span>
      <span className="flex items-center gap-[3px]" role="img" aria-label={member.weekLabel}>
        {member.days.map((d) => (
          <span key={d.date} className="h-1.5 w-1.5 rounded-full" style={{ background: DOT[d.state] }} />
        ))}
      </span>
      <div className="flex h-8 items-center justify-center">
        {member.status === "done" ? (
          <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "#15803D" }}>
            <Check size={14} strokeWidth={3} />
            {member.activityLabel ?? "Done"}
          </span>
        ) : member.status === "working_out" ? (
          <span className="flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold" style={{ color: PURPLE }}>
            <LiveDot size={7} />
            Working out
          </span>
        ) : member.status === "rest" ? (
          <span className="text-[12px] font-semibold" style={{ color: "#7C5CD6" }}>
            Rest day
          </span>
        ) : member.isYou ? (
          <span className="text-[12px] font-semibold text-neutral-500">Your turn</span>
        ) : (
          <NudgeButton
            groupId={groupId}
            member={{ userId: member.userId, firstName: member.firstName }}
            variant="pill"
            compact={compact}
            initialSent={member.nudgedToday}
          />
        )}
      </div>
    </li>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/** "Crew today": everyone's ring, weekly tally and Mon–Sun dots, with nudges. */
export function CrewToday({
  groupId,
  members,
  solo,
  onInvite,
}: {
  groupId: string;
  members: HomeCrewMember[];
  solo: boolean;
  onInvite: () => void;
}) {
  const shown = solo ? members.filter((m) => m.isYou) : members;
  const columns = shown.length + (solo ? 1 : 0);
  const compact = shown.length >= 5;
  return (
    <section className="mx-4 mt-4 rounded-[20px] bg-white p-4 shadow-sm" aria-label="Crew today">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-bold text-neutral-900">Crew today</h2>
        <span className="text-[13px] text-neutral-500">Day closes 11:59 pm your time</span>
      </div>
      <ul className="mt-4 grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {shown.map((m) => (
          <MemberColumn key={m.userId} member={m} groupId={groupId} compact={compact} />
        ))}
        {solo && (
          <li className="flex min-w-0 flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onInvite}
              aria-label="Invite someone to this crew"
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full active:opacity-70"
              style={{ border: "3px dashed #A8A29E", color: "#57534E" }}
            >
              <Plus size={26} />
            </button>
            <span className="text-[13px] font-semibold text-neutral-900">Invite</span>
          </li>
        )}
      </ul>
      <div className="mt-3 flex items-center justify-center gap-4 text-[12px] text-neutral-500">
        <LegendDot color={GREEN} label="Worked out" />
        <LegendDot color={REST} label="Rest day" />
        <LegendDot color="#D6D3D1" label="Not yet" />
      </div>
    </section>
  );
}

export function CrewTodaySkeleton() {
  return (
    <section className="mx-4 mt-4 rounded-[20px] bg-white p-4 shadow-sm" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-40 animate-pulse rounded-md bg-neutral-200" />
      </div>
      <div className="mt-4 grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-w-0 flex-col items-center gap-1.5">
            <div className="h-[76px] w-[76px] animate-pulse rounded-full bg-neutral-200" />
            <div className="h-4 w-12 animate-pulse rounded bg-neutral-200" />
            <div className="h-3.5 w-10 animate-pulse rounded bg-neutral-200" />
            <div className="h-1.5 w-[60px] animate-pulse rounded-full bg-neutral-200" />
            <div className="h-8" />
          </div>
        ))}
      </div>
      <div className="mx-auto mt-3 h-4 w-56 animate-pulse rounded bg-neutral-200" />
    </section>
  );
}
