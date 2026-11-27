import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus } from "lucide-react";
import { getWorkoutDetail, type WorkoutDetail } from "@/lib/lifts.functions";
import { saveCrewWorkout } from "@/lib/workout-share.functions";
import { MY_WORKOUTS_KEY } from "@/lib/exercise-library";
import type { HealthWorkout } from "@/lib/health-workouts";
import { healthWorkoutName } from "@/lib/health-workouts";
import { hasWeightedExercise, healthSourceNote, healthTiles, sheetSetLine, showPrChip, type AttachedCard } from "@/lib/redesign-feed-view";
import { showSavedToast, showTopError } from "@/components/workout/savedToast";
import { ExerciseThumb } from "@/components/workout/WorkoutBits";
import { NewSheet } from "./NewSheet";
import { NewStatBox } from "./NewStatBox";
import { CrewAvatar, type RedesignCrewAvatarMember } from "./CrewAvatars";

const INK = "#141218";
const MUTED = "#57534E";
const NOTE = "#78716C";
const LINE = "#EFEAE4";

export type SheetAuthor = RedesignCrewAvatarMember & { firstName: string; when: string };

function AuthorRow({ author }: { author: SheetAuthor }) {
  return (
    <div className="flex items-center gap-2.5" style={{ marginBottom: 10 }}>
      <CrewAvatar member={author} size={32} />
      <span className="min-w-0 truncate text-[13px]" style={{ color: MUTED }}>
        <strong style={{ color: INK }}>{author.firstName}</strong> · {author.when}
      </span>
    </div>
  );
}

function Heading({ label, title, color }: { label: string; title: string; color: string }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold" style={{ letterSpacing: "0.6px", color }}>{label}</div>
      <div className="mt-0.5 text-[22px] font-extrabold leading-tight" style={{ color: INK }}>{title}</div>
    </div>
  );
}

function PrChip({ text }: { text: string }) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-extrabold" style={{ background: "#FEF3C7", color: "#A16207" }}>
      {text}
    </span>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="mt-2.5 h-12 w-full shrink-0 rounded-full bg-white text-[15px] font-bold" style={{ border: `1.5px solid ${LINE}`, color: INK }}>
      Close
    </button>
  );
}

/** Logged workout or plan day: tiles, exercise list (no weights), then Save / View plan / Close. */
export function RedesignWorkoutSheet({
  open,
  onOpenChange,
  checkInId,
  card,
  author,
  isMine,
  planSlug,
  detail,
  attachmentAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInId: string;
  /** Camera-roll posts pass their own sets-and-reps snapshot instead of a check-in. */
  detail?: WorkoutDetail;
  /** Camera-roll posts reuse the card save state inside their sheet. */
  attachmentAction?: ReactNode;
  card: AttachedCard;
  author: SheetAuthor | null;
  isMine: boolean;
  planSlug: string | null;
}) {
  const fetchFn = useServerFn(getWorkoutDetail);
  const saveFn = useServerFn(saveCrewWorkout);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const queryKey = ["workout-detail", checkInId];
  const fetched = useQuery({ queryKey, queryFn: () => fetchFn({ data: { checkInId } }), staleTime: 60_000, enabled: open && !detail });
  const data = detail ?? fetched.data;
  const isLoading = !detail && fetched.isLoading;
  const [saving, setSaving] = useState(false);
  const saved = !!data?.savedWorkoutId;
  const exercises = data?.exercises ?? [];
  const canSave = !detail && !isMine && card.kind === "workout" && !!data && !data.isMine && exercises.length > 0;
  const summary = data?.summary;
  const prSource = "check_in" as const;

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const res = await saveFn({ data: { checkInId } });
      qc.setQueryData<WorkoutDetail | null>(queryKey, (d) => (d ? { ...d, savedWorkoutId: res.workoutId } : d));
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      showSavedToast(res.name, "new");
    } catch (e) {
      console.error("[feed] save crew workout failed", e);
      showTopError("Couldn't save. Try again.", "new");
    } finally {
      setSaving(false);
    }
  };

  return (
    <NewSheet open={open} onOpenChange={onOpenChange} title={card.title} hideTitle compact description={`${card.label}: ${card.title}`}>
      <div className="flex flex-col" style={{ color: INK }}>
        {author && !isMine && <AuthorRow author={author} />}
        <Heading label={card.label} title={card.title} color="#7C3AED" />
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          <NewStatBox value={summary ? `${summary.minutes} min` : "–"} label="Time" />
          <NewStatBox value={summary ? String(summary.sets) : "–"} label="Sets" />
          <NewStatBox value={summary ? String(summary.exercises) : "–"} label="Exercises" />
        </div>
        {isLoading ? (
          <div className="mt-3.5 h-32 animate-pulse rounded-[16px]" style={{ background: "#F5F2EE" }} />
        ) : exercises.length > 0 ? (
          <ul className="mt-3.5 rounded-[16px]" style={{ border: `1.5px solid ${LINE}` }} aria-label="Exercises">
            {exercises.map((e, i) => (
              <li key={`${e.exerciseId}-${i}`} className="flex items-center gap-3 p-3" style={{ borderTop: i ? `1px solid ${LINE}` : undefined }}>
                <ExerciseThumb name={e.name} primary={[]} image={e.imageStart} size={44} radius={12} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{e.name}</div>
                  <div className="text-[13px]" style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{sheetSetLine(e.sets, e.logType)}</div>
                </div>
                {showPrChip(prSource, isMine) && e.sets.some((s) => s.isPr) && <PrChip text="🏆 PR" />}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4">
          {attachmentAction}
          {canSave && hasWeightedExercise(exercises) && (
            <p className="mb-2.5 text-center text-[12px]" style={{ color: NOTE }}>Your weights fill in from your own history.</p>
          )}
          {canSave && (saved ? (
            <button
              type="button"
              onClick={() => { onOpenChange(false); void navigate({ to: "/workouts" }); }}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold"
              style={{ background: "#EDE9FE", color: "#6D28D9" }}
            >
              <Check size={18} aria-hidden /> Saved · Open in Workouts
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold text-white disabled:opacity-70"
              style={{ background: "#7C3AED" }}
            >
              <Plus size={18} aria-hidden /> {saving ? "Saving…" : "Save to my workouts"}
            </button>
          ))}
          {card.kind === "plan" && planSlug && (
            <button
              type="button"
              onClick={() => { onOpenChange(false); void navigate({ to: "/plans/$slug", params: { slug: planSlug } }); }}
              className="flex h-[52px] w-full items-center justify-center rounded-full text-[16px] font-bold"
              style={{ background: "#EDE9FE", color: "#6D28D9" }}
            >
              View plan
            </button>
          )}
          <CloseButton onClose={() => onOpenChange(false)} />
        </div>
      </div>
    </NewSheet>
  );
}

/** Apple Health: tiles for the stats that exist, a source note, Close. Nothing to save. */
export function RedesignHealthSheet({
  open,
  onOpenChange,
  health,
  unit,
  author,
  isMine,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  health: HealthWorkout;
  unit: "mi" | "km";
  author: SheetAuthor | null;
  isMine: boolean;
}) {
  const title = healthWorkoutName(health.type);
  return (
    <NewSheet open={open} onOpenChange={onOpenChange} title={title} hideTitle compact description={`Apple Health: ${title}`}>
      <div className="flex flex-col" style={{ color: INK }}>
        {author && !isMine && <AuthorRow author={author} />}
        <Heading label="APPLE HEALTH" title={title} color="#E11D48" />
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {healthTiles(health, unit).map((t) => <NewStatBox key={t.label} value={t.value} label={t.label} />)}
        </div>
        <p className="mt-3.5 text-center text-[12px]" style={{ color: NOTE }}>{healthSourceNote(author?.firstName ?? "", isMine)}</p>
        <div className="mt-4"><CloseButton onClose={() => onOpenChange(false)} /></div>
      </div>
    </NewSheet>
  );
}
