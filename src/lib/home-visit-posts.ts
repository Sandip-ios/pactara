/** Memory only: show the just-created post on the next Home visit, never persist it. */
const pending = new Set<string>();
const listeners = new Set<() => void>();
export function markHomePost(id: string) {
  pending.add(id);
  listeners.forEach((fn) => fn());
}
export function subscribeHomePosts(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function consumeHomePosts() {
  const ids = [...pending];
  pending.clear();
  return ids;
}
