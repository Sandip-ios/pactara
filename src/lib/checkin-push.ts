import { activityParts } from "./feed-view";

/**
 * Wording for the "someone checked in" push: title "{First name} · {Crew name}",
 * body "Checked in" plus the activity when tagged ("Checked in: Workout 💪").
 */
export function checkInPushText(
  name: string,
  crewName: string | null | undefined,
  activity: string | null | undefined,
): { title: string; body: string } {
  const first = name.trim().split(/\s+/)[0] || "Someone";
  const crew = (crewName ?? "").trim();
  const a = activityParts(activity);
  return {
    title: crew ? `${first} · ${crew}` : first,
    body: a ? `Checked in: ${a.emoji ? `${a.label} ${a.emoji}` : a.label}` : "Checked in",
  };
}
