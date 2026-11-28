/** A reaction is visible socially but can notify only another person's author. */
export function reactionNotifiesAuthor(actorId: string, authorId: string | null | undefined): boolean {
  return !!authorId && actorId !== authorId;
}