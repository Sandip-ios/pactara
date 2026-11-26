/** Historical memberships stay; only crews without an ending timestamp are active. */
export function crewIsActive(crew: { ended_at: string | null }): boolean {
  return crew.ended_at === null;
}