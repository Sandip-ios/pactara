const KEY = "pending-invite-group";

/**
 * Pending group invite persistence.
 *
 * Uses localStorage (not sessionStorage) so the invite survives an app
 * relaunch — e.g. the user taps the invite link, installs the app from the
 * App Store, and opens it later.
 */
export function setPendingInvite(groupId: string) {
  try {
    localStorage.setItem(KEY, groupId);
    sessionStorage.setItem(KEY, groupId);
  } catch {
    // storage unavailable
  }
}

export function getPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Extracts a group id from a Pactara invite URL, if the string is one. */
export function parseInviteUrl(value: string): string | null {
  const match = value.match(/pactara[^\s]*\/join\/([0-9a-fA-F-]{36})/);
  return match ? match[1] : null;
}
