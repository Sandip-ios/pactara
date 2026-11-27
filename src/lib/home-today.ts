export type TodayCover = "rest" | "freeze";

export type TodayCrewInput = {
  id: string;
  name: string;
  checkedIn: boolean;
  cover: TodayCover | null;
  checkedInCount: number;
  dueCount: number;
};

export type TodayPlanInput = {
  slug: string;
  name: string;
  week: number;
  day: number;
  title: string;
  minutes: string;
  coverUrl: string | null;
  status: "not_started" | "in_progress" | "done" | "checked_in";
  elapsedMinutes: number;
};

export type TodayCrewState =
  | "empty"
  | "single-not-checked"
  | "single-checked"
  | "single-covered"
  | "multi-not-checked"
  | "multi-partial"
  | "multi-all-checked"
  | "multi-covered";

export type TodayPlanState = "none" | "not-started" | "in-progress" | "done" | "checked-in";

export type TodaySelection =
  | { card: "loading" }
  | { card: "error" }
  | {
      card: "ready";
      crew: TodayCrewState;
      cover: TodayCover | null;
      plan: TodayPlanState;
      checkedInCrewIds: string[];
      missingCrewIds: string[];
    };

/** Pure state selection for every new-version Home Today card. */
export function selectTodayState(input: {
  status: "loading" | "error" | "ready";
  crews: TodayCrewInput[];
  plan: TodayPlanInput | null;
}): TodaySelection {
  if (input.status === "loading") return { card: "loading" };
  if (input.status === "error") return { card: "error" };

  const { crews } = input;
  const checkedInCrewIds = crews.filter((crew) => crew.checkedIn).map((crew) => crew.id);
  const missingCrewIds = crews.filter((crew) => !crew.checkedIn && !crew.cover).map((crew) => crew.id);
  const covered = crews.filter((crew) => !crew.checkedIn && crew.cover);
  let crew: TodayCrewState;
  if (crews.length === 0) crew = "empty";
  else if (crews.length === 1) {
    const only = crews[0]!;
    crew = only.checkedIn ? "single-checked" : only.cover ? "single-covered" : "single-not-checked";
  } else if (checkedInCrewIds.length === crews.length) crew = "multi-all-checked";
  else if (checkedInCrewIds.length > 0) crew = "multi-partial";
  else if (covered.length === crews.length) crew = "multi-covered";
  else crew = "multi-not-checked";

  const cover = covered.some((item) => item.cover === "freeze") && covered.every((item) => item.cover === "freeze")
    ? "freeze"
    : covered.length
      ? "rest"
      : null;
  const resting = crew === "single-covered" || crew === "multi-covered";
  const plan: TodayPlanState = resting || !input.plan
    ? "none"
    : input.plan.status === "not_started"
      ? "not-started"
      : input.plan.status === "in_progress"
        ? "in-progress"
        : input.plan.status === "done"
          ? "done"
          : "checked-in";

  return { card: "ready", crew, cover, plan, checkedInCrewIds, missingCrewIds };
}
