import { cheeredByLine } from "./redesign-feed-view";

/** Keep the optimistic viewer reaction in the same wording as check-in cheers. */
export function socialCheerLine(reactors: { firstName: string; isMe: boolean }[], cheered: boolean): string | null {
  return cheeredByLine([
    ...reactors.filter((reactor) => !reactor.isMe),
    ...(cheered ? [{ firstName: "You", isMe: true }] : []),
  ]);
}