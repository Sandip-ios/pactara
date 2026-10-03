/**
 * Persists a failed check-in (note, activity, target groups, and the captured
 * photo/video blob) in IndexedDB so it survives app restarts on weak
 * connections. The in-memory photo store alone loses the media on reload.
 */

export type CheckInDraft = {
  note: string;
  activity: string | null;
  groupId: string | null;
  allGroups: boolean;
  blob: Blob | null;
  isVideo: boolean;
  savedAt: number;
};

const DB_NAME = "pactara-checkin-drafts";
const STORE = "drafts";
const KEY = "current";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Ask the OS to keep this data (best effort; ignored where unsupported). */
function requestPersistence() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* noop */
  }
}

export async function saveCheckInDraft(draft: Omit<CheckInDraft, "savedAt">): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  requestPersistence();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ ...draft, savedAt: Date.now() }, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function loadCheckInDraft(): Promise<CheckInDraft | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        const draft = req.result as CheckInDraft | undefined;
        if (!draft) return resolve(null);
        // Drop stale drafts — a week-old check-in is no longer "today's".
        if (!draft.savedAt || Date.now() - draft.savedAt > MAX_AGE_MS) {
          void clearCheckInDraft();
          return resolve(null);
        }
        resolve(draft);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearCheckInDraft(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
