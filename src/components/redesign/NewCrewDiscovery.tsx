import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Lock } from "lucide-react";
import { toast } from "sonner";
import { getFindCrews, requestCrewJoin } from "@/lib/crew-join.functions";
import { filterDiscovery, type CrewWeekFilter, type DiscoveryCrew } from "@/lib/crew-join";
import { CrewAvatarOverlap, type RedesignCrewAvatarMember } from "./CrewAvatars";
import { NewSheet, NewSheetRow } from "./NewSheet";

const INK = "#1C1917";
const MUTED = "#57534E";
const SOFT = "#F4F2EF";
const LAV = "#EDE4FF";
const LAV_INK = "#6D28D9";

/** Discovery members carry only a first name and an avatar, so the stack keys off the crew. */
export const discoveryAvatars = (crew: DiscoveryCrew): RedesignCrewAvatarMember[] =>
  crew.members.map((m, i) => ({ id: `${crew.id}-${i}`, name: m.firstName, avatarUrl: m.avatarUrl, avatarColor: "" }));

const WEEKS: { value: CrewWeekFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6+", label: "6+" },
];

const pillStyle = { background: "#FFFFFF", border: "1px solid #E7E3DE", color: INK } as const;

export function NewCrewFindSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [week, setWeek] = useState<CrewWeekFilter>("any");
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["find-crews"], queryFn: () => getFindCrews(), staleTime: 30_000 });
  const ask = useServerFn(requestCrewJoin);
  const crews = filterDiscovery(data?.crews ?? [], week, open);

  const join = async (crew: DiscoveryCrew) => {
    setBusy(crew.id);
    try {
      await ask({ data: { groupId: crew.id } });
      toast.success(`Asked to join ${crew.name}.`);
      await queryClient.invalidateQueries({ queryKey: ["find-crews"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't ask right now. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="px-4 text-[20px] font-extrabold" style={{ color: INK }}>Find a crew</h2>
      <p className="mt-1 px-4 text-[14px] leading-[1.45]" style={{ color: MUTED }}>
        Anyone can find a crew. Only members see its check-ins, posts and chat.
      </p>

      <div className="mt-3 flex gap-2 px-4">
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold"
          style={pillStyle}
          aria-label="Filter by workouts a week"
        >
          {week === "any" ? "Workouts a week" : `${week} a week`}
          <ChevronDown size={16} className="!size-4 shrink-0" style={{ color: MUTED }} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-pressed={open}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold"
          style={open ? { background: LAV, border: `1px solid ${LAV}`, color: LAV_INK } : pillStyle}
        >
          Spots open
          <ChevronDown size={16} className="!size-4 shrink-0" style={{ color: open ? LAV_INK : MUTED }} aria-hidden />
        </button>
      </div>

      {isLoading && !data ? (
        <div className="mx-4 mt-3 h-[132px] animate-pulse rounded-[20px] bg-white" aria-label="Loading crews" />
      ) : crews.length ? (
        <div className="mt-3">
          {crews.map((crew) => {
            const full = crew.memberCount >= crew.limit;
            return (
              <div key={crew.id} className="mx-4 mb-2.5 rounded-[20px] bg-white p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigate({ to: "/crews/$groupId/preview", params: { groupId: crew.id } })}
                    aria-label={`Preview ${crew.name}`}
                  >
                    <h3 className="truncate text-[18px] font-extrabold" style={{ color: INK }}>{crew.name}</h3>
                    {crew.about ? (
                      <p className="mt-1 line-clamp-2 text-[14px] leading-[1.45]" style={{ color: MUTED }}>{crew.about}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold" style={{ background: SOFT, color: INK }}>
                        <Lock size={12} aria-hidden /> Private
                      </span>
                      <span className="flex h-7 items-center rounded-full px-2.5 text-[13px] font-bold" style={{ background: SOFT, color: INK }}>
                        {crew.daysPerWeek} days a week
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <CrewAvatarOverlap members={discoveryAvatars(crew)} size={28} />
                      <span className="min-w-0 text-[13px] leading-[1.35]" style={{ color: MUTED }}>
                        {crew.memberCount} of {crew.limit} spots · Started by {crew.ownerFirstName}
                      </span>
                    </div>
                  </button>
                  {full ? null : crew.requested ? (
                    <span className="flex h-10 shrink-0 items-center rounded-full px-3.5 text-[15px] font-bold" style={{ background: SOFT, color: MUTED }}>
                      Requested
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === crew.id}
                      onClick={() => void join(crew)}
                      className="flex h-10 shrink-0 items-center rounded-full px-3.5 text-[15px] font-bold disabled:opacity-60"
                      style={{ background: LAV, color: LAV_INK }}
                    >
                      {busy === crew.id ? "Asking…" : "Ask to join"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mx-4 mt-3 rounded-[20px] bg-white p-5">
          <p className="text-[15px] font-bold" style={{ color: INK }}>No crews to join yet.</p>
          <p className="mt-1 text-[14px] leading-[1.45]" style={{ color: MUTED }}>Start one and invite friends.</p>
        </div>
      )}

      <p className="px-5 pt-1 text-[13px] leading-[1.45]" style={{ color: MUTED }}>
        Ask to join and the person who runs the crew says yes.
      </p>

      <NewSheet open={picker} onOpenChange={setPicker} title="Workouts a week" subtitle="How often the crew wants its people in.">
        <div>
          {WEEKS.map((option) => (
            <NewSheetRow
              key={option.value}
              simple
              title={option.label}
              onClick={() => { setWeek(option.value); setPicker(false); }}
            />
          ))}
        </div>
      </NewSheet>
    </section>
  );
}
