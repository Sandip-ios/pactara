/** Only a single active crew can be named as the check-in destination. */
export function createCheckInLabel(activeCrewCount: number | undefined, crewName: string): string {
  return activeCrewCount === 1 ? `Check in to ${crewName}` : "Check in";
}