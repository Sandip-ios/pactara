/** Memory only: show the just-created post on the next Home visit, never persist it. */
const pending = new Set<string>();
export function markHomePost(id: string) { pending.add(id); }
export function consumeHomePosts() { const ids = [...pending]; pending.clear(); return ids; }
